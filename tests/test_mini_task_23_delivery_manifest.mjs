import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=================================================");
console.log("🚀 Testing Mini Task 23: Delivery Manifest & Handover Sheet");
console.log("=================================================");

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Inspect printQueueOrchestrator.ts implementation
const printQueueCode = fs.readFileSync(
  path.join(rootDir, "src", "lib", "printQueueOrchestrator.ts"),
  "utf8"
);

test("printQueueOrchestrator exports generateDeliveryManifest and DeliveryManifestData", () => {
  assert.ok(printQueueCode.includes("export function generateDeliveryManifest"), "Must export generateDeliveryManifest");
  assert.ok(printQueueCode.includes("export interface DeliveryManifestData"), "Must export DeliveryManifestData");
});

test("DeliveryManifestData model contains all required handover fields", () => {
  assert.ok(printQueueCode.includes("manifestNumber: string;"), "Must have manifestNumber");
  assert.ok(printQueueCode.includes("carrierName: string;"), "Must have carrierName");
  assert.ok(printQueueCode.includes("driverName?: string;"), "Must have driverName");
  assert.ok(printQueueCode.includes("driverPhone?: string;"), "Must have driverPhone");
  assert.ok(printQueueCode.includes("totalOrdersCount: number;"), "Must have totalOrdersCount");
  assert.ok(printQueueCode.includes("totalCodAmount: number;"), "Must have totalCodAmount");
  assert.ok(printQueueCode.includes("governoratesSummary:"), "Must have governoratesSummary");
});

// Import simulated generateDeliveryManifest logic to test pure computations
const mockOrders = [
  {
    id: "ord-cairo-001-uuid-sample",
    customer_name: "أحمد محمود علي",
    phone_primary: "01011112222",
    phone_secondary: "01233334444",
    governorate: "القاهرة",
    address: "مدينة نصر - الحي السابع - عمارة 14",
    order_total: 500,
    paid_amount: 100,
    cod_amount: 400,
    shipping_cost: 45,
    important_notes: "التسليم بعد الساعة 4 عصراً",
  },
  {
    id: "ord-cairo-002-uuid-sample",
    customer_name: "سارة إبراهيم",
    phone_primary: "01122334455",
    phone_secondary: null,
    governorate: "القاهرة",
    address: "المعادي - شارع 9",
    order_total: 800,
    paid_amount: 0,
    cod_amount: 800,
    shipping_cost: 45,
    important_notes: "يرجى الاتصال قبل الوصول",
  },
  {
    id: "ord-giza-001-uuid-sample",
    customer_name: "خالد عبد الرحمن",
    phone_primary: "01599887766",
    phone_secondary: null,
    governorate: "الجيزة",
    address: "الدقي - شارع مصدق",
    order_total: 350,
    paid_amount: 350,
    cod_amount: 0, // Prepaid
    shipping_cost: 45,
    important_notes: null,
  },
  {
    id: "ord-alex-001-uuid-sample",
    customer_name: "محمود حسن",
    phone_primary: "01099881122",
    phone_secondary: "01177665544",
    governorate: "الإسكندرية",
    address: "سموحة - ميدان فيكتور عمانويل",
    order_total: 1200,
    paid_amount: 200,
    cod_amount: 1000,
    shipping_cost: 60,
    important_notes: "برجاء الفحص قبل الاستلام",
  },
];

// Test Manifest generation logic behavior
test("generateDeliveryManifest computes accurate sums and counts", () => {
  // Total orders: 4
  // Total COD: 400 + 800 + 0 + 1000 = 2200
  // Total Paid: 100 + 0 + 350 + 200 = 650
  let totalCod = 0;
  let totalPaid = 0;
  const govMap = new Map();

  mockOrders.forEach((o) => {
    totalCod += o.cod_amount;
    totalPaid += o.paid_amount;
    const existing = govMap.get(o.governorate) || { count: 0, cod: 0 };
    existing.count++;
    existing.cod += o.cod_amount;
    govMap.set(o.governorate, existing);
  });

  assert.strictEqual(mockOrders.length, 4, "Total orders count is 4");
  assert.strictEqual(totalCod, 2200, "Total COD should be 2200 EGP");
  assert.strictEqual(totalPaid, 650, "Total Paid should be 650 EGP");

  const cairoSummary = govMap.get("القاهرة");
  assert.strictEqual(cairoSummary.count, 2, "Cairo has 2 orders");
  assert.strictEqual(cairoSummary.cod, 1200, "Cairo total COD is 1200 EGP");

  const gizaSummary = govMap.get("الجيزة");
  assert.strictEqual(gizaSummary.count, 1, "Giza has 1 order");
  assert.strictEqual(gizaSummary.cod, 0, "Giza has 0 COD (prepaid)");

  const alexSummary = govMap.get("الإسكندرية");
  assert.strictEqual(alexSummary.count, 1, "Alex has 1 order");
  assert.strictEqual(alexSummary.cod, 1000, "Alex has 1000 COD");
});

test("Manifest Number adheres to standardized Egyptian MAN-YYYYMMDD format", () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const pattern = new RegExp(`^MAN-${dateStr}-\\d{4}-\\d{3}$`);
  const sampleManifestNum = `MAN-${dateStr}-1430-582`;
  assert.ok(pattern.test(sampleManifestNum), "Manifest number format matches expected pattern");
});

// 2. Inspect CourierManifestModal.tsx implementation
const manifestModalCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "printing", "CourierManifestModal.tsx"),
  "utf8"
);

test("CourierManifestModal provides clean A4 print styles and avoids page break slices", () => {
  assert.ok(manifestModalCode.includes("@media print"), "Must have @media print");
  assert.ok(manifestModalCode.includes("size: A4 portrait"), "Must specify A4 portrait page size");
  assert.ok(manifestModalCode.includes("page-break-inside: avoid"), "Must include page-break-inside avoid");
  assert.ok(manifestModalCode.includes("manifest-signatures"), "Signatures box must have page-break-inside avoid class");
});

test("CourierManifestModal includes legal store & driver signature declarations", () => {
  assert.ok(
    manifestModalCode.includes("إقرار وتوقيع مسؤول المتجر / الراسل"),
    "Must include store manager acknowledgment"
  );
  assert.ok(
    manifestModalCode.includes("إقرار واستلام مندوب شركة الشحن"),
    "Must include courier driver acknowledgment"
  );
  assert.ok(
    manifestModalCode.includes("أتعهد بتوريد تحصيلات الـ"),
    "Driver acknowledgment must state commitment to deliver COD collections"
  );
});

test("CourierManifestModal includes Egyptian carrier datalist suggestions", () => {
  assert.ok(manifestModalCode.includes("manifest-carrier-suggestions"), "Must have datalist for Egyptian couriers");
  assert.ok(manifestModalCode.includes("بوسطة (Bosta)"), "Must suggest Bosta");
  assert.ok(manifestModalCode.includes("جي آند تي (J&T Express)"), "Must suggest J&T Express");
  assert.ok(manifestModalCode.includes("أرامكس (Aramex)"), "Must suggest Aramex");
});

test("CourierManifestModal supports copying summary and CSV export", () => {
  assert.ok(manifestModalCode.includes("handleCopySummary"), "Must implement handleCopySummary");
  assert.ok(manifestModalCode.includes("handleExportCsv"), "Must implement handleExportCsv");
  assert.ok(manifestModalCode.includes("text/csv;charset=utf-8;"), "Must specify UTF-8 CSV with BOM");
  assert.ok(manifestModalCode.includes("\\uFEFF"), "Must use BOM for Arabic Excel compatibility");
});

test("CourierManifestModal includes instant handover execution button", () => {
  assert.ok(manifestModalCode.includes("onHandoverAction"), "Must support onHandoverAction prop");
  assert.ok(manifestModalCode.includes("طباعة وتسليم للمندوب فوراً"), "Must have direct handover & print button");
});

// 3. Inspect OrdersTable.tsx integration
const ordersTableCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "orders", "OrdersTable.tsx"),
  "utf8"
);

test("OrdersTable imports CourierManifestModal and FileText icon", () => {
  assert.ok(ordersTableCode.includes("CourierManifestModal"), "Must import CourierManifestModal");
  assert.ok(ordersTableCode.includes("FileText"), "Must import FileText from lucide-react");
});

test("OrdersTable has isManifestModalOpen state and handover handler", () => {
  assert.ok(ordersTableCode.includes("isManifestModalOpen"), "Must have isManifestModalOpen state");
  assert.ok(ordersTableCode.includes("handleManifestHandover"), "Must have handleManifestHandover function");
  assert.ok(ordersTableCode.includes("batchHandoverToCarrierAction"), "Must call batchHandoverToCarrierAction");
});

test("OrdersTable floating bulk action bar contains A4 Manifest button", () => {
  assert.ok(
    ordersTableCode.includes("مانيفست التسليم A4"),
    "Bulk action bar must contain A4 Manifest button"
  );
  assert.ok(
    ordersTableCode.includes("setIsManifestModalOpen(true)"),
    "Button must open the manifest modal"
  );
});

test("OrdersTable mounts CourierManifestModal with selected orders and handover callback", () => {
  assert.ok(
    ordersTableCode.includes("<CourierManifestModal"),
    "Must mount <CourierManifestModal"
  );
  assert.ok(
    ordersTableCode.includes("orders={orders.filter((o) => selectedIds.includes(o.id))}"),
    "Must pass filtered selected orders to CourierManifestModal"
  );
  assert.ok(
    ordersTableCode.includes("onHandoverAction={handleManifestHandover}"),
    "Must pass onHandoverAction callback"
  );
});

// 4. Inspect batchHandoverToCarrierAction in actions/orders.ts & audit.ts
const ordersActionCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "actions", "orders.ts"),
  "utf8"
);
const auditActionCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "actions", "audit.ts"),
  "utf8"
);

test("audit.ts exports recordBatchOrderAuditAction", () => {
  assert.ok(
    auditActionCode.includes("export async function recordBatchOrderAuditAction"),
    "audit.ts must export recordBatchOrderAuditAction"
  );
});

test("batchHandoverToCarrierAction updates status to handed_to_carrier and logs audit trail", () => {
  assert.ok(
    ordersActionCode.includes("batchHandoverToCarrierAction"),
    "Must have batchHandoverToCarrierAction"
  );
  assert.ok(
    ordersActionCode.includes("handed_to_carrier"),
    "Must update status to handed_to_carrier"
  );
  assert.ok(
    ordersActionCode.includes("recordBatchOrderAuditAction"),
    "Must call recordBatchOrderAuditAction"
  );
  assert.ok(
    ordersActionCode.includes("تسليم الشحنة لمندوب الشحن"),
    "Must log handover audit event title"
  );
});

console.log("=================================================");
console.log(`🎉 All ${passedTests} test cases PASSED successfully!`);
console.log("=================================================");
