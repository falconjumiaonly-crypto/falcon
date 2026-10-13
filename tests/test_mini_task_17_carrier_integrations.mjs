import {
  mapBostaStatus,
  mapJntStatus,
  mapGenericCourierStatus,
  normalizeCarrierWebhookPayload,
} from "../src/lib/carriers/statusMapper.js";
import {
  buildCarrierTrackingNote,
} from "../src/lib/carriers/webhookProcessor.js";

let testsRun = 0;
let testsPassed = 0;

function assert(condition, message) {
  testsRun++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log("=== Testing Mini Task 17: Carrier API Integrations & Webhook Tracking Sync ===");

// 1. Bosta Status Mapper Tests
console.log("\n[Group 1] Bosta Courier Status Mapping:");
const bostaDelivered = mapBostaStatus(40);
assert(bostaDelivered.status === "delivered", "Bosta code 40 maps to delivered");
assert(bostaDelivered.isDelivered === true, "Bosta code 40 flag isDelivered is true");

const bostaDeliveredStr = mapBostaStatus("Delivered");
assert(bostaDeliveredStr.status === "delivered", "Bosta string 'Delivered' maps to delivered");

const bostaOutForDelivery = mapBostaStatus("Out for delivery");
assert(bostaOutForDelivery.status === "handed_to_carrier", "Bosta 'Out for delivery' maps to handed_to_carrier");
assert(bostaOutForDelivery.isOutForDelivery === true, "Bosta 'Out for delivery' flag isOutForDelivery is true");

const bostaPickedUp = mapBostaStatus(22);
assert(bostaPickedUp.status === "handed_to_carrier", "Bosta code 22 maps to handed_to_carrier");

const bostaReturned = mapBostaStatus(46);
assert(bostaReturned.status === "returned", "Bosta code 46 (Returned to business) maps to returned");
assert(bostaReturned.isReturn === true, "Bosta code 46 flag isReturn is true");

const bostaTerminated = mapBostaStatus("Terminated");
assert(bostaTerminated.status === "returned", "Bosta 'Terminated' maps to returned");

const bostaNew = mapBostaStatus(10);
assert(bostaNew.status === "new", "Bosta code 10 (Pickup requested) maps to new");

// 2. J&T Express Status Mapper Tests
console.log("\n[Group 2] J&T Express Status Mapping:");
const jntSign = mapJntStatus("SIGN");
assert(jntSign.status === "delivered", "J&T status 'SIGN' maps to delivered");

const jntDelivering = mapJntStatus("DELIVERING");
assert(jntDelivering.status === "handed_to_carrier", "J&T status 'DELIVERING' maps to handed_to_carrier");
assert(jntDelivering.isOutForDelivery === true, "J&T status 'DELIVERING' sets isOutForDelivery flag");

const jntArrival = mapJntStatus("ARRIVAL");
assert(jntArrival.status === "handed_to_carrier", "J&T status 'ARRIVAL' maps to handed_to_carrier");

const jntReturn = mapJntStatus("RETURN");
assert(jntReturn.status === "returned", "J&T status 'RETURN' maps to returned");

const jntReject = mapJntStatus("REJECTED");
assert(jntReject.status === "returned", "J&T status 'REJECTED' maps to returned");

// 3. Generic Courier Status Mapper Tests
console.log("\n[Group 3] Generic Courier Status Mapping:");
const genDelivered = mapGenericCourierStatus("تم التسليم للعميل");
assert(genDelivered.status === "delivered", "Generic 'تم التسليم للعميل' maps to delivered");

const genReturned = mapGenericCourierStatus("طرد مرتجع لتعذر الوصول");
assert(genReturned.status === "returned", "Generic 'طرد مرتجع' maps to returned");

const genInTransit = mapGenericCourierStatus("قيد التوصيل مع المندوب");
assert(genInTransit.status === "handed_to_carrier", "Generic 'قيد التوصيل' maps to handed_to_carrier");

// 4. Webhook Payload Normalizer Tests
console.log("\n[Group 4] Webhook Inbound Normalizer:");

// Bosta payload format
const bostaPayload = {
  trackingNumber: "BST-987654",
  businessReference: "ORD-12345",
  state: {
    value: "Delivered",
    code: 40,
    notes: "تم استلام الكود والدفع كاش",
  },
  receiver: {
    phone: "01012345678",
  },
};
const normBosta = normalizeCarrierWebhookPayload("bosta", bostaPayload);
assert(normBosta !== null, "Bosta payload parsed successfully");
assert(normBosta.carrier === "bosta", "Carrier is identified as bosta");
assert(normBosta.trackingNumber === "BST-987654", "Tracking number correctly extracted");
assert(normBosta.merchantOrderId === "ORD-12345", "Merchant order ID correctly extracted");
assert(normBosta.status === "delivered", "Event status mapped to delivered");
assert(normBosta.recipientPhone === "01012345678", "Recipient phone extracted");

// J&T Express payload format
const jntPayload = {
  billCode: "JT-55443322",
  scanType: "SIGN",
  scanDesc: "تم تسليم الطرد والتوقيع بنجاح",
  scanTime: "2026-10-13T18:00:00Z",
  receiverPhone: "01122334455",
};
const normJnt = normalizeCarrierWebhookPayload("jnt", jntPayload);
assert(normJnt !== null, "J&T payload parsed successfully");
assert(normJnt.carrier === "jnt", "Carrier is identified as jnt");
assert(normJnt.trackingNumber === "JT-55443322", "J&T billCode extracted as trackingNumber");
assert(normJnt.status === "delivered", "J&T status mapped to delivered");

// 5. Note Stamping & De-duplication Tests
console.log("\n[Group 5] Note Stamping & History Stamp:");
const stamp1 = buildCarrierTrackingNote("ملاحظة العميل القديمة", "bosta", "Delivered", "تم الاستلام");
assert(stamp1.includes("بوسطة"), "Stamp includes Arabic carrier name");
assert(stamp1.includes("Delivered"), "Stamp includes raw status");
assert(stamp1.includes("ملاحظة العميل القديمة"), "Existing note content preserved");

// Duplicate call shouldn't duplicate the line
const stampDuplicate = buildCarrierTrackingNote(stamp1, "bosta", "Delivered");
assert(stampDuplicate === stamp1, "Duplicate stamp is de-duplicated");

console.log(`\n========================================`);
console.log(`Mini Task 17 Test Results: ${testsPassed}/${testsRun} passed.`);
if (testsPassed === testsRun) {
  console.log("All tests passed successfully! ✓");
} else {
  process.exit(1);
}
