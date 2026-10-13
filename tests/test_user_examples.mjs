import { parseOrderText, parseBulkOrderText } from "../src/lib/orderTextParser.ts";

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

console.log("=== TEST 1: EX1 ===");
const res1 = parseOrderText(ex1);
console.log(res1);
if (
  res1.customer_name === "رضوي سعيد" &&
  res1.governorate === "الدقهلية" &&
  res1.order_total === 310 &&
  res1.phone_primary === "01221322423"
) {
  console.log("✅ EX1 PASSED PERFECTLY!");
} else {
  console.error("❌ EX1 FAILED");
  process.exit(1);
}

console.log("\n=== TEST 2: EX2 ===");
const res2 = parseOrderText(ex2);
console.log(res2);
if (
  res2.customer_name === "محمود رمضان محمد" &&
  res2.governorate === "الشرقية" &&
  res2.order_total === 410 &&
  res2.phone_primary === "01123125207" &&
  res2.phone_secondary === "01146006925"
) {
  console.log("✅ EX2 PASSED PERFECTLY!");
} else {
  console.error("❌ EX2 FAILED");
  process.exit(1);
}

console.log("\n=== TEST 3: EX3 ===");
const res3 = parseOrderText(ex3);
console.log(res3);
if (
  res3.customer_name === "سمر سامي" &&
  res3.governorate === "القاهرة" &&
  res3.order_total === 110 &&
  res3.phone_primary === "01060684143" &&
  res3.phone_secondary === "01063690872"
) {
  console.log("✅ EX3 PASSED PERFECTLY!");
} else {
  console.error("❌ EX3 FAILED");
  process.exit(1);
}

// Bulk test
console.log("\n=== TEST 4: BULK ALL 3 ORDERS ===");
const combinedBulk = `${ex1}\n\n---\n\n${ex2}\n\n---\n\n${ex3}`;
const bulkResults = parseBulkOrderText(combinedBulk);
console.log(`Parsed ${bulkResults.length} bulk orders`);
if (bulkResults.length === 3) {
  console.log("✅ BULK PARSER PASSED PERFECTLY!");
} else {
  console.error("❌ BULK PARSER FAILED");
  process.exit(1);
}
