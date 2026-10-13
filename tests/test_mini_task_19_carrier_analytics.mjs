import {
  detectOrderCarrier,
  calculateCarrierAnalytics,
} from "../src/lib/analytics/carrierAnalytics.js";

let testsRun = 0;
let testsPassed = 0;

function assert(condition, message) {
  testsRun++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log("=== Testing Mini Task 19: Carrier Performance & Delivery Matrix Analytics ===");

// 1. Carrier Detection from Order Metadata
console.log("\n[Group 1] Carrier Identity Detection:");
const orderBosta = {
  id: "ord-1",
  important_notes: "تم الشحن مع بوسطة برقم بوليصة 123",
};
assert(detectOrderCarrier(orderBosta).key === "bosta", "Order with 'بوسطة' in notes is detected as Bosta");

const orderJnt = {
  id: "ord-2",
  important_notes: "[تتبع J&T: في الطريق للعميل]",
};
assert(detectOrderCarrier(orderJnt).key === "jnt", "Order with 'J&T' in notes is detected as J&T Express");

const orderAramex = {
  id: "ord-3",
  important_notes: "شركة أرامكس بوليصة AWB456",
};
assert(detectOrderCarrier(orderAramex).key === "aramex", "Order with 'أرامكس' in notes is detected as Aramex");

// 2. High-level Carrier Analytics Computation
console.log("\n[Group 2] Carrier Performance Metrics Computation:");
const sampleOrders = [
  // Bosta orders (3 delivered, 1 returned) => Delivery Rate = 75%, Return Rate = 25%
  {
    id: "ord-b1",
    governorate: "القاهرة",
    important_notes: "بوسطة",
    delivery_status: "delivered",
    order_total: 500,
    shipping_cost: 60,
    cod_amount: 500,
    order_date: "2026-10-01",
    settled_at: "2026-10-03", // 2 days
  },
  {
    id: "ord-b2",
    governorate: "القاهرة",
    important_notes: "بوسطة",
    delivery_status: "delivered",
    order_total: 600,
    shipping_cost: 60,
    cod_amount: 600,
    order_date: "2026-10-01",
    settled_at: "2026-10-02", // 1 day
  },
  {
    id: "ord-b3",
    governorate: "الجيزة",
    important_notes: "بوسطة",
    delivery_status: "delivered",
    order_total: 700,
    shipping_cost: 65,
    cod_amount: 700,
    order_date: "2026-10-01",
    settled_at: "2026-10-04", // 3 days
  },
  {
    id: "ord-b4",
    governorate: "القاهرة",
    important_notes: "بوسطة",
    delivery_status: "returned",
    order_total: 450,
    shipping_cost: 60,
    cod_amount: 450,
    order_date: "2026-10-01",
  },

  // J&T orders (1 delivered, 2 returned) => Delivery Rate = 33.3%, Return Rate = 66.7%
  {
    id: "ord-j1",
    governorate: "الإسكندرية",
    important_notes: "J&T",
    delivery_status: "delivered",
    order_total: 800,
    shipping_cost: 70,
    cod_amount: 800,
    order_date: "2026-10-01",
    settled_at: "2026-10-05", // 4 days
  },
  {
    id: "ord-j2",
    governorate: "الإسكندرية",
    important_notes: "J&T",
    delivery_status: "returned",
    order_total: 400,
    shipping_cost: 70,
    cod_amount: 400,
    order_date: "2026-10-01",
  },
  {
    id: "ord-j3",
    governorate: "الإسكندرية",
    important_notes: "J&T",
    delivery_status: "returned",
    order_total: 550,
    shipping_cost: 70,
    cod_amount: 550,
    order_date: "2026-10-01",
  },
];

const analytics = calculateCarrierAnalytics(sampleOrders);

assert(analytics.totalShipmentsAnalyzed === 7, `Total shipments analyzed is 7 (got ${analytics.totalShipmentsAnalyzed})`);

const bostaStats = analytics.carrierStats.find((c) => c.carrierKey === "bosta");
assert(bostaStats !== undefined, "Bosta stats calculated");
assert(bostaStats.totalShipments === 4, `Bosta total shipments is 4 (got ${bostaStats.totalShipments})`);
assert(bostaStats.deliveredCount === 3, `Bosta delivered count is 3 (got ${bostaStats.deliveredCount})`);
assert(bostaStats.returnedCount === 1, `Bosta returned count is 1 (got ${bostaStats.returnedCount})`);
assert(bostaStats.deliverySuccessRate === 75.0, `Bosta delivery rate is 75.0% (got ${bostaStats.deliverySuccessRate}%)`);
assert(bostaStats.shippingPenaltyLoss === 60, `Bosta shipping penalty loss is 60 EGP (got ${bostaStats.shippingPenaltyLoss})`);
assert(bostaStats.avgDeliverySpeedDays === 2.0, `Bosta avg delivery days is 2.0 days (got ${bostaStats.avgDeliverySpeedDays})`);

const jntStats = analytics.carrierStats.find((c) => c.carrierKey === "jnt");
assert(jntStats !== undefined, "J&T stats calculated");
assert(jntStats.totalShipments === 3, `J&T total shipments is 3 (got ${jntStats.totalShipments})`);
assert(jntStats.deliveredCount === 1, `J&T delivered count is 1 (got ${jntStats.deliveredCount})`);
assert(jntStats.returnedCount === 2, `J&T returned count is 2 (got ${jntStats.returnedCount})`);
assert(jntStats.shippingPenaltyLoss === 140, `J&T shipping penalty loss is 140 EGP (got ${jntStats.shippingPenaltyLoss})`);

// 3. Top Performer Badges & Routing Recommendations
console.log("\n[Group 3] Performer Winners & Routing Recommendations:");
assert(analytics.bestOverallCarrier.includes("بوسطة"), `Best overall carrier is Bosta (got ${analytics.bestOverallCarrier})`);
assert(analytics.fastestCarrier.includes("بوسطة"), `Fastest carrier is Bosta with 2.0 days (got ${analytics.fastestCarrier})`);
assert(analytics.lowestReturnCarrier.includes("بوسطة"), `Lowest return carrier is Bosta (got ${analytics.lowestReturnCarrier})`);

// Governorate comparisons
assert(analytics.governorateComparisons.length >= 3, `Governorate comparisons computed for at least 3 govs`);
const cairoComparison = analytics.governorateComparisons.find((g) => g.governorate === "القاهرة");
assert(cairoComparison !== undefined, "Cairo comparison exists");
assert(cairoComparison.recommendedCarrier.includes("بوسطة"), "Bosta is recommended carrier for Cairo");

console.log(`\n========================================`);
console.log(`Mini Task 19 Test Results: ${testsPassed}/${testsRun} passed.`);
if (testsPassed === testsRun) {
  console.log("All tests passed successfully! ✓");
} else {
  process.exit(1);
}
