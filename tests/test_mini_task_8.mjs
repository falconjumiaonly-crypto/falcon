import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { generateCarrierSettlementExcelBuffer } from "../src/lib/excel.ts";
import { calculateCod, calculateNetProfit } from "../src/lib/calculations.ts";

const SUPABASE_URL = "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc";

async function testMiniTask8() {
  console.log("==================================================");
  console.log("=== RUNNING MINI TASK 8 ACCEPTANCE TESTS ===");
  console.log("==================================================");

  let allPassed = true;
  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
      allPassed = false;
    }
  }

  // 1. Math formulas check
  console.log("\n[TEST Q] Verifying financial accuracy & formulas...");
  const orderTotal = 1600;
  const paidAmount = 400;
  const shippingCost = 65;

  const cod = calculateCod(orderTotal, paidAmount);
  const netProfit = calculateNetProfit(orderTotal, shippingCost);

  assert(cod === 1200, `COD calculation: 1600 - 400 = 1200 (got ${cod})`);
  assert(netProfit === 1535, `Net profit calculation: 1600 - 65 = 1535 (got ${netProfit})`);

  // 2. Supabase connection & authentication
  console.log("\n[Auth] Signing in as admin...");
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError?.message);
    process.exit(1);
  }

  // 3. Seed test orders for TEST J (Carrier Settlement)
  console.log("\n[TEST J] Seeding delivered orders for carrier settlement testing...");
  const testDeliveredOrders = [
    {
      customer_name: "شحنة تسوية 1",
      phone_primary: "01099881122",
      governorate: "القاهرة",
      address: "المعادي",
      order_total: 1000,
      paid_amount: 0,
      cod_amount: 1000,
      shipping_cost: 60,
      net_profit: 940,
      delivery_status: "delivered",
      settlement_status: "pending",
      settled_at: null,
    },
    {
      customer_name: "شحنة تسوية 2",
      phone_primary: "01188776655",
      governorate: "الجيزة",
      address: "الدقي",
      order_total: 1500,
      paid_amount: 300,
      cod_amount: 1200,
      shipping_cost: 70,
      net_profit: 1430,
      delivery_status: "delivered",
      settlement_status: "pending",
      settled_at: null,
    },
  ];

  const { data: inserted, error: insertError } = await supabase
    .from("orders")
    .insert(testDeliveredOrders)
    .select();

  assert(!insertError, `Inserted 2 delivered orders with pending settlement`);
  assert(inserted?.length === 2, `Confirmed 2 test records created`);

  const [ord1, ord2] = inserted;
  const expectedPendingCarrierTotal = 1000 + 1200; // 2200

  // Verify pending carrier calculation
  const { data: pendingCarrierOrders } = await supabase
    .from("orders")
    .select("cod_amount")
    .eq("delivery_status", "delivered")
    .eq("settlement_status", "pending")
    .in("id", [ord1.id, ord2.id]);

  const actualPendingCod = pendingCarrierOrders.reduce(
    (sum, o) => sum + Number(o.cod_amount || 0),
    0
  );
  assert(
    actualPendingCod === expectedPendingCarrierTotal,
    `Pending carrier settlement matches exactly = 2200 ج.م`
  );

  // 4. Test carrier settlement export generation
  console.log("\n[TEST J/Q] Generating Carrier Settlement Statement Excel...");
  const settlementExcelBuffer = generateCarrierSettlementExcelBuffer(inserted);
  assert(settlementExcelBuffer && settlementExcelBuffer.length > 0, `Generated Carrier Settlement Excel buffer`);

  const readWb = XLSX.read(settlementExcelBuffer, { type: "buffer" });
  assert(readWb.SheetNames[0] === "مستحقات شركة الشحن المعلقة", `Sheet name is 'مستحقات شركة الشحن المعلقة'`);

  const parsedSettlementRows = XLSX.utils.sheet_to_json(readWb.Sheets[readWb.SheetNames[0]]);
  assert(parsedSettlementRows.length === 2, `Contains exactly 2 delivered orders`);
  assert(
    parsedSettlementRows[0]["مبلغ التحصيل (COD المطلوب توريده)"] === 1000,
    `Row 1 COD matches = 1000`
  );
  assert(
    parsedSettlementRows[1]["مبلغ التحصيل (COD المطلوب توريده)"] === 1200,
    `Row 2 COD matches = 1200`
  );

  // 5. Execute settlement of Order 1
  console.log("\n[TEST J] Executing settlement on Order 1...");
  const settleTimestamp = new Date().toISOString();
  const { error: settleErr } = await supabase
    .from("orders")
    .update({
      settlement_status: "settled",
      settled_at: settleTimestamp,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ord1.id);

  assert(!settleErr, `Order 1 marked as 'settled'`);

  // Verify Order 1 is settled and Order 2 remains pending
  const { data: updatedOrd1 } = await supabase
    .from("orders")
    .select("settlement_status, settled_at")
    .eq("id", ord1.id)
    .single();

  assert(updatedOrd1.settlement_status === "settled", `Order 1 status is 'settled'`);
  assert(updatedOrd1.settled_at !== null, `Order 1 has settled_at timestamp`);

  const { data: updatedOrd2 } = await supabase
    .from("orders")
    .select("settlement_status, settled_at")
    .eq("id", ord2.id)
    .single();

  assert(updatedOrd2.settlement_status === "pending", `Order 2 remains 'pending'`);
  assert(updatedOrd2.settled_at === null, `Order 2 settled_at is null`);

  // Re-check pending carrier total: now only Order 2 (1200)
  const { data: remainingPending } = await supabase
    .from("orders")
    .select("cod_amount")
    .eq("delivery_status", "delivered")
    .eq("settlement_status", "pending")
    .in("id", [ord1.id, ord2.id]);

  const newPendingTotal = remainingPending.reduce(
    (sum, o) => sum + Number(o.cod_amount || 0),
    0
  );
  assert(
    newPendingTotal === 1200,
    `Pending carrier settlement decreased to 1200 ج.م after Order 1 settlement`
  );

  // 6. Cleanup test records
  console.log("\n[Cleanup] Cleaning up test records...");
  await supabase.from("orders").delete().in("id", [ord1.id, ord2.id]);
  console.log("  [Cleanup] Done.");

  if (allPassed) {
    console.log("\n>>> ALL MINI TASK 8 ACCEPTANCE TESTS PASSED! <<<");
  } else {
    console.error("\n>>> SOME MINI TASK 8 TESTS FAILED! <<<");
    process.exit(1);
  }
}

testMiniTask8().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
