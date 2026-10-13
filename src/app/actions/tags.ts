"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  OrderTag,
  PRESET_TAGS,
  createTagDefinition,
  embedTagsInNotes,
  stripTagsFromNotes,
  extractTagsFromNotes,
} from "@/lib/tags/tagsEngine";

const CUSTOM_TAGS_KEY = "order_custom_tags";
const TAGS_MAP_KEY = "order_tags_map";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Retrieves the merchant's custom created tags
 */
export async function getCustomTagsAction(): Promise<ActionResult<OrderTag[]>> {
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
      .eq("key", CUSTOM_TAGS_KEY)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || !Array.isArray(data.value)) {
      return { success: true, data: [] };
    }

    return { success: true, data: data.value as OrderTag[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Creates and registers a new custom tag
 */
export async function createCustomTagAction(
  name: string,
  color = "slate"
): Promise<ActionResult<OrderTag>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    if (!name.trim()) {
      return { success: false, error: "يرجى كتابة اسم الوسم" };
    }

    const currentRes = await getCustomTagsAction();
    const list = currentRes.data || [];

    const id = `custom_${Date.now()}`;
    const newTag = createTagDefinition(id, name, color, false);

    const updated = [...list, newTag];

    const { error: upsertErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: CUSTOM_TAGS_KEY,
          value: updated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (upsertErr) {
      return { success: false, error: upsertErr.message };
    }

    revalidatePath("/orders");
    return { success: true, data: newTag };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Retrieves the registry map of assigned tags for all orders
 */
export async function getOrderTagsMapAction(): Promise<ActionResult<Record<string, string[]>>> {
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
      .eq("key", TAGS_MAP_KEY)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || typeof data.value !== "object" || data.value === null) {
      return { success: true, data: {} };
    }

    return { success: true, data: data.value as Record<string, string[]> };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Assigns or replaces tags for a single order
 */
export async function assignTagsToOrderAction(
  orderId: string,
  tagIds: string[],
  syncToNotes = true
): Promise<ActionResult<string[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    // 1. Update Map in app_settings
    const mapRes = await getOrderTagsMapAction();
    const currentMap = mapRes.data || {};
    currentMap[orderId] = tagIds;

    await (supabase.from("app_settings") as any).upsert(
      {
        key: TAGS_MAP_KEY,
        value: currentMap,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    // 2. Synchronize to order's important_notes so courier waybills receive the instructions
    if (syncToNotes) {
      const { data: order } = await (supabase
        .from("orders") as any)
        .select("important_notes")
        .eq("id", orderId)
        .single();

      if (order) {
        const customRes = await getCustomTagsAction();
        const allTags = [...PRESET_TAGS, ...(customRes.data || [])];
        const newNotes = embedTagsInNotes(order.important_notes, tagIds, allTags);

        await (supabase.from("orders") as any)
          .update({
            important_notes: newNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      }
    }

    revalidatePath("/orders");
    return { success: true, data: tagIds };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Batch assigns / appends tags to multiple selected orders
 */
export async function batchAssignTagsAction(
  orderIds: string[],
  tagIdsToAdd: string[],
  syncToNotes = true
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    if (orderIds.length === 0 || tagIdsToAdd.length === 0) {
      return { success: true, data: { updatedCount: 0 } };
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const mapRes = await getOrderTagsMapAction();
    const currentMap = mapRes.data || {};

    const customRes = await getCustomTagsAction();
    const allTags = [...PRESET_TAGS, ...(customRes.data || [])];

    // Fetch existing notes for selected orders
    const { data: orders } = await (supabase
      .from("orders") as any)
      .select("id, important_notes")
      .in("id", orderIds);

    for (const id of orderIds) {
      const existing = currentMap[id] || [];
      const merged = Array.from(new Set([...existing, ...tagIdsToAdd]));
      currentMap[id] = merged;

      if (syncToNotes && orders) {
        const ord = orders.find((o: any) => o.id === id);
        if (ord) {
          const notesTags = extractTagsFromNotes(ord.important_notes);
          const fullMerged = Array.from(new Set([...notesTags, ...merged]));
          const newNotes = embedTagsInNotes(ord.important_notes, fullMerged, allTags);

          await (supabase.from("orders") as any)
            .update({
              important_notes: newNotes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
        }
      }
    }

    await (supabase.from("app_settings") as any).upsert(
      {
        key: TAGS_MAP_KEY,
        value: currentMap,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    revalidatePath("/orders");
    return { success: true, data: { updatedCount: orderIds.length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}
