import { Order } from "@/types/database";

export interface CarrierZoneProfile {
  carrierKey: "bosta" | "jnt" | "aramex" | "r2s";
  carrierName: string;
  expectedDeliveryRate: number; // percentage (0 - 100)
  expectedCost: number; // in EGP
  expectedDeliveryDays: number;
  coverageReliability: "high" | "medium" | "low";
}

export interface RoutingWeights {
  deliverySuccessWeight?: number; // default 0.50
  costWeight?: number; // default 0.30
  speedWeight?: number; // default 0.20
}

export interface CarrierScoreResult {
  carrierKey: "bosta" | "jnt" | "aramex" | "r2s";
  carrierName: string;
  totalScore: number;
  expectedDeliveryRate: number;
  expectedCost: number;
  expectedDeliveryDays: number;
  recommendationReasonAr: string;
}

export interface RoutingRecommendation {
  governorate: string;
  bestCarrier: CarrierScoreResult;
  alternativeCarriers: CarrierScoreResult[];
  savingsVersusWorst: number; // EGP
  deliveryRateAdvantage: number; // percentage points
}

export interface BatchRoutingSummary {
  totalOrders: number;
  assignedBreakdown: Record<string, number>;
  projectedAvgDeliveryRate: number;
  projectedTotalShippingCost: number;
  estimatedCostSavings: number;
  recommendations: {
    orderId: string;
    customerName: string;
    governorate: string;
    currentCarrier?: string;
    recommendedCarrierKey: string;
    recommendedCarrierName: string;
    reason: string;
    expectedRate: number;
    expectedCost: number;
  }[];
}

/**
 * Egyptian Regional Courier Performance Baseline Matrix
 * Based on historical data from Bosta, J&T Express, and Aramex in Egyptian markets.
 */
export const CARRIER_REGIONAL_PROFILES: Record<string, CarrierZoneProfile[]> = {
  // 1. Greater Cairo & Giza
  "القاهرة": [
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 94, expectedCost: 65, expectedDeliveryDays: 1.2, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 91, expectedCost: 60, expectedDeliveryDays: 1.5, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 88, expectedCost: 75, expectedDeliveryDays: 2.0, coverageReliability: "high" },
  ],
  "الجيزة": [
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 93, expectedCost: 65, expectedDeliveryDays: 1.3, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 90, expectedCost: 60, expectedDeliveryDays: 1.6, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 87, expectedCost: 75, expectedDeliveryDays: 2.1, coverageReliability: "high" },
  ],
  "القليوبية": [
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 91, expectedCost: 65, expectedDeliveryDays: 1.5, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 92, expectedCost: 60, expectedDeliveryDays: 1.4, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 86, expectedCost: 75, expectedDeliveryDays: 2.2, coverageReliability: "high" },
  ],

  // 2. Alexandria & Delta
  "الإسكندرية": [
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 93, expectedCost: 65, expectedDeliveryDays: 1.5, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 91, expectedCost: 65, expectedDeliveryDays: 1.8, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 89, expectedCost: 80, expectedDeliveryDays: 2.2, coverageReliability: "high" },
  ],
  "الدقهلية": [
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 94, expectedCost: 65, expectedDeliveryDays: 1.8, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 88, expectedCost: 70, expectedDeliveryDays: 2.1, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 86, expectedCost: 80, expectedDeliveryDays: 2.5, coverageReliability: "high" },
  ],
  "الغربية": [
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 93, expectedCost: 65, expectedDeliveryDays: 1.8, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 89, expectedCost: 70, expectedDeliveryDays: 2.0, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 86, expectedCost: 80, expectedDeliveryDays: 2.4, coverageReliability: "high" },
  ],
  "الشرقية": [
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 92, expectedCost: 65, expectedDeliveryDays: 1.8, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 89, expectedCost: 70, expectedDeliveryDays: 2.0, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 87, expectedCost: 80, expectedDeliveryDays: 2.3, coverageReliability: "high" },
  ],
  "المنوفية": [
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 92, expectedCost: 65, expectedDeliveryDays: 1.8, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 88, expectedCost: 70, expectedDeliveryDays: 2.1, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 85, expectedCost: 80, expectedDeliveryDays: 2.5, coverageReliability: "high" },
  ],
  "البحيرة": [
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 91, expectedCost: 65, expectedDeliveryDays: 2.0, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 87, expectedCost: 70, expectedDeliveryDays: 2.2, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 86, expectedCost: 85, expectedDeliveryDays: 2.6, coverageReliability: "high" },
  ],
  "كفر الشيخ": [
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 91, expectedCost: 65, expectedDeliveryDays: 2.0, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 86, expectedCost: 70, expectedDeliveryDays: 2.4, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 85, expectedCost: 85, expectedDeliveryDays: 2.8, coverageReliability: "high" },
  ],
  "دمياط": [
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 93, expectedCost: 65, expectedDeliveryDays: 1.9, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 88, expectedCost: 70, expectedDeliveryDays: 2.2, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 86, expectedCost: 85, expectedDeliveryDays: 2.5, coverageReliability: "high" },
  ],

  // 3. Canal Zone
  "بورسعيد": [
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 92, expectedCost: 70, expectedDeliveryDays: 1.8, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 90, expectedCost: 70, expectedDeliveryDays: 2.0, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 88, expectedCost: 85, expectedDeliveryDays: 2.5, coverageReliability: "high" },
  ],
  "الإسماعيلية": [
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 91, expectedCost: 70, expectedDeliveryDays: 1.8, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 89, expectedCost: 70, expectedDeliveryDays: 2.1, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 87, expectedCost: 85, expectedDeliveryDays: 2.4, coverageReliability: "high" },
  ],
  "السويس": [
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 91, expectedCost: 70, expectedDeliveryDays: 1.9, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 89, expectedCost: 70, expectedDeliveryDays: 2.2, coverageReliability: "high" },
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 87, expectedCost: 85, expectedDeliveryDays: 2.4, coverageReliability: "high" },
  ],

  // 4. Upper Egypt (الصعيد)
  "بني سويف": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 90, expectedCost: 85, expectedDeliveryDays: 2.2, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 87, expectedCost: 80, expectedDeliveryDays: 2.5, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 86, expectedCost: 75, expectedDeliveryDays: 2.6, coverageReliability: "medium" },
  ],
  "الفيوم": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 89, expectedCost: 85, expectedDeliveryDays: 2.2, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 87, expectedCost: 80, expectedDeliveryDays: 2.5, coverageReliability: "high" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 86, expectedCost: 75, expectedDeliveryDays: 2.6, coverageReliability: "medium" },
  ],
  "المنيا": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 91, expectedCost: 90, expectedDeliveryDays: 2.4, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 85, expectedCost: 85, expectedDeliveryDays: 3.0, coverageReliability: "medium" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 83, expectedCost: 80, expectedDeliveryDays: 3.2, coverageReliability: "medium" },
  ],
  "أسيوط": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 92, expectedCost: 95, expectedDeliveryDays: 2.5, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 84, expectedCost: 90, expectedDeliveryDays: 3.2, coverageReliability: "medium" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 82, expectedCost: 85, expectedDeliveryDays: 3.4, coverageReliability: "medium" },
  ],
  "سوهاج": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 91, expectedCost: 95, expectedDeliveryDays: 2.6, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 83, expectedCost: 90, expectedDeliveryDays: 3.4, coverageReliability: "medium" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 81, expectedCost: 85, expectedDeliveryDays: 3.6, coverageReliability: "medium" },
  ],
  "قنا": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 90, expectedCost: 100, expectedDeliveryDays: 2.8, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 82, expectedCost: 95, expectedDeliveryDays: 3.5, coverageReliability: "medium" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 80, expectedCost: 90, expectedDeliveryDays: 3.8, coverageReliability: "medium" },
  ],
  "الأقصر": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 91, expectedCost: 100, expectedDeliveryDays: 2.8, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 83, expectedCost: 95, expectedDeliveryDays: 3.6, coverageReliability: "medium" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 79, expectedCost: 90, expectedDeliveryDays: 3.9, coverageReliability: "medium" },
  ],
  "أسوان": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 90, expectedCost: 105, expectedDeliveryDays: 3.0, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 81, expectedCost: 100, expectedDeliveryDays: 3.8, coverageReliability: "medium" },
    { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 78, expectedCost: 95, expectedDeliveryDays: 4.0, coverageReliability: "medium" },
  ],

  // 5. Frontier & Remote (المحافظات الحدودية)
  "البحر الأحمر": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 89, expectedCost: 110, expectedDeliveryDays: 3.2, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 80, expectedCost: 115, expectedDeliveryDays: 4.0, coverageReliability: "medium" },
  ],
  "جنوب سيناء": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 88, expectedCost: 115, expectedDeliveryDays: 3.5, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 77, expectedCost: 120, expectedDeliveryDays: 4.5, coverageReliability: "medium" },
  ],
  "مطروح": [
    { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 87, expectedCost: 105, expectedDeliveryDays: 3.2, coverageReliability: "high" },
    { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 82, expectedCost: 100, expectedDeliveryDays: 3.8, coverageReliability: "medium" },
  ],
};

const DEFAULT_NATIONAL_PROFILE: CarrierZoneProfile[] = [
  { carrierKey: "bosta", carrierName: "بوسطة (Bosta)", expectedDeliveryRate: 88, expectedCost: 75, expectedDeliveryDays: 2.2, coverageReliability: "high" },
  { carrierKey: "jnt", carrierName: "جي آند تي (J&T Express)", expectedDeliveryRate: 87, expectedCost: 70, expectedDeliveryDays: 2.4, coverageReliability: "high" },
  { carrierKey: "aramex", carrierName: "أرامكس (Aramex)", expectedDeliveryRate: 89, expectedCost: 85, expectedDeliveryDays: 2.5, coverageReliability: "high" },
];

/**
 * Evaluates candidates using multi-factor scoring (Delivery success rate 50%, Cost 30%, Speed 20%)
 */
export function calculateCarrierScore(
  profile: CarrierZoneProfile,
  weights: RoutingWeights = {}
): CarrierScoreResult {
  const wDelivery = weights.deliverySuccessWeight ?? 0.50;
  const wCost = weights.costWeight ?? 0.30;
  const wSpeed = weights.speedWeight ?? 0.20;

  // Normalized factors (0 to 100 scale)
  const deliveryScore = profile.expectedDeliveryRate; // already 0-100
  const costScore = Math.max(0, 100 - (profile.expectedCost - 50) * 1.2); // cheaper is better
  const speedScore = Math.max(0, 100 - (profile.expectedDeliveryDays * 18)); // faster is better

  const totalScore = Math.round(
    deliveryScore * wDelivery + costScore * wCost + speedScore * wSpeed
  );

  let reason = "";
  if (profile.expectedDeliveryRate >= 92) {
    reason = `أعلى نسبة تسليم مضمونة (${profile.expectedDeliveryRate}%) وسرعة ${profile.expectedDeliveryDays} يوم`;
  } else if (profile.expectedCost <= 65) {
    reason = `سعر شحن اقتصادي (${profile.expectedCost} ج) مع تسليم مستقر`;
  } else {
    reason = `أفضل تغطية جغرافية وشبكة فروع في المنطقة`;
  }

  return {
    carrierKey: profile.carrierKey,
    carrierName: profile.carrierName,
    totalScore,
    expectedDeliveryRate: profile.expectedDeliveryRate,
    expectedCost: profile.expectedCost,
    expectedDeliveryDays: profile.expectedDeliveryDays,
    recommendationReasonAr: reason,
  };
}

/**
 * Computes optimal courier recommendation for an Egyptian governorate
 */
export function getSmartCarrierRecommendation(
  governorate: string,
  weights?: RoutingWeights
): RoutingRecommendation {
  const cleanGov = (governorate || "القاهرة").trim();
  const profiles = CARRIER_REGIONAL_PROFILES[cleanGov] || DEFAULT_NATIONAL_PROFILE;

  const scored = profiles
    .map((p) => calculateCarrierScore(p, weights))
    .sort((a, b) => b.totalScore - a.totalScore);

  const best = scored[0];
  const worst = scored[scored.length - 1];

  const savings = Math.max(0, worst.expectedCost - best.expectedCost);
  const rateAdvantage = Math.max(0, best.expectedDeliveryRate - worst.expectedDeliveryRate);

  return {
    governorate: cleanGov,
    bestCarrier: best,
    alternativeCarriers: scored.slice(1),
    savingsVersusWorst: savings,
    deliveryRateAdvantage: rateAdvantage,
  };
}

/**
 * Batch analyzes orders and builds optimized carrier assignments with projected savings
 */
export function batchSmartRouteOrders(
  orders: Order[],
  weights?: RoutingWeights
): BatchRoutingSummary {
  const breakdown: Record<string, number> = {};
  let totalRate = 0;
  let totalCost = 0;
  let totalSavings = 0;

  const recommendations = orders.map((order) => {
    const rec = getSmartCarrierRecommendation(order.governorate, weights);
    const best = rec.bestCarrier;

    breakdown[best.carrierName] = (breakdown[best.carrierName] || 0) + 1;
    totalRate += best.expectedDeliveryRate;
    totalCost += best.expectedCost;
    totalSavings += rec.savingsVersusWorst;

    return {
      orderId: order.id,
      customerName: order.customer_name,
      governorate: order.governorate,
      currentCarrier: order.important_notes?.includes("بوسطة")
        ? "بوسطة"
        : order.important_notes?.includes("جي آند تي")
        ? "جي آند تي"
        : order.important_notes?.includes("أرامكس")
        ? "أرامكس"
        : "غير محدد",
      recommendedCarrierKey: best.carrierKey,
      recommendedCarrierName: best.carrierName,
      reason: best.recommendationReasonAr,
      expectedRate: best.expectedDeliveryRate,
      expectedCost: best.expectedCost,
    };
  });

  const count = orders.length || 1;

  return {
    totalOrders: orders.length,
    assignedBreakdown: breakdown,
    projectedAvgDeliveryRate: Math.round(totalRate / count),
    projectedTotalShippingCost: totalCost,
    estimatedCostSavings: totalSavings,
    recommendations,
  };
}
