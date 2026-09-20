import { calculateCod, calculateNetProfit, derivePaymentStatus } from "../src/lib/calculations.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc";

async function testMiniTask3() {
  console.log("=== Running MINI TASK 3 Acceptance Tests ===");

  // 1. Calculations Unit Verification
  console.log("\n[Test 1] Testing Calculation Logic...");
  const cod1 = calculateCod(1500, 500);
  const profit1 = calculateNetProfit(1500, 65);
  const status1 = derivePaymentStatus(1500, 500);

  if (cod1 !== 1000 || profit1 !== 1435 || status1 !== "partially_paid") {
    throw new Error(`Partial payment calculation failed! COD: ${cod1}, Profit: ${profit1}, Status: ${status1}`);
  }
  console.log("✔ Partial payment calculates COD correctly (1500 - 500 = 1000).");

  const cod2 = calculateCod(1200, 1200);
  const profit2 = calculateNetProfit(1200, 50);
  const status2 = derivePaymentStatus(1200, 1200);

  if (cod2 !== 0 || profit2 !== 1150 || status2 !== "fully_paid") {
    throw new Error(`Fully paid calculation failed! COD: ${cod2}, Profit: ${profit2}, Status: ${status2}`);
  }
  console.log("✔ Fully paid order produces COD = 0 and status 'fully_paid'.");

  // 2. Database & Form Submission Verification
  console.log("\n[Test 2] Authenticating test client...");
  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });

  if (authError || !authData.session) {
    throw new Error("Authentication failed: " + authError?.message);
  }

  // 3. Submit Partial Payment Order
  console.log("\n[Test 3] Submitting Partial Payment Order to Supabase...");
  const { data: order1, error: err1 } = await authClient
    .from("orders")
    .insert({
      customer_name: "أحمد حسني",
      phone_primary: "01099887766",
      governorate: "الإسكندرية",
      address: "سموحة - شارع ألبرت الأول",
      order_total: 1500,
      paid_amount: 500,
      shipping_cost: 65,
    })
    .select()
    .single();

  if (err1) throw new Error("Partial order insert failed: " + err1.message);

  console.log(`Inserted order: ${order1.customer_name}, COD: ${order1.cod_amount}, Status: ${order1.payment_status}`);
  if (Number(order1.cod_amount) !== 1000 || order1.payment_status !== "partially_paid") {
    throw new Error("Mismatch in database computed fields for partial order!");
  }
  console.log("✔ Partial payment order confirmed in database with COD = 1000.");

  // 4. Submit Fully Paid Order
  console.log("\n[Test 4] Submitting Fully Paid Order to Supabase...");
  const { data: order2, error: err2 } = await authClient
    .from("orders")
    .insert({
      customer_name: "سارة محمود",
      phone_primary: "01122334455",
      governorate: "القاهرة",
      address: "المعادي - شارع النصر",
      order_total: 1200,
      paid_amount: 1200,
      shipping_cost: 50,
    })
    .select()
    .single();

  if (err2) throw new Error("Fully paid order insert failed: " + err2.message);

  console.log(`Inserted order: ${order2.customer_name}, COD: ${order2.cod_amount}, Status: ${order2.payment_status}`);
  if (Number(order2.cod_amount) !== 0 || order2.payment_status !== "fully_paid") {
    throw new Error("Mismatch in database computed fields for fully paid order!");
  }
  console.log("✔ Fully paid order confirmed in database with COD = 0.");

  // 5. Test Invalid Financial Values (Must be rejected)
  console.log("\n[Test 5] Testing Invalid Financial Values Rejection...");
  
  // A. Paid exceeds total
  const { error: invalidPaidErr } = await authClient.from("orders").insert({
    customer_name: "خطأ دفع",
    phone_primary: "01000000000",
    governorate: "القاهرة",
    address: "وسط البلد",
    order_total: 1000,
    paid_amount: 1500, // Invalid: paid > total
    shipping_cost: 50,
  });

  if (!invalidPaidErr) {
    throw new Error("Validation failure: Database accepted paid_amount > order_total!");
  }
  console.log("✔ Correctly rejected paid_amount > order_total:", invalidPaidErr.message);

  // B. Negative order total
  const { error: negativeTotalErr } = await authClient.from("orders").insert({
    customer_name: "خطأ إجمالي",
    phone_primary: "01000000000",
    governorate: "القاهرة",
    address: "وسط البلد",
    order_total: -500, // Invalid: negative
    paid_amount: 0,
    shipping_cost: 50,
  });

  if (!negativeTotalErr) {
    throw new Error("Validation failure: Database accepted negative order_total!");
  }
  console.log("✔ Correctly rejected negative order_total:", negativeTotalErr.message);

  // C. Negative shipping cost
  const { error: negativeShippingErr } = await authClient.from("orders").insert({
    customer_name: "خطأ شحن",
    phone_primary: "01000000000",
    governorate: "القاهرة",
    address: "وسط البلد",
    order_total: 500,
    paid_amount: 0,
    shipping_cost: -50, // Invalid: negative
  });

  if (!negativeShippingErr) {
    throw new Error("Validation failure: Database accepted negative shipping_cost!");
  }
  console.log("✔ Correctly rejected negative shipping_cost:", negativeShippingErr.message);

  // Cleanup test orders
  console.log("\n[Test 6] Cleaning up test orders...");
  await authClient.from("orders").delete().in("id", [order1.id, order2.id]);
  console.log("✔ Cleaned up test orders.");

  console.log("\n🎉 ALL MINI TASK 3 ACCEPTANCE TESTS PASSED! 🎉\n");
}

testMiniTask3().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
