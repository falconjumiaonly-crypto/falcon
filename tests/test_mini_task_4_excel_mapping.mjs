import {
  detectColumnMappings,
  detectPlatformPreset,
  validateImportRow,
  PLATFORM_PRESETS,
} from "../src/lib/excel-import.ts";
import { DEFAULT_GOVERNORATES } from "../src/lib/governorates.ts";

console.log("================================================================================");
console.log("             TESTING MINI TASK 4: AUTO COLUMN MAPPING WIZARD                    ");
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

// 1. Shopify Sheet Headers Auto-Mapping & Preset Detection
console.log("\n[Test 1] Testing Shopify Headers Auto-Mapping & Detection...");
const shopifyHeaders = [
  "Order ID",
  "Billing Name",
  "Shipping Name",
  "Shipping Phone",
  "Shipping Address1",
  "Shipping City",
  "Total Price",
  "Lineitem name",
  "Financial Status",
];

const presetShopify = detectPlatformPreset(shopifyHeaders);
assert(presetShopify.preset === "shopify", `Detected preset: "${presetShopify.preset}"`);

const mappedShopify = detectColumnMappings(shopifyHeaders);
assert(mappedShopify.customer_name === "Shipping Name" || mappedShopify.customer_name === "Billing Name", `Customer Name mapped: "${mappedShopify.customer_name}"`);
assert(mappedShopify.phone_primary === "Shipping Phone", `Phone mapped: "${mappedShopify.phone_primary}"`);
assert(mappedShopify.address === "Shipping Address1", `Address mapped: "${mappedShopify.address}"`);
assert(mappedShopify.governorate === "Shipping City", `Governorate mapped: "${mappedShopify.governorate}"`);
assert(mappedShopify.order_total === "Total Price", `Order Total mapped: "${mappedShopify.order_total}"`);
assert(mappedShopify.important_notes === "Lineitem name", `Notes mapped: "${mappedShopify.important_notes}"`);

// 2. Shipping Carrier (Bosta / J&T) Sheet Headers Auto-Mapping
console.log("\n[Test 2] Testing Carrier (Bosta / Courier) Headers Auto-Mapping...");
const bostaHeaders = [
  "AWB",
  "Receiver Name",
  "Receiver Phone",
  "Drop Off Address",
  "City",
  "COD Amount",
  "Package Details",
];

const presetBosta = detectPlatformPreset(bostaHeaders);
assert(presetBosta.preset === "bosta", `Detected carrier preset: "${presetBosta.preset}"`);

const mappedBosta = detectColumnMappings(bostaHeaders);
assert(mappedBosta.customer_name === "Receiver Name", `Receiver Name mapped: "${mappedBosta.customer_name}"`);
assert(mappedBosta.phone_primary === "Receiver Phone", `Receiver Phone mapped: "${mappedBosta.phone_primary}"`);
assert(mappedBosta.address === "Drop Off Address", `Drop Off Address mapped: "${mappedBosta.address}"`);
assert(mappedBosta.governorate === "City", `City mapped: "${mappedBosta.governorate}"`);
assert(mappedBosta.order_total === "COD Amount", `COD Amount mapped: "${mappedBosta.order_total}"`);
assert(mappedBosta.important_notes === "Package Details", `Package Details mapped: "${mappedBosta.important_notes}"`);

// 3. Arabic with Hamza & Variations (إسم المستلم / رقم الجوال)
console.log("\n[Test 3] Testing Arabic Variant Normalization...");
const arabicHeaders = [
  "إسم المستلم",
  "رقم الجوال",
  "عنوان الشحن",
  "المحافظة",
  "قيمة التحصيل",
];

const mappedArabic = detectColumnMappings(arabicHeaders);
assert(mappedArabic.customer_name === "إسم المستلم", `Normalized "إسم المستلم" matched customer_name: "${mappedArabic.customer_name}"`);
assert(mappedArabic.phone_primary === "رقم الجوال", `Matched "رقم الجوال": "${mappedArabic.phone_primary}"`);
assert(mappedArabic.address === "عنوان الشحن", `Matched "عنوان الشحن": "${mappedArabic.address}"`);
assert(mappedArabic.governorate === "المحافظة", `Matched "المحافظة": "${mappedArabic.governorate}"`);
assert(mappedArabic.order_total === "قيمة التحصيل", `Matched "قيمة التحصيل": "${mappedArabic.order_total}"`);

// 4. Resolving Governorate directly from Address when Governorate column is missing
console.log("\n[Test 4] Testing Governorate Resolution from Address without Governorate Column...");
const sheetWithoutGovCol = {
  "الاسم": "مصطفى كامل",
  "الهاتف": "01099887766",
  "العنوان": "شارع الجمهورية المنصورة برج النور",
  "السعر": "650",
};

const mappingWithoutGov = {
  customer_name: "الاسم",
  phone_primary: "الهاتف",
  address: "العنوان",
  order_total: "السعر",
};

const rowValidation = validateImportRow(sheetWithoutGovCol, mappingWithoutGov, 1, DEFAULT_GOVERNORATES);
assert(rowValidation.isValid === true, `Row is valid without separate gov column: ${rowValidation.isValid} (Errors: ${rowValidation.errors.join(", ")})`);
assert(rowValidation.data?.governorate === "الدقهلية", `Governorate extracted from address "المنصورة" -> "الدقهلية": "${rowValidation.data?.governorate}"`);
assert(rowValidation.data?.shipping_cost === 75, `Shipping cost automatically assigned for الدقهلية: ${rowValidation.data?.shipping_cost}`);

console.log("\n================================================================================");
console.log(` 🎉 ALL TESTS PASSED: ${passedCount}/${totalCount} assertions verified!`);
console.log("================================================================================");
