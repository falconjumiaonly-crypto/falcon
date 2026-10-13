import { parseOrderText, parseBulkOrderText } from "../src/lib/orderTextParser";

const ex1 = `ال ٤ جرابات دول للعميلة دي 

رضوي سعيد
01221322423
الدقهليه
صهرجت الكبري مركز ميت غمر
صهرجت الكبري شارع السوق عند جامع الشيخ نصر الدين عند شارع الدكتور اسامه بتاع الاطفال

بعتت ٣٠٠
باقي ٣١٠`;

const ex2 = `ال ٤ جرابات دول للعميل ده 

محمود رمضان محمد 
٠١١٢٣١٢٥٢٠٧
01146006925
الشرقية 
أبو حماد . الأسدية تل مرداس ( مسجد وجمعية الخلفاء الراشدين ) بيت الأستاذ رمضان أبو الخير الفيومي

بعت ٢٠٠
٤١٠`;

const ex3 = `الاسم :سمر سامي 
رقم التلفون :01060684143
رقم تلفون اضافى:01063690872
المحافظة:القاهرة 
حلوان مدينة الابطال عمارة ١٣٤ شقة 52 
بجوار البوابة الجوية الى هى البوابة التانية 
وأمام سوبر ماركت

Redmie A5  - 4g

بعتت ١١٥
باقي ١١٠`;

console.log("=== TEST 1: EX1 (NO PRICE / NO PRODUCT IN NOTES) ===");
const res1 = parseOrderText(ex1);
console.log(res1);
if (
  res1.customer_name === "رضوي سعيد" &&
  res1.governorate === "الدقهلية" &&
  res1.order_total === 310 &&
  res1.phone_primary === "01221322423" &&
  res1.important_notes === ""
) {
  console.log("✅ EX1 PASSED PERFECTLY (important_notes is empty as expected)!");
} else {
  console.error("❌ EX1 FAILED: important_notes =", res1.important_notes);
  process.exit(1);
}

console.log("\n=== TEST 2: EX2 (NO PRICE / NO PRODUCT IN NOTES) ===");
const res2 = parseOrderText(ex2);
console.log(res2);
if (
  res2.customer_name === "محمود رمضان محمد" &&
  res2.governorate === "الشرقية" &&
  res2.order_total === 410 &&
  res2.phone_primary === "01123125207" &&
  res2.phone_secondary === "01146006925" &&
  res2.important_notes === ""
) {
  console.log("✅ EX2 PASSED PERFECTLY (important_notes is empty as expected)!");
} else {
  console.error("❌ EX2 FAILED: important_notes =", res2.important_notes);
  process.exit(1);
}

console.log("\n=== TEST 3: EX3 (NO PRICE / NO PRODUCT IN NOTES) ===");
const res3 = parseOrderText(ex3);
console.log(res3);
if (
  res3.customer_name === "سمر سامي" &&
  res3.governorate === "القاهرة" &&
  res3.order_total === 110 &&
  res3.phone_primary === "01060684143" &&
  res3.phone_secondary === "01063690872" &&
  res3.important_notes === ""
) {
  console.log("✅ EX3 PASSED PERFECTLY (important_notes is empty as expected)!");
} else {
  console.error("❌ EX3 FAILED: important_notes =", res3.important_notes);
  process.exit(1);
}

console.log("\n=== TEST 4: FRAGILE (ضد الكسر) ===");
const exFragile = `محمد علاء
01012345678
الجيزة
الهرم
الاوردر ضد الكسر
بعت 100 باقي 250`;
const resFragile = parseOrderText(exFragile);
console.log("Fragile result notes:", resFragile.important_notes);
if (resFragile.important_notes.includes("ضد الكسر") && !resFragile.important_notes.includes("100") && !resFragile.important_notes.includes("250")) {
  console.log("✅ FRAGILE TEST PASSED PERFECTLY!");
} else {
  console.error("❌ FRAGILE TEST FAILED:", resFragile.important_notes);
  process.exit(1);
}

console.log("\n=== TEST 5: TIMING (معاد) + COURIER ALERT (تنبيه للمندوب) + FRAGILE (ضد الكسر) ===");
const exCombined = `كريم طارق
01555554444
الإسكندرية
سموحة ش فوزي معاذ
ضد الكسر
التسليم بعد الساعة 5 مساءً
الاتصال قبل الوصول
المنتج: جراب مغناطيسي
بعت 300 باقي 400`;
const resCombined = parseOrderText(exCombined);
console.log("Combined result notes:", resCombined.important_notes);
console.log("Combined items summary:", resCombined.items_summary);
console.log("Combined order total:", resCombined.order_total);
if (
  resCombined.important_notes.includes("ضد الكسر") &&
  resCombined.important_notes.includes("التسليم بعد الساعة 5 مساءً") &&
  resCombined.important_notes.includes("الاتصال قبل الوصول") &&
  !resCombined.important_notes.includes("جراب") &&
  !resCombined.important_notes.includes("300") &&
  !resCombined.important_notes.includes("400") &&
  resCombined.order_total === 400
) {
  console.log("✅ COMBINED NOTES TEST PASSED PERFECTLY!");
} else {
  console.error("❌ COMBINED NOTES TEST FAILED:", resCombined.important_notes);
  process.exit(1);
}

console.log("\n🎉 ALL TESTS PASSED WITH 100% SUCCESS!");
