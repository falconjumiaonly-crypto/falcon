import assert from "node:assert";
import {
  calculateDispatchMetrics,
  matchScannedBarcode,
} from "../src/lib/dispatchTracker.ts";
import { soundSynth } from "../src/lib/sound.ts";

console.log("🚀 Testing Mini Task 13: Instant Dispatched vs Remaining Tracker & Handover Scanner...\n");

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

// Mock dataset
const mockOrders = [
  // 1. In Warehouse, Printed and Ready for Courier Pickup
  {
    id: "f1a2b3c4-1111-2222-3333-444455556666",
    customer_name: "محمد كمال",
    phone_primary: "01011111111",
    cod_amount: 500,
    print_status: "printed",
    delivery_status: "new",
  },
  // 2. In Warehouse, Unprinted (Still being packed/prepared)
  {
    id: "f2a2b3c4-1111-2222-3333-444455556666",
    customer_name: "علي رضا",
    phone_primary: "01022222222",
    cod_amount: 300,
    print_status: "pending",
    delivery_status: "new",
  },
  // 3. Dispatched / Handed to Courier (In transit on the street)
  {
    id: "f3a2b3c4-1111-2222-3333-444455556666",
    customer_name: "سارة نبيل",
    phone_primary: "01033333333",
    cod_amount: 850,
    print_status: "printed",
    delivery_status: "handed_to_carrier",
  },
  // 4. Delivered Successfully to Customer
  {
    id: "f4a2b3c4-1111-2222-3333-444455556666",
    customer_name: "كريم شريف",
    phone_primary: "01044444444",
    phone_secondary: "01199999999",
    cod_amount: 1200,
    print_status: "printed",
    delivery_status: "delivered",
  },
  // 5. Returned Order
  {
    id: "f5a2b3c4-1111-2222-3333-444455556666",
    customer_name: "إيمان فاروق",
    phone_primary: "01055555555",
    cod_amount: 400,
    print_status: "printed",
    delivery_status: "returned",
  },
];

// 1. Dispatch Metrics Calculation
it("calculateDispatchMetrics accurately partitions warehouse vs dispatched vs delivered vs returned", () => {
  const metrics = calculateDispatchMetrics(mockOrders);

  assert.strictEqual(metrics.totalOrders, 5);

  // Warehouse: ord-1 (printed 500 COD) + ord-2 (unprinted 300 COD) = 2 orders, 800 COD
  assert.strictEqual(metrics.remainingInWarehouse.total, 2);
  assert.strictEqual(metrics.remainingInWarehouse.printedReady, 1);
  assert.strictEqual(metrics.remainingInWarehouse.unprinted, 1);
  assert.strictEqual(metrics.remainingInWarehouse.codAmount, 800);

  // Dispatched with Carrier: ord-3 (850 COD)
  assert.strictEqual(metrics.dispatchedWithCarrier.total, 1);
  assert.strictEqual(metrics.dispatchedWithCarrier.codAmount, 850);

  // Delivered: ord-4 (1200 COD)
  assert.strictEqual(metrics.delivered.total, 1);
  assert.strictEqual(metrics.delivered.codAmount, 1200);

  // Returned: ord-5 (400 COD)
  assert.strictEqual(metrics.returned.total, 1);
  assert.strictEqual(metrics.returned.codAmount, 400);
});

it("calculateDispatchMetrics safely handles empty order lists", () => {
  const metrics = calculateDispatchMetrics([]);

  assert.strictEqual(metrics.totalOrders, 0);
  assert.strictEqual(metrics.remainingInWarehouse.total, 0);
  assert.strictEqual(metrics.remainingInWarehouse.printedReady, 0);
  assert.strictEqual(metrics.remainingInWarehouse.unprinted, 0);
  assert.strictEqual(metrics.remainingInWarehouse.codAmount, 0);
  assert.strictEqual(metrics.dispatchedWithCarrier.total, 0);
  assert.strictEqual(metrics.dispatchedWithCarrier.codAmount, 0);
});

// 2. Barcode & Handheld Scanner Matching
it("matchScannedBarcode finds order by exact full UUID case-insensitively", () => {
  const res = matchScannedBarcode("F1A2B3C4-1111-2222-3333-444455556666", mockOrders);
  assert(res.order !== null);
  assert.strictEqual(res.order.customer_name, "محمد كمال");
  assert.strictEqual(res.matchType, "exact_id");
  assert.strictEqual(res.isAlreadyDispatched, false);
});

it("matchScannedBarcode finds order by short 8-char UUID barcode", () => {
  const res = matchScannedBarcode("f1a2b3c4", mockOrders);
  assert(res.order !== null);
  assert.strictEqual(res.order.customer_name, "محمد كمال");
  assert.strictEqual(res.matchType, "short_id");
  assert.strictEqual(res.isAlreadyDispatched, false);
});

it("matchScannedBarcode strips leading '#' symbols emitted by some hardware barcode guns", () => {
  const res = matchScannedBarcode("###f1a2b3c4", mockOrders);
  assert(res.order !== null);
  assert.strictEqual(res.order.customer_name, "محمد كمال");
});

it("matchScannedBarcode finds order by customer primary phone number", () => {
  const res = matchScannedBarcode("01022222222", mockOrders);
  assert(res.order !== null);
  assert.strictEqual(res.order.customer_name, "علي رضا");
  assert.strictEqual(res.matchType, "phone");
  assert.strictEqual(res.isAlreadyDispatched, false);
});

it("matchScannedBarcode finds order by customer secondary phone number", () => {
  const res = matchScannedBarcode("01199999999", mockOrders);
  assert(res.order !== null);
  assert.strictEqual(res.order.customer_name, "كريم شريف");
  assert.strictEqual(res.matchType, "phone");
});

it("matchScannedBarcode correctly flags orders that were already dispatched", () => {
  const res = matchScannedBarcode("f3a2b3c4", mockOrders);
  assert(res.order !== null);
  assert.strictEqual(res.order.customer_name, "سارة نبيل");
  assert.strictEqual(res.isAlreadyDispatched, true);
});

it("matchScannedBarcode returns null safely when no match is found", () => {
  const res = matchScannedBarcode("NON_EXISTENT_BARCODE", mockOrders);
  assert.strictEqual(res.order, null);
  assert.strictEqual(res.isAlreadyDispatched, false);
});

it("matchScannedBarcode handles null, undefined, and empty string safely", () => {
  assert.strictEqual(matchScannedBarcode("", mockOrders).order, null);
  assert.strictEqual(matchScannedBarcode(null, mockOrders).order, null);
  assert.strictEqual(matchScannedBarcode(undefined, mockOrders).order, null);
});

// 3. Sound Synthesizer instance sanity check
it("soundSynth instance exposes playSuccessBeep and playWarningBeep methods", () => {
  assert(typeof soundSynth.playSuccessBeep === "function");
  assert(typeof soundSynth.playWarningBeep === "function");
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 13 tests passed successfully!");
}
