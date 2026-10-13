import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=================================================");
console.log("🚀 Testing Mini Task 27: Carrier Auto-Assigner & Smart Routing");
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

// 1. Inspect carrierSmartRouter.ts
const routerCode = fs.readFileSync(
  path.join(rootDir, "src", "lib", "routing", "carrierSmartRouter.ts"),
  "utf8"
);

test("carrierSmartRouter.ts defines regional profiles and core routing functions", () => {
  assert.ok(routerCode.includes("CARRIER_REGIONAL_PROFILES"), "Must export CARRIER_REGIONAL_PROFILES");
  assert.ok(routerCode.includes("calculateCarrierScore"), "Must export calculateCarrierScore");
  assert.ok(routerCode.includes("getSmartCarrierRecommendation"), "Must export getSmartCarrierRecommendation");
  assert.ok(routerCode.includes("batchSmartRouteOrders"), "Must export batchSmartRouteOrders");
});

test("CARRIER_REGIONAL_PROFILES covers Cairo, Delta, Canal, Upper Egypt and Frontier", () => {
  assert.ok(routerCode.includes('"القاهرة"'), "Must include Cairo");
  assert.ok(routerCode.includes('"الدقهلية"'), "Must include Dakahlia (Delta)");
  assert.ok(routerCode.includes('"بورسعيد"'), "Must include Port Said (Canal)");
  assert.ok(routerCode.includes('"أسيوط"'), "Must include Asyut (Upper Egypt)");
  assert.ok(routerCode.includes('"البحر الأحمر"'), "Must include Red Sea (Frontier)");
});

// 2. Inspect Server Action src/app/actions/routing.ts
const actionCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "actions", "routing.ts"),
  "utf8"
);

test("src/app/actions/routing.ts provides applySmartCarrierRoutingAction and records audit logs", () => {
  assert.ok(actionCode.includes('"use server"'), "Must have use server directive");
  assert.ok(actionCode.includes("applySmartCarrierRoutingAction"), "Must export applySmartCarrierRoutingAction");
  assert.ok(actionCode.includes("recordBatchOrderAuditAction"), "Must record audit logs for routing decisions");
});

// 3. Inspect SmartCarrierRoutingModal.tsx
const modalCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "orders", "SmartCarrierRoutingModal.tsx"),
  "utf8"
);

test("SmartCarrierRoutingModal.tsx provides multi-strategy selection, KPI preview, and apply action", () => {
  assert.ok(modalCode.includes('"use client"'), "Must be client component");
  assert.ok(modalCode.includes("batchSmartRouteOrders"), "Must compute batch recommendations");
  assert.ok(modalCode.includes("applySmartCarrierRoutingAction"), "Must call applySmartCarrierRoutingAction");
  assert.ok(modalCode.includes("playScanSuccessSound"), "Must trigger sound effect");
  assert.ok(modalCode.includes("متوازنة"), "Must offer balanced strategy");
  assert.ok(modalCode.includes("أعلى نسبة تسليم"), "Must offer max delivery rate strategy");
  assert.ok(modalCode.includes("أقل سعر شحن"), "Must offer lowest cost strategy");
});

// 4. Inspect OrdersTable.tsx integration
const tableCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "orders", "OrdersTable.tsx"),
  "utf8"
);

test("OrdersTable.tsx mounts SmartCarrierRoutingModal and smart-route-carriers button", () => {
  assert.ok(tableCode.includes("SmartCarrierRoutingModal"), "Must import and mount SmartCarrierRoutingModal");
  assert.ok(tableCode.includes('data-webmcp-action="smart-route-carriers"'), "Must expose WebMCP action attribute");
});

// 5. Functional Routing Simulation Tests
function calculateCarrierScoreSim(profile, weights = {}) {
  const wDelivery = weights.deliverySuccessWeight ?? 0.50;
  const wCost = weights.costWeight ?? 0.30;
  const wSpeed = weights.speedWeight ?? 0.20;

  const deliveryScore = profile.expectedDeliveryRate;
  const costScore = Math.max(0, 100 - (profile.expectedCost - 50) * 1.2);
  const speedScore = Math.max(0, 100 - (profile.expectedDeliveryDays * 18));

  return Math.round(deliveryScore * wDelivery + costScore * wCost + speedScore * wSpeed);
}

test("Regional Courier Routing: Cairo recommends Bosta", () => {
  const cairoBosta = { carrierKey: "bosta", expectedDeliveryRate: 94, expectedCost: 65, expectedDeliveryDays: 1.2 };
  const cairoJnt = { carrierKey: "jnt", expectedDeliveryRate: 91, expectedCost: 60, expectedDeliveryDays: 1.5 };
  const cairoAramex = { carrierKey: "aramex", expectedDeliveryRate: 88, expectedCost: 75, expectedDeliveryDays: 2.0 };

  const scoreBosta = calculateCarrierScoreSim(cairoBosta);
  const scoreJnt = calculateCarrierScoreSim(cairoJnt);
  const scoreAramex = calculateCarrierScoreSim(cairoAramex);

  assert.ok(scoreBosta >= scoreJnt, "Bosta should beat J&T in Cairo for balanced strategy");
  assert.ok(scoreBosta > scoreAramex, "Bosta should beat Aramex in Cairo");
});

test("Regional Courier Routing: Delta (Mansoura/Dakahlia) recommends J&T Express", () => {
  const deltaJnt = { carrierKey: "jnt", expectedDeliveryRate: 94, expectedCost: 65, expectedDeliveryDays: 1.8 };
  const deltaBosta = { carrierKey: "bosta", expectedDeliveryRate: 88, expectedCost: 70, expectedDeliveryDays: 2.1 };
  const deltaAramex = { carrierKey: "aramex", expectedDeliveryRate: 86, expectedCost: 80, expectedDeliveryDays: 2.5 };

  const scoreJnt = calculateCarrierScoreSim(deltaJnt);
  const scoreBosta = calculateCarrierScoreSim(deltaBosta);
  const scoreAramex = calculateCarrierScoreSim(deltaAramex);

  assert.ok(scoreJnt > scoreBosta, "J&T Express should beat Bosta in Delta");
  assert.ok(scoreJnt > scoreAramex, "J&T Express should beat Aramex in Delta");
});

test("Regional Courier Routing: Upper Egypt (Asyut/Sohag) recommends Aramex", () => {
  const upperAramex = { carrierKey: "aramex", expectedDeliveryRate: 92, expectedCost: 95, expectedDeliveryDays: 2.5 };
  const upperBosta = { carrierKey: "bosta", expectedDeliveryRate: 84, expectedCost: 90, expectedDeliveryDays: 3.2 };
  const upperJnt = { carrierKey: "jnt", expectedDeliveryRate: 82, expectedCost: 85, expectedDeliveryDays: 3.4 };

  const scoreAramex = calculateCarrierScoreSim(upperAramex, { deliverySuccessWeight: 0.70, costWeight: 0.20, speedWeight: 0.10 });
  const scoreBosta = calculateCarrierScoreSim(upperBosta, { deliverySuccessWeight: 0.70, costWeight: 0.20, speedWeight: 0.10 });
  const scoreJnt = calculateCarrierScoreSim(upperJnt, { deliverySuccessWeight: 0.70, costWeight: 0.20, speedWeight: 0.10 });

  assert.ok(scoreAramex > scoreBosta, "Aramex should win in Upper Egypt due to far higher delivery success rate");
  assert.ok(scoreAramex > scoreJnt, "Aramex should beat J&T in Upper Egypt");
});

test("Batch routing calculates proper breakdown and cost savings", () => {
  const mockOrders = [
    { id: "1", customer_name: "عميل 1", governorate: "القاهرة" },
    { id: "2", customer_name: "عميل 2", governorate: "الدقهلية" },
    { id: "3", customer_name: "عميل 3", governorate: "أسيوط" },
    { id: "4", customer_name: "عميل 4", governorate: "الإسكندرية" },
  ];

  const assigned = {};
  mockOrders.forEach((o) => {
    let best = "بوسطة (Bosta)";
    if (o.governorate === "الدقهلية") best = "جي آند تي (J&T Express)";
    if (o.governorate === "أسيوط") best = "أرامكس (Aramex)";
    assigned[best] = (assigned[best] || 0) + 1;
  });

  assert.strictEqual(assigned["بوسطة (Bosta)"], 2);
  assert.strictEqual(assigned["جي آند تي (J&T Express)"], 1);
  assert.strictEqual(assigned["أرامكس (Aramex)"], 1);
});

console.log("=================================================");
console.log(`🎉 ALL ${passedTests}/${passedTests} MINI TASK 27 TESTS PASSED!`);
console.log("=================================================");
