"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Order } from "@/types/database";
import { normalizePhoneNumber } from "@/lib/excel-import";
import {
  BlacklistEntry,
  CustomerRiskProfile,
  calculateCustomerRisk,
} from "@/lib/risk/customerRiskEngine";

const BLACKLIST_KEY = "customer_blacklist";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Retrieves the merchant's list of blacklisted customer numbers
 */
export async function getBlacklistAction(): Promise<ActionResult<BlacklistEntry[]>> {
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
      .eq("key", BLACKLIST_KEY)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || !Array.isArray(data.value)) {
      return { success: true, data: [] };
    }

    return { success: true, data: data.value as BlacklistEntry[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Adds or updates a customer in the blacklist
 */
export async function addToBlacklistAction(
  phone: string,
  name: string,
  reason: string
): Promise<ActionResult<BlacklistEntry>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const normPhone = normalizePhoneNumber(phone);
    if (!normPhone || normPhone.length < 10) {
      return { success: false, error: "رقم الهاتف غير صالح" };
    }

    const currentRes = await getBlacklistAction();
    const list = currentRes.data || [];

    const newEntry: BlacklistEntry = {
      phone: normPhone,
      name: name.trim() || "عميل محظور",
      reason: reason.trim() || "رفض استلام متكرر وإلغاء شحنات",
      addedAt: new Date().toISOString(),
    };

    const updated = [newEntry, ...list.filter((b) => b.phone !== normPhone)];

    const { error: upsertErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: BLACKLIST_KEY,
          value: updated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (upsertErr) {
      return { success: false, error: upsertErr.message };
    }

    revalidatePath("/orders");
    return { success: true, data: newEntry };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Removes a customer phone number from the blacklist
 */
export async function removeFromBlacklistAction(phone: string): Promise<ActionResult<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const normPhone = normalizePhoneNumber(phone);
    const currentRes = await getBlacklistAction();
    const list = currentRes.data || [];

    const filtered = list.filter((b) => b.phone !== normPhone);

    const { error: upsertErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: BLACKLIST_KEY,
          value: filtered,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (upsertErr) {
      return { success: false, error: upsertErr.message };
    }

    revalidatePath("/orders");
    return { success: true, data: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Real-time Customer Risk Scoring query by phone number
 */
export async function checkCustomerRiskAction(
  phone: string
): Promise<ActionResult<CustomerRiskProfile>> {
  try {
    const supabase = await createClient();
    const normPhone = normalizePhoneNumber(phone);

    if (!normPhone || normPhone.length < 10) {
      return {
        success: true,
        data: calculateCustomerRisk(phone, [], []),
      };
    }

    // 1. Fetch past customer orders
    const { data: customerOrders, error: ordersErr } = await (supabase
      .from("orders") as any)
      .select("*")
      .or(`phone_primary.ilike.%${normPhone}%,phone_secondary.ilike.%${normPhone}%`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // 2. Fetch blacklist
    const blacklistRes = await getBlacklistAction();
    const blacklist = blacklistRes.data || [];

    const riskProfile = calculateCustomerRisk(
      normPhone,
      (customerOrders as Order[]) || [],
      blacklist
    );

    return { success: true, data: riskProfile };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}
