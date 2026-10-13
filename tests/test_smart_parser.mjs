import { parseOrderText, sanitizeEgyptianPhone } from "../src/lib/orderTextParser.ts";

console.log("================================================================================");
console.log("             TESTING MINI TASK 1: SMART ORDER TEXT PARSER                      ");
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

// Case 1: Phone sanitization
console.log("\n[Scenario 1] Phone Sanitization Test:");
assert(sanitizeEgyptianPhone("+201012345678") === "01012345678", "Handles +20 format");
assert(sanitizeEgyptianPhone("201123456789") === "01123456789", "Handles 20 prefix");
assert(sanitizeEgyptianPhone("012-3456-7890") === "01234567890", "Strips dashes");
assert(sanitizeEgyptianPhone("1555555555") === "01555555555", "Adds missing leading 0 for 10-digit 15x");

// Case 2: Full labeled Arabic message from WhatsApp
console.log("\n[Scenario 2] Labeled WhatsApp Message Test:");
const sample1 = `
الاسم: أحمد مصطفى إبراهيم
الموبايل: 01012345678 - 01223456789
المحافظة: الجيزة
العنوان: 15 شارع الهرم الرئيسي محطة العريش بجوار بنك مصر
المنتجات: 2 تيشرت اوفر سايز اسود + كوتشي ابيض 42
المبلغ: 850 جنيه
مدفوع: 100
ملاحظات: الاتصال بعد الظهر
`;

const res1 = parseOrderText(sample1);
assert(res1.customer_name === "أحمد مصطفى إبراهيم", `Extracted Name: "${res1.customer_name}"`);
assert(res1.phone_primary === "01012345678", `Extracted Primary Phone: "${res1.phone_primary}"`);
assert(res1.phone_secondary === "01223456789", `Extracted Secondary Phone: "${res1.phone_secondary}"`);
assert(res1.governorate === "الجيزة", `Extracted Governorate: "${res1.governorate}"`);
assert(res1.address.includes("شارع الهرم"), `Extracted Address: "${res1.address}"`);
assert(res1.landmark.includes("بنك مصر"), `Extracted Landmark: "${res1.landmark}"`);
assert(res1.order_total === 850, `Extracted Total: ${res1.order_total}`);
assert(res1.paid_amount === 100, `Extracted Paid Amount: ${res1.paid_amount}`);
assert(res1.items_summary.includes("اوفر سايز"), `Extracted Items: "${res1.items_summary}"`);
assert(res1.important_notes.includes("بعد الظهر"), `Extracted Notes: "${res1.important_notes}"`);
assert(res1.confidence.name && res1.confidence.phone && res1.confidence.governorate && res1.confidence.total, "High confidence scores");

// Case 3: Freeform messy single-line format
console.log("\n[Scenario 3] Messy Unlabeled Input with Alias (المنصورة -> الدقهلية):");
const sample2 = `محمد علاء حسان 01156789012 المنصورة شارع الجمهورية برج الأطباء الدور الرابع 3 قمصان 750ج`;
const res2 = parseOrderText(sample2);
assert(res2.customer_name.includes("محمد علاء"), `Identified name without label: "${res2.customer_name}"`);
assert(res2.phone_primary === "01156789012", `Extracted phone: "${res2.phone_primary}"`);
assert(res2.governorate === "الدقهلية", `Resolved alias "المنصورة" to governorate "الدقهلية": "${res2.governorate}"`);
assert(res2.order_total === 750, `Extracted inline price "750ج": ${res2.order_total}`);

// Case 4: Cairo alias recognition ("المعادي" -> القاهرة)
console.log("\n[Scenario 4] City Alias Recognition (المعادي -> القاهرة):");
const sample3 = `
سارة محمود الشافعي
01099887766
المعادي شارع 9 امام جراند مول
السعر: 400
`;
const res3 = parseOrderText(sample3);
assert(res3.customer_name === "سارة محمود الشافعي", `Name extracted: "${res3.customer_name}"`);
assert(res3.phone_primary === "01099887766", `Phone extracted: "${res3.phone_primary}"`);
assert(res3.governorate === "القاهرة", `Matched governorate القاهرة from المعادي: "${res3.governorate}"`);
assert(res3.order_total === 400, `Total: ${res3.order_total}`);

console.log("\n================================================================================");
console.log(` 🎉 ALL TESTS PASSED: ${passedCount}/${totalCount} assertions verified!`);
console.log("================================================================================");
