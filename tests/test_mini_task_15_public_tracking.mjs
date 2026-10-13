import assert from "node:assert";
import {
  maskPhoneNumber,
  maskAddressSnippet,
  getCustomerFriendlyStatus,
  buildPublicTrackingTimeline,
  sanitizeOrderForPublicTracking,
} from "../src/lib/publicTracking.ts";
import { interpolateWhatsAppTemplate } from "../src/lib/whatsappNotifications.ts";

console.log("🚀 Testing Mini Task 15: Public Customer Tracking Page & Live Status Timeline...\n");

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

// 1. Phone & Address Privacy Masking
it("maskPhoneNumber protects customer phone privacy (010****5678)", () => {
  assert.strictEqual(maskPhoneNumber("01012345678"), "010****5678");
  assert.strictEqual(maskPhoneNumber("01199887766"), "011****7766");
  assert.strictEqual(maskPhoneNumber(""), "");
  assert.strictEqual(maskPhoneNumber(null), "");
});

it("maskAddressSnippet shows governorate and area without exposing full home address", () => {
  const snippet = maskAddressSnippet("شارع عباس العقاد - عمارة 12 الدور الرابع شقة 8", "القاهرة");
  assert(snippet.includes("القاهرة"));
  assert(snippet.includes("شارع عباس العقاد"));
  assert(!snippet.includes("الدور الرابع شقة 8"));

  assert.strictEqual(maskAddressSnippet("", "الجيزة"), "الجيزة");
});

// 2. Customer-Friendly Status Headlines
it("getCustomerFriendlyStatus translates internal statuses to reassuring customer copy", () => {
  const newStatus = getCustomerFriendlyStatus("new");
  assert.strictEqual(newStatus.headline, "جاري تجهيز وتغليف الشحنة بالمخزن");
  assert.strictEqual(newStatus.color, "blue");

  const handed = getCustomerFriendlyStatus("handed_to_carrier");
  assert.strictEqual(handed.headline, "الشحنة في الطريق مع مندوب التوصيل");
  assert.strictEqual(handed.color, "amber");

  const delivered = getCustomerFriendlyStatus("delivered");
  assert.strictEqual(delivered.headline, "تم تسليم الطلب بنجاح للعميل");
  assert.strictEqual(delivered.color, "emerald");

  const returned = getCustomerFriendlyStatus("returned");
  assert.strictEqual(returned.headline, "تعذر التسليم - مرتجع للمتجر");
  assert.strictEqual(returned.color, "rose");
});

// 3. Status Timeline Progression
it("buildPublicTrackingTimeline progresses step completion accurately according to lifecycle", () => {
  // Scenario A: Fresh order in warehouse, unprinted
  const freshOrder = { delivery_status: "new", print_status: "pending" };
  const freshTimeline = buildPublicTrackingTimeline(freshOrder);
  assert.strictEqual(freshTimeline.length, 4);
  assert.strictEqual(freshTimeline[0].isCompleted, true);
  assert.strictEqual(freshTimeline[0].isCurrent, true);
  assert.strictEqual(freshTimeline[1].isCompleted, false);

  // Scenario B: Packed & Printed in warehouse
  const packedOrder = { delivery_status: "new", print_status: "printed" };
  const packedTimeline = buildPublicTrackingTimeline(packedOrder);
  assert.strictEqual(packedTimeline[0].isCompleted, true);
  assert.strictEqual(packedTimeline[1].isCompleted, true);
  assert.strictEqual(packedTimeline[1].isCurrent, true);
  assert.strictEqual(packedTimeline[2].isCompleted, false);

  // Scenario C: Out for Delivery with driver
  const inTransitOrder = { delivery_status: "handed_to_carrier", print_status: "printed" };
  const inTransitTimeline = buildPublicTrackingTimeline(inTransitOrder);
  assert.strictEqual(inTransitTimeline[0].isCompleted, true);
  assert.strictEqual(inTransitTimeline[1].isCompleted, true);
  assert.strictEqual(inTransitTimeline[2].isCompleted, true);
  assert.strictEqual(inTransitTimeline[2].isCurrent, true);
  assert.strictEqual(inTransitTimeline[3].isCompleted, false);

  // Scenario D: Delivered successfully
  const deliveredOrder = { delivery_status: "delivered", print_status: "printed" };
  const deliveredTimeline = buildPublicTrackingTimeline(deliveredOrder);
  assert.strictEqual(deliveredTimeline[0].isCompleted, true);
  assert.strictEqual(deliveredTimeline[1].isCompleted, true);
  assert.strictEqual(deliveredTimeline[2].isCompleted, true);
  assert.strictEqual(deliveredTimeline[3].isCompleted, true);
  assert.strictEqual(deliveredTimeline[3].isCurrent, true);

  // Scenario E: Returned order
  const returnedOrder = { delivery_status: "returned", print_status: "printed" };
  const returnedTimeline = buildPublicTrackingTimeline(returnedOrder);
  const returnedStep = returnedTimeline.find((s) => s.stepId === "returned");
  assert(returnedStep !== undefined);
  assert.strictEqual(returnedStep.isAlert, true);
});

// 4. Privacy & Merchant Security Sanitizer
const mockMerchantOrder = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  customer_name: "سامح فوزي",
  phone_primary: "01234567890",
  phone_secondary: "01099998888",
  governorate: "الإسكندرية",
  address: "شارع جمال عبد الناصر - عمارة 40",
  landmark: "بجوار صيدلية خليل",
  order_total: 1500,
  paid_amount: 500,
  cod_amount: 1000,
  shipping_cost: 75, // Sensitive merchant cost!
  net_profit: 425, // Sensitive merchant profit!
  important_notes: "العميل بيطلب خصم ومعندوش فكة - المندوب ياخد باله", // Private internal note!
  delivery_status: "handed_to_carrier",
  print_status: "printed",
  payment_status: "partially_paid",
};

it("sanitizeOrderForPublicTracking strips all sensitive merchant financial & internal fields", () => {
  const sanitized = sanitizeOrderForPublicTracking(mockMerchantOrder, "https://falcon.app");

  // Verify sensitive fields do NOT exist
  assert.strictEqual(sanitized["net_profit"], undefined);
  assert.strictEqual(sanitized["shipping_cost"], undefined);
  assert.strictEqual(sanitized["important_notes"], undefined);
  assert.strictEqual(sanitized["landmark"], undefined);

  // Verify public fields exist and are safe
  assert.strictEqual(sanitized.orderId, "550e8400-e29b-41d4-a716-446655440000");
  assert.strictEqual(sanitized.shortId, "550E8400");
  assert.strictEqual(sanitized.customerName, "سامح فوزي");
  assert.strictEqual(sanitized.maskedPhone, "012****7890");
  assert.strictEqual(sanitized.codAmount, 1000);
  assert.strictEqual(sanitized.trackingUrl, "https://falcon.app/track/550e8400-e29b-41d4-a716-446655440000");
  assert(Array.isArray(sanitized.timeline));
});

// 5. WhatsApp Tracking Link Integration
it("interpolateWhatsAppTemplate supports {{tracking_link}} placeholder dynamically", () => {
  const template = "أهلاً {{customer_name}}، لمتابعة شحنتك اضغط هنا: {{tracking_link}}";
  const result = interpolateWhatsAppTemplate(template, mockMerchantOrder, {
    trackingLink: "https://falcon.app/track/550e8400",
  });

  assert(result.includes("https://falcon.app/track/550e8400"));
  assert(result.includes("سامح فوزي"));
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 15 tests passed successfully!");
}
