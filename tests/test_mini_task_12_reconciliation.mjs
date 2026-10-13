import assert from "node:assert";
import {
  cleanNumericValue,
  normalizeIdentifier,
  parseCourierSettlementRecords,
  reconcileSettlement,
} from "../src/lib/settlementReconciliation.ts";

console.log("🚀 Testing Mini Task 12: Carrier Settlement Reconciliation & Statement Importer...\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}:`, err.message);
  }
}

// 1. Data Cleaning & Normalization Tests
it("cleanNumericValue strips Egyptian currency markers, commas, and whitespace", () => {
  assert.strictEqual(cleanNumericValue(150), 150);
  assert.strictEqual(cleanNumericValue(" 450.50 ج.م "), 450.5);
  assert.strictEqual(cleanNumericValue("1,250 EGP"), 1250);
  assert.strictEqual(cleanNumericValue("65 egp"), 65);
  assert.strictEqual(cleanNumericValue(null), 0);
  assert.strictEqual(cleanNumericValue(""), 0);
  assert.strictEqual(cleanNumericValue("N/A"), 0);
});

it("normalizeIdentifier cleans hashtags and trailing whitespaces", () => {
  assert.strictEqual(normalizeIdentifier("#ORD-1234"), "ORD-1234");
  assert.strictEqual(normalizeIdentifier("  ###FALCON-99  "), "FALCON-99");
  assert.strictEqual(normalizeIdentifier("6850c95a"), "6850c95a");
  assert.strictEqual(normalizeIdentifier(null), "");
});

// 2. Courier Statement Header Parsing Tests
it("parseCourierSettlementRecords detects diverse carrier column naming (Arabic & English)", () => {
  const bostaSample = [
    {
      "مرجع التاجر": "ORD-101",
      "اسم المستلم": "أحمد إبراهيم",
      "موبايل": "01012345678",
      "مبلغ التحصيل": "850 ج.م",
      "رسوم الشحن": "65",
      "الصافي": "785",
      "الحالة": "تم التسليم",
    },
  ];

  const parsed = parseCourierSettlementRecords(bostaSample);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].orderIdOrRef, "ORD-101");
  assert.strictEqual(parsed[0].customerName, "أحمد إبراهيم");
  assert.strictEqual(parsed[0].phone, "01012345678");
  assert.strictEqual(parsed[0].courierCod, 850);
  assert.strictEqual(parsed[0].courierShippingFee, 65);
  assert.strictEqual(parsed[0].courierNet, 785);
  assert.strictEqual(parsed[0].courierStatus, "تم التسليم");
});

it("parseCourierSettlementRecords detects standard English carrier headers", () => {
  const englishSample = [
    {
      "Order ID": "UUID-777",
      "Recipient": "Sara Mohamed",
      "Phone": "01123456789",
      "COD Amount": 1200,
      "Shipping Cost": 70,
      "Net Payout": 1130,
    },
  ];

  const parsed = parseCourierSettlementRecords(englishSample);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].orderIdOrRef, "UUID-777");
  assert.strictEqual(parsed[0].customerName, "Sara Mohamed");
  assert.strictEqual(parsed[0].courierCod, 1200);
  assert.strictEqual(parsed[0].courierShippingFee, 70);
  assert.strictEqual(parsed[0].courierNet, 1130);
});

// 3. Reconciliation Logic & Discrepancy Detection
const mockSystemOrders = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    customer_name: "عميل 1 - مطابق",
    phone_primary: "01011111111",
    cod_amount: 1000,
    shipping_cost: 65,
    delivery_status: "handed_to_carrier",
    settlement_status: "pending",
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    customer_name: "عميل 2 - فرق تحصيل",
    phone_primary: "01022222222",
    cod_amount: 800,
    shipping_cost: 65,
    delivery_status: "handed_to_carrier",
    settlement_status: "pending",
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    customer_name: "عميل 3 - زيادة شحن",
    phone_primary: "01033333333",
    cod_amount: 500,
    shipping_cost: 60,
    delivery_status: "delivered",
    settlement_status: "pending",
  },
  {
    id: "d4e5f6a7-b8c9-0123-def1-234567890123",
    customer_name: "عميل 4 - مسوى سابقا",
    phone_primary: "01044444444",
    cod_amount: 700,
    shipping_cost: 65,
    delivery_status: "delivered",
    settlement_status: "settled",
  },
  {
    id: "e5f6a7b8-c9d0-1234-ef12-345678901234",
    customer_name: "عميل 5 - شحنة مسقطة من الكشف",
    phone_primary: "01055555555",
    cod_amount: 1500,
    shipping_cost: 80,
    delivery_status: "handed_to_carrier",
    settlement_status: "pending",
  },
];

it("reconcileSettlement accurately identifies 100% perfect match via short UUID", () => {
  const courierRows = [
    {
      rowId: "r1",
      orderIdOrRef: "A1B2C3D4", // Short ID uppercase
      courierCod: 1000,
      courierShippingFee: 65,
      courierNet: 935,
      rawRecord: {},
    },
  ];

  const report = reconcileSettlement(courierRows, mockSystemOrders);
  assert.strictEqual(report.summary.perfectMatchesCount, 1);
  assert.strictEqual(report.summary.discrepanciesCount, 0);
  assert.strictEqual(report.results[0].status, "matched_perfect");
  assert.strictEqual(report.results[0].codDiscrepancy, 0);
  assert.strictEqual(report.results[0].shippingDiscrepancy, 0);
  assert.strictEqual(report.summary.readyToSettleOrderIds.length, 1);
  assert.strictEqual(report.summary.readyToSettleOrderIds[0], "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
});

it("reconcileSettlement detects COD collection deficits or discrepancies", () => {
  const courierRows = [
    {
      rowId: "r2",
      orderIdOrRef: "b2c3d4e5",
      courierCod: 700, // Expected 800 -> 100 EGP deficit!
      courierShippingFee: 65,
      courierNet: 635,
      rawRecord: {},
    },
  ];

  const report = reconcileSettlement(courierRows, mockSystemOrders);
  assert.strictEqual(report.summary.discrepanciesCount, 1);
  assert.strictEqual(report.results[0].status, "matched_discrepancy");
  assert.strictEqual(report.results[0].codDiscrepancy, -100);
  assert(report.results[0].discrepancyNotes[0].includes("عجز في التحصيل"));
});

it("reconcileSettlement detects courier shipping fee overcharge", () => {
  const courierRows = [
    {
      rowId: "r3",
      orderIdOrRef: "c3d4e5f6",
      courierCod: 500,
      courierShippingFee: 85, // Expected 60 -> 25 EGP extra deducted!
      courierNet: 415,
      rawRecord: {},
    },
  ];

  const report = reconcileSettlement(courierRows, mockSystemOrders);
  assert.strictEqual(report.summary.discrepanciesCount, 1);
  assert.strictEqual(report.results[0].status, "matched_discrepancy");
  assert.strictEqual(report.results[0].shippingDiscrepancy, 25);
  assert(report.results[0].discrepancyNotes[0].includes("خصم شحن إضافي"));
});

it("reconcileSettlement identifies already settled orders and unknown external orders", () => {
  const courierRows = [
    {
      rowId: "r4",
      orderIdOrRef: "d4e5f6a7",
      courierCod: 700,
      courierShippingFee: 65,
      courierNet: 635,
      rawRecord: {},
    },
    {
      rowId: "r5",
      orderIdOrRef: "UNKNOWN-999",
      courierCod: 300,
      courierShippingFee: 50,
      courierNet: 250,
      rawRecord: {},
    },
  ];

  const report = reconcileSettlement(courierRows, mockSystemOrders);
  assert.strictEqual(report.summary.alreadySettledCount, 1);
  assert.strictEqual(report.summary.notFoundCount, 1);

  const settledRes = report.results.find((r) => r.orderIdOrRef === "d4e5f6a7");
  assert.strictEqual(settledRes.status, "already_settled");

  const notFoundRes = report.results.find((r) => r.orderIdOrRef === "UNKNOWN-999");
  assert.strictEqual(notFoundRes.status, "not_found_in_system");
});

it("reconcileSettlement detects omitted system orders missing from courier statement", () => {
  // Pass only order 1 in courier statement
  const courierRows = [
    {
      rowId: "r1",
      orderIdOrRef: "a1b2c3d4",
      courierCod: 1000,
      courierShippingFee: 65,
      courierNet: 935,
      rawRecord: {},
    },
  ];

  const report = reconcileSettlement(courierRows, mockSystemOrders);
  // System order 5 (e5f6a7b8...) is pending with courier but wasn't mentioned!
  assert(report.summary.unsettledSystemOrdersCount >= 1);
  const omitted = report.unsettledSystemOrders.find((o) => o.id.startsWith("e5f6a7b8"));
  assert(omitted, "Omitted order 5 must be flagged in unsettledSystemOrders");
});

it("reconcileSettlement matches by customer phone number if order ID is missing", () => {
  const courierRows = [
    {
      rowId: "r_phone",
      orderIdOrRef: "", // Empty ID
      phone: "01033333333", // Phone of client 3
      courierCod: 500,
      courierShippingFee: 60,
      courierNet: 440,
      rawRecord: {},
    },
  ];

  const report = reconcileSettlement(courierRows, mockSystemOrders);
  assert.strictEqual(report.summary.perfectMatchesCount, 1);
  assert.strictEqual(report.results[0].matchedOrder?.id, "c3d4e5f6-a7b8-9012-cdef-123456789012");
});

it("reconcileSettlement computes overall financial variance accurately", () => {
  const mixedRows = [
    {
      rowId: "m1",
      orderIdOrRef: "a1b2c3d4",
      courierCod: 1000,
      courierShippingFee: 65,
      courierNet: 935,
      rawRecord: {},
    },
    {
      rowId: "m2",
      orderIdOrRef: "b2c3d4e5",
      courierCod: 750, // 50 deficit
      courierShippingFee: 75, // 10 overcharge
      courierNet: 675,
      rawRecord: {},
    },
  ];

  const report = reconcileSettlement(mixedRows, mockSystemOrders);
  // Expected COD: 1000 + 800 = 1800. Courier COD: 1000 + 750 = 1750. COD discrepancy: -50
  assert.strictEqual(report.summary.totalExpectedCod, 1800);
  assert.strictEqual(report.summary.totalCourierCod, 1750);
  assert.strictEqual(report.summary.totalCodDiscrepancy, -50);

  // Expected Shipping: 65 + 65 = 130. Courier Shipping: 65 + 75 = 140. Shipping discrepancy: +10
  assert.strictEqual(report.summary.totalExpectedShipping, 130);
  assert.strictEqual(report.summary.totalCourierShipping, 140);
  assert.strictEqual(report.summary.totalShippingDiscrepancy, 10);

  // Expected Net: 1800 - 130 = 1670. Courier Net: 1750 - 140 = 1610. Variance: -60
  assert.strictEqual(report.summary.netExpectedPayable, 1670);
  assert.strictEqual(report.summary.netCourierPayable, 1610);
  assert.strictEqual(report.summary.netVariance, -60);
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 12 tests passed successfully!");
}
