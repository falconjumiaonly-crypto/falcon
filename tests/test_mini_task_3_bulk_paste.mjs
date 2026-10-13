import { parseBulkOrderText } from "../src/lib/orderTextParser.ts";
import { DEFAULT_GOVERNORATES } from "../src/lib/governorates.ts";

console.log("================================================================================");
console.log("             TESTING MINI TASK 3: BULK QUICK PASTE PARSER                      ");
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

// 1. Test splitting text with multiple orders separated by `---`
const bulkSampleDashes = `
الاسم: أحمد مصطفى
الموبايل: 01012345678
المحافظة: الجيزة
العنوان: شارع الهرم الرئيسي
المبلغ: 750 جنيه
---
محمود سعيد
01198765432
طنطا شارع النحاس
السعر: 850 جنيه
---
سارة محمود الشافعي
01099887766
المعادي شارع 9 امام جراند مول
المبلغ: 600 جنيه
مدفوع: 100
`;

console.log("\n[Test 1] Testing Parsing 3 Orders Separated by '---'...");
const res1 = parseBulkOrderText(bulkSampleDashes, DEFAULT_GOVERNORATES);

assert(res1.length === 3, `Expected 3 parsed orders, got ${res1.length}`);
assert(res1[0].customer_name === "أحمد مصطفى", `Order 1 name: "${res1[0].customer_name}"`);
assert(res1[0].phone_primary === "01012345678", `Order 1 phone: "${res1[0].phone_primary}"`);
assert(res1[0].governorate === "الجيزة", `Order 1 gov: "${res1[0].governorate}"`);
assert(res1[0].order_total === 750, `Order 1 total: ${res1[0].order_total}`);

assert(res1[1].customer_name.includes("محمود سعيد"), `Order 2 name: "${res1[1].customer_name}"`);
assert(res1[1].phone_primary === "01198765432", `Order 2 phone: "${res1[1].phone_primary}"`);
assert(res1[1].governorate === "الغربية", `Order 2 gov from طنطا: "${res1[1].governorate}"`);
assert(res1[1].order_total === 850, `Order 2 total: ${res1[1].order_total}`);

assert(res1[2].customer_name === "سارة محمود الشافعي", `Order 3 name: "${res1[2].customer_name}"`);
assert(res1[2].phone_primary === "01099887766", `Order 3 phone: "${res1[2].phone_primary}"`);
assert(res1[2].governorate === "القاهرة", `Order 3 gov from المعادي: "${res1[2].governorate}"`);
assert(res1[2].order_total === 600, `Order 3 total: ${res1[2].order_total}`);
assert(res1[2].paid_amount === 100, `Order 3 paid: ${res1[2].paid_amount}`);

// 2. Test splitting with double blank lines (common when copying from WhatsApp)
const bulkSampleDoubleNewlines = `
كريم عبد العزيز
01055554433
المنصورة شارع المشاية
500ج

يوسف الشريف
01122334455
الإسكندرية سموحة
1000ج
`;

console.log("\n[Test 2] Testing Parsing Orders Separated by Double Line Breaks...");
const res2 = parseBulkOrderText(bulkSampleDoubleNewlines, DEFAULT_GOVERNORATES);
assert(res2.length === 2, `Expected 2 orders, got ${res2.length}`);
assert(res2[0].customer_name.includes("كريم"), `Order 1: "${res2[0].customer_name}"`);
assert(res2[0].governorate === "الدقهلية", `Order 1 gov: "${res2[0].governorate}"`);
assert(res2[1].customer_name.includes("يوسف"), `Order 2: "${res2[1].customer_name}"`);
assert(res2[1].governorate === "الإسكندرية", `Order 2 gov: "${res2[1].governorate}"`);

console.log("\n================================================================================");
console.log(` 🎉 BULK QUICK PASTE TEST PASSED: ${passedCount}/${totalCount} assertions verified!`);
console.log("================================================================================");
