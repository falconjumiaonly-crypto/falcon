import {
  PRESET_TAGS,
  COLOR_PALETTES,
  createTagDefinition,
  extractTagsFromNotes,
  stripTagsFromNotes,
  embedTagsInNotes,
  resolveOrderTags,
  getOrderTags,
  orderHasTag,
  filterOrdersByTag,
} from "../src/lib/tags/tagsEngine.ts";

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("\n🧪 Running Mini Task 21: Custom Order Tags & Lifecycle Labels Test Suite...\n");

// Test 1: Presets & Color Palettes
console.log("▶ Test 1: Presets and Color Palettes Validity");
assert(PRESET_TAGS.length >= 8, `PRESET_TAGS has ${PRESET_TAGS.length} predefined merchant tags`);
const urgentPreset = PRESET_TAGS.find((p) => p.id === "urgent");
assert(urgentPreset !== undefined, "Preset 'urgent' exists");
assert(urgentPreset.name.includes("عاجل"), "Urgent preset has Arabic label");
assert(urgentPreset.color === "rose", "Urgent preset uses rose color palette");
assert(urgentPreset.bgClass.includes("bg-rose-50"), "Urgent preset has correct background class");

const inspectionPreset = PRESET_TAGS.find((p) => p.id === "allow_inspection");
assert(inspectionPreset !== undefined, "Preset 'allow_inspection' exists");
assert(inspectionPreset.name.includes("المعاينة"), "Allow inspection has Arabic label");

// Test 2: Custom Tag Definition
console.log("\n▶ Test 2: Custom Tag Creation Helper");
const customTag = createTagDefinition("vip_packaging", "تغليف هدايا فاخر", "purple");
assert(customTag.id === "vip_packaging", "Tag ID sanitized and preserved");
assert(customTag.name === "تغليف هدايا فاخر", "Tag name preserved");
assert(customTag.color === "purple", "Tag color assigned");
assert(customTag.textClass === COLOR_PALETTES.purple.textClass, "Tag inherits proper purple text class");

// Test 3: Tag Extraction from Notes
console.log("\n▶ Test 3: Tag Extraction from Free-form Order Notes");
const arabicNotes = "التسليم في مكتب العمل [وسوم: عاجل، مسموح المعاينة]";
const extractedArabic = extractTagsFromNotes(arabicNotes);
assert(extractedArabic.includes("urgent"), "Extracted 'urgent' from Arabic notes");
assert(extractedArabic.includes("allow_inspection"), "Extracted 'allow_inspection' from Arabic notes");

const englishNotes = "Call before delivery [tags: urgent, deposit_paid]";
const extractedEnglish = extractTagsFromNotes(englishNotes);
assert(extractedEnglish.includes("urgent"), "Extracted 'urgent' from English tags block");
assert(extractedEnglish.includes("deposit_paid"), "Extracted 'deposit_paid' from English tags block");

const hashtagNotes = "العميل مستعجل جدا #عاجل بعد الساعة 4 #معاينة";
const extractedHashtags = extractTagsFromNotes(hashtagNotes);
assert(extractedHashtags.includes("urgent"), "Extracted tag from hashtag #عاجل");
assert(extractedHashtags.includes("allow_inspection"), "Extracted tag from hashtag #معاينة");

const emptyNotesTags = extractTagsFromNotes(null);
assert(emptyNotesTags.length === 0, "Null notes returns empty tags array");

// Test 4: Stripping and Embedding Tags into Notes
console.log("\n▶ Test 4: Stripping and Embedding Tags into Notes");
const originalUserText = "برجاء الاتصال قبل الميعاد بساعة";
const embedded = embedTagsInNotes(originalUserText, ["urgent", "deposit_paid"]);
assert(embedded.includes(originalUserText), "Embedded notes preserves original text");
assert(embedded.includes("[وسوم:"), "Embedded notes has '[وسوم:' block");
assert(embedded.includes("عاجل"), "Embedded notes contains Arabic tag names for courier");

const stripped = stripTagsFromNotes(embedded);
assert(stripped === originalUserText, "stripTagsFromNotes correctly restored clean user notes");

// Test 5: Resolving & Filtering Orders by Tags
console.log("\n▶ Test 5: Order Tag Resolution and Filtering");
const sampleOrders = [
  {
    id: "ord-1",
    customer_name: "أحمد سليم",
    important_notes: "تسليم سريع [وسوم: عاجل]",
  },
  {
    id: "ord-2",
    customer_name: "سارة محمود",
    important_notes: "ممنوع فتح الطرد",
  },
  {
    id: "ord-3",
    customer_name: "كريم يوسف",
    important_notes: "[وسوم: مسموح المعاينة]",
  },
];

// External registry tags map simulation
const tagsMap = {
  "ord-2": ["deposit_paid"],
};

const ord1Tags = getOrderTags(sampleOrders[0], [], tagsMap);
assert(ord1Tags.some((t) => t.id === "urgent"), "ord-1 resolves 'urgent' tag");

const ord2Tags = getOrderTags(sampleOrders[1], [], tagsMap);
assert(ord2Tags.some((t) => t.id === "deposit_paid"), "ord-2 resolves 'deposit_paid' from external map");

// Check filtering
const urgentFiltered = filterOrdersByTag(sampleOrders, "urgent", tagsMap);
assert(urgentFiltered.length === 1 && urgentFiltered[0].id === "ord-1", "Filtered urgent orders correctly");

const depositFiltered = filterOrdersByTag(sampleOrders, "deposit_paid", tagsMap);
assert(depositFiltered.length === 1 && depositFiltered[0].id === "ord-2", "Filtered deposit_paid orders correctly");

const allFiltered = filterOrdersByTag(sampleOrders, "all", tagsMap);
assert(allFiltered.length === 3, "Filter with 'all' preserves all orders");

console.log(`\n🎉 All ${passedCount}/${totalCount} tests passed successfully!\n`);
