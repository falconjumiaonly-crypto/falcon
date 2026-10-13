import { Order, DeliveryStatus, PrintStatus } from "@/types/database";

export interface DispatchMetrics {
  totalOrders: number;
  remainingInWarehouse: {
    total: number;
    printedReady: number;
    unprinted: number;
    codAmount: number;
  };
  dispatchedWithCarrier: {
    total: number;
    codAmount: number;
  };
  delivered: {
    total: number;
    codAmount: number;
  };
  returned: {
    total: number;
    codAmount: number;
  };
}

/**
 * Calculates real-time operational dispatch metrics from the orders pool:
 * Tells the merchant exactly what is remaining in the warehouse vs dispatched with drivers.
 */
export function calculateDispatchMetrics(orders: Order[]): DispatchMetrics {
  let warehousePrintedReady = 0;
  let warehouseUnprinted = 0;
  let warehouseCod = 0;

  let dispatchedCount = 0;
  let dispatchedCod = 0;

  let deliveredCount = 0;
  let deliveredCod = 0;

  let returnedCount = 0;
  let returnedCod = 0;

  orders.forEach((order) => {
    const cod = Number(order.cod_amount || 0);
    const delivStatus: DeliveryStatus = order.delivery_status || "new";
    const printStatus: PrintStatus = order.print_status || "pending";

    if (delivStatus === "new") {
      warehouseCod += cod;
      if (printStatus === "printed") {
        warehousePrintedReady++;
      } else {
        warehouseUnprinted++;
      }
    } else if (delivStatus === "handed_to_carrier") {
      dispatchedCount++;
      dispatchedCod += cod;
    } else if (delivStatus === "delivered") {
      deliveredCount++;
      deliveredCod += cod;
    } else if (delivStatus === "returned") {
      returnedCount++;
      returnedCod += cod;
    }
  });

  return {
    totalOrders: orders.length,
    remainingInWarehouse: {
      total: warehousePrintedReady + warehouseUnprinted,
      printedReady: warehousePrintedReady,
      unprinted: warehouseUnprinted,
      codAmount: warehouseCod,
    },
    dispatchedWithCarrier: {
      total: dispatchedCount,
      codAmount: dispatchedCod,
    },
    delivered: {
      total: deliveredCount,
      codAmount: deliveredCod,
    },
    returned: {
      total: returnedCount,
      codAmount: returnedCod,
    },
  };
}

export interface BarcodeMatchResult {
  order: Order | null;
  matchType?: "exact_id" | "short_id" | "phone" | null;
  isAlreadyDispatched: boolean;
}

/**
 * Fast barcode & query matcher for courier handover scanning.
 * Accurately finds orders by barcode string, short UUID, or customer phone.
 */
export function matchScannedBarcode(
  rawInput: string,
  orders: Order[]
): BarcodeMatchResult {
  if (!rawInput || typeof rawInput !== "string") {
    return { order: null, isAlreadyDispatched: false };
  }

  const clean = rawInput.trim().replace(/^#+/, "").toLowerCase();
  if (!clean) {
    return { order: null, isAlreadyDispatched: false };
  }

  // 1. Exact ID match (case-insensitive)
  let found = orders.find((o) => o.id.toLowerCase() === clean);
  let matchType: "exact_id" | "short_id" | "phone" | null = found ? "exact_id" : null;

  // 2. Short ID match (first 8 characters of UUID)
  if (!found && clean.length >= 6) {
    found = orders.find(
      (o) =>
        o.id.toLowerCase().startsWith(clean) ||
        (clean.length >= 8 && o.id.toLowerCase().slice(0, 8) === clean.slice(0, 8))
    );
    if (found) matchType = "short_id";
  }

  // 3. Customer phone match
  if (!found) {
    found = orders.find((o) => {
      const p1 = String(o.phone_primary || "").trim();
      const p2 = String(o.phone_secondary || "").trim();
      return p1 === clean || p2 === clean;
    });
    if (found) matchType = "phone";
  }

  if (!found) {
    return { order: null, isAlreadyDispatched: false };
  }

  return {
    order: found,
    matchType,
    isAlreadyDispatched: found.delivery_status === "handed_to_carrier",
  };
}
