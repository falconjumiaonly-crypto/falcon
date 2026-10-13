import assert from "node:assert";
import {
  REGION_DEFINITIONS,
  sortPrintQueueOrders,
  getOrderIdsByPreset,
  generateDeliveryManifest,
} from "../src/lib/printQueueOrchestrator.ts";

console.log("🚀 Testing Mini Task 9: Print Queue Orchestrator & Courier Delivery Manifest...\n");

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

// Sample test orders representing various Egyptian regions and COD values
const mockOrders = [
  {
    id: "ord-1",
    customer_name: "محمد كمال",
    phone_primary: "01011112222",
    governorate: "القاهرة",
    address: "المعادي - شارع 9",
    cod_amount: 500,
    paid_amount: 100,
    order_total: 600,
    created_at: "2026-10-10T10:00:00Z",
    order_date: "2026-10-10",
  },
  {
    id: "ord-2",
    customer_name: "أحمد عصام",
    phone_primary: "01122223333",
    governorate: "الجيزة",
    address: "الدقي - ميدان المساحة",
    cod_amount: 0,
    paid_amount: 800,
    order_total: 800,
    created_at: "2026-10-12T14:00:00Z",
    order_date: "2026-10-12",
  },
  {
    id: "ord-3",
    customer_name: "سامي حسن",
    phone_primary: "01233334444",
    governorate: "الدقهلية",
    address: "المنصورة - حي الجامعة",
    cod_amount: 1200,
    paid_amount: 0,
    order_total: 1200,
    created_at: "2026-10-11T09:00:00Z",
    order_date: "2026-10-11",
  },
  {
    id: "ord-4",
    customer_name: "إبراهيم خليل",
    phone_primary: "01544445555",
    governorate: "أسيوط",
    address: "شارع الجمهورية",
    cod_amount: 350,
    paid_amount: 50,
    order_total: 400,
    created_at: "2026-10-09T18:00:00Z",
    order_date: "2026-10-09",
  },
  {
    id: "ord-5",
    customer_name: "يوسف النجار",
    phone_primary: "01055556666",
    governorate: "الإسكندرية",
    address: "سموحة - شارع فوزي معاذ",
    cod_amount: 750,
    paid_amount: 0,
    order_total: 750,
    created_at: "2026-10-13T08:00:00Z",
    order_date: "2026-10-13",
  },
];

// 1. Regional Definitions
it("REGION_DEFINITIONS covers all Egyptian zones correctly", () => {
  assert(REGION_DEFINITIONS.greater_cairo.governorates.includes("القاهرة"));
  assert(REGION_DEFINITIONS.greater_cairo.governorates.includes("الجيزة"));
  assert(REGION_DEFINITIONS.delta.governorates.includes("الدقهلية"));
  assert(REGION_DEFINITIONS.upper_egypt.governorates.includes("أسيوط"));
  assert(REGION_DEFINITIONS.alex_canal.governorates.includes("الإسكندرية"));
});

// 2. Sorting Functionality
it("sortPrintQueueOrders sorts by governorate alphabetically (gov_asc)", () => {
  const sorted = sortPrintQueueOrders(mockOrders, "gov_asc");
  const govs = sorted.map((o) => o.governorate);
  // Arabic collation: أسيوط, الإسكندرية, الجيزة, الدقهلية, القاهرة
  assert.strictEqual(govs[0], "أسيوط");
  assert.strictEqual(govs[1], "الإسكندرية");
  assert.strictEqual(govs[2], "الجيزة");
  assert.strictEqual(govs[3], "الدقهلية");
  assert.strictEqual(govs[4], "القاهرة");
});

it("sortPrintQueueOrders sorts by date correctly (date_desc & date_asc)", () => {
  const newestFirst = sortPrintQueueOrders(mockOrders, "date_desc");
  assert.strictEqual(newestFirst[0].id, "ord-5"); // 2026-10-13

  const oldestFirst = sortPrintQueueOrders(mockOrders, "date_asc");
  assert.strictEqual(oldestFirst[0].id, "ord-4"); // 2026-10-09
});

it("sortPrintQueueOrders sorts by COD amount (cod_desc & cod_asc)", () => {
  const highestCod = sortPrintQueueOrders(mockOrders, "cod_desc");
  assert.strictEqual(highestCod[0].cod_amount, 1200);
  assert.strictEqual(highestCod[highestCod.length - 1].cod_amount, 0);

  const lowestCod = sortPrintQueueOrders(mockOrders, "cod_asc");
  assert.strictEqual(lowestCod[0].cod_amount, 0);
  assert.strictEqual(lowestCod[lowestCod.length - 1].cod_amount, 1200);
});

// 3. Quick Selection Presets
it("getOrderIdsByPreset filters Cairo and Giza preset correctly", () => {
  const cairoGizaIds = getOrderIdsByPreset(mockOrders, "cairo_giza");
  assert.deepStrictEqual(cairoGizaIds.sort(), ["ord-1", "ord-2"].sort());
});

it("getOrderIdsByPreset filters Delta preset correctly", () => {
  const deltaIds = getOrderIdsByPreset(mockOrders, "delta");
  assert.deepStrictEqual(deltaIds, ["ord-3"]);
});

it("getOrderIdsByPreset filters Upper Egypt preset correctly", () => {
  const upperEgyptIds = getOrderIdsByPreset(mockOrders, "upper_egypt");
  assert.deepStrictEqual(upperEgyptIds, ["ord-4"]);
});

it("getOrderIdsByPreset filters COD only and Prepaid only", () => {
  const codOnly = getOrderIdsByPreset(mockOrders, "cod_only");
  assert.strictEqual(codOnly.length, 4);
  assert(!codOnly.includes("ord-2")); // ord-2 has COD 0

  const prepaidOnly = getOrderIdsByPreset(mockOrders, "prepaid_only");
  assert.deepStrictEqual(prepaidOnly, ["ord-2"]);
});

// 4. Delivery Manifest Generation
it("generateDeliveryManifest computes totals and breakdown accurately", () => {
  const manifest = generateDeliveryManifest(mockOrders, {
    carrierName: "بوسطة",
    driverName: "كابتن محمود",
    driverPhone: "01099887766",
  });

  assert(manifest.manifestNumber.startsWith("MAN-"));
  assert.strictEqual(manifest.carrierName, "بوسطة");
  assert.strictEqual(manifest.driverName, "كابتن محمود");
  assert.strictEqual(manifest.totalOrdersCount, 5);

  // Total COD: 500 + 0 + 1200 + 350 + 750 = 2800
  assert.strictEqual(manifest.totalCodAmount, 2800);
  // Total Paid: 100 + 800 + 0 + 50 + 0 = 950
  assert.strictEqual(manifest.totalPaidAmount, 950);

  // Governorate summary
  assert.strictEqual(manifest.governoratesSummary.length, 5);
  const dakahlia = manifest.governoratesSummary.find((g) => g.governorate === "الدقهلية");
  assert(dakahlia);
  assert.strictEqual(dakahlia.count, 1);
  assert.strictEqual(dakahlia.cod, 1200);

  // Orders are pre-sorted inside manifest by governorate
  assert.strictEqual(manifest.orders[0].governorate, "أسيوط");
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 9 tests passed successfully!");
}
