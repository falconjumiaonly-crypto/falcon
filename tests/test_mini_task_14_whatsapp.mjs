import assert from "node:assert";
import {
  normalizePhoneForWhatsApp,
  interpolateWhatsAppTemplate,
  generateWhatsAppUrl,
  generateWhatsAppWebUrl,
  DEFAULT_WHATSAPP_TEMPLATES,
} from "../src/lib/whatsappNotifications.ts";

console.log("🚀 Testing Mini Task 14: Automated WhatsApp Order Tracking Notification Dispatcher...\n");

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

// 1. Phone Normalization for WhatsApp (wa.me)
it("normalizePhoneForWhatsApp normalizes standard 11-digit Egyptian numbers to 201x format", () => {
  assert.strictEqual(normalizePhoneForWhatsApp("01012345678"), "201012345678");
  assert.strictEqual(normalizePhoneForWhatsApp("01123456789"), "201123456789");
  assert.strictEqual(normalizePhoneForWhatsApp("01234567890"), "201234567890");
  assert.strictEqual(normalizePhoneForWhatsApp("01555555555"), "201555555555");
});

it("normalizePhoneForWhatsApp strips spaces, hyphens, and leading '+' or '00' prefixes", () => {
  assert.strictEqual(normalizePhoneForWhatsApp("+201012345678"), "201012345678");
  assert.strictEqual(normalizePhoneForWhatsApp("00201012345678"), "201012345678");
  assert.strictEqual(normalizePhoneForWhatsApp("010 1234 5678"), "201012345678");
  assert.strictEqual(normalizePhoneForWhatsApp("011-2345-6789"), "201123456789");
});

it("normalizePhoneForWhatsApp normalizes 10-digit numbers without leading zero (10xxxxxxxx)", () => {
  assert.strictEqual(normalizePhoneForWhatsApp("1012345678"), "201012345678");
});

it("normalizePhoneForWhatsApp handles international numbers and empty inputs safely", () => {
  assert.strictEqual(normalizePhoneForWhatsApp("+966501234567"), "966501234567");
  assert.strictEqual(normalizePhoneForWhatsApp(""), "");
  assert.strictEqual(normalizePhoneForWhatsApp(null), "");
  assert.strictEqual(normalizePhoneForWhatsApp(undefined), "");
});

// 2. Template Variable Interpolation
const mockOrder = {
  id: "9f8e7d6c-5b4a-3f2e-1d0c-ba9876543210",
  customer_name: "أحمد السيد",
  phone_primary: "01098765432",
  governorate: "الإسكندرية",
  address: "سيدي جابر - شارع المشير",
  order_total: 1250,
  paid_amount: 250,
  cod_amount: 1000,
  shipping_cost: 65,
  delivery_status: "new",
  print_status: "printed",
};

it("interpolateWhatsAppTemplate replaces all order placeholders correctly", () => {
  const template = "مرحباً {{customer_name}}، طلبك #{{order_id}} بمبلغ {{cod_amount}} جاهز في {{governorate}} - {{address}}.";
  const result = interpolateWhatsAppTemplate(template, mockOrder);

  assert(result.includes("أحمد السيد"), "Must contain customer name");
  assert(result.includes("9F8E7D6C"), "Must contain uppercase short order ID");
  assert(result.includes("1000 ج.م"), "Must contain COD amount in EGP");
  assert(result.includes("الإسكندرية"), "Must contain governorate");
  assert(result.includes("سيدي جابر"), "Must contain address");
});

it("interpolateWhatsAppTemplate handles custom extra parameters (storeName, carrierName)", () => {
  const template = "شكراً لتعاملك مع {{store_name}}. تم تسليم طلبك لـ {{carrier_name}}. للمساعدة: {{support_phone}}";
  const result = interpolateWhatsAppTemplate(template, mockOrder, {
    storeName: "براند النيل",
    carrierName: "بوسطة",
    supportPhone: "01000000000",
  });

  assert(result.includes("براند النيل"));
  assert(result.includes("بوسطة"));
  assert(result.includes("01000000000"));
});

it("interpolateWhatsAppTemplate handles empty order values with safe fallbacks", () => {
  const emptyOrder = { id: "", cod_amount: 0, order_total: 0 };
  const template = "أهلاً {{customer_name}}، كود: {{order_id}}، COD: {{cod_amount}}";
  const result = interpolateWhatsAppTemplate(template, emptyOrder);

  assert(result.includes("عميلنا العزيز"));
  assert(result.includes("0 ج.م"));
});

// 3. WhatsApp Direct URL Generation
it("generateWhatsAppUrl creates a valid wa.me link with encoded Arabic text and emojis", () => {
  const phone = "01012345678";
  const message = "أهلاً بك 👋 كود طلبك #1234 بمبلغ 500 ج.م";
  const url = generateWhatsAppUrl(phone, message);

  assert(url.startsWith("https://wa.me/201012345678?text="));
  assert(url.includes(encodeURIComponent(message)));
});

it("generateWhatsAppWebUrl creates a valid web.whatsapp.com URL", () => {
  const url = generateWhatsAppWebUrl("01234567890", "مرحباً");
  assert(url.startsWith("https://web.whatsapp.com/send?phone=201234567890&text="));
});

it("generateWhatsAppUrl returns empty string if phone is missing", () => {
  assert.strictEqual(generateWhatsAppUrl("", "مرحباً"), "");
  assert.strictEqual(generateWhatsAppUrl(null, "مرحباً"), "");
});

// 4. Default Template Library Validation
it("DEFAULT_WHATSAPP_TEMPLATES contains all 4 standard e-commerce templates", () => {
  assert.strictEqual(DEFAULT_WHATSAPP_TEMPLATES.length, 4);
  const ids = DEFAULT_WHATSAPP_TEMPLATES.map((t) => t.id);
  assert(ids.includes("printed_packing"));
  assert(ids.includes("dispatched_carrier"));
  assert(ids.includes("order_confirmation"));
  assert(ids.includes("delivery_reminder"));

  DEFAULT_WHATSAPP_TEMPLATES.forEach((tmpl) => {
    assert(tmpl.name.length > 0);
    assert(tmpl.template.includes("{{customer_name}}"));
    assert(tmpl.template.includes("{{order_id}}"));
  });
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 14 tests passed successfully!");
}
