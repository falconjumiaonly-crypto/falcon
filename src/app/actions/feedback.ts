"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CustomerFeedbackSubmission,
  CustomerFeedbackRecord,
  FeedbackAnalytics,
  FEEDBACK_APP_SETTING_KEY,
  evaluateFeedbackUrgency,
  computeFeedbackAnalytics,
} from "@/lib/feedback/customerFeedbackEngine";
import { recordBatchOrderAuditAction } from "@/app/actions/audit";

export interface FeedbackActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Public action: Fetches lightweight order details for customer feedback page
 */
export async function getOrderForFeedbackAction(orderId: string): Promise<FeedbackActionResult<{
  id: string;
  customerName: string;
  governorate: string;
  carrierName: string;
  deliveryStatus: string;
}>> {
  try {
    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer_name, governorate, delivery_status, important_notes")
      .eq("id", orderId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !order) {
      return { success: false, error: "لم يتم العثور على هذا الطلب" };
    }

    const orderData = order as any;
    let carrier = "بوسطة (Bosta)";
    if (orderData.important_notes?.includes("جي آند تي") || orderData.important_notes?.includes("J&T")) {
      carrier = "جي آند تي (J&T Express)";
    } else if (orderData.important_notes?.includes("أرامكس") || orderData.important_notes?.includes("Aramex")) {
      carrier = "أرامكس (Aramex)";
    }

    return {
      success: true,
      data: {
        id: orderData.id,
        customerName: orderData.customer_name,
        governorate: orderData.governorate,
        carrierName: carrier,
        deliveryStatus: orderData.delivery_status,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "حدث خطأ أثناء جلب بيانات الطلب" };
  }
}

/**
 * Public action: Submits customer ratings and comments
 */
export async function submitCustomerFeedbackAction(
  submission: CustomerFeedbackSubmission
): Promise<FeedbackActionResult<{ feedbackId: string; discountCode: string }>> {
  try {
    if (!submission.orderId) {
      return { success: false, error: "كود الطلب مطلوب" };
    }

    const overall = Math.min(5, Math.max(1, Number(submission.overallRating) || 5));
    const product = Math.min(5, Math.max(1, Number(submission.ratingProduct) || 5));
    const courier = Math.min(5, Math.max(1, Number(submission.ratingCourier) || 5));
    const urgency = evaluateFeedbackUrgency(overall);

    const feedbackRecord: CustomerFeedbackRecord = {
      ...submission,
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ratingProduct: product,
      ratingCourier: courier,
      overallRating: overall,
      createdAt: new Date().toISOString(),
      isComplaint: urgency.isComplaint,
      isResolved: false,
    };

    const supabase = await createClient();

    // Fetch existing records from app_settings
    const { data: settingData } = await (supabase.from("app_settings") as any)
      .select("value")
      .eq("key", FEEDBACK_APP_SETTING_KEY)
      .maybeSingle();

    const existingList: CustomerFeedbackRecord[] = Array.isArray(settingData?.value)
      ? settingData.value
      : [];

    const updatedList = [feedbackRecord, ...existingList];

    // Save back to app_settings
    await (supabase.from("app_settings") as any).upsert({
      key: FEEDBACK_APP_SETTING_KEY,
      value: updatedList,
      updated_at: new Date().toISOString(),
    });

    // If complaint (<= 2 stars), record audit log for merchant awareness
    if (urgency.isComplaint) {
      await recordBatchOrderAuditAction(
        [submission.orderId],
        "order_edited",
        "تنبيه: شكوى عميل بعد الاستلام",
        `سجل العميل تقييماً منخفضاً (${overall}/5 نجوم): "${submission.comment || "بدون تعليق"}". يرجى المتابعة فوراً.`,
        "نظام التقييم التلقائي",
        {
          ratingProduct: product,
          ratingCourier: courier,
          overallRating: overall,
          comment: submission.comment,
        }
      );
    }

    revalidatePath("/orders");

    return {
      success: true,
      data: {
        feedbackId: feedbackRecord.id,
        discountCode: "FALCON10",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "فشل تسجيل التقييم" };
  }
}

/**
 * Merchant action: Gets all feedback logs and analytics summary
 */
export async function getFeedbackAnalyticsAction(): Promise<
  FeedbackActionResult<{ analytics: FeedbackAnalytics; feedbacks: CustomerFeedbackRecord[] }>
> {
  try {
    const supabase = await createClient();
    const { data: settingData, error } = await (supabase.from("app_settings") as any)
      .select("value")
      .eq("key", FEEDBACK_APP_SETTING_KEY)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      return { success: false, error: error.message };
    }

    const feedbacks: CustomerFeedbackRecord[] = Array.isArray(settingData?.value)
      ? settingData.value
      : [];

    const analytics = computeFeedbackAnalytics(feedbacks);

    return {
      success: true,
      data: {
        analytics,
        feedbacks,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "فشل جلب إحصائيات التقييمات" };
  }
}

/**
 * Merchant action: Resolves a customer complaint
 */
export async function resolveFeedbackAction(
  feedbackId: string,
  notes?: string
): Promise<FeedbackActionResult<{ resolved: boolean }>> {
  try {
    const supabase = await createClient();
    const { data: settingData } = await (supabase.from("app_settings") as any)
      .select("value")
      .eq("key", FEEDBACK_APP_SETTING_KEY)
      .maybeSingle();

    const feedbacks: CustomerFeedbackRecord[] = Array.isArray(settingData?.value)
      ? settingData.value
      : [];

    const updated = feedbacks.map((f) => {
      if (f.id === feedbackId) {
        return {
          ...f,
          isResolved: true,
          resolutionNotes: notes || "تم التواصل مع العميل وحل المشكلة بنجاح",
        };
      }
      return f;
    });

    await (supabase.from("app_settings") as any).upsert({
      key: FEEDBACK_APP_SETTING_KEY,
      value: updated,
      updated_at: new Date().toISOString(),
    });

    revalidatePath("/orders");

    return { success: true, data: { resolved: true } };
  } catch (err: any) {
    return { success: false, error: err.message || "فشل تحديث حالة الشكوى" };
  }
}
