"use server";

import { createClient } from "@/lib/supabase/server";
import { Order } from "@/types/database";
import {
  OrderAuditEvent,
  createAuditEvent,
  buildOrderFullTimeline,
} from "@/lib/audit/orderAuditEngine";

const AUDIT_MAP_KEY = "order_audit_trail_map";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Retrieves the raw recorded audit events map from app_settings
 */
export async function getOrderAuditEventsMapAction(): Promise<
  ActionResult<Record<string, OrderAuditEvent[]>>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const { data, error } = await (supabase
      .from("app_settings") as any)
      .select("value")
      .eq("key", AUDIT_MAP_KEY)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || typeof data.value !== "object" || data.value === null) {
      return { success: true, data: {} };
    }

    return { success: true, data: data.value as Record<string, OrderAuditEvent[]> };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Records an audit event for a specific order
 */
export async function recordOrderAuditAction(
  orderId: string,
  action: Parameters<typeof createAuditEvent>[1],
  title: string,
  description: string,
  actor = "التاجر",
  metadata?: Record<string, any>
): Promise<ActionResult<OrderAuditEvent>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const mapRes = await getOrderAuditEventsMapAction();
    const currentMap = mapRes.data || {};

    const newEvent = createAuditEvent(orderId, action, title, description, actor, metadata);

    const existingEvents = currentMap[orderId] || [];
    currentMap[orderId] = [newEvent, ...existingEvents];

    const { error: upsertErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: AUDIT_MAP_KEY,
          value: currentMap,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (upsertErr) {
      return { success: false, error: upsertErr.message };
    }

    return { success: true, data: newEvent };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Records an audit event for multiple orders at once (e.g. batch handover or status updates)
 */
export async function recordBatchOrderAuditAction(
  orderIds: string[],
  action: Parameters<typeof createAuditEvent>[1],
  title: string,
  description: string,
  actor = "التاجر",
  metadata?: Record<string, any>
): Promise<ActionResult<{ recordedCount: number }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    if (!orderIds || orderIds.length === 0) {
      return { success: true, data: { recordedCount: 0 } };
    }

    const mapRes = await getOrderAuditEventsMapAction();
    const currentMap = mapRes.data || {};

    for (const orderId of orderIds) {
      const newEvent = createAuditEvent(orderId, action, title, description, actor, metadata);
      const existingEvents = currentMap[orderId] || [];
      currentMap[orderId] = [newEvent, ...existingEvents];
    }

    const { error: upsertErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: AUDIT_MAP_KEY,
          value: currentMap,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (upsertErr) {
      return { success: false, error: upsertErr.message };
    }

    return { success: true, data: { recordedCount: orderIds.length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Retrieves the full unified timeline (synthesized baseline + explicit audit logs) for an order
 */
export async function getOrderTimelineAction(
  orderId: string
): Promise<ActionResult<{ order: Order; timeline: OrderAuditEvent[] }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    // 1. Fetch Order data
    const { data: order, error: orderErr } = await (supabase
      .from("orders") as any)
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: "لم يتم العثور على الأوردر المطلوب" };
    }

    // 2. Fetch recorded audit events
    const mapRes = await getOrderAuditEventsMapAction();
    const currentMap = mapRes.data || {};
    const recordedEvents = currentMap[orderId] || [];

    // 3. Build unified chronological timeline
    const timeline = buildOrderFullTimeline(order as Order, recordedEvents);

    return {
      success: true,
      data: {
        order: order as Order,
        timeline,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}
