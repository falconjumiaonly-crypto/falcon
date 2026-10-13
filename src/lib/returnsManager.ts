import { Order, DeliveryStatus } from "@/types/database";

export const PHYSICAL_RETURN_TAG = "[تم استلام المرتجع بالمخزن]";
export const DISPUTED_LOST_TAG = "[مطالبة طرد مفقود]";

export interface GovernorateReturnLoss {
  governorate: string;
  totalOrders: number;
  returnedCount: number;
  returnRate: number; // percentage (0 - 100)
  penaltyLoss: number; // shipping fees paid without revenue
}

export interface ReturnsMetrics {
  totalOrdersCount: number;
  totalReturnedCount: number;
  returnRate: number; // overall return percentage
  totalShippingPenaltyLoss: number; // total shipping fee loss deducted by couriers
  
  // Physical inventory custody check
  physicalReceivedCount: number; // packages safely back on merchant warehouse shelves
  physicalMissingCount: number; // packages reported returned by carrier but NOT yet physically received (theft/loss risk!)
  merchandiseValueAtRisk: number; // value of products missing with carrier

  returnsByGovernorate: GovernorateReturnLoss[];
}

/**
 * Checks if a returned package has been physically checked-in at the merchant warehouse
 */
export function isPhysicalReturnReceived(order: Order): boolean {
  if (order.delivery_status !== "returned") return false;
  const notes = order.important_notes || "";
  return (
    notes.includes(PHYSICAL_RETURN_TAG) ||
    notes.includes("تم استلام المرتجع") ||
    notes.includes("استلام مخزن") ||
    notes.includes("فحص سليم")
  );
}

/**
 * Checks if a returned package has an open dispute/claim against the courier company
 */
export function isReturnDisputedLost(order: Order): boolean {
  if (order.delivery_status !== "returned") return false;
  const notes = order.important_notes || "";
  return (
    notes.includes(DISPUTED_LOST_TAG) ||
    notes.includes("طرد مفقود") ||
    notes.includes("مطالبة تعويض")
  );
}

/**
 * Calculates comprehensive return statistics and loss indicators
 */
export function calculateReturnsMetrics(orders: Order[]): ReturnsMetrics {
  let totalReturnedCount = 0;
  let totalShippingPenaltyLoss = 0;
  let physicalReceivedCount = 0;
  let physicalMissingCount = 0;
  let merchandiseValueAtRisk = 0;

  const govMap = new Map<string, { total: number; returned: number; loss: number }>();

  orders.forEach((order) => {
    const gov = order.governorate || "غير محدد";
    const existingGov = govMap.get(gov) || { total: 0, returned: 0, loss: 0 };
    existingGov.total++;

    const isReturned = order.delivery_status === "returned";
    const shipping = Number(order.shipping_cost || 0);
    const orderTotal = Number(order.order_total || 0);

    if (isReturned) {
      totalReturnedCount++;
      totalShippingPenaltyLoss += shipping;
      existingGov.returned++;
      existingGov.loss += shipping;

      if (isPhysicalReturnReceived(order)) {
        physicalReceivedCount++;
      } else {
        physicalMissingCount++;
        merchandiseValueAtRisk += Math.max(0, orderTotal - shipping);
      }
    }

    govMap.set(gov, existingGov);
  });

  const totalOrdersCount = orders.length;
  const returnRate =
    totalOrdersCount > 0 ? (totalReturnedCount / totalOrdersCount) * 100 : 0;

  const returnsByGovernorate: GovernorateReturnLoss[] = Array.from(govMap.entries())
    .map(([gov, stat]) => ({
      governorate: gov,
      totalOrders: stat.total,
      returnedCount: stat.returned,
      returnRate: stat.total > 0 ? (stat.returned / stat.total) * 100 : 0,
      penaltyLoss: stat.loss,
    }))
    .filter((g) => g.returnedCount > 0)
    .sort((a, b) => b.penaltyLoss - a.penaltyLoss);

  return {
    totalOrdersCount,
    totalReturnedCount,
    returnRate: Number(returnRate.toFixed(1)),
    totalShippingPenaltyLoss,
    physicalReceivedCount,
    physicalMissingCount,
    merchandiseValueAtRisk,
    returnsByGovernorate,
  };
}

/**
 * Formulates updated note payload marking physical package as safely received in warehouse
 */
export function buildPhysicalReturnReceivedNote(currentNotes?: string | null): string {
  const existing = (currentNotes || "").replace(PHYSICAL_RETURN_TAG, "").trim();
  const timestamp = new Date().toLocaleDateString("ar-EG");
  const prefix = `${PHYSICAL_RETURN_TAG} (بتاريخ ${timestamp})`;
  return existing ? `${prefix} - ${existing}` : prefix;
}

/**
 * Formulates updated note payload filing a lost parcel claim against the courier company
 */
export function buildDisputedLostNote(currentNotes?: string | null, claimReason?: string): string {
  const existing = (currentNotes || "").replace(DISPUTED_LOST_TAG, "").trim();
  const timestamp = new Date().toLocaleDateString("ar-EG");
  const reasonText = claimReason ? `: ${claimReason}` : "";
  const prefix = `${DISPUTED_LOST_TAG} (مطالبة ${timestamp}${reasonText})`;
  return existing ? `${prefix} - ${existing}` : prefix;
}
