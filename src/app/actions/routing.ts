"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Order } from "@/types/database";
import {
  getSmartCarrierRecommendation,
  batchSmartRouteOrders,
  RoutingWeights,
  BatchRoutingSummary,
} from "@/lib/routing/carrierSmartRouter";
import { recordBatchOrderAuditAction } from "@/app/actions/audit";

export interface RoutingActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Gets smart courier recommendation for a single governorate
 */
export async function getSmartCarrierRecommendationAction(
  governorate: string
): Promise<RoutingActionResult> {
  try {
    const recommendation = getSmartCarrierRecommendation(governorate);
    return {
      success: true,
      data: recommendation,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "فشل احتساب التوجيه الذكي",
    };
  }
}

/**
 * Batch applies optimal smart routing to a selection of orders in database
 */
export async function applySmartCarrierRoutingAction(
  orderIds: string[],
  weights?: RoutingWeights
): Promise<RoutingActionResult<{ updatedCount: number; summary: BatchRoutingSummary }>> {
  try {
    if (!orderIds || orderIds.length === 0) {
      return { success: false, error: "لم يتم تحديد أي شحنات للتوجيه" };
    }

    const supabase = await createClient();

    // 1. Fetch targeted orders
    const { data: orders, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .in("id", orderIds)
      .is("deleted_at", null);

    if (fetchErr || !orders) {
      return { success: false, error: fetchErr?.message || "فشل جلب الشحنات" };
    }

    const ordersList = orders as Order[];
    const summary = batchSmartRouteOrders(ordersList, weights);

    // 2. Update each order with designated courier and updated estimated shipping cost
    let updatedCount = 0;
    const auditEntries = [];

    for (const rec of summary.recommendations) {
      const order = ordersList.find((o) => o.id === rec.orderId);
      if (!order) continue;

      let cleanNotes = order.important_notes || "";
      // Strip previous courier tags if present
      cleanNotes = cleanNotes.replace(/\[شركة الشحن:.*?\]/g, "").trim();
      const updatedNotes = cleanNotes
        ? `[شركة الشحن: ${rec.recommendedCarrierName}] ${cleanNotes}`
        : `[شركة الشحن: ${rec.recommendedCarrierName}]`;

      const { error: updateErr } = await (supabase.from("orders") as any)
        .update({
          important_notes: updatedNotes,
          shipping_cost: rec.expectedCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rec.orderId);

      if (!updateErr) {
        updatedCount++;
        auditEntries.push({
          order_id: rec.orderId,
          action_type: "carrier_routed",
          actor_name: "Falcon Smart Router AI",
          notes: `تم التوجيه آلياً إلى ${rec.recommendedCarrierName} (نسبة التسليم: ${rec.expectedRate}%، السبب: ${rec.reason})`,
          metadata: {
            carrierKey: rec.recommendedCarrierKey,
            carrierName: rec.recommendedCarrierName,
            expectedCost: rec.expectedCost,
            expectedRate: rec.expectedRate,
          },
        });
      }
    }

    // 3. Record batch audit trail if updated
    if (updatedCount > 0) {
      const affectedIds = summary.recommendations.map((r) => r.orderId);
      await recordBatchOrderAuditAction(
        affectedIds,
        "carrier_synced",
        "توجيه ذكي لشركات الشحن",
        `تم توجيه وتعيين شركات الشحن آلياً بواسطة Falcon Smart Router AI`,
        "Falcon Smart Router AI",
        {
          assignedBreakdown: summary.assignedBreakdown,
          projectedDeliveryRate: summary.projectedAvgDeliveryRate,
        }
      );
    }

    revalidatePath("/orders");

    return {
      success: true,
      data: {
        updatedCount,
        summary,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "حدث خطأ أثناء تطبيق التوجيه الذكي",
    };
  }
}
