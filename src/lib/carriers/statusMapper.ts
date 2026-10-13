import { DeliveryStatus } from "@/types/database";
import {
  CarrierType,
  CarrierTrackingEvent,
  CarrierStatusMappingResult,
} from "./types";

/**
 * Maps Bosta webhook / tracking states to Falcon internal delivery status
 */
export function mapBostaStatus(rawState: string | number): CarrierStatusMappingResult {
  const stateStr = String(rawState || "").trim().toUpperCase();

  // Delivered
  if (
    stateStr === "40" ||
    stateStr === "41" ||
    stateStr.includes("DELIVERED") ||
    stateStr.includes("تم التسليم")
  ) {
    return {
      status: "delivered",
      labelAr: "تم التسليم بنجاح (بوسطة)",
      isDelivered: true,
      isReturn: false,
      isOutForDelivery: false,
    };
  }

  // Returned / Terminated
  if (
    stateStr === "45" ||
    stateStr === "46" ||
    stateStr === "47" ||
    stateStr.includes("TERMINATED") ||
    stateStr.includes("RETURNED") ||
    stateStr.includes("CANCELLED") ||
    stateStr.includes("EXCEPTION") ||
    stateStr.includes("مرتجع") ||
    stateStr.includes("إلغاء")
  ) {
    return {
      status: "returned",
      labelAr: "مرتجع / لاغي (بوسطة)",
      isDelivered: false,
      isReturn: true,
      isOutForDelivery: false,
    };
  }

  // Out for delivery / In transit / Handed to courier
  if (
    stateStr === "20" ||
    stateStr === "21" ||
    stateStr === "22" ||
    stateStr === "23" ||
    stateStr === "24" ||
    stateStr === "25" ||
    stateStr === "30" ||
    stateStr.includes("PICKED UP") ||
    stateStr.includes("IN TRANSIT") ||
    stateStr.includes("OUT FOR DELIVERY") ||
    stateStr.includes("RECEIVED AT WAREHOUSE") ||
    stateStr.includes("خرج للتوصيل") ||
    stateStr.includes("في الطريق")
  ) {
    return {
      status: "handed_to_carrier",
      labelAr: stateStr.includes("OUT FOR DELIVERY") || stateStr === "30"
        ? "خرج للتوصيل مع المندوب (بوسطة)"
        : "قيد الشحن بمستودعات بوسطة",
      isDelivered: false,
      isReturn: false,
      isOutForDelivery: stateStr.includes("OUT FOR DELIVERY") || stateStr === "30",
    };
  }

  // New / Pickup requested
  return {
    status: "new",
    labelAr: "بانتظار استلام بوسطة",
    isDelivered: false,
    isReturn: false,
    isOutForDelivery: false,
  };
}

/**
 * Maps J&T Express scan codes & statuses to Falcon internal delivery status
 */
export function mapJntStatus(rawStatus: string): CarrierStatusMappingResult {
  const statusStr = String(rawStatus || "").trim().toUpperCase();

  // Delivered (SIGN)
  if (
    statusStr === "SIGN" ||
    statusStr.includes("DELIVERED") ||
    statusStr.includes("SUCCESS") ||
    statusStr.includes("تم التسليم") ||
    statusStr.includes("توقيع")
  ) {
    return {
      status: "delivered",
      labelAr: "تم التسليم بنجاح (J&T)",
      isDelivered: true,
      isReturn: false,
      isOutForDelivery: false,
    };
  }

  // Returned / Abnormal / Rejected
  if (
    statusStr.includes("RETURN") ||
    statusStr.includes("REJECT") ||
    statusStr.includes("ABNORMAL") ||
    statusStr.includes("FAILED") ||
    statusStr.includes("مرتجع") ||
    statusStr.includes("فشل")
  ) {
    return {
      status: "returned",
      labelAr: "مرتجع / تعذر التسليم (J&T)",
      isDelivered: false,
      isReturn: true,
      isOutForDelivery: false,
    };
  }

  // In Transit / Delivering
  if (
    statusStr.includes("SENDING") ||
    statusStr.includes("DELIVERING") ||
    statusStr.includes("DEPARTURE") ||
    statusStr.includes("ARRIVAL") ||
    statusStr.includes("TRANSIT") ||
    statusStr.includes("ON_WAY") ||
    statusStr.includes("PICK")
  ) {
    return {
      status: "handed_to_carrier",
      labelAr: statusStr.includes("DELIVERING") || statusStr.includes("SENDING")
        ? "مع مندوب J&T في الطريق للعميل"
        : "قيد النقل والتوزيع (J&T)",
      isDelivered: false,
      isReturn: false,
      isOutForDelivery: statusStr.includes("DELIVERING") || statusStr.includes("SENDING"),
    };
  }

  return {
    status: "new",
    labelAr: "تم تسجيل الشحنة (J&T)",
    isDelivered: false,
    isReturn: false,
    isOutForDelivery: false,
  };
}

/**
 * Maps generic / third-party courier status strings
 */
export function mapGenericCourierStatus(rawStatus: string): CarrierStatusMappingResult {
  const s = String(rawStatus || "").trim().toLowerCase();

  if (s.includes("deliver") || s.includes("تسليم") || s.includes("تم التوصيل") || s.includes("paid")) {
    return {
      status: "delivered",
      labelAr: "تم التسليم للعميل",
      isDelivered: true,
      isReturn: false,
      isOutForDelivery: false,
    };
  }

  if (s.includes("return") || s.includes("مرتجع") || s.includes("cancel") || s.includes("رفض") || s.includes("مرفوض")) {
    return {
      status: "returned",
      labelAr: "طرد مرتجع",
      isDelivered: false,
      isReturn: true,
      isOutForDelivery: false,
    };
  }

  if (s.includes("transit") || s.includes("شحن") || s.includes("مع المندوب") || s.includes("out") || s.includes("picked")) {
    return {
      status: "handed_to_carrier",
      labelAr: "قيد الشحن والتوصيل",
      isDelivered: false,
      isReturn: false,
      isOutForDelivery: s.includes("out") || s.includes("مندوب"),
    };
  }

  return {
    status: "new",
    labelAr: "جديد بالمخزن",
    isDelivered: false,
    isReturn: false,
    isOutForDelivery: false,
  };
}

/**
 * Normalizes any incoming webhook payload from Bosta, J&T, Aramex, or Generic into standard CarrierTrackingEvent
 */
export function normalizeCarrierWebhookPayload(
  carrierParam: string,
  body: any
): CarrierTrackingEvent | null {
  if (!body || typeof body !== "object") return null;

  const carrier = (carrierParam || "generic").toLowerCase() as CarrierType;

  // 1. BOSTA WEBHOOK FORMAT
  // Bosta sends { _id, trackingNumber, state: { value: "Delivered", code: 40 }, notes, ... }
  // or flat { trackingNumber, state: "Delivered" } or { type: "UpdateState", data: { ... } }
  if (carrier === "bosta") {
    const data = body.data || body;
    const trackingNumber =
      data.trackingNumber ||
      data._id ||
      data.tracking_number ||
      data.waybill ||
      data.code ||
      "";

    const merchantOrderId =
      data.businessReference ||
      data.orderId ||
      data.order_id ||
      data.reference ||
      undefined;

    const rawState =
      (typeof data.state === "object" ? data.state?.value || data.state?.code : data.state) ||
      data.status ||
      "";

    const mapped = mapBostaStatus(rawState);

    return {
      carrier: "bosta",
      trackingNumber: String(trackingNumber).trim(),
      merchantOrderId: merchantOrderId ? String(merchantOrderId).trim() : undefined,
      status: mapped.status,
      rawStatus: String(rawState),
      statusReason: data.notes || data.reason || data.state?.notes || undefined,
      eventTimestamp: data.updatedAt || data.createdAt || new Date().toISOString(),
      recipientPhone: data.receiver?.phone || data.phone || undefined,
      codAmount: data.cod ? Number(data.cod) : undefined,
      notes: mapped.labelAr,
    };
  }

  // 2. J&T EXPRESS WEBHOOK FORMAT
  // J&T sends { billCode, scanType, scanDesc, scanTime, ... }
  // or { data: [ { billCode, ... } ] }
  if (carrier === "jnt") {
    const item = Array.isArray(body.data) ? body.data[0] : body.data || body;
    const trackingNumber = item.billCode || item.waybillNo || item.trackingNo || item.code || "";
    const merchantOrderId = item.orderId || item.referenceNo || item.customerOrderId || undefined;
    const rawStatus = item.scanType || item.scanDesc || item.status || "";

    const mapped = mapJntStatus(rawStatus);

    return {
      carrier: "jnt",
      trackingNumber: String(trackingNumber).trim(),
      merchantOrderId: merchantOrderId ? String(merchantOrderId).trim() : undefined,
      status: mapped.status,
      rawStatus: String(rawStatus),
      statusReason: item.scanDesc || item.remark || undefined,
      eventTimestamp: item.scanTime || new Date().toISOString(),
      recipientPhone: item.receiverPhone || undefined,
      notes: mapped.labelAr,
    };
  }

  // 3. GENERIC / ARAMEX / CUSTOM WEBHOOK FORMAT
  const trackingNumber =
    body.tracking_number ||
    body.trackingNumber ||
    body.waybill ||
    body.code ||
    body.id ||
    "";

  const merchantOrderId =
    body.order_id ||
    body.orderId ||
    body.merchant_order_id ||
    body.reference ||
    undefined;

  const rawStatus =
    body.status ||
    body.delivery_status ||
    body.state ||
    body.event ||
    "";

  const mapped = mapGenericCourierStatus(String(rawStatus));

  return {
    carrier,
    trackingNumber: String(trackingNumber).trim(),
    merchantOrderId: merchantOrderId ? String(merchantOrderId).trim() : undefined,
    status: mapped.status,
    rawStatus: String(rawStatus),
    statusReason: body.reason || body.notes || undefined,
    eventTimestamp: body.timestamp || new Date().toISOString(),
    recipientPhone: body.phone || body.customer_phone || undefined,
    notes: mapped.labelAr,
  };
}
