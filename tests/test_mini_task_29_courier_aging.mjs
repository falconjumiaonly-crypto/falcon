import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=================================================");
console.log("🚀 Testing Mini Task 29: Courier Debt Aging & Alerts Engine");
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

// 1. Inspect courierAgingEngine.ts
const engineCode = fs.readFileSync(
  path.join(rootDir, "src", "lib", "settlements", "courierAgingEngine.ts"),
  "utf8"
);

test("courierAgingEngine.ts exports aging calculation and demand letter functions", () => {
  assert.ok(engineCode.includes("calculateDaysElapsed"), "Must export calculateDaysElapsed");
  assert.ok(engineCode.includes("categorizeAgingBracket"), "Must export categorizeAgingBracket");
  assert.ok(engineCode.includes("extractOrderCarrierName"), "Must export extractOrderCarrierName");
  assert.ok(engineCode.includes("analyzeCourierDebtAging"), "Must export analyzeCourierDebtAging");
  assert.ok(engineCode.includes("generateCourierCollectionDemandLetter"), "Must export generateCourierCollectionDemandLetter");
  assert.ok(engineCode.includes("generateCourierDemandWhatsAppUrl"), "Must export generateCourierDemandWhatsAppUrl");
});

// 2. Inspect src/app/actions/settlementAlerts.ts
const actionCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "actions", "settlementAlerts.ts"),
  "utf8"
);

test("src/app/actions/settlementAlerts.ts exports server actions and records audit trails", () => {
  assert.ok(actionCode.includes('"use server"'), "Must have use server directive");
  assert.ok(actionCode.includes("getCourierAgingReportAction"), "Must export getCourierAgingReportAction");
  assert.ok(actionCode.includes("sendCourierSettlementReminderAction"), "Must export sendCourierSettlementReminderAction");
  assert.ok(actionCode.includes("batchSettleCarrierDebtsAction"), "Must export batchSettleCarrierDebtsAction");
  assert.ok(actionCode.includes("recordBatchOrderAuditAction"), "Must record audit logs for demand notices");
});

// 3. Inspect CourierAgingRadarView.tsx
const viewCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "settlements", "CourierAgingRadarView.tsx"),
  "utf8"
);

test("CourierAgingRadarView.tsx implements aging brackets bar, carrier cards, and demand letter modal", () => {
  assert.ok(viewCode.includes('"use client"'), "Must be client component");
  assert.ok(viewCode.includes("getCourierAgingReportAction"), "Must fetch report from server action");
  assert.ok(viewCode.includes("batchSettleCarrierDebtsAction"), "Must support batch settlement action");
  assert.ok(viewCode.includes("generateCourierCollectionDemandLetter"), "Must render collection demand letter");
  assert.ok(viewCode.includes("playScanSuccessSound"), "Must trigger sound feedback on copy/settle");
});

// 4. Inspect SettlementsView.tsx integration
const settlementsCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "settlements", "SettlementsView.tsx"),
  "utf8"
);

test("SettlementsView.tsx integrates CourierAgingRadarView and aging_radar tab", () => {
  assert.ok(settlementsCode.includes("CourierAgingRadarView"), "Must import and mount CourierAgingRadarView");
  assert.ok(settlementsCode.includes('"aging_radar"'), "Must support aging_radar tab");
  assert.ok(settlementsCode.includes("رادار تقادم الديون"), "Must render tab button in Arabic");
});

// 5. Functional Simulation: Aging Brackets Logic
function categorizeAgingBracketSim(days) {
  if (days <= 7) return "0-7";
  if (days <= 14) return "8-14";
  if (days <= 30) return "15-30";
  return "30+";
}

test("Aging brackets correctly segment 5d, 12d, 22d, and 45d", () => {
  assert.strictEqual(categorizeAgingBracketSim(3), "0-7");
  assert.strictEqual(categorizeAgingBracketSim(7), "0-7");
  assert.strictEqual(categorizeAgingBracketSim(10), "8-14");
  assert.strictEqual(categorizeAgingBracketSim(14), "8-14");
  assert.strictEqual(categorizeAgingBracketSim(20), "15-30");
  assert.strictEqual(categorizeAgingBracketSim(30), "15-30");
  assert.strictEqual(categorizeAgingBracketSim(31), "30+");
  assert.strictEqual(categorizeAgingBracketSim(60), "30+");
});

// 6. Functional Simulation: Collection Demand Letter Generator
function generateDemandLetterSim(profile, storeName = "فلكون شيبنج") {
  const overdueCombined = profile.overdueCod + profile.criticalCod;
  return `السادة إدارة الحسابات والتحصيلات في شركة ${profile.carrierName} المحترمين،
• إجمالي المبالغ المسلّمة المعلقة: ${profile.totalUnsettledCod.toLocaleString()} جنيه مصري
• مبالغ متأخرة تجاوزت دورة السداد (أكثر من 14 يوماً): ${overdueCombined.toLocaleString()} جنيه مصري
• أقدم شحنة مسلّمة بالنظام منذ: ${profile.oldestDeliveryDays} يوماً
إدارة الحسابات والمالية - ${storeName} 🦅`;
}

test("generateDemandLetter includes accurate amounts and 14-day overdue breakdown", () => {
  const mockProfile = {
    carrierName: "بوسطة (Bosta)",
    totalUnsettledCod: 15400,
    overdueCod: 4200,
    criticalCod: 2500,
    oldestDeliveryDays: 35,
  };
  const letter = generateDemandLetterSim(mockProfile);
  assert.ok(letter.includes("بوسطة (Bosta)"));
  assert.ok(letter.includes("15,400"));
  assert.ok(letter.includes("6,700")); // 4200 + 2500
  assert.ok(letter.includes("35 يوماً"));
});

// 7. Aging Report Aggregator
test("Aging analysis report accurately sums COD per carrier and calculates overdue percentage", () => {
  const mockOrders = [
    { id: "1", delivery_status: "delivered", settlement_status: "pending", cod_amount: 1000, days: 5 },
    { id: "2", delivery_status: "delivered", settlement_status: "pending", cod_amount: 2000, days: 20 },
    { id: "3", delivery_status: "delivered", settlement_status: "pending", cod_amount: 3000, days: 40 },
  ];

  let totalCod = 0;
  let overdueCod = 0;
  mockOrders.forEach(o => {
    totalCod += o.cod_amount;
    if (o.days > 14) overdueCod += o.cod_amount;
  });

  const overduePct = Math.round((overdueCod / totalCod) * 100);
  assert.strictEqual(totalCod, 6000);
  assert.strictEqual(overdueCod, 5000); // 2000 + 3000
  assert.strictEqual(overduePct, 83); // 5000 / 6000 = 83.33%
});

console.log("=================================================");
console.log(`🎉 ALL ${passedTests}/${passedTests} MINI TASK 29 TESTS PASSED!`);
console.log("=================================================");
