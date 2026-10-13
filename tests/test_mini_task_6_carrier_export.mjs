import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  generateCarrierOrdersExcelBuffer,
  generateOrdersExcelBuffer,
  generateCarrierSettlementExcelBuffer,
  CARRIER_TEMPLATES,
} from "../src/lib/excel.ts";

// Mock orders with Egyptian phone numbers, COD, and notes
const mockOrders = [
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    order_date: "2026-10-13",
    customer_name: "أحمد محمود سالم",
    phone_primary: "01012345678",
    phone_secondary: "01198765432",
    governorate: "القاهرة",
    address: "15 شارع مصطفى النحاس، مدينة نصر",
    landmark: "بجوار بنك مصر",
    order_total: 850,
    paid_amount: 100,
    cod_amount: 750,
    shipping_cost: 60,
    net_profit: 690,
    important_notes: "يرجى الاتصال قبل الوصول بنصف ساعة",
    payment_status: "partially_paid",
    print_status: "printed",
    printed_at: "2026-10-13T10:00:00Z",
    delivery_status: "new",
    settlement_status: "pending",
    settled_at: null,
    created_at: "2026-10-13T09:00:00Z",
    updated_at: "2026-10-13T10:00:00Z",
  },
  {
    id: "a81bc81b-dead-beef-cafe-0e02b2c3d999",
    order_date: "2026-10-13",
    customer_name: "مروة عبد الرحمن",
    phone_primary: "01200001111",
    phone_secondary: null,
    governorate: "الإسكندرية",
    address: "طريق الجيش، لوران، برج الروان الدور الخامس",
    landmark: "أمام فندق بلازا",
    order_total: 1200,
    paid_amount: 0,
    cod_amount: 1200,
    shipping_cost: 75,
    net_profit: 1125,
    important_notes: "تسليم مسائي فقط",
    payment_status: "unpaid",
    print_status: "pending",
    printed_at: null,
    delivery_status: "handed_to_carrier",
    settlement_status: "pending",
    settled_at: null,
    created_at: "2026-10-13T09:15:00Z",
    updated_at: "2026-10-13T09:15:00Z",
  },
];

console.log("🚀 Starting Mini Task 6 Multi-Carrier Excel Export Tests...\n");

let passedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. CARRIER_TEMPLATES completeness test
runTest("CARRIER_TEMPLATES dictionary covers all required carriers", () => {
  const requiredCarriers = ["bosta", "jt", "aramex", "mylerz", "standard", "carrier_settlement"];
  for (const c of requiredCarriers) {
    assert(CARRIER_TEMPLATES[c], `Missing template for ${c}`);
    assert(CARRIER_TEMPLATES[c].nameAr.length > 0, `Missing Arabic name for ${c}`);
    assert(CARRIER_TEMPLATES[c].filePrefix.length > 0, `Missing filePrefix for ${c}`);
    assert(CARRIER_TEMPLATES[c].sheetName.length > 0, `Missing sheetName for ${c}`);
  }
});

// 2. Bosta Export Schema & Values
runTest("Bosta export creates correct columns, COD, and string phone numbers with leading zeros", () => {
  const buf = generateCarrierOrdersExcelBuffer(mockOrders, "bosta", {
    allowOpenPackage: true,
    defaultPackageDescription: "ملابس رياضية فاخرة",
  });
  assert(buf instanceof Uint8Array && buf.length > 0, "Buffer should be valid Uint8Array");

  const wb = XLSX.read(buf, { type: "buffer" });
  assert.equal(wb.SheetNames[0], CARRIER_TEMPLATES.bosta.sheetName);

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Header verification
  const headers = rows[0];
  assert.equal(headers[0], "اسم المستلم");
  assert.equal(headers[1], "رقم الهاتف");
  assert.equal(headers[6], "مبلغ التحصيل (COD)");
  assert.equal(headers[9], "محتوى الشحنة");
  assert.equal(headers[10], "السماح بفتح الشحنة");

  // Row 1 verification
  const row1 = rows[1];
  assert.equal(row1[0], "أحمد محمود سالم");
  assert.equal(row1[1], "01012345678");
  assert.equal(row1[6], 750);
  assert.equal(row1[9], "ملابس رياضية فاخرة");
  assert.equal(row1[10], "نعم");

  // Cell types verification (Phone MUST be string type 's' to preserve leading zeros in Excel)
  const phoneCell = ws["B2"];
  assert.equal(phoneCell.t, "s", "Phone cell B2 must be type string 's'");
  assert.equal(phoneCell.v, "01012345678", "Phone cell value must keep leading zero");

  // Secondary phone string cell verification
  const secPhoneCell = ws["C2"];
  assert.equal(secPhoneCell.t, "s", "Secondary phone must be type string 's'");
  assert.equal(secPhoneCell.v, "01198765432");
});

// 3. Bosta Option allowOpenPackage: false
runTest("Bosta respects allowOpenPackage = false option", () => {
  const buf = generateCarrierOrdersExcelBuffer(mockOrders, "bosta", {
    allowOpenPackage: false,
  });
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  assert.equal(rows[1][10], "لا");
});

// 4. J&T Express Export Schema & Values
runTest("J&T Express export creates correct columns, customer order no, and phone preservation", () => {
  const buf = generateCarrierOrdersExcelBuffer(mockOrders, "jt");
  const wb = XLSX.read(buf, { type: "buffer" });
  assert.equal(wb.SheetNames[0], CARRIER_TEMPLATES.jt.sheetName);

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headers = rows[0];
  assert(headers[0].includes("Customer Order No"));
  assert(headers[1].includes("Consignee Name"));
  assert(headers[2].includes("Consignee Phone"));
  assert(headers[6].includes("COD Amount"));

  const row1 = rows[1];
  assert.equal(row1[0], mockOrders[0].id.slice(0, 8).toUpperCase());
  assert.equal(row1[1], "أحمد محمود سالم");
  assert.equal(row1[2], "01012345678");
  assert.equal(row1[6], 750);

  // Phone cell type
  const phoneCell = ws["C2"];
  assert.equal(phoneCell.t, "s", "J&T phone cell C2 must be type string 's'");
  assert.equal(phoneCell.v, "01012345678");
});

// 5. Aramex Export Schema & Values
runTest("Aramex export creates correct columns and formatted COD values", () => {
  const buf = generateCarrierOrdersExcelBuffer(mockOrders, "aramex", {
    defaultPackageDescription: "إلكترونيات",
  });
  const wb = XLSX.read(buf, { type: "buffer" });
  assert.equal(wb.SheetNames[0], CARRIER_TEMPLATES.aramex.sheetName);

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headers = rows[0];
  assert(headers[0].includes("Reference 1"));
  assert(headers[1].includes("Recipient Name"));
  assert(headers[2].includes("Recipient Phone 1"));
  assert(headers[6].includes("COD Amount"));
  assert(headers[8].includes("Goods Description"));

  const row2 = rows[2]; // Order 2
  assert.equal(row2[1], "مروة عبد الرحمن");
  assert.equal(row2[2], "01200001111");
  assert.equal(row2[6], 1200);
  assert.equal(row2[8], "إلكترونيات");

  const phoneCell = ws["C3"];
  assert.equal(phoneCell.t, "s", "Aramex phone cell C3 must be type string 's'");
  assert.equal(phoneCell.v, "01200001111");
});

// 6. Mylerz Export Schema & Values
runTest("Mylerz export creates merchant reference and mobile preservation", () => {
  const buf = generateCarrierOrdersExcelBuffer(mockOrders, "mylerz");
  const wb = XLSX.read(buf, { type: "buffer" });
  assert.equal(wb.SheetNames[0], CARRIER_TEMPLATES.mylerz.sheetName);

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headers = rows[0];
  assert(headers[0].includes("Merchant Reference"));
  assert(headers[1].includes("Customer Name"));
  assert(headers[2].includes("Mobile No"));
  assert(headers[6].includes("COD Value"));

  const row1 = rows[1];
  assert.equal(row1[1], "أحمد محمود سالم");
  assert.equal(row1[2], "01012345678");
  assert.equal(row1[6], 750);
});

// 7. Falcon Standard & Settlement Export
runTest("Standard and Settlement export function properly through generateCarrierOrdersExcelBuffer", () => {
  const standardBuf = generateCarrierOrdersExcelBuffer(mockOrders, "standard");
  const stdWb = XLSX.read(standardBuf, { type: "buffer" });
  assert.equal(stdWb.SheetNames[0], "الطلبات");

  const settlementBuf = generateCarrierOrdersExcelBuffer(mockOrders, "carrier_settlement");
  const setWb = XLSX.read(settlementBuf, { type: "buffer" });
  assert.equal(setWb.SheetNames[0], "مستحقات شركة الشحن المعلقة");
});

console.log(`\n🎉 All ${passedTests} Mini Task 6 Carrier Export tests passed successfully!`);
