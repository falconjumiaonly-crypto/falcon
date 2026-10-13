import { parseOrderText } from "../src/lib/orderTextParser.ts";
import { DEFAULT_GOVERNORATES, matchGovernorate } from "../src/lib/governorates.ts";

console.log("================================================================================");
console.log("             TESTING MINI TASK 2: SMART OMNIBOX INTEGRATION                     ");
console.log("================================================================================");

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✔ [PASS]: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL]: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// 1. Test parsing realistic complex order
const sampleWhatsApp = `الاسم: عمر خالد الشريف
الموبايل: 01023456789 - 01198765432
العنوان: طنطا شارع النحاس امام صيدلية مصر
الطلب: 3 شيميز ابيض مقاس L
السعر: 900 جنيه
مدفوع: 200
ملاحظات: التسليم بعد الساعة 4 عصراً`;

console.log("\n[Test 1] Testing Parsing Sample Message...");
const parsed = parseOrderText(sampleWhatsApp, DEFAULT_GOVERNORATES);

assert(parsed.customer_name === "عمر خالد الشريف", "Extracted Name correctly");
assert(parsed.phone_primary === "01023456789", "Extracted Primary Phone");
assert(parsed.phone_secondary === "01198765432", "Extracted Secondary Phone");
assert(parsed.order_total === 900, "Extracted Total 900 EGP");
assert(parsed.paid_amount === 200, "Extracted Paid Amount 200 EGP");
assert(parsed.important_notes.includes("الساعة 4"), "Extracted Notes");

// 2. Test auto-matching governorate from city in address ("طنطا" -> "الغربية")
console.log("\n[Test 2] Testing Auto Matching City to Governorate & Shipping Rate...");
assert(parsed.governorate === "الغربية", `Matched "طنطا" to "الغربية": "${parsed.governorate}"`);

const rateMatch = matchGovernorate(parsed.governorate, DEFAULT_GOVERNORATES);
assert(rateMatch.matched === true, "Governorate rate matched");
assert(rateMatch.rate === 75, `Matched correct shipping rate for الغربية (75 EGP): ${rateMatch.rate}`);

// 3. Simulating Form Data Application
console.log("\n[Test 3] Simulating Form State Update (Like onApply callback)...");
const initialFormState = {
  customer_name: "",
  phone_primary: "",
  phone_secondary: "",
  governorate: "",
  address: "",
  landmark: "",
  order_total: "",
  paid_amount: "0",
  shipping_cost: "",
  important_notes: "",
};

const updatedState = {
  ...initialFormState,
  customer_name: parsed.customer_name,
  phone_primary: parsed.phone_primary,
  phone_secondary: parsed.phone_secondary,
  governorate: parsed.governorate,
  address: parsed.address,
  landmark: parsed.landmark,
  order_total: String(parsed.order_total),
  paid_amount: String(parsed.paid_amount),
  shipping_cost: String(rateMatch.rate),
  important_notes: [parsed.items_summary, parsed.important_notes].filter(Boolean).join(" | "),
};

assert(updatedState.customer_name === "عمر خالد الشريف", "Form received customer name");
assert(updatedState.shipping_cost === "75", "Form received auto-matched shipping cost 75");
assert(updatedState.order_total === "900", "Form received order total");
assert(updatedState.paid_amount === "200", "Form received paid amount");

console.log("\n================================================================================");
console.log(` 🎉 MINI TASK 2 INTEGRATION PASSED: ${passedCount}/${totalCount} assertions verified!`);
console.log("================================================================================");
