import { Order, DeliveryStatus, SettlementStatus } from "@/types/database";

export interface CourierSettlementMetrics {
  totalOrdersCount: number;
  // Gross totals
  totalOrderValue: number;
  totalCustomerPaid: number;
  grossCod: number;
  totalShippingCost: number;
  // Core Receivable figures
  netReceivable: number; // grossCod - totalShippingCost

  // Categorized Balances:
  // 1. Confirmed cash collected by courier, awaiting bank/wallet transfer (تم التوصيل وبانتظار التوريد)
  deliveredPendingCount: number;
  deliveredPendingCod: number;
  deliveredPendingShippingCost: number;
  deliveredPendingNet: number;

  // 2. Floating cash with drivers in transit (شحنات في الطريق مع المناديب)
  inTransitCount: number;
  inTransitCod: number;
  inTransitShippingCost: number;

  // 3. Already settled & closed accounts (تم استلامها وتسويتها)
  settledCount: number;
  settledCod: number;
  settledShippingCost: number;
  settledNet: number;

  // 4. Returns & shipping deductions (مرتجعات مخصومة)
  returnsCount: number;
  returnsShippingCost: number;

  // Breakdown by delivery status
  byDeliveryStatus: Record<
    DeliveryStatus,
    { count: number; cod: number; shippingCost: number; net: number }
  >;

  // Regional breakdown
  byGovernorate: {
    governorate: string;
    count: number;
    cod: number;
    shippingCost: number;
    net: number;
  }[];
}

/**
 * Calculates comprehensive courier settlement metrics for an e-commerce merchant.
 * Accurately determines exactly what funds are held by couriers and what net payouts are due.
 */
export function calculateCourierSettlementMetrics(
  orders: Order[]
): CourierSettlementMetrics {
  let totalOrderValue = 0;
  let totalCustomerPaid = 0;
  let grossCod = 0;
  let totalShippingCost = 0;

  let deliveredPendingCount = 0;
  let deliveredPendingCod = 0;
  let deliveredPendingShippingCost = 0;

  let inTransitCount = 0;
  let inTransitCod = 0;
  let inTransitShippingCost = 0;

  let settledCount = 0;
  let settledCod = 0;
  let settledShippingCost = 0;

  let returnsCount = 0;
  let returnsShippingCost = 0;

  const byDeliveryStatus: Record<
    DeliveryStatus,
    { count: number; cod: number; shippingCost: number; net: number }
  > = {
    new: { count: 0, cod: 0, shippingCost: 0, net: 0 },
    handed_to_carrier: { count: 0, cod: 0, shippingCost: 0, net: 0 },
    delivered: { count: 0, cod: 0, shippingCost: 0, net: 0 },
    returned: { count: 0, cod: 0, shippingCost: 0, net: 0 },
  };

  const govMap = new Map<
    string,
    { count: number; cod: number; shippingCost: number }
  >();

  orders.forEach((order) => {
    const orderVal = Number(order.order_total || 0);
    const paid = Number(order.paid_amount || 0);
    const cod = Number(order.cod_amount || 0);
    const shipping = Number(order.shipping_cost || 0);

    totalOrderValue += orderVal;
    totalCustomerPaid += paid;
    grossCod += cod;
    totalShippingCost += shipping;

    // Delivery status tally
    const delivStatus: DeliveryStatus =
      order.delivery_status && order.delivery_status in byDeliveryStatus
        ? order.delivery_status
        : "new";

    byDeliveryStatus[delivStatus].count++;
    byDeliveryStatus[delivStatus].cod += cod;
    byDeliveryStatus[delivStatus].shippingCost += shipping;
    byDeliveryStatus[delivStatus].net += cod - shipping;

    // Governorate tally
    const gov = order.governorate || "غير محدد";
    const existingGov = govMap.get(gov) || { count: 0, cod: 0, shippingCost: 0 };
    existingGov.count++;
    existingGov.cod += cod;
    existingGov.shippingCost += shipping;
    govMap.set(gov, existingGov);

    // Settlement state breakdowns:
    if (order.settlement_status === "settled") {
      settledCount++;
      settledCod += cod;
      settledShippingCost += shipping;
    } else {
      // Pending settlements
      if (order.delivery_status === "delivered") {
        // Confirmed delivered by courier but not yet settled to merchant
        deliveredPendingCount++;
        deliveredPendingCod += cod;
        deliveredPendingShippingCost += shipping;
      } else if (order.delivery_status === "handed_to_carrier") {
        // Out with drivers in the market
        inTransitCount++;
        inTransitCod += cod;
        inTransitShippingCost += shipping;
      }
    }

    if (order.delivery_status === "returned") {
      returnsCount++;
      returnsShippingCost += shipping;
    }
  });

  const netReceivable = grossCod - totalShippingCost;
  const deliveredPendingNet = deliveredPendingCod - deliveredPendingShippingCost;
  const settledNet = settledCod - settledShippingCost;

  const byGovernorate = Array.from(govMap.entries())
    .map(([gov, stat]) => ({
      governorate: gov,
      count: stat.count,
      cod: stat.cod,
      shippingCost: stat.shippingCost,
      net: stat.cod - stat.shippingCost,
    }))
    .sort((a, b) => b.cod - a.cod);

  return {
    totalOrdersCount: orders.length,
    totalOrderValue,
    totalCustomerPaid,
    grossCod,
    totalShippingCost,
    netReceivable,
    deliveredPendingCount,
    deliveredPendingCod,
    deliveredPendingShippingCost,
    deliveredPendingNet,
    inTransitCount,
    inTransitCod,
    inTransitShippingCost,
    settledCount,
    settledCod,
    settledShippingCost,
    settledNet,
    returnsCount,
    returnsShippingCost,
    byDeliveryStatus,
    byGovernorate,
  };
}
