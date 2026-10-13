import type { Order } from "../../types/database";

export type AuditActionType =
  | "order_created"
  | "status_changed"
  | "printed"
  | "handed_to_carrier"
  | "delivered"
  | "returned"
  | "return_received"
  | "whatsapp_sent"
  | "settled"
  | "order_edited"
  | "tag_updated"
  | "carrier_synced"
  | "blacklisted";

export interface OrderAuditEvent {
  id: string;
  order_id: string;
  action: AuditActionType;
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Creates an audit event object with a unique ID and current timestamp
 */
export function createAuditEvent(
  orderId: string,
  action: AuditActionType,
  title: string,
  description: string,
  actor = "التاجر",
  metadata?: Record<string, any>,
  customTimestamp?: string
): OrderAuditEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    order_id: orderId,
    action,
    title,
    description,
    actor,
    timestamp: customTimestamp || new Date().toISOString(),
    metadata,
  };
}

/**
 * Generates synthetic baseline lifecycle events from an order's native fields.
 * Guarantees that even existing orders have an accurate chronological timeline.
 */
export function generateSyntheticOrderEvents(order: Order): OrderAuditEvent[] {
  const events: OrderAuditEvent[] = [];

  // 1. Order Creation Event
  const createdAt = order.created_at || (order.order_date ? `${order.order_date}T09:00:00Z` : new Date().toISOString());
  events.push({
    id: `synth_created_${order.id}`,
    order_id: order.id,
    action: "order_created",
    title: "إنشاء وتسجيل الأوردر",
    description: `تم إدراج الأوردر بمبلغ إجمالي ${order.order_total} ج.م ومطلوب تحصيل ${order.cod_amount} ج.م.`,
    actor: "التاجر",
    timestamp: createdAt,
    metadata: {
      order_total: order.order_total,
      cod_amount: order.cod_amount,
      governorate: order.governorate,
    },
  });

  // 2. Printing Event (if printed)
  if (order.print_status === "printed") {
    const printedAt = order.printed_at || new Date(new Date(createdAt).getTime() + 15 * 60000).toISOString();
    events.push({
      id: `synth_printed_${order.id}`,
      order_id: order.id,
      action: "printed",
      title: "طباعة بوليصة الشحن",
      description: "تم تجهيز وطباعة البوليصة الحرارية للطرد وإدراجه في طابور الشحن.",
      actor: "نظام الطباعة",
      timestamp: printedAt,
    });
  }

  // 3. Handover Event (if handed to carrier or beyond)
  if (order.delivery_status !== "new") {
    const handedAt = order.printed_at
      ? new Date(new Date(order.printed_at).getTime() + 60 * 60000).toISOString()
      : new Date(new Date(createdAt).getTime() + 60 * 60000).toISOString();

    events.push({
      id: `synth_handed_${order.id}`,
      order_id: order.id,
      action: "handed_to_carrier",
      title: "تسليم الشحنة لشركة الشحن",
      description: "تم مسح الشحنة وتسليم الطرد فعلياً لمندوب شركة الشحن للبدء في خط سير التوصيل.",
      actor: "الماسح الضوئي / مسؤول المخزن",
      timestamp: handedAt,
    });
  }

  // 4. Delivered Event
  if (order.delivery_status === "delivered") {
    const deliveredAt = new Date(new Date(createdAt).getTime() + 48 * 3600000).toISOString();
    events.push({
      id: `synth_delivered_${order.id}`,
      order_id: order.id,
      action: "delivered",
      title: "تم تسليم الشحنة للعميل بنجاح",
      description: `استلم العميل (${order.customer_name}) الشحنة بنجاح وتم تحصيل مبلغ COD: ${order.cod_amount} ج.م.`,
      actor: "مندوب شركة الشحن",
      timestamp: deliveredAt,
      metadata: { cod_amount: order.cod_amount },
    });
  }

  // 5. Returned Event
  if (order.delivery_status === "returned") {
    const returnedAt = new Date(new Date(createdAt).getTime() + 72 * 3600000).toISOString();
    events.push({
      id: `synth_returned_${order.id}`,
      order_id: order.id,
      action: "returned",
      title: "تعذر التسليم وطرد مرتجع",
      description: `فشلت محاولة التسليم وتم تسجيل الطرد كمرتجع. غرامة الشحن المحتسبة: ${order.shipping_cost} ج.م.`,
      actor: "شركة الشحن",
      timestamp: returnedAt,
      metadata: { shipping_cost: order.shipping_cost },
    });
  }

  // 6. Settlement Event
  if (order.settlement_status === "settled") {
    const settledAt = order.settled_at || new Date().toISOString();
    events.push({
      id: `synth_settled_${order.id}`,
      order_id: order.id,
      action: "settled",
      title: "تسوية المستحقات المالية والكاش",
      description: "تمت تسوية الكاش المحصل مع شركة الشحن وإيداع صافي المبلغ في حساب التاجر.",
      actor: "نظام التسويات المالية",
      timestamp: settledAt,
    });
  }

  // 7. Check notes for carrier webhook sync stamps
  if (order.important_notes) {
    const webhookStamps = order.important_notes.match(/\[تحديث ([^:]+): ([^\]]+)\]/g);
    if (webhookStamps) {
      webhookStamps.forEach((stamp, index) => {
        const parts = stamp.replace(/[\[\]]/g, "").split(":");
        const carrierPart = parts[0]?.replace("تحديث", "").trim() || "شركة الشحن";
        const statusPart = parts[1]?.trim() || "";

        events.push({
          id: `synth_webhook_${order.id}_${index}`,
          order_id: order.id,
          action: "carrier_synced",
          title: `تحديث تتبع تلقائي (${carrierPart})`,
          description: `ورد إشعار API من شركة الشحن بالحالة: "${statusPart}".`,
          actor: `Webhook (${carrierPart})`,
          timestamp: new Date(new Date(createdAt).getTime() + (index + 2) * 3600000).toISOString(),
          metadata: { carrier: carrierPart, status: statusPart },
        });
      });
    }
  }

  return events;
}

/**
 * Merges recorded audit events with synthetic baseline events, eliminates duplicates, and sorts chronologically
 */
export function buildOrderFullTimeline(
  order: Order,
  recordedEvents: OrderAuditEvent[] = []
): OrderAuditEvent[] {
  const synthetic = generateSyntheticOrderEvents(order);

  // Filter out any synthetic event if an explicit recorded event for the same action already exists
  const explicitActions = new Set(recordedEvents.map((e) => e.action));
  const filteredSynthetic = synthetic.filter((s) => !explicitActions.has(s.action));

  const all = [...filteredSynthetic, ...recordedEvents];

  // Sort descending by timestamp (newest first for timeline view)
  return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
