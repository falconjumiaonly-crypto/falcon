import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc";

export async function testMiniTask2() {
  console.log("=== Running MINI TASK 2 Acceptance Tests ===");

  // 1. Unauthenticated Client
  console.log("\n[Test 1] Testing Unauthenticated Access Restrictions...");
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);

  const { error: anonInsertError } = await anonClient
    .from("orders")
    .insert({
      customer_name: "مخترق غير مصرح",
      phone_primary: "01000000000",
      governorate: "القاهرة",
      address: "عنوان غير مصرح",
      order_total: 500,
      shipping_cost: 50,
    });

  if (!anonInsertError) {
    throw new Error("Unauthenticated insert was allowed!");
  }
  console.log("✔ Unauthenticated insert correctly blocked by RLS.");

  const { data: anonSelect, error: anonSelectError } = await anonClient
    .from("orders")
    .select("*");

  if (!anonSelectError && anonSelect.length === 0) {
    console.log("✔ Unauthenticated select returned 0 rows (RLS active).");
  } else if (anonSelectError) {
    console.log("✔ Unauthenticated select blocked:", anonSelectError.message);
  } else {
    throw new Error("Unauthenticated read leaked rows!");
  }

  // 2. Authenticated Client
  console.log("\n[Test 2] Testing Authenticated User Login...");
  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });

  if (authError || !authData.session) {
    throw new Error(`Login failed: ${authError?.message}`);
  }
  console.log("✔ Authenticated login successful as:", authData.user.email);

  // 3. Authenticated Insert (TEST A Scenario: total=1000, paid=300, shipping=60)
  console.log("\n[Test 3] Testing Valid Order Creation & Auto Calculations...");
  const { data: createdOrder, error: createError } = await authClient
    .from("orders")
    .insert({
      customer_name: "محمد أحمد",
      phone_primary: "01012345678",
      phone_secondary: "01187654321",
      governorate: "الجيزة",
      address: "شارع فيصل - بجوار محطة التعاون",
      order_total: 1000,
      paid_amount: 300,
      shipping_cost: 60,
      important_notes: "التسليم بعد الساعة 4 مساءً",
    })
    .select()
    .single();

  if (createError) {
    throw new Error(`Order insert failed: ${createError.message}`);
  }

  if (
    Number(createdOrder.cod_amount) !== 700 ||
    Number(createdOrder.net_profit) !== 940 ||
    createdOrder.payment_status !== "partially_paid"
  ) {
    throw new Error("Calculations mismatch in Test A!");
  }
  console.log("✔ TEST A Passed: COD (700), net_profit (940), payment_status (partially_paid)!");

  // 4. Authenticated Update (TEST B Scenario: paid_amount = 1000)
  console.log("\n[Test 4] Testing Order Update (Fully Paid)...");
  const { data: updatedOrder, error: updateError } = await authClient
    .from("orders")
    .update({
      paid_amount: 1000,
    })
    .eq("id", createdOrder.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Order update failed: ${updateError.message}`);
  }

  if (
    Number(updatedOrder.cod_amount) !== 0 ||
    updatedOrder.payment_status !== "fully_paid"
  ) {
    throw new Error("Update calculations mismatch in Test B!");
  }
  console.log("✔ TEST B Passed: Updating to fully paid recalculated COD to 0 and status to fully_paid!");

  // 5. Test Database Constraints (paid_amount > order_total should fail)
  console.log("\n[Test 5] Testing Database Constraints...");
  const { error: constraintError } = await authClient
    .from("orders")
    .insert({
      customer_name: "اختبار خطأ",
      phone_primary: "01234567890",
      governorate: "القاهرة",
      address: "وسط البلد",
      order_total: 500,
      paid_amount: 800,
      shipping_cost: 50,
    });

  if (!constraintError) {
    throw new Error("Database permitted paid_amount > order_total!");
  }
  console.log("✔ Constraint check succeeded: Database rejected paid_amount > order_total.");

  // Cleanup test order
  console.log("\n[Test 6] Cleaning up test order...");
  await authClient.from("orders").delete().eq("id", createdOrder.id);
  console.log("✔ Test order deleted cleanly.");

  console.log("\n🎉 ALL MINI TASK 2 TESTS PASSED! 🎉\n");
}

testMiniTask2().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
