import { Order, DeliveryStatus, PrintStatus } from "@/types/database";

export interface TrackingTimelineStep {
  stepId: "placed" | "packed" | "shipped" | "delivered" | "returned";
  title: string;
  description: string;
  timestamp?: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
  isAlert?: boolean;
}

export interface PublicOrderTrackingData {
  orderId: string;
  shortId: string;
  orderDate: string;
  customerName: string;
  maskedPhone: string;
  governorate: string;
  maskedAddress: string;
  orderTotal: number;
  paidAmount: number;
  codAmount: number;
  paymentStatus: string;
  deliveryStatus: DeliveryStatus;
  printStatus: PrintStatus;
  carrierName?: string;
  timeline: TrackingTimelineStep[];
  trackingUrl: string;
}

/**
 * Masks customer phone number for public privacy (e.g. 01012345678 -> 010****5678)
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  const str = String(phone).trim();
  if (str.length <= 6) return str;
  const start = str.slice(0, 3);
  const end = str.slice(-4);
  return `${start}****${end}`;
}

/**
 * Masks detailed street address to show only destination region/city for privacy
 */
export function maskAddressSnippet(address?: string | null, governorate?: string | null): string {
  const gov = governorate || "محافظة التسليم";
  if (!address) return gov;
  // Return first 2 words or first 25 characters if available
  const parts = address.split(/[-–,،]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 0) {
    return `${gov} - ${parts[0]}`;
  }
  return gov;
}

/**
 * Translates delivery status into user-friendly Arabic customer text
 */
export function getCustomerFriendlyStatus(status?: DeliveryStatus): {
  headline: string;
  badgeClass: string;
  color: string;
} {
  switch (status) {
    case "delivered":
      return {
        headline: "تم تسليم الطلب بنجاح للعميل",
        badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
        color: "emerald",
      };
    case "handed_to_carrier":
      return {
        headline: "الشحنة في الطريق مع مندوب التوصيل",
        badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/30",
        color: "amber",
      };
    case "returned":
      return {
        headline: "تعذر التسليم - مرتجع للمتجر",
        badgeClass: "bg-rose-500/10 text-rose-700 border-rose-500/30",
        color: "rose",
      };
    case "new":
    default:
      return {
        headline: "جاري تجهيز وتغليف الشحنة بالمخزن",
        badgeClass: "bg-blue-500/10 text-blue-700 border-blue-500/30",
        color: "blue",
      };
  }
}

/**
 * Builds real-time delivery status timeline steps for the customer
 */
export function buildPublicTrackingTimeline(
  order: Partial<Order>
): TrackingTimelineStep[] {
  const deliveryStatus: DeliveryStatus = order.delivery_status || "new";
  const printStatus: PrintStatus = order.print_status || "pending";
  const createdAt = order.created_at || order.order_date || null;
  const printedAt = order.printed_at || null;
  const settledAt = order.settled_at || null;

  const isDelivered = deliveryStatus === "delivered";
  const isShipped = deliveryStatus === "handed_to_carrier" || isDelivered;
  const isPacked = printStatus === "printed" || isShipped;
  const isReturned = deliveryStatus === "returned";

  const steps: TrackingTimelineStep[] = [
    {
      stepId: "placed",
      title: "تم استلام الطلب وتأكيده",
      description: "تم تسجيل تفاصيل طلبك بنجاح وجاري إرساله لقسم التجهيز.",
      timestamp: createdAt,
      isCompleted: true,
      isCurrent: !isPacked && !isShipped && !isReturned,
    },
    {
      stepId: "packed",
      title: "جاري التجهيز والتغليف بالمخزن",
      description: isPacked
        ? "تمت طباعة بوليصة الشحن وتغليف الطرد بالكامل."
        : "يتم تجهيز المنتجات ومراجعة الجودة في المخزن.",
      timestamp: printedAt,
      isCompleted: isPacked,
      isCurrent: isPacked && !isShipped && !isReturned,
    },
    {
      stepId: "shipped",
      title: "خرج مع مندوب التوصيل",
      description: isShipped
        ? "الطرد في عهدة مندوب شركة الشحن وسيتواصل معك قريباً للتسليم."
        : "بانتظار وصول مندوب شركة الشحن لاستلام الطرد.",
      timestamp: isShipped ? order.updated_at || null : null,
      isCompleted: isShipped,
      isCurrent: deliveryStatus === "handed_to_carrier",
    },
  ];

  if (isReturned) {
    steps.push({
      stepId: "returned",
      title: "طرد مرتجع",
      description: "تعذر تسليم الطرد أو تم رفض الاستلام من قبل العميل.",
      timestamp: order.updated_at || null,
      isCompleted: true,
      isCurrent: true,
      isAlert: true,
    });
  } else {
    steps.push({
      stepId: "delivered",
      title: "تم الاستلام بنجاح",
      description: isDelivered
        ? "تم تسليم الطرد للعميل وتحصيل المبلغ بنجاح. شكراً لثقتك بنا!"
        : "المندوب في طريقه إلى عنوانك لتسليم الطرد.",
      timestamp: isDelivered ? settledAt || order.updated_at || null : null,
      isCompleted: isDelivered,
      isCurrent: isDelivered,
    });
  }

  return steps;
}

/**
 * Sanitizes an order object, ensuring NO internal merchant finances or sensitive notes leak
 */
export function sanitizeOrderForPublicTracking(
  order: Order,
  originUrl = ""
): PublicOrderTrackingData {
  const shortId = order.id ? order.id.slice(0, 8).toUpperCase() : "";
  const trackingUrl = originUrl
    ? `${originUrl}/track/${order.id}`
    : `/track/${order.id}`;

  return {
    orderId: order.id,
    shortId,
    orderDate: order.order_date || order.created_at || new Date().toISOString(),
    customerName: order.customer_name || "عميلنا العزيز",
    maskedPhone: maskPhoneNumber(order.phone_primary),
    governorate: order.governorate || "غير محدد",
    maskedAddress: maskAddressSnippet(order.address, order.governorate),
    orderTotal: Number(order.order_total || 0),
    paidAmount: Number(order.paid_amount || 0),
    codAmount: Number(order.cod_amount || 0),
    paymentStatus: order.payment_status || "unpaid",
    deliveryStatus: order.delivery_status || "new",
    printStatus: order.print_status || "pending",
    carrierName: "شركة الشحن المعتمدة",
    timeline: buildPublicTrackingTimeline(order),
    trackingUrl,
  };
}
