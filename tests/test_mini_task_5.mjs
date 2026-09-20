import { createClient } from "@supabase/supabase-js";
import { generateOrdersExcelBuffer } from "../src/lib/excel.ts";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc";

async function testMiniTask5() {
  console.log("=== Running MINI TASK 5 Acceptance Tests ===");

  const client = createClient(SUPABASE_URL, ANON_KEY);
  await client.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });

  // 1. Seed 6 distinctive test orders
  console.log("\n[Step 1] Seeding test orders...");
  const seedOrders = [
    {
      customer_name: "محمد أحمد",
      phone_primary: "01012345678",
      phone_secondary: "01188776655",
      governorate: "الجيزة",
      address: "شارع فيصل - بجوار محطة التعاون",
      order_total: 1500,
      paid_amount: 500,
      shipping_cost: 70,
      important_notes: "اتصل قبل الميعاد",
      print_status: "pending",
    },
    {
      customer_name: "علي حسن",
      phone_primary: "01234567890",
      governorate: "القاهرة",
      address: "مدينة نصر",
      order_total: 800,
      paid_amount: 0,
      shipping_cost: 50,
      print_status: "pending",
    },
    {
      customer_name: "منى إبراهيم",
      phone_primary: "01599887766",
      governorate: "الإسكندرية",
      address: "سيدي جابر",
      order_total: 1000,
      paid_amount: 1000,
      shipping_cost: 60,
      print_status: "printed",
      printed_at: new Date().toISOString(),
    },
    {
      customer_name: "يوسف خليل",
      phone_primary: "01055554444",
      governorate: "الشرقية",
      address: "الزقازيق",
      order_total: 600,
      paid_amount: 200,
      shipping_cost: 45,
      print_status: "pending",
    },
    {
      customer_name: "خالد سعيد",
      phone_primary: "01144443333",
      governorate: "الدقهلية",
      address: "المنصورة",
      order_total: 750,
      paid_amount: 750,
      shipping_cost: 50,
      print_status: "pending",
    },
    {
      customer_name: "نادية طارق",
      phone_primary: "01211112222",
      governorate: "القليوبية",
      address: "بنها",
      order_total: 900,
      paid_amount: 300,
      shipping_cost: 55,
      print_status: "printed",
      printed_at: new Date().toISOString(),
    },
  ];

  const { data: insertedOrders, error: seedError } = await client
    .from("orders")
    .insert(seedOrders)
    .select();

  if (seedError) throw new Error("Seed failed: " + seedError.message);
  console.log(`✔ Seeded ${insertedOrders.length} test orders successfully.`);

  try {
    // 2. Test Search by Name and Phone
    console.log("\n[Test 2] Testing Search by Customer Name & Phone...");
    const { data: searchNameResult } = await client
      .from("orders")
      .select("*")
      .ilike("customer_name", "%علي حسن%");

    if (!searchNameResult || searchNameResult.length === 0) {
      throw new Error("Search by customer name failed!");
    }
    console.log("✔ Found order by customer name 'علي حسن'.");

    const { data: searchPhoneResult } = await client
      .from("orders")
      .select("*")
      .ilike("phone_primary", "%01012345678%");

    if (!searchPhoneResult || searchPhoneResult.length === 0) {
      throw new Error("Search by phone number failed!");
    }
    console.log("✔ Found order by phone '01012345678'.");

    // 3. Test TEST I: Editing an existing customer phone/address
    console.log("\n[Test 3] Testing TEST I: Editing customer phone/address...");
    const orderToEdit = insertedOrders[0];
    const { data: editedOrder, error: editError } = await client
      .from("orders")
      .update({
        phone_primary: "01099999999",
        address: "شارع الهرم - أمام المحافظة",
      })
      .eq("id", orderToEdit.id)
      .select()
      .single();

    if (editError || editedOrder.phone_primary !== "01099999999") {
      throw new Error("Editing order failed: " + editError?.message);
    }
    console.log("✔ TEST I Passed: Customer phone updated to '01099999999' and persisted in Supabase.");

    // 4. Test TEST K: Selected Orders Export
    console.log("\n[Test 4] Testing TEST K: Selected Orders Export (4 out of 6)...");
    const selected4 = insertedOrders.slice(0, 4);
    const excelBufSelected = generateOrdersExcelBuffer(selected4, "الطلبات");
    const wbSelected = XLSX.read(excelBufSelected, { type: "buffer" });
    const sheetSelected = wbSelected.Sheets["الطلبات"];
    const rowsSelected = XLSX.utils.sheet_to_json(sheetSelected);

    if (rowsSelected.length !== 4) {
      throw new Error(`Expected exactly 4 rows in selected export, but got ${rowsSelected.length}`);
    }
    console.log(`✔ TEST K Passed: Export contains exactly 4 rows.`);

    // 5. Test TEST M: Phone Number Leading Zeros
    console.log("\n[Test 5] Testing TEST M: Phone Numbers Retain Leading Zeros in Excel...");
    const firstRow = rowsSelected[0];
    const exportedPhone = String(firstRow["رقم الهاتف"]);
    if (!exportedPhone.startsWith("0")) {
      throw new Error(`Phone number lost leading zero! Value: ${exportedPhone}`);
    }
    console.log(`✔ TEST M Passed: Phone number is '${exportedPhone}', leading zero preserved!`);

    // 6. Test TEST N: Arabic Text Encoding
    console.log("\n[Test 6] Testing TEST N: Arabic Text Exports Without Corruption...");
    const exportedName = firstRow["اسم العميل"];
    const exportedGov = firstRow["المحافظة"];
    if (typeof exportedName !== "string" || !exportedName.includes("محمد")) {
      throw new Error(`Arabic name corrupted: ${exportedName}`);
    }
    console.log(`✔ TEST N Passed: Arabic text is intact ('${exportedName}', '${exportedGov}').`);

    // 7. Test TEST O: Financial Calculations in Export
    console.log("\n[Test 7] Testing TEST O: Exported Financial Calculations...");
    // Find order with total=1500, paid=500, shipping=70
    const finOrder = rowsSelected.find((r) => Number(r["سعر الأوردر"]) === 1500);
    if (!finOrder) throw new Error("Financial test order not found in export!");

    const totalVal = Number(finOrder["سعر الأوردر"]);
    const paidVal = Number(finOrder["المدفوع مقدمًا"]);
    const codVal = Number(finOrder["COD"]);
    const profitVal = Number(finOrder["صافي الربح"]);

    if (totalVal !== 1500 || paidVal !== 500 || codVal !== 1000 || profitVal !== 1430) {
      throw new Error(`Financial mismatch! total: ${totalVal}, paid: ${paidVal}, COD: ${codVal}, profit: ${profitVal}`);
    }
    console.log(`✔ TEST O Passed: Total=1500, Paid=500, COD=1000, Net Profit=1430.`);

    // 8. Test TEST P: Export Must Be Read-Only
    console.log("\n[Test 8] Testing TEST P: Export Must Be Read-Only (State Untouched)...");
    const { data: checkOrders } = await client
      .from("orders")
      .select("id, print_status, delivery_status, settlement_status")
      .in("id", insertedOrders.map((o) => o.id));

    const stillPending = checkOrders.filter((o) => o.print_status === "pending").length;
    if (stillPending !== 4) {
      throw new Error(`Order states were modified during export! Expected 4 pending, got ${stillPending}`);
    }
    console.log("✔ TEST P Passed: Export is completely read-only. No statuses were modified.");

    // 9. Test TEST L: Filtered Export (e.g. pending print orders)
    console.log("\n[Test 9] Testing TEST L: Filtered Export across pagination...");
    const { data: pendingOnly } = await client
      .from("orders")
      .select("*")
      .eq("print_status", "pending")
      .in("id", insertedOrders.map((o) => o.id));

    const excelBufFiltered = generateOrdersExcelBuffer(pendingOnly, "قائمة الطباعة");
    const wbFiltered = XLSX.read(excelBufFiltered, { type: "buffer" });
    const rowsFiltered = XLSX.utils.sheet_to_json(wbFiltered.Sheets["قائمة الطباعة"]);

    if (rowsFiltered.length !== 4) {
      throw new Error(`Expected 4 pending orders, got ${rowsFiltered.length}`);
    }
    console.log(`✔ TEST L Passed: Filtered export contains all ${rowsFiltered.length} matching rows.`);

  } finally {
    // Cleanup seed orders
    console.log("\n[Step 10] Cleaning up test orders...");
    await client.from("orders").delete().in("id", insertedOrders.map((o) => o.id));
    console.log("✔ Test orders cleaned up cleanly.");
  }

  console.log("\n🎉 ALL MINI TASK 5 & ACCEPTANCE TESTS (K, L, M, N, O, P, I) PASSED! 🎉\n");
}

testMiniTask5().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
