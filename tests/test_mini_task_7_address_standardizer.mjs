import assert from "node:assert/strict";
import {
  getDistrictsForGovernorate,
  detectGovernorateMisclassification,
  findDistrictInText,
  extractLandmarkAndCleanAddress,
  standardizeAddress,
} from "../src/lib/addressStandardizer.ts";
import { parseOrderText } from "../src/lib/orderTextParser.ts";
import { DEFAULT_GOVERNORATES } from "../src/lib/governorates.ts";

console.log("🚀 Starting Mini Task 7: Smart Address & District Standardizer Tests...\n");

let passedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${testName}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. District Lookup
runTest("getDistrictsForGovernorate returns accurate districts for major Egyptian governorates", () => {
  const cairoDistricts = getDistrictsForGovernorate("القاهرة");
  assert(cairoDistricts.includes("مدينة نصر"), "Cairo must include مدينة نصر");
  assert(cairoDistricts.includes("المعادي"), "Cairo must include المعادي");
  assert(cairoDistricts.includes("التجمع الخامس"), "Cairo must include التجمع الخامس");

  const gizaDistricts = getDistrictsForGovernorate("الجيزة");
  assert(gizaDistricts.includes("الشيخ زايد"), "Giza must include الشيخ زايد");
  assert(gizaDistricts.includes("6 أكتوبر"), "Giza must include 6 أكتوبر");
  assert(gizaDistricts.includes("الهرم"), "Giza must include الهرم");

  const alexDistricts = getDistrictsForGovernorate("الإسكندرية");
  assert(alexDistricts.includes("سموحة"), "Alexandria must include سموحة");
  assert(alexDistricts.includes("ميامي"), "Alexandria must include ميامي");

  const qalyubiaDistricts = getDistrictsForGovernorate("القليوبية");
  assert(qalyubiaDistricts.includes("شبرا الخيمة"), "Qalyubia must include شبرا الخيمة");
  assert(qalyubiaDistricts.includes("بنها"), "Qalyubia must include بنها");
});

// 2. Misclassification Detection: شبرا الخيمة
runTest("detectGovernorateMisclassification detects شبرا الخيمة misfiled under القاهرة", () => {
  const result = detectGovernorateMisclassification("شبرا الخيمة شارع 15 مايو", "القاهرة");
  assert(result !== null, "Should detect misclassification");
  assert.equal(result.isMisclassified, true);
  assert.equal(result.correctGov, "القليوبية");
  assert.equal(result.district, "شبرا الخيمة");
  assert(result.reason.includes("القليوبية"));
});

// 3. Misclassification: الشيخ زايد and 6 أكتوبر
runTest("detectGovernorateMisclassification detects الشيخ زايد and 6 أكتوبر misfiled under القاهرة", () => {
  const zayedResult = detectGovernorateMisclassification("الشيخ زايد الحي الثامن", "القاهرة");
  assert(zayedResult !== null);
  assert.equal(zayedResult.correctGov, "الجيزة");

  const octoberResult = detectGovernorateMisclassification("6 أكتوبر الحي المتميز", "القاهرة");
  assert(octoberResult !== null);
  assert.equal(octoberResult.correctGov, "الجيزة");
});

// 4. Misclassification: العاشر من رمضان
runTest("detectGovernorateMisclassification detects العاشر من رمضان misfiled under القاهرة", () => {
  const result = detectGovernorateMisclassification("العاشر من رمضان المجاورة 12", "القاهرة");
  assert(result !== null);
  assert.equal(result.correctGov, "الشرقية");
});

// 5. شبرا مصر disambiguation
runTest("detectGovernorateMisclassification keeps شبرا مصر correctly under القاهرة", () => {
  const result = detectGovernorateMisclassification("شبرا مصر شارع الترعة البولاقية", "القاهرة");
  assert.equal(result, null, "شبرا مصر in Cairo should NOT trigger misclassification");
});

// 6. findDistrictInText
runTest("findDistrictInText finds correct district and governorate from address text", () => {
  const match1 = findDistrictInText("شارع التسعين التجمع الخامس أمام الجامعة الأمريكية");
  assert(match1 !== null);
  assert.equal(match1.district, "التجمع الخامس");
  assert.equal(match1.governorate, "القاهرة");

  const match2 = findDistrictInText("طريق الجيش سموحة الإسكندرية");
  assert(match2 !== null);
  assert.equal(match2.district, "سموحة");
  assert.equal(match2.governorate, "الإسكندرية");
});

// 7. Landmark Extraction & Address Cleaning
runTest("extractLandmarkAndCleanAddress separates landmark and cleans repetitive names", () => {
  const { cleanedStreetAddress, extractedLandmark } = extractLandmarkAndCleanAddress(
    "القاهرة - 15 شارع مصطفى النحاس بجوار بنك مصر مدينة نصر",
    "مدينة نصر",
    "القاهرة"
  );
  assert.equal(extractedLandmark, "بجوار بنك مصر");
  assert(cleanedStreetAddress.includes("15 شارع مصطفى النحاس"));
});

// 8. Full standardizeAddress function
runTest("standardizeAddress resolves governorate, corrects mistakes, and assigns shipping rate", () => {
  const result = standardizeAddress(
    "15 شارع أحمد عرابي شبرا الخيمة بجوار محطة المترو",
    "القاهرة",
    DEFAULT_GOVERNORATES
  );
  assert.equal(result.standardGovernorate, "القليوبية");
  assert.equal(result.wasGovernorateCorrected, true);
  assert.equal(result.standardDistrict, "شبرا الخيمة");
  assert.equal(result.extractedLandmark, "بجوار محطة المترو");
  assert.equal(result.shippingRate, 65);
});

// 9. Integration with parseOrderText in WhatsApp message
runTest("parseOrderText uses address standardizer to extract district and correct misclassified governorate", () => {
  const msg = `الاسم: محمود طارق
الموبايل: 01012345678
المحافظة: القاهرة
العنوان: شبرا الخيمة شارع نادي المؤسسة امام البنك الاهلي
المبلغ: 500 جنيه`;

  const parsed = parseOrderText(msg, DEFAULT_GOVERNORATES);
  assert.equal(parsed.customer_name, "محمود طارق");
  assert.equal(parsed.phone_primary, "01012345678");
  assert.equal(parsed.governorate, "القليوبية", "Should auto-correct Cairo to Qalyubia for Shubra El-Kheima");
  assert.equal(parsed.was_governorate_corrected, true);
  assert.equal(parsed.district, "شبرا الخيمة");
  assert.equal(parsed.landmark, "امام البنك الاهلي");
  assert.equal(parsed.order_total, 500);
});

console.log(`\n🎉 All ${passedTests} Mini Task 7 Address Standardizer tests passed successfully!`);
