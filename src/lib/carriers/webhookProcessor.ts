import { revalidatePath } from "next/cache";
import { getAutomationSupabaseClient } from "@/lib/api-auth";
import { Order, DeliveryStatus } from "@/types/database";
import { normalizePhoneNumber } from "@/lib/excel-import";
import {
  CarrierType,
  CarrierTrackingEvent,
  WebhookProcessingResult,
} from "./types";
import { normalizeCarrierWebhookPayload } from "./statusMapper";

/**
 * Searches and finds an order by tracking number, order ID, or phone
 */
export async function findMatchingOrder(
  supabase: any,
  event: CarrierTrackingEvent
): Promise<{ order: Order | null; matchedBy: "id" | "short_id" | "phone" | "notes" | null }> {
  const { trackingNumber, merchantOrderId, recipientPhone } = event;

  // 1. Check merchantOrderId or trackingNumber as exact UUID
  const candidateIds = [merchantOrderId, trackingNumber].filter(Boolean) as string[];

  for (const candidate of candidateIds) {
    const cleanId = candidate.replace(/^#/, "").trim();

    // Check exact UUID length or match
    if (cleanId.length >= 32) {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", cleanId)
        .is("deleted_at", null)
        .maybeSingle();

      if (data) return { order: data as Order, matchedBy: "id" };
    }

    // Check short 8-char hex prefix
    if (cleanId.length === 8) {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .ilike("id", `${cleanId}%`)
        .is("deleted_at", null)
        .limit(1);

      if (data && data.length > 0) return { order: data[0] as Order, matchedBy: "short_id" };
    }
  }

  // 2. Check important_notes containing tracking number
  if (trackingNumber && trackingNumber.length >= 4) {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .ilike("important_notes", `%${trackingNumber}%`)
      .is("deleted_at", null)
      .limit(1);

    if (data && data.length > 0) return { order: data[0] as Order, matchedBy: "notes" };
  }

  // 3. Fallback: Check recipient phone if provided
  if (recipientPhone) {
    const normPhone = normalizePhoneNumber(recipientPhone);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .or(`phone_primary.eq.${normPhone},phone_primary.ilike.%${normPhone}%`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) return { order: data[0] as Order, matchedBy: "phone" };
  }

  return { order: null, matchedBy: null };
}

/**
 * Formulates the updated notes string with a clean carrier tracking stamp
 */
export function buildCarrierTrackingNote(
  existingNotes: string | null | undefined,
  carrier: CarrierType,
  rawStatus: string,
  eventNotes?: string
): string {
  const existing = existingNotes || "";
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-EG");
  const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  const carrierLabels: Record<CarrierType, string> = {
    bosta: "بوسطة",
    jnt: "J&T Express",
    aramex: "أرامكس",
    generic: "شركة الشحن",
  };

  const carrierName = carrierLabels[carrier] || carrier;
  const stamp = `[تتبع ${carrierName}: ${rawStatus} (${dateStr} ${timeStr})]`;

  // Avoid duplicate stamps if same status received recently
  if (existing.includes(rawStatus) && existing.includes(carrierName)) {
    return existing;
  }

  const details = eventNotes ? ` - ${eventNotes}` : "";
  return existing ? `${stamp}${details}\n${existing}` : `${stamp}${details}`;
}

/**
 * Processes incoming carrier webhook payload and synchronizes order status in database
 */
export async function processCarrierWebhook(
  carrierParam: string,
  body: any
): Promise<WebhookProcessingResult> {
  try {
    const event = normalizeCarrierWebhookPayload(carrierParam, body);
    if (!event) {
      return {
        success: false,
        message: "تعذر قراءة بيانات الويب هوك أو الصيغة غير مدعومة",
      };
    }

    if (!event.trackingNumber && !event.merchantOrderId && !event.recipientPhone) {
      return {
        success: false,
        message: "لم يتم العثور على رقم تتبع أو كود أوردر في رسالة الويب هوك",
      };
    }

    const supabase = await getAutomationSupabaseClient();
    const { order, matchedBy } = await findMatchingOrder(supabase, event);

    if (!order) {
      return {
        success: false,
        message: `لم يتم العثور على أوردر يطابق رقم التتبع (${event.trackingNumber}) في النظام`,
      };
    }

    const previousStatus = order.delivery_status;
    const newStatus = event.status;

    // Build updated notes
    const updatedNotes = buildCarrierTrackingNote(
      order.important_notes,
      event.carrier,
      event.rawStatus,
      event.statusReason
    );

    const updatePayload: Record<string, unknown> = {
      delivery_status: newStatus,
      important_notes: updatedNotes,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await (supabase
      .from("orders") as any)
      .update(updatePayload)
      .eq("id", order.id);

    if (updateErr) {
      return {
        success: false,
        message: `فشل تحديث حالة الأورار في قاعدة البيانات: ${updateErr.message}`,
        orderId: order.id,
      };
    }

    try {
      revalidatePath("/orders");
      revalidatePath("/settlements");
      revalidatePath(`/track/${order.id}`);
    } catch {
      // Revalidation may fail in pure API context without request store
    }

    return {
      success: true,
      message: `تم تحديث حالة الأوردر #${order.id.slice(0, 8)} من (${previousStatus}) إلى (${newStatus}) بنجاح عبر ${event.carrier}`,
      orderId: order.id,
      matchedBy: matchedBy || undefined,
      previousStatus,
      newStatus,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return {
      success: false,
      message: `فشل معالجة الويب هوك: ${msg}`,
    };
  }
}
