import { calculateCustomerRisk } from "../src/lib/risk/customerRiskEngine.ts";
import { normalizePhoneNumber } from "../src/lib/excel-import.ts";

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

console.log("\n🧪 Running Mini Task 20: Customer Blacklist & Bad-Order Risk Scoring Test Suite...\n");

// Test 1: New Customer (No orders, not on blacklist)
console.log("▶ Test 1: New Customer Initial Risk Assessment");
const newCustomerRisk = calculateCustomerRisk("01011112222", [], []);
assert(newCustomerRisk.riskLevel === "safe", "New customer is classified as 'safe'");
assert(newCustomerRisk.riskScore === 20, "New customer receives baseline risk score 20");
assert(newCustomerRisk.totalOrders === 0, "Total orders is 0");
assert(newCustomerRisk.isBlacklisted === false, "Customer is not blacklisted");
assert(newCustomerRisk.totalPenaltyLossCaused === 0, "No shipping penalty loss caused");
assert(newCustomerRisk.recommendation === "proceed", "Recommendation is 'proceed'");

// Test 2: VIP / Trusted Customer (Multiple successful deliveries, zero returns)
console.log("\n▶ Test 2: VIP Customer Assessment");
const vipOrders = [
  { id: "1", customer_name: "أحمد علي", phone_primary: "01022223333", delivery_status: "delivered", order_total: 600, shipping_cost: 65 },
  { id: "2", customer_name: "أحمد علي", phone_primary: "01022223333", delivery_status: "delivered", order_total: 950, shipping_cost: 65 },
  { id: "3", customer_name: "أحمد علي", phone_primary: "01022223333", delivery_status: "delivered", order_total: 400, shipping_cost: 65 },
];
const vipRisk = calculateCustomerRisk("01022223333", vipOrders, []);
assert(vipRisk.riskLevel === "safe", "VIP customer is classified as 'safe'");
assert(vipRisk.riskScore === 5, "VIP customer receives minimal risk score 5");
assert(vipRisk.deliveredOrders === 3, "Delivered orders count is 3");
assert(vipRisk.returnedOrders === 0, "Returned orders count is 0");
assert(vipRisk.returnRate === 0, "Return rate is 0%");
assert(vipRisk.recommendation === "proceed", "Recommendation is 'proceed'");
assert(vipRisk.recommendationTextAr.includes("VIP"), "Advisory mentions VIP status");

// Test 3: Severe Serial Returner (2+ returns and >= 50% return rate)
console.log("\n▶ Test 3: High Risk Serial Returner Detection & Penalty Loss");
const serialReturnerOrders = [
  { id: "1", customer_name: "محمود صابر", phone_primary: "01133334444", delivery_status: "returned", order_total: 500, shipping_cost: 75 },
  { id: "2", customer_name: "محمود صابر", phone_primary: "01133334444", delivery_status: "returned", order_total: 450, shipping_cost: 75 },
  { id: "3", customer_name: "محمود صابر", phone_primary: "01133334444", delivery_status: "delivered", order_total: 300, shipping_cost: 65 },
];
const serialRisk = calculateCustomerRisk("01133334444", serialReturnerOrders, []);
assert(serialRisk.riskLevel === "high", "Serial returner flagged as 'high' risk");
assert(serialRisk.returnedOrders === 2, "Returned orders count is 2");
assert(serialRisk.returnRate === 66.7, "Return rate is 66.7%");
assert(serialRisk.totalPenaltyLossCaused === 150, "Calculated total penalty loss is 150 EGP (75 + 75)");
assert(serialRisk.recommendation === "require_deposit", "Recommendation requires deposit (فودافون كاش)");
assert(serialRisk.recommendationTextAr.includes("عربون"), "Advisory text advises requiring cash deposit before shipping");

// Test 4: Medium Risk (1 single past return)
console.log("\n▶ Test 4: Medium Risk Warning");
const mediumOrders = [
  { id: "1", customer_name: "سامي عادل", phone_primary: "01244445555", delivery_status: "returned", order_total: 800, shipping_cost: 70 },
  { id: "2", customer_name: "سامي عادل", phone_primary: "01244445555", delivery_status: "delivered", order_total: 750, shipping_cost: 70 },
  { id: "3", customer_name: "سامي عادل", phone_primary: "01244445555", delivery_status: "delivered", order_total: 500, shipping_cost: 70 },
];
const mediumRisk = calculateCustomerRisk("01244445555", mediumOrders, []);
assert(mediumRisk.riskLevel === "medium", "Customer with 1 return is classified as 'medium' risk");
assert(mediumRisk.recommendation === "call_to_confirm", "Recommendation is 'call_to_confirm'");
assert(mediumRisk.recommendationTextAr.includes("الاتصال هاتفياً"), "Advisory recommends phone verification call");

// Test 5: Explicitly Blacklisted Customer with Phone Number Normalization
console.log("\n▶ Test 5: Explicit Blacklist Match & Phone Number Normalization");
const blacklist = [
  {
    phone: "01099998888",
    name: "محتال كود",
    reason: "طلب وهمي ورفض الاستلام والرد على المندوب 3 مرات متتالية",
    addedAt: "2026-03-01T10:00:00Z",
  },
];
// Query with formatting differences (+20, dashes, spaces)
const rawInputPhone = " +20 10-9999-8888 ";
const blacklistHit = calculateCustomerRisk(rawInputPhone, [
  { id: "1", customer_name: "محتال كود", phone_primary: "01099998888", delivery_status: "returned", order_total: 1000, shipping_cost: 90 },
], blacklist);

assert(blacklistHit.isBlacklisted === true, "Blacklisted customer identified despite phone format differences");
assert(blacklistHit.riskLevel === "blacklisted", "Risk level is 'blacklisted'");
assert(blacklistHit.riskScore === 100, "Risk score is maximum 100");
assert(blacklistHit.recommendation === "block_order", "Recommendation is 'block_order'");
assert(blacklistHit.blacklistReason.includes("طلب وهمي"), "Blacklist reason correctly retrieved");
assert(blacklistHit.totalPenaltyLossCaused === 90, "Wasted shipping fee recorded (90 EGP)");

console.log(`\n🎉 All ${passedCount}/${totalCount} tests passed successfully!\n`);
