import {
  splitAndNormalizePhoneNumbers,
  normalizePhoneNumber,
  validateImportRow,
  detectIntraSheetDuplicates,
  classifyDbDuplicates,
  applyDuplicateResolutionStrategy,
  revalidateSingleRow,
} from "../src/lib/excel-import.ts";
import { DEFAULT_GOVERNORATES } from "../src/lib/governorates.ts";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`  ✔ Passed: ${message}`);
}

console.log("=== MINI TASK 5: PRE-VALIDATION & DUPLICATE DETECTION TEST SUITE ===\n");

// -------------------------------------------------------------
// TEST 1: Phone Sanitization, Normalization & Splitting
// -------------------------------------------------------------
console.log("[Test Suite 1] Phone Sanitization & Multi-Phone Extraction");

const phoneSplit1 = splitAndNormalizePhoneNumbers("01012345678 / 01198765432");
assert(phoneSplit1.primary === "01012345678", "Primary phone extracted from slash-separated string");
assert(phoneSplit1.secondary === "01198765432", "Secondary phone extracted from slash-separated string");
assert(phoneSplit1.wasRepaired === true, "Marked as repaired when extracting secondary");

const phoneSplit2 = splitAndNormalizePhoneNumbers("1012345678");
assert(phoneSplit2.primary === "01012345678", "Restores missing leading 0 for 10-digit Egyptian number");

const phoneSplit3 = splitAndNormalizePhoneNumbers("+201012345678");
assert(phoneSplit3.primary === "01012345678", "Strips +20 international prefix");

const phoneSplit4 = splitAndNormalizePhoneNumbers("00201012345678");
assert(phoneSplit4.primary === "01012345678", "Strips 0020 international prefix");

const phoneSplit5 = splitAndNormalizePhoneNumbers("٠١٠١٢٣٤٥٦٧٨");
assert(phoneSplit5.primary === "01012345678", "Converts Eastern Arabic digits (٠-٩) to English digits");

const phoneSplit6 = splitAndNormalizePhoneNumbers("01012345678 و 01555554444");
assert(phoneSplit6.primary === "01012345678", "Handles Arabic 'و' separator for primary");
assert(phoneSplit6.secondary === "01555554444", "Handles Arabic 'و' separator for secondary");

// -------------------------------------------------------------
// TEST 2: Row Validation with Auto-extracted Secondary Phone
// -------------------------------------------------------------
console.log("\n[Test Suite 2] validateImportRow with Phone Splitting & Address Extraction");

const mapping = {
  customer_name: "الاسم",
  phone_primary: "الهاتف",
  governorate: "المحافظة",
  address: "العنوان",
  order_total: "السعر",
  paid_amount: "المدفوع",
};

const rawRowWithTwoPhones = {
  "الاسم": "محمود سمير",
  "الهاتف": "01099887766 / 01233445566",
  "المحافظة": "الجيزة",
  "العنوان": "فيصل - محطة المساحة",
  "السعر": 1200,
  "المدفوع": 200,
};

const validatedRow1 = validateImportRow(rawRowWithTwoPhones, mapping, 1, DEFAULT_GOVERNORATES);
assert(validatedRow1.isValid === true, "Row is valid");
assert(validatedRow1.data?.phone_primary === "01099887766", "Phone primary is clean 01099887766");
assert(validatedRow1.data?.phone_secondary === "01233445566", "Phone secondary populated automatically");
assert(validatedRow1.data?.cod_amount === 1000, "COD amount calculated correctly (1200 - 200 = 1000)");

// -------------------------------------------------------------
// TEST 3: Intra-Sheet Duplicate Detection
// -------------------------------------------------------------
console.log("\n[Test Suite 3] Intra-Sheet Duplicate Detection");

const rawSheetRows = [
  {
    rowNumber: 1,
    raw: {},
    isValid: true,
    errors: [],
    data: {
      customer_name: "كريم يوسف",
      phone_primary: "01011112222",
      governorate: "القاهرة",
      address: "ش مصر والسودان",
      order_total: 900,
      paid_amount: 0,
      cod_amount: 900,
      shipping_cost: 60,
      net_profit: 840,
    },
    governorateMatched: true,
    governorateRaw: "القاهرة",
  },
  {
    rowNumber: 2,
    raw: {},
    isValid: true,
    errors: [],
    data: {
      customer_name: "كريم يوسف",
      phone_primary: "01011112222",
      governorate: "القاهرة",
      address: "ش مصر والسودان",
      order_total: 900,
      paid_amount: 0,
      cod_amount: 900,
      shipping_cost: 60,
      net_profit: 840,
    },
    governorateMatched: true,
    governorateRaw: "القاهرة",
  },
  {
    rowNumber: 3,
    raw: {},
    isValid: true,
    errors: [],
    data: {
      customer_name: "سامح كامل",
      phone_primary: "01011112222",
      governorate: "القاهرة",
      address: "مدينة نصر",
      order_total: 1500,
      paid_amount: 0,
      cod_amount: 1500,
      shipping_cost: 60,
      net_profit: 1440,
    },
    governorateMatched: true,
    governorateRaw: "القاهرة",
  },
];

const processedIntra = detectIntraSheetDuplicates(rawSheetRows);
assert(processedIntra[0].isDuplicate === true, "Row 1 tagged as duplicate");
assert(processedIntra[0].duplicateDetails?.severity === "exact_sheet", "Row 1 severity is exact_sheet");
assert(processedIntra[1].isDuplicate === true, "Row 2 tagged as duplicate");
assert(processedIntra[1].duplicateDetails?.severity === "exact_sheet", "Row 2 severity is exact_sheet");
assert(processedIntra[2].isDuplicate === true, "Row 3 tagged as duplicate");
assert(processedIntra[2].duplicateDetails?.severity === "phone_sheet", "Row 3 severity is phone_sheet (same phone, different name/total)");

// -------------------------------------------------------------
// TEST 4: Database Existing Duplicates Classification
// -------------------------------------------------------------
console.log("\n[Test Suite 4] Database Existing Duplicates Classification");

const mockDbMatches = {
  "01055556666": [
    {
      id: "abc12345-order-uuid",
      customer_name: "رانيا مجدي",
      phone_primary: "01055556666",
      order_total: 750,
      delivery_status: "delivered",
      created_at: "2026-10-01",
    },
  ],
  "01277778888": [
    {
      id: "def67890-order-uuid",
      customer_name: "هشام شوقي",
      phone_primary: "01277778888",
      order_total: 400,
      delivery_status: "delivered",
      created_at: "2026-09-15",
    },
  ],
};

const rowsForDbCheck = [
  {
    rowNumber: 10,
    raw: {},
    isValid: true,
    errors: [],
    data: {
      customer_name: "رانيا مجدي",
      phone_primary: "01055556666",
      governorate: "الإسكندرية",
      address: "سموحة",
      order_total: 750, // exact same total and name
      paid_amount: 0,
      cod_amount: 750,
      shipping_cost: 65,
      net_profit: 685,
    },
    governorateMatched: true,
    governorateRaw: "الإسكندرية",
  },
  {
    rowNumber: 11,
    raw: {},
    isValid: true,
    errors: [],
    data: {
      customer_name: "هشام شوقي",
      phone_primary: "01277778888",
      governorate: "القاهرة",
      address: "المعادي",
      order_total: 1200, // returning customer with new order total!
      paid_amount: 0,
      cod_amount: 1200,
      shipping_cost: 60,
      net_profit: 1140,
    },
    governorateMatched: true,
    governorateRaw: "القاهرة",
  },
];

const processedDb = classifyDbDuplicates(rowsForDbCheck, mockDbMatches);
assert(processedDb[0].isDuplicate === true, "Exact DB match is tagged as duplicate");
assert(processedDb[0].duplicateDetails?.severity === "exact_db", "Severity classified as exact_db");

assert(processedDb[1].isDuplicate === true, "Returning customer is tagged as duplicate");
assert(processedDb[1].duplicateDetails?.severity === "returning_customer", "Severity classified as returning_customer");

// -------------------------------------------------------------
// TEST 5: Duplicate Resolution Strategies
// -------------------------------------------------------------
console.log("\n[Test Suite 5] Duplicate Resolution Strategies");

const mixedDuplicates = [processedDb[0], processedDb[1]]; // exact_db and returning_customer

// Strategy 1: skip_exact_only (Recommended default)
const afterExactOnly = applyDuplicateResolutionStrategy(mixedDuplicates, "skip_exact_only");
assert(afterExactOnly[0].skipDuplicate === true, "Strategy 'skip_exact_only' skips exact_db");
assert(afterExactOnly[1].skipDuplicate === false, "Strategy 'skip_exact_only' keeps returning_customer for import");

// Strategy 2: skip_all
const afterSkipAll = applyDuplicateResolutionStrategy(mixedDuplicates, "skip_all");
assert(afterSkipAll[0].skipDuplicate === true, "Strategy 'skip_all' skips exact_db");
assert(afterSkipAll[1].skipDuplicate === true, "Strategy 'skip_all' skips returning_customer too");

// Strategy 3: import_all
const afterImportAll = applyDuplicateResolutionStrategy(mixedDuplicates, "import_all");
assert(afterImportAll[0].skipDuplicate === false, "Strategy 'import_all' imports exact_db");
assert(afterImportAll[1].skipDuplicate === false, "Strategy 'import_all' imports returning_customer");

// -------------------------------------------------------------
// TEST 6: Inline Row Revalidation (revalidateSingleRow)
// -------------------------------------------------------------
console.log("\n[Test Suite 6] Inline Row Revalidation");

const rowWithErrors = {
  rowNumber: 20,
  raw: {},
  isValid: false,
  errors: ["المحافظة مطلوبة", "صيغة رقم الهاتف غير صالحة"],
  data: {
    customer_name: "طارق سليم",
    phone_primary: "123", // invalid
    phone_secondary: null,
    governorate: "", // missing
    address: "ش الهرم",
    order_total: 1000,
    paid_amount: 200,
    cod_amount: 800,
    shipping_cost: 0,
    net_profit: 1000,
    payment_status: "partially_paid",
  },
  governorateMatched: false,
  governorateRaw: "",
};

// User fixes phone and selects Cairo in inline edit mode
const revalidated = revalidateSingleRow(
  rowWithErrors,
  {
    phone_primary: "01012345678",
    governorate: "القاهرة",
  },
  DEFAULT_GOVERNORATES
);

assert(revalidated.isValid === true, "Row becomes valid after inline edits");
assert(revalidated.errors.length === 0, "All errors cleared");
assert(revalidated.governorateMatched === true, "Governorate matched to Cairo");
assert(revalidated.data?.shipping_cost === 65, "Shipping rate automatically set to Cairo (65 EGP)");
assert(revalidated.data?.net_profit === 935, "Net profit recomputed (1000 - 65 = 935)");
assert(revalidated.isManuallyEdited === true, "Flagged as manually edited");

console.log("\n🎉 ALL MINI TASK 5 PRE-VALIDATION & DUPLICATE TESTS PASSED! 🎉\n");
