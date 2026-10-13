"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { InventoryProduct, StockAdjustmentReason } from "@/lib/inventory/types";
import { DEFAULT_INVENTORY_PRODUCTS } from "@/lib/inventory/inventoryEngine";

const SETTINGS_KEY = "inventory_products";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Loads all inventory items from storage, seeding defaults if empty
 */
export async function getInventoryProductsAction(): Promise<ActionResult<InventoryProduct[]>> {
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
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || !Array.isArray(data.value) || data.value.length === 0) {
      // Seed starter products so merchant has a rich working system out-of-the-box
      await (supabase
        .from("app_settings") as any)
        .upsert(
          {
            key: SETTINGS_KEY,
            value: DEFAULT_INVENTORY_PRODUCTS,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      return { success: true, data: DEFAULT_INVENTORY_PRODUCTS };
    }

    return { success: true, data: data.value as InventoryProduct[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Creates or updates an inventory product
 */
export async function saveInventoryProductAction(
  product: Partial<InventoryProduct> & { name: string; sku: string }
): Promise<ActionResult<InventoryProduct>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const currentRes = await getInventoryProductsAction();
    const currentProducts = currentRes.data || [];

    const now = new Date().toISOString();
    let updatedList: InventoryProduct[] = [];
    let savedProduct: InventoryProduct;

    if (product.id) {
      // Update existing
      updatedList = currentProducts.map((p) => {
        if (p.id === product.id) {
          savedProduct = {
            ...p,
            ...product,
            updatedAt: now,
          } as InventoryProduct;
          return savedProduct;
        }
        return p;
      });
      // In case it wasn't found in current list
      if (!updatedList.some((p) => p.id === product.id)) {
        savedProduct = {
          id: product.id,
          sku: product.sku.trim().toUpperCase(),
          name: product.name.trim(),
          category: product.category || "عام",
          stockQuantity: Number(product.stockQuantity || 0),
          reservedQuantity: Number(product.reservedQuantity || 0),
          inTransitQuantity: Number(product.inTransitQuantity || 0),
          soldQuantity: Number(product.soldQuantity || 0),
          returnedPendingCheckin: Number(product.returnedPendingCheckin || 0),
          unitCost: Number(product.unitCost || 0),
          sellingPrice: Number(product.sellingPrice || 0),
          lowStockThreshold: Number(product.lowStockThreshold || 5),
          warehouseLocation: product.warehouseLocation || "المخزن الرئيسي",
          updatedAt: now,
        };
        updatedList.push(savedProduct);
      }
    } else {
      // Create new
      savedProduct = {
        id: `prod_${Date.now()}`,
        sku: product.sku.trim().toUpperCase(),
        name: product.name.trim(),
        category: product.category || "عام",
        stockQuantity: Number(product.stockQuantity || 0),
        reservedQuantity: 0,
        inTransitQuantity: 0,
        soldQuantity: 0,
        returnedPendingCheckin: 0,
        unitCost: Number(product.unitCost || 0),
        sellingPrice: Number(product.sellingPrice || 0),
        lowStockThreshold: Number(product.lowStockThreshold || 5),
        warehouseLocation: product.warehouseLocation || "المخزن الرئيسي",
        updatedAt: now,
      };
      updatedList.unshift(savedProduct);
    }

    const { error: upsertErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: SETTINGS_KEY,
          value: updatedList,
          updated_at: now,
        },
        { onConflict: "key" }
      );

    if (upsertErr) {
      return { success: false, error: upsertErr.message };
    }

    revalidatePath("/inventory");
    return { success: true, data: savedProduct! };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Removes a product from the inventory
 */
export async function deleteInventoryProductAction(productId: string): Promise<ActionResult<boolean>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const currentRes = await getInventoryProductsAction();
    const currentProducts = currentRes.data || [];
    const filtered = currentProducts.filter((p) => p.id !== productId);

    const { error: updateErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: SETTINGS_KEY,
          value: filtered,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath("/inventory");
    return { success: true, data: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}

/**
 * Quickly increments or decrements physical stock quantity
 */
export async function adjustProductStockAction(
  productId: string,
  delta: number,
  _reason?: StockAdjustmentReason
): Promise<ActionResult<number>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const currentRes = await getInventoryProductsAction();
    const currentProducts = currentRes.data || [];

    let newStock = 0;
    const updated = currentProducts.map((p) => {
      if (p.id === productId) {
        newStock = Math.max(0, (p.stockQuantity || 0) + delta);
        return {
          ...p,
          stockQuantity: newStock,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    const { error: updateErr } = await (supabase
      .from("app_settings") as any)
      .upsert(
        {
          key: SETTINGS_KEY,
          value: updated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath("/inventory");
    return { success: true, data: newStock };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: msg };
  }
}
