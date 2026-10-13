import { Order } from "@/types/database";
import { normalizePhoneNumber } from "@/lib/excel-import";

export type RiskLevel = "safe" | "medium" | "high" | "blacklisted";
export type RiskRecommendation = "proceed" | "call_to_confirm" | "require_deposit" | "block_order";

export interface BlacklistEntry {
  phone: string;
  name: string;
  reason: string;
  addedAt: string;
}

export interface CustomerRiskProfile {
  phone: string;
  name: string;
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  returnRate: number; // percentage (0 - 100)
  riskScore: number; // 0 - 100 (0 = trusted, 100 = blacklisted/fraud)
  riskLevel: RiskLevel;
  isBlacklisted: boolean;
  blacklistReason?: string;
  totalPenaltyLossCaused: number; // Sum of shipping costs wasted on returns
  recommendation: RiskRecommendation;
  recommendationTextAr: string;
}

/**
 * Calculates a customer's dynamic risk score and loss indicators based on order history and blacklist
 */
export function calculateCustomerRisk(
  phone: string,
  customerOrders: Order[] = [],
  blacklist: BlacklistEntry[] = []
): CustomerRiskProfile {
  const normPhone = normalizePhoneNumber(phone);
  const name = customerOrders[0]?.customer_name || "عميل";

  // 1. Check if explicitly blacklisted
  const blacklistHit = blacklist.find((b) => normalizePhoneNumber(b.phone) === normPhone);
  if (blacklistHit) {
    const penaltyLoss = customerOrders
      .filter((o) => o.delivery_status === "returned")
      .reduce((sum, o) => sum + (o.shipping_cost || 0), 0);

    return {
      phone: normPhone,
      name: blacklistHit.name || name,
      totalOrders: customerOrders.length,
      deliveredOrders: customerOrders.filter((o) => o.delivery_status === "delivered").length,
      returnedOrders: customerOrders.filter((o) => o.delivery_status === "returned").length,
      returnRate: customerOrders.length > 0
        ? Number(((customerOrders.filter((o) => o.delivery_status === "returned").length / customerOrders.length) * 100).toFixed(1))
        : 100,
      riskScore: 100,
      riskLevel: "blacklisted",
      isBlacklisted: true,
      blacklistReason: blacklistHit.reason || "تم إدراجه بالقائمة السوداء لسوابق رفض استلام الشحنات",
      totalPenaltyLossCaused: penaltyLoss,
      recommendation: "block_order",
      recommendationTextAr: `🚫 العميل مسجل بالقائمة السوداء (${blacklistHit.reason || "رفض استلام متكرر"}). يوصى بعدم الشحن أو اشتراط تحويل بنكي/عربون مسبق.`,
    };
  }

  // 2. Evaluate from history
  const total = customerOrders.length;
  const delivered = customerOrders.filter((o) => o.delivery_status === "delivered").length;
  const returned = customerOrders.filter((o) => o.delivery_status === "returned").length;
  const penaltyLoss = customerOrders
    .filter((o) => o.delivery_status === "returned")
    .reduce((sum, o) => sum + (o.shipping_cost || 0), 0);

  const returnRate = total > 0 ? Number(((returned / total) * 100).toFixed(1)) : 0;

  // Case A: First time / New Customer (No past history)
  if (total === 0) {
    return {
      phone: normPhone,
      name,
      totalOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      returnRate: 0,
      riskScore: 20,
      riskLevel: "safe",
      isBlacklisted: false,
      totalPenaltyLossCaused: 0,
      recommendation: "proceed",
      recommendationTextAr: "عميل جديد لأول مرة. لا توجد سوابق إلغاء أو ارتجاع.",
    };
  }

  // Case B: Severe Serial Returner (2+ returns and >= 50% return rate)
  if (returned >= 2 && returnRate >= 50) {
    return {
      phone: normPhone,
      name,
      totalOrders: total,
      deliveredOrders: delivered,
      returnedOrders: returned,
      returnRate,
      riskScore: Math.min(95, 75 + returned * 5),
      riskLevel: "high",
      isBlacklisted: false,
      totalPenaltyLossCaused: penaltyLoss,
      recommendation: "require_deposit",
      recommendationTextAr: `⚠️ عميل عالي المخاطر! لديه ${returned} شحنات مرتجعة سابقة وخسارة شحن ${penaltyLoss} ج.م. يرجى طلب عربون مصاريف الشحن فودافون كاش قبل الإرسال.`,
    };
  }

  // Case C: Medium Risk (1 return or return rate between 25% and 50%)
  if (returned >= 1 || (total >= 3 && delivered / total < 0.7)) {
    return {
      phone: normPhone,
      name,
      totalOrders: total,
      deliveredOrders: delivered,
      returnedOrders: returned,
      returnRate,
      riskScore: 55,
      riskLevel: "medium",
      isBlacklisted: false,
      totalPenaltyLossCaused: penaltyLoss,
      recommendation: "call_to_confirm",
      recommendationTextAr: `تنبيه: العميل لديه مرتجع سابق (${returned} طرد). يوصى بالاتصال هاتفياً للتأكيد ومراجعة العنوان قبل الشحن.`,
    };
  }

  // Case D: Trusted / VIP Customer (2+ delivered, 0 returns)
  if (delivered >= 2 && returned === 0) {
    return {
      phone: normPhone,
      name,
      totalOrders: total,
      deliveredOrders: delivered,
      returnedOrders: 0,
      returnRate: 0,
      riskScore: 5,
      riskLevel: "safe",
      isBlacklisted: false,
      totalPenaltyLossCaused: 0,
      recommendation: "proceed",
      recommendationTextAr: `🌟 عميل مميز وموثوق (VIP)! استلم ${delivered} أوردرات سابقة بنجاح ونسبة تسليم 100%.`,
    };
  }

  // Case E: Normal / Safe (Default)
  return {
    phone: normPhone,
    name,
    totalOrders: total,
    deliveredOrders: delivered,
    returnedOrders: returned,
    returnRate,
    riskScore: 25,
    riskLevel: "safe",
    isBlacklisted: false,
    totalPenaltyLossCaused: penaltyLoss,
    recommendation: "proceed",
    recommendationTextAr: "سجل العميل سليم وجيد. الشحن مسموح بصورة طبيعية.",
  };
}
