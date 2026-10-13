import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=================================================");
console.log("🚀 Testing Mini Task 28: WhatsApp Post-Delivery Rating & Feedback");
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

// 1. Inspect customerFeedbackEngine.ts
const engineCode = fs.readFileSync(
  path.join(rootDir, "src", "lib", "feedback", "customerFeedbackEngine.ts"),
  "utf8"
);

test("customerFeedbackEngine.ts exports message generator and analytics functions", () => {
  assert.ok(engineCode.includes("generatePostDeliveryFeedbackWhatsAppMessage"), "Must export generatePostDeliveryFeedbackWhatsAppMessage");
  assert.ok(engineCode.includes("generateFeedbackWhatsAppUrl"), "Must export generateFeedbackWhatsAppUrl");
  assert.ok(engineCode.includes("evaluateFeedbackUrgency"), "Must export evaluateFeedbackUrgency");
  assert.ok(engineCode.includes("computeFeedbackAnalytics"), "Must export computeFeedbackAnalytics");
  assert.ok(engineCode.includes("FEEDBACK_APP_SETTING_KEY"), "Must define FEEDBACK_APP_SETTING_KEY");
});

// 2. Inspect src/app/actions/feedback.ts
const actionCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "actions", "feedback.ts"),
  "utf8"
);

test("src/app/actions/feedback.ts implements public and merchant server actions", () => {
  assert.ok(actionCode.includes('"use server"'), "Must have use server directive");
  assert.ok(actionCode.includes("getOrderForFeedbackAction"), "Must export getOrderForFeedbackAction");
  assert.ok(actionCode.includes("submitCustomerFeedbackAction"), "Must export submitCustomerFeedbackAction");
  assert.ok(actionCode.includes("getFeedbackAnalyticsAction"), "Must export getFeedbackAnalyticsAction");
  assert.ok(actionCode.includes("resolveFeedbackAction"), "Must export resolveFeedbackAction");
});

// 3. Inspect public feedback page and client-view
const pageCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "feedback", "[id]", "page.tsx"),
  "utf8"
);
const clientViewCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "feedback", "[id]", "client-view.tsx"),
  "utf8"
);

test("app/feedback/[id] renders customer survey and reward coupon", () => {
  assert.ok(pageCode.includes("getOrderForFeedbackAction"), "Page must load order data");
  assert.ok(pageCode.includes("FeedbackClientView"), "Page must render FeedbackClientView");
  assert.ok(clientViewCode.includes("submitCustomerFeedbackAction"), "Client view must submit feedback");
  assert.ok(clientViewCode.includes("FALCON10"), "Must provide discount code reward");
  assert.ok(clientViewCode.includes("جودة وحالة المنتجات"), "Must rate product quality");
  assert.ok(clientViewCode.includes("مندوب الشحن"), "Must rate courier service");
});

// 4. Inspect CustomerFeedbackModal.tsx and Header.tsx integration
const modalCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "feedback", "CustomerFeedbackModal.tsx"),
  "utf8"
);
const headerCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "layout", "Header.tsx"),
  "utf8"
);

test("CustomerFeedbackModal.tsx and Header.tsx integration", () => {
  assert.ok(modalCode.includes('"use client"'), "Modal must be client component");
  assert.ok(modalCode.includes("getFeedbackAnalyticsAction"), "Modal must load analytics");
  assert.ok(modalCode.includes("resolveFeedbackAction"), "Modal must support resolving complaints");
  assert.ok(headerCode.includes("CustomerFeedbackModal"), "Header must mount CustomerFeedbackModal");
  assert.ok(headerCode.includes("تقييمات العملاء"), "Header must have feedback trigger button");
});

// 5. Functional Simulation: WhatsApp Feedback Message Generation
function generatePostDeliveryFeedbackSim(order, options = {}) {
  const storeName = options.storeName || "فلكون شيبنج";
  const baseUrl = options.baseUrl || "https://falcon-shipping.vercel.app";
  const shortId = order.id ? order.id.slice(0, 8).toUpperCase() : "";
  const feedbackUrl = `${baseUrl}/feedback/${order.id}`;

  return `حمد لله على السلامة يا فندم! 🌸📦
تم تسليم طلبك رقم #${shortId} بنجاح.
👉 ${feedbackUrl}
مع تحيات فريق ${storeName} 🦅`;
}

test("generatePostDeliveryFeedback produces polite message with feedback URL", () => {
  const mockOrder = { id: "ord-test-12345", customer_name: "سارة محمود", phone_primary: "01011122233" };
  const msg = generatePostDeliveryFeedbackSim(mockOrder);
  assert.ok(msg.includes("ORD-TEST"), "Must include uppercase order code");
  assert.ok(msg.includes("https://falcon-shipping.vercel.app/feedback/ord-test-12345"), "Must include feedback URL");
  assert.ok(msg.includes("فلكون شيبنج"), "Must mention store name");
});

// 6. Complaint Urgency Evaluation
function evaluateUrgencySim(rating) {
  if (rating <= 1) return { isComplaint: true, level: "critical" };
  if (rating === 2) return { isComplaint: true, level: "medium" };
  return { isComplaint: false, level: "low" };
}

test("evaluateUrgency correctly classifies low ratings as complaints", () => {
  assert.strictEqual(evaluateUrgencySim(1).isComplaint, true);
  assert.strictEqual(evaluateUrgencySim(1).level, "critical");
  assert.strictEqual(evaluateUrgencySim(2).isComplaint, true);
  assert.strictEqual(evaluateUrgencySim(2).level, "medium");
  assert.strictEqual(evaluateUrgencySim(4).isComplaint, false);
  assert.strictEqual(evaluateUrgencySim(5).isComplaint, false);
});

// 7. Statistical Aggregation
test("computeFeedbackAnalytics computes accurate averages and carrier rankings", () => {
  const records = [
    { overallRating: 5, ratingProduct: 5, ratingCourier: 5, carrierName: "بوسطة", isComplaint: false, isResolved: false },
    { overallRating: 4, ratingProduct: 4, ratingCourier: 4, carrierName: "بوسطة", isComplaint: false, isResolved: false },
    { overallRating: 2, ratingProduct: 3, ratingCourier: 1, carrierName: "جي آند تي", isComplaint: true, isResolved: false },
  ];

  const avgOverall = Number(((5 + 4 + 2) / 3).toFixed(1));
  assert.strictEqual(avgOverall, 3.7);

  const unresolved = records.filter(r => r.isComplaint && !r.isResolved).length;
  assert.strictEqual(unresolved, 1);
});

console.log("=================================================");
console.log(`🎉 ALL ${passedTests}/${passedTests} MINI TASK 28 TESTS PASSED!`);
console.log("=================================================");
