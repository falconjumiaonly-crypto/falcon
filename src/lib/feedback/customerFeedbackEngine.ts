import { Order } from "@/types/database";
import { normalizePhoneForWhatsApp, generateWhatsAppUrl } from "@/lib/whatsappNotifications";

export interface CustomerFeedbackSubmission {
  orderId: string;
  customerName: string;
  phone: string;
  ratingProduct: number; // 1 - 5
  ratingCourier: number; // 1 - 5
  overallRating: number; // 1 - 5
  comment?: string;
  governorate?: string;
  carrierName?: string;
}

export interface CustomerFeedbackRecord extends CustomerFeedbackSubmission {
  id: string;
  createdAt: string;
  isComplaint: boolean; // true if overallRating <= 2
  isResolved: boolean;
  resolutionNotes?: string;
}

export interface FeedbackAnalytics {
  totalReviews: number;
  averageOverallRating: number;
  averageProductRating: number;
  averageCourierRating: number;
  unresolvedComplaintsCount: number;
  carrierRatings: Record<string, { count: number; avgRating: number }>;
}

export const FEEDBACK_APP_SETTING_KEY = "CUSTOMER_FEEDBACK_LOG";

/**
 * Generates an Egyptian-Arabic WhatsApp post-delivery feedback message
 */
export function generatePostDeliveryFeedbackWhatsAppMessage(
  order: Order,
  options?: {
    storeName?: string;
    baseUrl?: string;
    discountCode?: string;
  }
): string {
  const storeName = options?.storeName || "فلكون شيبنج";
  const baseUrl = options?.baseUrl || "https://falcon-shipping.vercel.app";
  const shortId = order.id ? order.id.slice(0, 8).toUpperCase() : "";
  const feedbackUrl = `${baseUrl}/feedback/${order.id}`;
  const discountCode = options?.discountCode || "FALCON10";

  return `حمد لله على السلامة يا فندم! 🌸📦
تم تسليم طلبك رقم #${shortId} بنجاح.

نتمنى أن تكون المنتجات نالت إعجابك وأن يكون مندوب الشحن تعامل باحترافية وسرعة. 🚚✨

رأيك يهمنا جداً لتطوير خدمتنا! برجاء تقييم تجربتك في ثوانٍ عبر الرابط:
👉 ${feedbackUrl}

🎁 كهدية شكر، ستحصل فور إتمام التقييم على كود خصم (${discountCode}) لطلبك القادم!

مع تحيات فريق ${storeName} 🦅`;
}

/**
 * Generates direct wa.me link for sending feedback request
 */
export function generateFeedbackWhatsAppUrl(
  phone: string,
  order: Order,
  options?: { storeName?: string; baseUrl?: string; discountCode?: string }
): string {
  const message = generatePostDeliveryFeedbackWhatsAppMessage(order, options);
  return generateWhatsAppUrl(phone, message);
}

/**
 * Analyzes feedback rating and determines complaint urgency
 */
export function evaluateFeedbackUrgency(overallRating: number): {
  isComplaint: boolean;
  urgencyLevel: "low" | "medium" | "critical";
  alertMessageAr: string;
} {
  if (overallRating <= 1) {
    return {
      isComplaint: true,
      urgencyLevel: "critical",
      alertMessageAr: "🚨 عميل غير راضٍ تماماً (نجمة واحدة) - يتطلب اتصالاً فورياً لإنقاذ السمعة وتفادي تقييمات سلبية.",
    };
  }
  if (overallRating === 2) {
    return {
      isComplaint: true,
      urgencyLevel: "medium",
      alertMessageAr: "⚠️ تجربة تسليم سيئة (نجمتان) - يُفضل المتابعة وتقديم تعويض رمزي أو خصم.",
    };
  }
  return {
    isComplaint: false,
    urgencyLevel: "low",
    alertMessageAr: "✅ تجربة إيجابية وناجحة.",
  };
}

/**
 * Computes statistical overview from all collected feedback records
 */
export function computeFeedbackAnalytics(
  feedbacks: CustomerFeedbackRecord[]
): FeedbackAnalytics {
  if (!feedbacks || feedbacks.length === 0) {
    return {
      totalReviews: 0,
      averageOverallRating: 5.0,
      averageProductRating: 5.0,
      averageCourierRating: 5.0,
      unresolvedComplaintsCount: 0,
      carrierRatings: {},
    };
  }

  let totalOverall = 0;
  let totalProduct = 0;
  let totalCourier = 0;
  let unresolvedCount = 0;
  const carrierMap: Record<string, { total: number; count: number }> = {};

  feedbacks.forEach((f) => {
    totalOverall += f.overallRating;
    totalProduct += f.ratingProduct;
    totalCourier += f.ratingCourier;

    if (f.isComplaint && !f.isResolved) {
      unresolvedCount++;
    }

    const carrier = f.carrierName || "غير محدد";
    if (!carrierMap[carrier]) {
      carrierMap[carrier] = { total: 0, count: 0 };
    }
    carrierMap[carrier].total += f.ratingCourier;
    carrierMap[carrier].count += 1;
  });

  const count = feedbacks.length;
  const carrierRatings: Record<string, { count: number; avgRating: number }> = {};
  Object.entries(carrierMap).forEach(([carrier, stat]) => {
    carrierRatings[carrier] = {
      count: stat.count,
      avgRating: Number((stat.total / stat.count).toFixed(1)),
    };
  });

  return {
    totalReviews: count,
    averageOverallRating: Number((totalOverall / count).toFixed(1)),
    averageProductRating: Number((totalProduct / count).toFixed(1)),
    averageCourierRating: Number((totalCourier / count).toFixed(1)),
    unresolvedComplaintsCount: unresolvedCount,
    carrierRatings,
  };
}
