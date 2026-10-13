import {
  calculateReturnsMetrics,
  isPhysicalReturnReceived,
  isReturnDisputedLost,
  buildPhysicalReturnReceivedNote,
  buildDisputedLostNote,
  PHYSICAL_RETURN_TAG,
  DISPUTED_LOST_TAG,
} from "../src/lib/returnsManager.js";

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

console.log("=== Testing Mini Task 16: Return Lifecycle & Penalty Loss Manager ===");

// 1. Tag recognition tests
console.log("\n[Group 1] Physical Return & Dispute Tag Detection:");
const orderDelivered = {
  id: "ord-1",
  delivery_status: "delivered",
  important_notes: PHYSICAL_RETURN_TAG,
  shipping_cost: 65,
  order_total: 500,
};
assert(!isPhysicalReturnReceived(orderDelivered), "Delivered order is NOT considered a returned parcel even if note has tag");

const orderReturnedUnchecked = {
  id: "ord-2",
  delivery_status: "returned",
  important_notes: "العميل لم يرد على الهاتف",
  shipping_cost: 70,
  order_total: 650,
};
assert(!isPhysicalReturnReceived(orderReturnedUnchecked), "Returned order without check-in note is not physically received");

const orderReturnedChecked = {
  id: "ord-3",
  delivery_status: "returned",
  important_notes: `طرد سليم ${PHYSICAL_RETURN_TAG}`,
  shipping_cost: 80,
  order_total: 800,
};
assert(isPhysicalReturnReceived(orderReturnedChecked), "Returned order with PHYSICAL_RETURN_TAG is marked physically received");

const orderDisputed = {
  id: "ord-4",
  delivery_status: "returned",
  important_notes: `طرد لم يسلمه المندوب ${DISPUTED_LOST_TAG}`,
  shipping_cost: 75,
  order_total: 1000,
};
assert(isReturnDisputedLost(orderDisputed), "Returned order with DISPUTED_LOST_TAG is recognized as disputed lost parcel");

// 2. Note formatting tests
console.log("\n[Group 2] Return Note Builders:");
const checkinNote = buildPhysicalReturnReceivedNote("ملاحظة سابقة للعميل");
assert(checkinNote.includes(PHYSICAL_RETURN_TAG), "buildPhysicalReturnReceivedNote includes PHYSICAL_RETURN_TAG");
assert(checkinNote.includes("ملاحظة سابقة للعميل"), "buildPhysicalReturnReceivedNote preserves existing notes");

const disputeNote = buildDisputedLostNote("ملاحظة سابقة", "المندوب رفض تسليم الطرد");
assert(disputeNote.includes(DISPUTED_LOST_TAG), "buildDisputedLostNote includes DISPUTED_LOST_TAG");
assert(disputeNote.includes("المندوب رفض تسليم الطرد"), "buildDisputedLostNote includes the claim reason");

// 3. Financial Metrics & Custody Calculations
console.log("\n[Group 3] Return Metrics & Custody Calculations:");
const sampleOrders = [
  // 1. Delivered order
  {
    id: "ord-1",
    customer_name: "أحمد",
    governorate: "القاهرة",
    delivery_status: "delivered",
    order_total: 1000,
    shipping_cost: 60,
  },
  // 2. Delivered order
  {
    id: "ord-2",
    customer_name: "محمود",
    governorate: "الجيزة",
    delivery_status: "delivered",
    order_total: 800,
    shipping_cost: 65,
  },
  // 3. Returned & Physically Checked In
  {
    id: "ord-3",
    customer_name: "علي",
    governorate: "الإسكندرية",
    delivery_status: "returned",
    important_notes: PHYSICAL_RETURN_TAG,
    order_total: 500, // Merchandise value = 500 - 70 = 430
    shipping_cost: 70,
  },
  // 4. Returned & Missing with Courier
  {
    id: "ord-4",
    customer_name: "كريم",
    governorate: "الإسكندرية",
    delivery_status: "returned",
    important_notes: "العميل رفض الاستلام",
    order_total: 900, // Merchandise value = 900 - 70 = 830
    shipping_cost: 70,
  },
  // 5. Returned & Missing with Courier (Giza)
  {
    id: "ord-5",
    customer_name: "سامح",
    governorate: "الجيزة",
    delivery_status: "returned",
    important_notes: "مغلق",
    order_total: 600, // Merchandise value = 600 - 65 = 535
    shipping_cost: 65,
  },
];

const metrics = calculateReturnsMetrics(sampleOrders);

assert(metrics.totalOrdersCount === 5, `Total orders count is 5 (got ${metrics.totalOrdersCount})`);
assert(metrics.totalReturnedCount === 3, `Total returned count is 3 (got ${metrics.totalReturnedCount})`);
assert(metrics.returnRate === 60.0, `Return rate is 60.0% (got ${metrics.returnRate})`);

// Total shipping penalty loss: 70 + 70 + 65 = 205
assert(metrics.totalShippingPenaltyLoss === 205, `Total shipping penalty loss is 205 EGP (got ${metrics.totalShippingPenaltyLoss})`);

// Physical custody:
// 1 received in warehouse (ord-3)
// 2 missing with carrier (ord-4: 900-70=830, ord-5: 600-65=535 => total merchandise value at risk: 830 + 535 = 1365)
assert(metrics.physicalReceivedCount === 1, `Physical received count is 1 (got ${metrics.physicalReceivedCount})`);
assert(metrics.physicalMissingCount === 2, `Physical missing count is 2 (got ${metrics.physicalMissingCount})`);
assert(metrics.merchandiseValueAtRisk === 1365, `Merchandise value at risk is 1365 EGP (got ${metrics.merchandiseValueAtRisk})`);

// Governorate breakdown
assert(metrics.returnsByGovernorate.length === 2, `Governorates with returns count is 2 (got ${metrics.returnsByGovernorate.length})`);
// Alexandria has penaltyLoss = 140, Giza has penaltyLoss = 65
assert(metrics.returnsByGovernorate[0].governorate === "الإسكندرية", "Alexandria is top governorate in return loss");
assert(metrics.returnsByGovernorate[0].penaltyLoss === 140, "Alexandria penalty loss is 140 EGP");
assert(metrics.returnsByGovernorate[0].returnRate === 100, "Alexandria return rate is 100% (2 out of 2)");

console.log(`\n========================================`);
console.log(`Mini Task 16 Test Results: ${testsPassed}/${testsRun} passed.`);
if (testsPassed === testsRun) {
  console.log("All tests passed successfully! ✓");
} else {
  process.exit(1);
}
