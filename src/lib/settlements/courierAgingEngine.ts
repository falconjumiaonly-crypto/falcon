import { Order } from "@/types/database";
import { generateWhatsAppUrl } from "@/lib/whatsappNotifications";

export type AgingBracketType = "0-7" | "8-14" | "15-30" | "30+";

export interface AgingOrderRecord {
  orderId: string;
  customerName: string;
  governorate: string;
  codAmount: number;
  deliveryDate: string;
  daysSinceDelivery: number;
  bracket: AgingBracketType;
  carrierName: string;
}

export interface CarrierDebtProfile {
  carrierKey: string;
  carrierName: string;
  totalUnsettledCount: number;
  totalUnsettledCod: number;
  overdueCount: number; // > 14 days
  overdueCod: number; // > 14 days
  criticalCount: number; // > 30 days
  criticalCod: number; // > 30 days
  oldestDeliveryDate: string;
  oldestDeliveryDays: number;
  riskStatus: "healthy" | "overdue" | "critical";
  orders: AgingOrderRecord[];
}

export interface CourierAgingReport {
  analyzedAt: string;
  totalUnsettledOrders: number;
  totalUnsettledCod: number;
  bracketTotals: {
    "0-7": { count: number; cod: number; label: string };
    "8-14": { count: number; cod: number; label: string };
    "15-30": { count: number; cod: number; label: string };
    "30+": { count: number; cod: number; label: string };
  };
  overduePercentage: number; // % of funds > 14 days
  carrierProfiles: Record<string, CarrierDebtProfile>;
}

/**
 * Calculates days elapsed between a past ISO date and now
 */
export function calculateDaysElapsed(isoDateString?: string | null): number {
  if (!isoDateString) return 0;
  const deliveryTime = new Date(isoDateString).getTime();
  if (isNaN(deliveryTime)) return 0;
  const now = Date.now();
  const diffDays = Math.floor((now - deliveryTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Categorizes elapsed delivery days into aging debt brackets
 */
export function categorizeAgingBracket(days: number): AgingBracketType {
  if (days <= 7) return "0-7";
  if (days <= 14) return "8-14";
  if (days <= 30) return "15-30";
  return "30+";
}

/**
 * Identifies the carrier name from order metadata and notes
 */
export function extractOrderCarrierName(order: Order): { key: string; name: string } {
  const notes = (order.important_notes || "").toLowerCase();
  if (notes.includes("جي آند تي") || notes.includes("j&t") || notes.includes("jnt")) {
    return { key: "jnt", name: "جي آند تي (J&T Express)" };
  }
  if (notes.includes("أرامكس") || notes.includes("aramex")) {
    return { key: "aramex", name: "أرامكس (Aramex)" };
  }
  return { key: "bosta", name: "بوسطة (Bosta)" };
}

/**
 * Analyzes delivered but unsettled orders and builds comprehensive aging radar report
 */
export function analyzeCourierDebtAging(orders: Order[]): CourierAgingReport {
  // Filter for delivered and unsettled orders only
  const pendingOrders = orders.filter(
    (o) => o.delivery_status === "delivered" && o.settlement_status === "pending"
  );

  const bracketTotals = {
    "0-7": { count: 0, cod: 0, label: "0 - 7 أيام (دورة تحصيل جارية 🟢)" },
    "8-14": { count: 0, cod: 0, label: "8 - 14 يوم (مستحقة التوريد هذا الأسبوع 🟡)" },
    "15-30": { count: 0, cod: 0, label: "15 - 30 يوم (متأخرة تستوجب المطالبة 🟠)" },
    "30+": { count: 0, cod: 0, label: "أكثر من 30 يوم (ديون حرجة معرضة للتجميد 🔴)" },
  };

  const carrierProfiles: Record<string, CarrierDebtProfile> = {};
  let grandTotalCod = 0;
  let totalOverdueCod = 0;

  pendingOrders.forEach((o) => {
    const cod = Number(o.cod_amount || 0);
    grandTotalCod += cod;

    // Delivery date fallback to updated_at or order_date or created_at
    const deliveryDate = o.updated_at || o.order_date || o.created_at || new Date().toISOString();
    const days = calculateDaysElapsed(deliveryDate);
    const bracket = categorizeAgingBracket(days);

    bracketTotals[bracket].count += 1;
    bracketTotals[bracket].cod += cod;

    if (days > 14) {
      totalOverdueCod += cod;
    }

    const { key, name } = extractOrderCarrierName(o);

    if (!carrierProfiles[key]) {
      carrierProfiles[key] = {
        carrierKey: key,
        carrierName: name,
        totalUnsettledCount: 0,
        totalUnsettledCod: 0,
        overdueCount: 0,
        overdueCod: 0,
        criticalCount: 0,
        criticalCod: 0,
        oldestDeliveryDate: deliveryDate,
        oldestDeliveryDays: days,
        riskStatus: "healthy",
        orders: [],
      };
    }

    const prof = carrierProfiles[key];
    prof.totalUnsettledCount += 1;
    prof.totalUnsettledCod += cod;

    if (days > prof.oldestDeliveryDays) {
      prof.oldestDeliveryDays = days;
      prof.oldestDeliveryDate = deliveryDate;
    }

    if (days > 30) {
      prof.criticalCount += 1;
      prof.criticalCod += cod;
    } else if (days > 14) {
      prof.overdueCount += 1;
      prof.overdueCod += cod;
    }

    prof.orders.push({
      orderId: o.id,
      customerName: o.customer_name,
      governorate: o.governorate,
      codAmount: cod,
      deliveryDate,
      daysSinceDelivery: days,
      bracket,
      carrierName: name,
    });
  });

  // Evaluate riskStatus for each carrier
  Object.values(carrierProfiles).forEach((prof) => {
    if (prof.criticalCount > 0 || prof.oldestDeliveryDays > 30) {
      prof.riskStatus = "critical";
    } else if (prof.overdueCount > 0 || prof.oldestDeliveryDays > 14) {
      prof.riskStatus = "overdue";
    } else {
      prof.riskStatus = "healthy";
    }
  });

  const overduePct = grandTotalCod > 0 ? Math.round((totalOverdueCod / grandTotalCod) * 100) : 0;

  return {
    analyzedAt: new Date().toISOString(),
    totalUnsettledOrders: pendingOrders.length,
    totalUnsettledCod: grandTotalCod,
    bracketTotals,
    overduePercentage: overduePct,
    carrierProfiles,
  };
}

/**
 * Generates an authoritative Arabic demand letter for an Egyptian courier company
 */
export function generateCourierCollectionDemandLetter(
  profile: CarrierDebtProfile,
  storeName = "فلكون شيبنج"
): string {
  const overdueCombined = profile.overdueCod + profile.criticalCod;
  const overdueCountCombined = profile.overdueCount + profile.criticalCount;

  return `السادة إدارة الحسابات والتحصيلات في شركة ${profile.carrierName} المحترمين،
تحية طيبة وبعد،،

نود إحاطة عنايتكم بوجود مستحقات مالية معلقة ومبالغ COD مسلّمة للعملاء لم يتم إيداعها حتى تاريخه لصالح متجرنا (${storeName}):

📌 **بيان المستحقات المعلقة بالنظام:**
• إجمالي المبالغ المسلّمة المعلقة: **${profile.totalUnsettledCod.toLocaleString()} جنيه مصري**
• عدد الشحنات المسلّمة غير المسواة: **${profile.totalUnsettledCount} شحنة**
• مبالغ متأخرة تجاوزت دورة السداد (أكثر من 14 يوماً): **${overdueCombined.toLocaleString()} جنيه مصري** (${overdueCountCombined} شحنة)
• أقدم شحنة مسلّمة بالنظام منذ: **${profile.oldestDeliveryDays} يوماً** (بتاريخ ${new Date(profile.oldestDeliveryDate).toLocaleDateString("ar-EG")})

⚠️ **المطلوب:**
نرجو سرعة مراجعة الكشف المرفق وتأكيد موعد التحويل البنكي أو إيداع شيك التسوية خلال **48 ساعة عمل**، تفادياً لتعليق تسليم الشحنات الجديدة للمناديب.

شاكرين لسيادتكم حسن التعاون والاهتمام.

إدارة الحسابات والمالية - ${storeName} 🦅`;
}

/**
 * Creates a direct WhatsApp click-to-chat URL with the demand letter for courier manager
 */
export function generateCourierDemandWhatsAppUrl(
  managerPhone: string,
  profile: CarrierDebtProfile,
  storeName?: string
): string {
  const letter = generateCourierCollectionDemandLetter(profile, storeName);
  return generateWhatsAppUrl(managerPhone, letter);
}
