import assert from "node:assert";
import { calculateCourierSettlementMetrics } from "../src/lib/settlementCalculations.ts";
import { generateCarrierSettlementExcelBuffer } from "../src/lib/excel.ts";
import * as XLSX from "xlsx";

console.log("🚀 Testing Mini Task 11: Courier Cash Settlement Engine & Outstanding Balance Dashboard...\n");

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

// Mock test orders dataset representing typical Egyptian merchant workflow
const mockOrders = [
  // 1. Delivered, Pending Settlement (Confirmed due to merchant)
  {
    id: "ord-1",
    customer_name: "أحمد علي",
    phone_primary: "01012345678",
    governorate: "القاهرة",
    address: "مدينة نصر",
    order_total: 1000,
    paid_amount: 0,
    cod_amount: 1000,
    shipping_cost: 65,
    delivery_status: "delivered",
    settlement_status: "pending",
  },
  // 2. Delivered, Pending Settlement (Confirmed due to merchant)
  {
    id: "ord-2",
    customer_name: "محمود حسن",
    phone_primary: "01123456789",
    governorate: "الجيزة",
    address: "الدقي",
    order_total: 600,
    paid_amount: 100,
    cod_amount: 500,
    shipping_cost: 65,
    delivery_status: "delivered",
    settlement_status: "pending",
  },
  // 3. In Transit (Handed to carrier, floating cash in market with drivers)
  {
    id: "ord-3",
    customer_name: "سارة إبراهيم",
    phone_primary: "01234567890",
    governorate: "الإسكندرية",
    address: "سموحة",
    order_total: 800,
    paid_amount: 0,
    cod_amount: 800,
    shipping_cost: 75,
    delivery_status: "handed_to_carrier",
    settlement_status: "pending",
  },
  // 4. Settled (Already paid to merchant bank/instapay account)
  {
    id: "ord-4",
    customer_name: "خالد سعيد",
    phone_primary: "01512345678",
    governorate: "القاهرة",
    address: "المعادي",
    order_total: 1200,
    paid_amount: 200,
    cod_amount: 1000,
    shipping_cost: 65,
    delivery_status: "delivered",
    settlement_status: "settled",
  },
  // 5. Returned Order (Customer refused or failed delivery, shipping deduction penalty)
  {
    id: "ord-5",
    customer_name: "كريم يوسف",
    phone_primary: "01099887766",
    governorate: "طنطا",
    address: "شارع البحر",
    order_total: 450,
    paid_amount: 0,
    cod_amount: 450,
    shipping_cost: 70,
    delivery_status: "returned",
    settlement_status: "pending",
  },
  // 6. New Unshipped Order (Not with courier yet)
  {
    id: "ord-6",
    customer_name: "هدى محمد",
    phone_primary: "01199887755",
    governorate: "القاهرة",
    address: "التجمع الخامس",
    order_total: 1500,
    paid_amount: 500,
    cod_amount: 1000,
    shipping_cost: 65,
    delivery_status: "new",
    settlement_status: "pending",
  },
];

// Test 1: Core Receivable Formulation for Merchant
it("Accurately isolates Confirmed Delivered Pending COD and Net Receivables", () => {
  const metrics = calculateCourierSettlementMetrics(mockOrders);

  // Delivered Pending: ord-1 (1000 COD, 65 ship) + ord-2 (500 COD, 65 ship)
  // Total COD = 1500, Total Shipping = 130, Net = 1370
  assert.strictEqual(metrics.deliveredPendingCount, 2);
  assert.strictEqual(metrics.deliveredPendingCod, 1500);
  assert.strictEqual(metrics.deliveredPendingShippingCost, 130);
  assert.strictEqual(metrics.deliveredPendingNet, 1370);
});

// Test 2: In-Transit Floating Market Cash
it("Correctly identifies in-transit market cash in couriers' custody", () => {
  const metrics = calculateCourierSettlementMetrics(mockOrders);

  // In Transit: ord-3 (800 COD, 75 ship)
  assert.strictEqual(metrics.inTransitCount, 1);
  assert.strictEqual(metrics.inTransitCod, 800);
  assert.strictEqual(metrics.inTransitShippingCost, 75);
});

// Test 3: Settled Orders Accounting
it("Tracks already settled payouts separately from pending receivables", () => {
  const metrics = calculateCourierSettlementMetrics(mockOrders);

  // Settled: ord-4 (1000 COD, 65 ship, net 935)
  assert.strictEqual(metrics.settledCount, 1);
  assert.strictEqual(metrics.settledCod, 1000);
  assert.strictEqual(metrics.settledShippingCost, 65);
  assert.strictEqual(metrics.settledNet, 935);
});

// Test 4: Returns Shipping Loss Deduction
it("Calculates return shipping charges deducted by couriers", () => {
  const metrics = calculateCourierSettlementMetrics(mockOrders);

  // Returned: ord-5 (70 shipping loss)
  assert.strictEqual(metrics.returnsCount, 1);
  assert.strictEqual(metrics.returnsShippingCost, 70);
});

// Test 5: Global Totals & Gross Metrics
it("Computes exact aggregate totals across the entire fleet", () => {
  const metrics = calculateCourierSettlementMetrics(mockOrders);

  assert.strictEqual(metrics.totalOrdersCount, 6);
  // Total COD: 1000 + 500 + 800 + 1000 + 450 + 1000 = 4750
  assert.strictEqual(metrics.grossCod, 4750);
  // Total Shipping: 65 + 65 + 75 + 65 + 70 + 65 = 405
  assert.strictEqual(metrics.totalShippingCost, 405);
  // Net Receivable: 4750 - 405 = 4345
  assert.strictEqual(metrics.netReceivable, 4345);
});

// Test 6: Breakdown by Delivery Status Tally
it("Builds comprehensive delivery status breakdown metrics", () => {
  const metrics = calculateCourierSettlementMetrics(mockOrders);

  assert.strictEqual(metrics.byDeliveryStatus.new.count, 1);
  assert.strictEqual(metrics.byDeliveryStatus.handed_to_carrier.count, 1);
  assert.strictEqual(metrics.byDeliveryStatus.delivered.count, 3); // ord-1, ord-2, ord-4
  assert.strictEqual(metrics.byDeliveryStatus.returned.count, 1);
});

// Test 7: Regional Breakdown Ranking
it("Aggregates governorate metrics sorted by COD descending", () => {
  const metrics = calculateCourierSettlementMetrics(mockOrders);

  assert(Array.isArray(metrics.byGovernorate));
  assert(metrics.byGovernorate.length > 0);
  // Cairo should be top: ord-1 (1000) + ord-4 (1000) + ord-6 (1000) = 3000
  const cairo = metrics.byGovernorate[0];
  assert.strictEqual(cairo.governorate, "القاهرة");
  assert.strictEqual(cairo.count, 3);
  assert.strictEqual(cairo.cod, 3000);
  assert.strictEqual(cairo.shippingCost, 195);
  assert.strictEqual(cairo.net, 2805);
});

// Test 8: Empty Orders Edge Case
it("Handles empty order lists safely without NaN or exceptions", () => {
  const metrics = calculateCourierSettlementMetrics([]);

  assert.strictEqual(metrics.totalOrdersCount, 0);
  assert.strictEqual(metrics.grossCod, 0);
  assert.strictEqual(metrics.totalShippingCost, 0);
  assert.strictEqual(metrics.netReceivable, 0);
  assert.strictEqual(metrics.deliveredPendingNet, 0);
  assert.strictEqual(metrics.inTransitCod, 0);
  assert.strictEqual(metrics.settledNet, 0);
  assert.strictEqual(metrics.returnsShippingCost, 0);
  assert.deepStrictEqual(metrics.byGovernorate, []);
});

// Test 9: Carrier Settlement Excel Export Buffer Generation
it("Generates a valid Excel sheet for carrier settlement reconciliation", () => {
  const deliveredOrders = mockOrders.filter(
    (o) => o.delivery_status === "delivered" && o.settlement_status === "pending"
  );
  const buffer = generateCarrierSettlementExcelBuffer(deliveredOrders);

  assert(buffer instanceof Uint8Array, "Buffer must be Uint8Array");
  assert(buffer.length > 0, "Buffer should not be empty");

  // Parse workbook back with XLSX
  const wb = XLSX.read(buffer, { type: "buffer" });
  assert(wb.SheetNames.length >= 1, "Workbook must contain at least 1 sheet");
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // First row is headers
  assert(rows.length >= 3, "Must have header + 2 delivered orders");
  assert.strictEqual(rows[0][0], "كود الأوردر");
  assert.strictEqual(rows[0][6], "مبلغ التحصيل (COD المطلوب توريده)");

  // Check data row values
  assert.strictEqual(rows[1][0], "ord-1");
  assert.strictEqual(rows[1][6], 1000);
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 11 tests passed successfully!");
}
