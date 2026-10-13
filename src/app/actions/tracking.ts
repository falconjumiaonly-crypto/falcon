"use server";

import { getAutomationSupabaseClient } from "@/lib/api-auth";
import { Order } from "@/types/database";
import {
  PublicOrderTrackingData,
  sanitizeOrderForPublicTracking,
} from "@/lib/publicTracking";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Public server action for retrieving order tracking data safely without authentication.
 * Never leaks merchant profit, wholesale cost, or internal notes.
 */
export async function getPublicOrderTrackingAction(
  query: string
): Promise<ActionResult<PublicOrderTrackingData>> {
  try {
    const clean = query.trim().replace(/^#+/, "");
    if (!clean) {
      return { success: false, error: "يرجى إدخال كود الأوردر أو رقم البوليصة" };
    }

    const supabase = await getAutomationSupabaseClient();

    // 1. Try exact UUID match
    let { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", clean)
      .is("deleted_at", null)
      .maybeSingle();

    // 2. If not found and input looks like short UUID (e.g. 8 characters)
    if (!order && clean.length >= 6) {
      const { data: prefixMatches } = await supabase
        .from("orders")
        .select("*")
        .ilike("id", `${clean}%`)
        .is("deleted_at", null)
        .limit(1);

      if (prefixMatches && prefixMatches.length > 0) {
        order = prefixMatches[0];
      }
    }

    // 3. Fallback: match by phone number (clean numeric)
    if (!order && /^[0-9]{10,14}$/.test(clean)) {
      const cleanPhone = clean.startsWith("20") ? "0" + clean.slice(2) : clean;
      const { data: phoneMatches } = await supabase
        .from("orders")
        .select("*")
        .eq("phone_primary", cleanPhone)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (phoneMatches && phoneMatches.length > 0) {
        order = phoneMatches[0];
      }
    }

    if (error) {
      return { success: false, error: "تعذر الاستعلام عن الشحنة" };
    }

    if (!order) {
      return {
        success: false,
        error: "لم يتم العثور على شحنة تطابق هذا الرقم. يرجى التأكد من كود الطلب.",
      };
    }

    const sanitized = sanitizeOrderForPublicTracking(order as Order);
    return { success: true, data: sanitized };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}
