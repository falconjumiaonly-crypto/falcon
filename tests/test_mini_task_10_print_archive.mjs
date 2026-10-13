import assert from "node:assert";
import {
  isPrintedWithinTimeframe,
  formatPrintedRelativeTime,
} from "../src/lib/printQueueOrchestrator.ts";
import { getDeliveryStatusBadge } from "../src/lib/calculations.ts";

console.log("🚀 Testing Mini Task 10: Instant Print Archive & Audit Log...\n");

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

// 1. Timeframe Audit Filters
it("isPrintedWithinTimeframe handles 'all' timeframe correctly", () => {
  assert(isPrintedWithinTimeframe("2026-01-01T00:00:00Z", "all"));
  assert(isPrintedWithinTimeframe(null, "all"));
});

it("isPrintedWithinTimeframe matches 'today' correctly", () => {
  const now = new Date();
  const todayStr = now.toISOString();
  assert(isPrintedWithinTimeframe(todayStr, "today"), "Current date should match 'today'");

  const pastDate = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
  assert(!isPrintedWithinTimeframe(pastDate, "today"), "48 hours ago should not match 'today'");
  assert(!isPrintedWithinTimeframe(null, "today"), "Null should not match 'today'");
});

it("isPrintedWithinTimeframe matches 'yesterday' correctly", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString();

  assert(isPrintedWithinTimeframe(yesterdayStr, "yesterday"), "Yesterday should match 'yesterday'");
  assert(!isPrintedWithinTimeframe(new Date().toISOString(), "yesterday"), "Today should not match 'yesterday'");
});

it("isPrintedWithinTimeframe matches 'this_week' correctly", () => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  assert(isPrintedWithinTimeframe(threeDaysAgo, "this_week"), "3 days ago should match 'this_week'");

  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();
  assert(!isPrintedWithinTimeframe(twentyDaysAgo, "this_week"), "20 days ago should not match 'this_week'");
});

// 2. Relative Time Formatter
it("formatPrintedRelativeTime formats recent timestamps into Arabic descriptions", () => {
  const justNow = new Date().toISOString();
  const formatted = formatPrintedRelativeTime(justNow);
  assert(typeof formatted === "string");
  assert(formatted.includes("الآن") || formatted.includes("دقيقة"), "Recent date should have relative label");

  const nullResult = formatPrintedRelativeTime(null);
  assert.strictEqual(nullResult, "غير محدد");
});

// 3. Delivery Status Badges
it("getDeliveryStatusBadge maps delivery lifecycle states correctly", () => {
  const newBadge = getDeliveryStatusBadge("new");
  assert.strictEqual(newBadge.label, "جاهز للتسليم");
  assert(newBadge.bgClass.includes("blue"));

  const handedBadge = getDeliveryStatusBadge("handed_to_carrier");
  assert.strictEqual(handedBadge.label, "مشحون مع المندوب");
  assert(handedBadge.bgClass.includes("indigo"));

  const deliveredBadge = getDeliveryStatusBadge("delivered");
  assert.strictEqual(deliveredBadge.label, "تم التسليم بنجاح");
  assert(deliveredBadge.bgClass.includes("emerald"));

  const returnedBadge = getDeliveryStatusBadge("returned");
  assert.strictEqual(returnedBadge.label, "شحنة مرتجعة");
  assert(returnedBadge.bgClass.includes("rose"));
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 10 tests passed successfully!");
}
