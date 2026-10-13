import {
  createAuditEvent,
  generateSyntheticOrderEvents,
  buildOrderFullTimeline,
} from "../src/lib/audit/orderAuditEngine.ts";

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

console.log("\n🧪 Running Mini Task 22: Order Activity & Audit Trail Test Suite...\n");

// Test 1: Event Creation & Structure
console.log("▶ Test 1: createAuditEvent Helper Structure");
const sampleEvent = createAuditEvent(
  "ord-100",
  "whatsapp_sent",
  "إرسال إشعار واتساب",
  "تم إرسال رابط التتبع المباشر للعميل على الواتساب بنجاح.",
  "بوت الواتساب",
  { phone: "01012345678" }
);

assert(sampleEvent.id.startsWith("evt_"), "Event has unique ID prefix 'evt_'");
assert(sampleEvent.order_id === "ord-100", "Order ID is accurately mapped");
assert(sampleEvent.action === "whatsapp_sent", "Action type is 'whatsapp_sent'");
assert(sampleEvent.actor === "بوت الواتساب", "Actor correctly assigned");
assert(sampleEvent.metadata?.phone === "01012345678", "Metadata preserved");
assert(new Date(sampleEvent.timestamp).getTime() > 0, "Valid ISO timestamp generated");

// Test 2: Synthetic Event Generation for Fresh New Order
console.log("\n▶ Test 2: Synthetic Baseline Generation for Fresh Order");
const newOrder = {
  id: "ord-new",
  customer_name: "مروان كمال",
  order_date: "2026-03-10",
  created_at: "2026-03-10T10:00:00Z",
  order_total: 800,
  paid_amount: 100,
  cod_amount: 700,
  shipping_cost: 65,
  governorate: "الإسكندرية",
  print_status: "pending",
  delivery_status: "new",
  settlement_status: "pending",
  important_notes: null,
};

const newOrderEvents = generateSyntheticOrderEvents(newOrder);
assert(newOrderEvents.length === 1, "New unprinted order has exactly 1 synthetic creation event");
assert(newOrderEvents[0].action === "order_created", "First event is 'order_created'");
assert(newOrderEvents[0].description.includes("700"), "Creation description mentions COD amount 700");

// Test 3: Synthetic Timeline for Fully Delivered & Settled Order
console.log("\n▶ Test 3: Synthetic Timeline for Fully Delivered and Settled Order");
const deliveredSettledOrder = {
  id: "ord-delivered",
  customer_name: "نورا يوسف",
  order_date: "2026-03-01",
  created_at: "2026-03-01T08:00:00Z",
  order_total: 1200,
  paid_amount: 0,
  cod_amount: 1200,
  shipping_cost: 70,
  governorate: "القاهرة",
  print_status: "printed",
  printed_at: "2026-03-01T09:00:00Z",
  delivery_status: "delivered",
  settlement_status: "settled",
  settled_at: "2026-03-04T14:00:00Z",
  important_notes: "[تحديث بوسطة: تم التسليم للعميل]",
};

const deliveredEvents = generateSyntheticOrderEvents(deliveredSettledOrder);
const deliveredActions = deliveredEvents.map((e) => e.action);

assert(deliveredActions.includes("order_created"), "Includes order_created");
assert(deliveredActions.includes("printed"), "Includes printed event");
assert(deliveredActions.includes("handed_to_carrier"), "Includes handed_to_carrier event");
assert(deliveredActions.includes("delivered"), "Includes delivered event");
assert(deliveredActions.includes("settled"), "Includes settled event");
assert(deliveredActions.includes("carrier_synced"), "Includes carrier_synced from notes stamp");

// Test 4: Synthetic Timeline for Returned Order
console.log("\n▶ Test 4: Synthetic Timeline for Returned Order");
const returnedOrder = {
  id: "ord-returned",
  customer_name: "طارق سليم",
  order_date: "2026-03-02",
  created_at: "2026-03-02T11:00:00Z",
  order_total: 500,
  paid_amount: 0,
  cod_amount: 500,
  shipping_cost: 85,
  governorate: "سوهاج",
  print_status: "printed",
  printed_at: "2026-03-02T12:00:00Z",
  delivery_status: "returned",
  settlement_status: "pending",
  important_notes: null,
};

const returnedEvents = generateSyntheticOrderEvents(returnedOrder);
const returnedActionTypes = returnedEvents.map((e) => e.action);
assert(returnedActionTypes.includes("returned"), "Includes returned event");
const returnedEvt = returnedEvents.find((e) => e.action === "returned");
assert(returnedEvt.description.includes("85"), "Returned event mentions penalty loss 85 EGP");

// Test 5: Full Timeline Merging & Deduplication
console.log("\n▶ Test 5: buildOrderFullTimeline Merging & Deduplication");
const explicitRecorded = [
  createAuditEvent(
    "ord-new",
    "whatsapp_sent",
    "إرسال إشعار تتبع بالواتساب",
    "تم إرسال رسالة ترحيب ورابط البوليصة على هاتف العميل.",
    "الواتساب",
    {},
    "2026-03-10T11:00:00Z"
  ),
  createAuditEvent(
    "ord-new",
    "order_edited",
    "تعديل العنوان",
    "تمت إضافة علامة مميزة: بجوار صيدلية العزبي.",
    "التاجر",
    {},
    "2026-03-10T12:00:00Z"
  ),
];

const fullTimeline = buildOrderFullTimeline(newOrder, explicitRecorded);
assert(fullTimeline.length === 3, "Merged full timeline contains 3 events (1 synth + 2 explicit)");
// Verify sorting: newest first
assert(fullTimeline[0].action === "order_edited", "Newest event is order_edited at index 0");
assert(fullTimeline[1].action === "whatsapp_sent", "Middle event is whatsapp_sent at index 1");
assert(fullTimeline[2].action === "order_created", "Oldest event is order_created at index 2");

console.log(`\n🎉 All ${passedCount}/${totalCount} tests passed successfully!\n`);
