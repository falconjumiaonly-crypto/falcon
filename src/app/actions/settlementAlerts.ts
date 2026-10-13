"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Order } from "@/types/database";
import {
  CourierAgingReport,
  analyzeCourierDebtAging,
  generateCourierCollectionDemandLetter,
  generateCourierDemandWhatsAppUrl,
} from "@/lib/settlements/courierAgingEngine";
import { recordBatchOrderAuditAction } from "@/app/actions/audit";

export interface SettlementAlertActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Gets real-time courier debt aging report
 */
export async function getCourierAgingReportAction(): Promise<
  SettlementAlertActionResult<CourierAgingReport>
> {
  try {
    const supabase = await createClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null);

    if (error) {
      return { success: false, error: error.message };
    }

    const report = analyzeCourierDebtAging((orders || []) as Order[]);
    return { success: true, data: report };
  } catch (err: any) {
    return { success: false, error: err.message || "فشل احتساب تقادم الديون" };
  }
}

/**
 * Generates an official demand letter and records collection notification audit log
 */
export async function sendCourierSettlementReminderAction(
  carrierKey: string,
  managerPhone?: string
): Promise<
  SettlementAlertActionResult<{ letterText: string; whatsappUrl?: string }>
> {
  try {
    const supabase = await createClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null);

    if (error || !orders) {
      return { success: false, error: "تعذر جلب الشحنات" };
    }

    const report = analyzeCourierDebtAging(orders as Order[]);
    const profile = report.carrierProfiles[carrierKey];

    if (!profile) {
      return { success: false, error: "لا توجد مستحقات مسلّمة معلقة لهذه الشركة" };
    }

    const letterText = generateCourierCollectionDemandLetter(profile, "فلكون شيبنج");
    const whatsappUrl = managerPhone
      ? generateCourierDemandWhatsAppUrl(managerPhone, profile, "فلكون شيبنج")
      : undefined;

    // Log audit trail for affected orders
    const targetOrderIds = profile.orders.slice(0, 5).map((o) => o.orderId);
    if (targetOrderIds.length > 0) {
      await recordBatchOrderAuditAction(
        targetOrderIds,
        "settled",
        `مطالبة مالية رسمية (${profile.carrierName})`,
        `تم تصدير خطاب مطالبة بمستحقات بقيمة ${profile.totalUnsettledCod.toLocaleString()} ج.م (${profile.totalUnsettledCount} شحنة)`,
        "التاجر",
        {
          carrierName: profile.carrierName,
          totalUnsettledCod: profile.totalUnsettledCod,
          overdueCount: profile.overdueCount,
        }
      );
    }

    revalidatePath("/settlements");

    return {
      success: true,
      data: {
        letterText,
        whatsappUrl,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "فشل توليد خطاب المطالبة" };
  }
}

/**
 * Batch marks all delivered orders for a specific courier as settled
 */
export async function batchSettleCarrierDebtsAction(
  carrierKey: string,
  settlementRef?: string
): Promise<SettlementAlertActionResult<{ settledCount: number; totalCodSettled: number }>> {
  try {
    const supabase = await createClient();
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("delivery_status", "delivered")
      .eq("settlement_status", "pending")
      .is("deleted_at", null);

    if (error || !orders) {
      return { success: false, error: error?.message || "فشل جلب الشحنات" };
    }

    const report = analyzeCourierDebtAging(orders as Order[]);
    const profile = report.carrierProfiles[carrierKey];

    if (!profile || profile.orders.length === 0) {
      return { success: false, error: "لا توجد شحنات معلقة لتسويتها لهذه الشركة" };
    }

    const targetOrderIds = profile.orders.map((o) => o.orderId);

    // Update orders to settled
    const { error: updateErr } = await (supabase.from("orders") as any)
      .update({
        settlement_status: "settled",
        updated_at: new Date().toISOString(),
      })
      .in("id", targetOrderIds);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Record audit event
    await recordBatchOrderAuditAction(
      targetOrderIds,
      "settled",
      `تسوية وإيداع مالي (${profile.carrierName})`,
      `تم تأكيد تسوية مبالغ COD بقيمة ${profile.totalUnsettledCod.toLocaleString()} ج.م (${settlementRef ? `كشف رقم: ${settlementRef}` : "تسوية يدوية"})`,
      "التاجر",
      {
        carrierName: profile.carrierName,
        totalCodSettled: profile.totalUnsettledCod,
        settlementRef,
      }
    );

    revalidatePath("/settlements");
    revalidatePath("/orders");

    return {
      success: true,
      data: {
        settledCount: targetOrderIds.length,
        totalCodSettled: profile.totalUnsettledCod,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "فشل تسجيل التسوية" };
  }
}
