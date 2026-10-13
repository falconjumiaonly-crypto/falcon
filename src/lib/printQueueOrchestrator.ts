import { Order } from "@/types/database";

export const REGION_DEFINITIONS: Record<
  string,
  { label: string; governorates: string[] }
> = {
  greater_cairo: {
    label: "القاهرة الكبرى",
    governorates: ["القاهرة", "الجيزة", "القليوبية"],
  },
  alex_canal: {
    label: "الإسكندرية والقناة",
    governorates: [
      "الإسكندرية",
      "بورسعيد",
      "بور سعيد",
      "الإسماعيلية",
      "السويس",
      "مطروح",
    ],
  },
  delta: {
    label: "محافظات الدلتا",
    governorates: [
      "الدقهلية",
      "الشرقية",
      "الغربية",
      "المنوفية",
      "البحيرة",
      "كفر الشيخ",
      "دمياط",
    ],
  },
  upper_egypt: {
    label: "محافظات الصعيد",
    governorates: [
      "الفيوم",
      "بني سويف",
      "المنيا",
      "أسيوط",
      "سوهاج",
      "قنا",
      "الأقصر",
      "أسوان",
    ],
  },
  coastal_frontier: {
    label: "البحر الأحمر وسيناء",
    governorates: ["البحر الأحمر", "الوادي الجديد", "شمال سيناء", "جنوب سيناء"],
  },
};

export type PrintQueueSortOption =
  | "gov_asc" // حسب المحافظة أ-ي (مثالي للتجميع والطباعة المتسلسلة)
  | "date_desc" // الأحدث أولاً
  | "date_asc" // الأقدم أولاً
  | "cod_desc" // أعلى قيمة تحصيل COD
  | "cod_asc" // أقل قيمة تحصيل COD
  | "name_asc"; // اسم العميل أ-ي

export type QuickSelectPreset =
  | "all_visible"
  | "cairo_giza"
  | "delta"
  | "upper_egypt"
  | "alex_canal"
  | "cod_only"
  | "prepaid_only";

/**
 * Sorts orders in the print queue based on the merchant's distribution requirements.
 */
export function sortPrintQueueOrders(
  orders: Order[],
  sortBy: PrintQueueSortOption
): Order[] {
  const list = [...orders];

  switch (sortBy) {
    case "gov_asc":
      return list.sort((a, b) => {
        const govCompare = (a.governorate || "").localeCompare(
          b.governorate || "",
          "ar"
        );
        if (govCompare !== 0) return govCompare;
        return (a.customer_name || "").localeCompare(b.customer_name || "", "ar");
      });

    case "date_desc":
      return list.sort(
        (a, b) =>
          new Date(b.created_at || b.order_date).getTime() -
          new Date(a.created_at || a.order_date).getTime()
      );

    case "date_asc":
      return list.sort(
        (a, b) =>
          new Date(a.created_at || a.order_date).getTime() -
          new Date(b.created_at || b.order_date).getTime()
      );

    case "cod_desc":
      return list.sort((a, b) => (b.cod_amount || 0) - (a.cod_amount || 0));

    case "cod_asc":
      return list.sort((a, b) => (a.cod_amount || 0) - (b.cod_amount || 0));

    case "name_asc":
      return list.sort((a, b) =>
        (a.customer_name || "").localeCompare(b.customer_name || "", "ar")
      );

    default:
      return list;
  }
}

/**
 * Returns order IDs that match a quick selection preset.
 */
export function getOrderIdsByPreset(
  orders: Order[],
  preset: QuickSelectPreset
): string[] {
  switch (preset) {
    case "all_visible":
      return orders.map((o) => o.id);

    case "cairo_giza": {
      const targetGovs = REGION_DEFINITIONS.greater_cairo.governorates;
      return orders
        .filter((o) => targetGovs.includes(o.governorate))
        .map((o) => o.id);
    }

    case "delta": {
      const targetGovs = REGION_DEFINITIONS.delta.governorates;
      return orders
        .filter((o) => targetGovs.includes(o.governorate))
        .map((o) => o.id);
    }

    case "upper_egypt": {
      const targetGovs = REGION_DEFINITIONS.upper_egypt.governorates;
      return orders
        .filter((o) => targetGovs.includes(o.governorate))
        .map((o) => o.id);
    }

    case "alex_canal": {
      const targetGovs = REGION_DEFINITIONS.alex_canal.governorates;
      return orders
        .filter((o) => targetGovs.includes(o.governorate))
        .map((o) => o.id);
    }

    case "cod_only":
      return orders.filter((o) => (o.cod_amount || 0) > 0).map((o) => o.id);

    case "prepaid_only":
      return orders.filter((o) => (o.cod_amount || 0) === 0).map((o) => o.id);

    default:
      return [];
  }
}

export interface DeliveryManifestData {
  manifestNumber: string;
  createdAt: string;
  carrierName: string;
  driverName?: string;
  driverPhone?: string;
  orders: Order[];
  totalOrdersCount: number;
  totalCodAmount: number;
  totalPaidAmount: number;
  governoratesSummary: { governorate: string; count: number; cod: number }[];
}

/**
 * Builds a structured Delivery Manifest data model from selected orders.
 */
export function generateDeliveryManifest(
  orders: Order[],
  options?: {
    carrierName?: string;
    driverName?: string;
    driverPhone?: string;
    manifestNumber?: string;
  }
): DeliveryManifestData {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const manifestNumber =
    options?.manifestNumber || `MAN-${dateStr}-${timeStr}-${randomSuffix}`;

  const govMap = new Map<string, { count: number; cod: number }>();
  let totalCod = 0;
  let totalPaid = 0;

  orders.forEach((o) => {
    const cod = Number(o.cod_amount || 0);
    const paid = Number(o.paid_amount || 0);
    totalCod += cod;
    totalPaid += paid;

    const gov = o.governorate || "غير محدد";
    const existing = govMap.get(gov) || { count: 0, cod: 0 };
    existing.count++;
    existing.cod += cod;
    govMap.set(gov, existing);
  });

  const governoratesSummary = Array.from(govMap.entries())
    .map(([gov, stat]) => ({
      governorate: gov,
      count: stat.count,
      cod: stat.cod,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    manifestNumber,
    createdAt: now.toISOString(),
    carrierName: options?.carrierName || "مندوب شركة الشحن",
    driverName: options?.driverName || "",
    driverPhone: options?.driverPhone || "",
    orders: sortPrintQueueOrders(orders, "gov_asc"),
    totalOrdersCount: orders.length,
    totalCodAmount: totalCod,
    totalPaidAmount: totalPaid,
    governoratesSummary,
  };
}

export type PrintAuditTimeframe = "all" | "today" | "yesterday" | "this_week";

/**
 * Checks whether an order was printed within a specific timeframe filter.
 */
export function isPrintedWithinTimeframe(
  printedAt: string | null,
  timeframe: PrintAuditTimeframe
): boolean {
  if (timeframe === "all") return true;
  if (!printedAt) return false;

  const printDate = new Date(printedAt);
  if (isNaN(printDate.getTime())) return false;

  const now = new Date();

  if (timeframe === "today") {
    return (
      printDate.getDate() === now.getDate() &&
      printDate.getMonth() === now.getMonth() &&
      printDate.getFullYear() === now.getFullYear()
    );
  }

  if (timeframe === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return (
      printDate.getDate() === yesterday.getDate() &&
      printDate.getMonth() === yesterday.getMonth() &&
      printDate.getFullYear() === yesterday.getFullYear()
    );
  }

  if (timeframe === "this_week") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return printDate >= weekAgo;
  }

  return true;
}

/**
 * Formats a printed timestamp with readable Arabic date and relative elapsed time.
 */
export function formatPrintedRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "غير محدد";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    const timeFormatted = new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

    if (diffMins < 2) {
      return `الآن (${timeFormatted})`;
    }
    if (diffMins < 60) {
      return `منذ ${diffMins} دقيقة (${timeFormatted})`;
    }
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `اليوم منذ ${diffHours} س (${timeFormatted})`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate()) {
      return `أمس (${timeFormatted})`;
    }

    return new Intl.DateTimeFormat("ar-EG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateStr;
  }
}

