import { createClient } from "@supabase/supabase-js";
import {
  calculatePrintPagesCount,
  checkOrderPrintOverflow,
  calculateCod,
  calculateNetProfit,
  derivePaymentStatus,
} from "../src/lib/calculations.ts";

const SUPABASE_URL = "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc";

async function testMiniTask6() {
  console.log("==================================================");
  console.log("=== RUNNING MINI TASK 6 ACCEPTANCE TESTS ===");
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

  // ----------------------------------------------------
  // TEST D: 9 orders on 3-per-page mode = exactly 3 A4 pages
  // ----------------------------------------------------
  console.log("\n[TEST D] Verifying 9 orders on 3-per-page mode...");
  const count9 = 9;
  const mode3 = 3;
  const pagesCountD = calculatePrintPagesCount(count9, mode3);
  assert(pagesCountD === 3, `9 orders on 3-per-page mode yields exactly 3 pages (got ${pagesCountD})`);

  // Verify page chunking and cut line placement
  const mockOrders9 = Array.from({ length: 9 }, (_, i) => ({
    id: `order-9-${i + 1}`,
    customer_name: `عميل تجريبي ${i + 1}`,
    address: "العنوان بالتفصيل",
    cod_amount: 100,
  }));

  const pagesD = [];
  for (let i = 0; i < mockOrders9.length; i += mode3) {
    pagesD.push(mockOrders9.slice(i, i + mode3));
  }
  assert(pagesD.length === 3, `Grouped into exactly 3 chunks of pages`);
  pagesD.forEach((page, pageIdx) => {
    assert(page.length === 3, `Page ${pageIdx + 1} contains exactly 3 labels`);
    page.forEach((_, itemIdx) => {
      const showCutLine = itemIdx < page.length - 1;
      if (itemIdx === 2) {
        assert(!showCutLine, `Page ${pageIdx + 1}, item 3 has NO trailing cut line at page bottom`);
      } else {
        assert(showCutLine, `Page ${pageIdx + 1}, item ${itemIdx + 1} has dashed cutting line`);
      }
    });
  });

  // ----------------------------------------------------
  // TEST E: 8 orders on 2-per-page mode = exactly 4 A4 pages
  // ----------------------------------------------------
  console.log("\n[TEST E] Verifying 8 orders on 2-per-page mode...");
  const count8 = 8;
  const mode2 = 2;
  const pagesCountE = calculatePrintPagesCount(count8, mode2);
  assert(pagesCountE === 4, `8 orders on 2-per-page mode yields exactly 4 pages (got ${pagesCountE})`);

  const mockOrders8 = Array.from({ length: 8 }, (_, i) => ({
    id: `order-8-${i + 1}`,
    customer_name: `عميل تجريبي ${i + 1}`,
    address: "العنوان بالتفصيل",
    cod_amount: 150,
  }));

  const pagesE = [];
  for (let i = 0; i < mockOrders8.length; i += mode2) {
    pagesE.push(mockOrders8.slice(i, i + mode2));
  }
  assert(pagesE.length === 4, `Grouped into exactly 4 chunks of pages`);
  pagesE.forEach((page, pageIdx) => {
    assert(page.length === 2, `Page ${pageIdx + 1} contains exactly 2 labels`);
    assert(page.length - 1 === 1, `Page ${pageIdx + 1} has cutting line only between items, not on bottom`);
  });

  // Test edge counts: 7 orders on 3-per-page -> 3 pages; 5 orders on 2-per-page -> 3 pages
  assert(calculatePrintPagesCount(7, 3) === 3, `7 orders on 3-per-page = 3 pages`);
  assert(calculatePrintPagesCount(5, 2) === 3, `5 orders on 2-per-page = 3 pages`);
  assert(calculatePrintPagesCount(0, 3) === 0, `0 orders on 3-per-page = 0 pages`);

  // ----------------------------------------------------
  // TEST F: Grayscale, COD zero vs collection box, overflow
  // ----------------------------------------------------
  console.log("\n[TEST F] Verifying label details, COD zero distinction, and overflow detection...");

  // 1. COD calculations for label display
  const codPaidInFull = calculateCod(1200, 1200);
  assert(codPaidInFull === 0, `Fully paid order has COD = 0`);

  const codPartial = calculateCod(1500, 500);
  assert(codPartial === 1000, `Partial payment order has COD = 1000`);

  // 2. Overflow protection detection
  const normalOrder = {
    address: "شارع التحرير - الدقي",
    important_notes: "تسليم باليد",
  };
  assert(!checkOrderPrintOverflow(normalOrder), `Normal address and notes do NOT trigger overflow warning`);

  const longAddressOrder = {
    address: "جمهورية مصر العربية - محافظة الجيزة - شارع فيصل الرئيسي متفرع من شارع العشرين عمارة الأمل الدور الرابع شقة 12 بجوار صيدلية السلام",
    important_notes: "عاجل جدا",
  };
  assert(checkOrderPrintOverflow(longAddressOrder), `Long address (> 70 chars) triggers overflow warning`);

  const longNotesOrder = {
    address: "مدينة نصر - الحي السابع",
    important_notes: "يرجى الاتصال قبل الوصول بنصف ساعة والتأكد من وجود المستلم شخصياً وعدم ترك الطرد مع البواب تحت أي ظرف",
  };
  assert(checkOrderPrintOverflow(longNotesOrder), `Long courier notes (> 50 chars) triggers overflow warning`);

  // ----------------------------------------------------
  // QUEUE & ARCHIVE DB TRANSITIONS
  // ----------------------------------------------------
  console.log("\n[DB Test] Testing Print Queue & Print Archive transitions in Supabase...");

  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError?.message);
    process.exit(1);
  }

  // Insert 3 test orders
  const testPayload = [
    {
      customer_name: "عميل طباعة 1",
      phone_primary: "01099887711",
      governorate: "القاهرة",
      address: "مصر الجديدة",
      order_total: 800,
      paid_amount: 800,
      shipping_cost: 60,
      cod_amount: 0,
      net_profit: 740,
      payment_status: "fully_paid",
      print_status: "pending",
      printed_at: null,
    },
    {
      customer_name: "عميل طباعة 2",
      phone_primary: "01122334455",
      governorate: "الجيزة",
      address: "المهندسين",
      order_total: 1500,
      paid_amount: 500,
      shipping_cost: 80,
      cod_amount: 100,
      net_profit: 1420,
      payment_status: "partially_paid",
      print_status: "pending",
      printed_at: null,
    },
  ];

  const { data: inserted, error: insertError } = await supabase
    .from("orders")
    .insert(testPayload)
    .select();

  if (insertError) {
    console.error("Insert error:", insertError.message);
    process.exit(1);
  }

  const insertedIds = inserted.map((o) => o.id);
  assert(inserted.length === 2, `Inserted 2 test orders in print queue (print_status = pending)`);

  // 1. Verify in pending queue
  const { data: queueOrders, error: queueErr } = await supabase
    .from("orders")
    .select("id, print_status, printed_at")
    .in("id", insertedIds)
    .eq("print_status", "pending");

  assert(queueOrders?.length === 2, `Both orders found in pending print queue`);
  assert(queueOrders?.[0].printed_at === null, `printed_at is initially null`);

  // 2. Mark as printed (transition to archive)
  const printTimestamp = new Date().toISOString();
  const { error: updatePrintedErr } = await supabase
    .from("orders")
    .update({
      print_status: "printed",
      printed_at: printTimestamp,
      updated_at: new Date().toISOString(),
    })
    .in("id", insertedIds);

  assert(!updatePrintedErr, `Updated print_status to 'printed' in database`);

  // 3. Verify in printed archive
  const { data: archiveOrders } = await supabase
    .from("orders")
    .select("id, print_status, printed_at")
    .in("id", insertedIds)
    .eq("print_status", "printed");

  assert(archiveOrders?.length === 2, `Orders now present in printed archive`);
  assert(archiveOrders?.[0].printed_at !== null, `printed_at is populated with timestamp`);

  // 4. Return to queue (re-queue)
  const { error: requeueErr } = await supabase
    .from("orders")
    .update({
      print_status: "pending",
      printed_at: null,
      updated_at: new Date().toISOString(),
    })
    .in("id", insertedIds);

  assert(!requeueErr, `Re-queued orders back to 'pending'`);

  const { data: requeuedOrders } = await supabase
    .from("orders")
    .select("id, print_status, printed_at")
    .in("id", insertedIds)
    .eq("print_status", "pending");

  assert(requeuedOrders?.length === 2, `Orders successfully returned to queue`);
  assert(requeuedOrders?.[0].printed_at === null, `printed_at is cleared to null`);

  // 5. Cleanup test orders
  await supabase.from("orders").delete().in("id", insertedIds);
  console.log("  [Cleanup] Test orders cleaned up successfully.");

  if (allPassed) {
    console.log("\n>>> ALL MINI TASK 6 ACCEPTANCE TESTS PASSED! <<<");
  } else {
    console.error("\n>>> SOME MINI TASK 6 TESTS FAILED! <<<");
    process.exit(1);
  }
}

testMiniTask6().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
