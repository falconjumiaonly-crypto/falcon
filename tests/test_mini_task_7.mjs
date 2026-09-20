import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { generateOrdersExcelBuffer } from "../src/lib/excel.ts";
import {
  detectColumnMappings,
  validateImportRow,
  normalizePhoneNumber,
} from "../src/lib/excel-import.ts";

const SUPABASE_URL = "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc";

async function testMiniTask7() {
  console.log("==================================================");
  console.log("=== RUNNING MINI TASK 7 ACCEPTANCE TESTS ===");
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
  // TEST H: Mixed Valid and Invalid Rows
  // ----------------------------------------------------
  console.log("\n[TEST H] Testing row-level validation & error reporting...");

  // Mapping using standard Arabic headers
  const mapping = {
    customer_name: "اسم العميل",
    phone_primary: "رقم الهاتف",
    phone_secondary: "رقم احتياطي",
    governorate: "المحافظة",
    address: "العنوان بالتفصيل",
    order_total: "سعر الأوردر",
    paid_amount: "المدفوع مقدمًا",
    shipping_cost: "سعر الشحن",
    important_notes: "ملاحظات المندوب",
  };

  const testRows = [
    // Row 1: Valid normal
    {
      "اسم العميل": "محمود سعيد",
      "رقم الهاتف": "01098765432",
      "المحافظة": "القاهرة",
      "العنوان بالتفصيل": "المعادي - شارع 9",
      "سعر الأوردر": 1000,
      "المدفوع مقدمًا": 200,
      "سعر الشحن": 60,
    },
    // Row 2: Valid fully paid
    {
      "اسم العميل": "هدى حسن",
      "رقم الهاتف": "01122334455",
      "المحافظة": "الجيزة",
      "العنوان بالتفصيل": "الدقي",
      "سعر الأوردر": 500,
      "المدفوع مقدمًا": 500,
      "سعر الشحن": 40,
    },
    // Row 3: Missing customer name
    {
      "اسم العميل": "",
      "رقم الهاتف": "01234567890",
      "المحافظة": "الإسكندرية",
      "العنوان بالتفصيل": "سموحة",
      "سعر الأوردر": 800,
      "المدفوع مقدمًا": 0,
      "سعر الشحن": 50,
    },
    // Row 4: Invalid phone format
    {
      "اسم العميل": "عميل هاتف خاطئ",
      "رقم الهاتف": "abc1234",
      "المحافظة": "القاهرة",
      "العنوان بالتفصيل": "مدينة نصر",
      "سعر الأوردر": 750,
      "المدفوع مقدمًا": 0,
      "سعر الشحن": 50,
    },
    // Row 5: Paid amount > total
    {
      "اسم العميل": "مدفوع أكثر من الإجمالي",
      "رقم الهاتف": "01555554444",
      "المحافظة": "طنطا",
      "العنوان بالتفصيل": "شارع الجيش",
      "سعر الأوردر": 600,
      "المدفوع مقدمًا": 800,
      "سعر الشحن": 40,
    },
    // Row 6: Negative total
    {
      "اسم العميل": "سعر سالب",
      "رقم الهاتف": "01011112222",
      "المحافظة": "المنصورة",
      "العنوان بالتفصيل": "حي الجامعة",
      "سعر الأوردر": -100,
      "المدفوع مقدمًا": 0,
      "سعر الشحن": 40,
    },
    // Row 7: Valid phone with leading zero normalization (1012345678 -> 01012345678)
    {
      "اسم العميل": "ياسر كمال",
      "رقم الهاتف": 1012345678,
      "المحافظة": "الشرقية",
      "العنوان بالتفصيل": "الزقازيق",
      "سعر الأوردر": 1400,
      "المدفوع مقدمًا": 400,
      "سعر الشحن": 70,
    },
  ];

  const valResults = testRows.map((r, idx) => validateImportRow(r, mapping, idx + 1));

  assert(valResults[0].isValid, `Row 1 is valid (COD = 800)`);
  assert(valResults[0].data?.cod_amount === 800, `Row 1 calculated COD correctly = 800`);
  assert(valResults[0].data?.net_profit === 940, `Row 1 calculated net profit = 940`);

  assert(valResults[1].isValid, `Row 2 is valid fully paid`);
  assert(valResults[1].data?.cod_amount === 0, `Row 2 COD = 0`);
  assert(valResults[1].data?.payment_status === "fully_paid", `Row 2 payment_status = fully_paid`);

  assert(!valResults[2].isValid, `Row 3 rejected (missing customer name)`);
  assert(valResults[2].errors.some((e) => e.includes("اسم العميل")), `Row 3 reports customer name error`);

  assert(!valResults[3].isValid, `Row 4 rejected (invalid phone format)`);
  assert(valResults[3].errors.some((e) => e.includes("رقم الهاتف")), `Row 4 reports phone error`);

  assert(!valResults[4].isValid, `Row 5 rejected (paid > total)`);
  assert(valResults[4].errors.some((e) => e.includes("المدفوع")), `Row 5 reports paid > total error`);

  assert(!valResults[5].isValid, `Row 6 rejected (negative total)`);
  assert(valResults[5].errors.some((e) => e.includes("سعر الأوردر")), `Row 6 reports negative total error`);

  assert(valResults[6].isValid, `Row 7 is valid with number phone`);
  assert(valResults[6].data?.phone_primary === "01012345678", `Row 7 phone normalized with leading zero = 01012345678`);

  // Phone normalization edge cases
  assert(normalizePhoneNumber("01012345678") === "01012345678", `Standard string phone preserved`);
  assert(normalizePhoneNumber("1012345678") === "01012345678", `10 digits starting with 1 gets leading 0`);
  assert(normalizePhoneNumber("1122334455") === "01122334455", `10 digits starting with 11 gets leading 0`);
  assert(normalizePhoneNumber("٠١٠١٢٣٤٥٦٧٨") === "01012345678", `Eastern Arabic numerals converted`);
  assert(normalizePhoneNumber("+201012345678") === "01012345678", `+2 prefix converted to 010...`);

  // ----------------------------------------------------
  // TEST S: Roundtrip Falcon Export -> Import Compatibility
  // ----------------------------------------------------
  console.log("\n[TEST S] Testing Roundtrip compatibility (Falcon Export -> Falcon Import)...");

  const sampleFalconOrders = [
    {
      id: "ord-roundtrip-1",
      customer_name: "تامر حسني",
      phone_primary: "01055443322",
      phone_secondary: "01233445566",
      governorate: "القاهرة",
      address: "الزمالك - ش حسن صبري",
      landmark: "بجوار نادي الجزيرة",
      order_total: 2500,
      paid_amount: 500,
      cod_amount: 2000,
      shipping_cost: 80,
      net_profit: 2420,
      payment_status: "partially_paid",
      print_status: "pending",
      delivery_status: "new",
      settlement_status: "pending",
      order_date: "2026-09-20",
    },
    {
      id: "ord-roundtrip-2",
      customer_name: "دينا الشربيني",
      phone_primary: "01199887766",
      phone_secondary: null,
      governorate: "الجيزة",
      address: "الشيخ زايد - الحي الأول",
      landmark: null,
      order_total: 1800,
      paid_amount: 1800,
      cod_amount: 0,
      shipping_cost: 70,
      net_profit: 1730,
      payment_status: "fully_paid",
      print_status: "printed",
      delivery_status: "delivered",
      settlement_status: "settled",
      order_date: "2026-09-20",
    },
  ];

  // 1. Export using Falcon's actual excel generator
  const excelBuffer = generateOrdersExcelBuffer(sampleFalconOrders);
  assert(excelBuffer && excelBuffer.length > 0, `Generated Falcon export Excel buffer`);

  // 2. Read back generated Excel workbook
  const readWb = XLSX.read(excelBuffer, { type: "buffer" });
  const sheetName = readWb.SheetNames[0];
  const parsedRows = XLSX.utils.sheet_to_json(readWb.Sheets[sheetName], { raw: false });
  assert(parsedRows.length === 2, `Parsed exactly 2 rows from exported file`);

  // 3. Auto-detect headers from exported file
  const exportedHeaders = Object.keys(parsedRows[0]);
  const detectedMapping = detectColumnMappings(exportedHeaders);

  assert(detectedMapping.customer_name === "اسم العميل", `Auto-detected customer_name = 'اسم العميل'`);
  assert(detectedMapping.phone_primary === "رقم الهاتف", `Auto-detected phone_primary = 'رقم الهاتف'`);
  assert(detectedMapping.governorate === "المحافظة", `Auto-detected governorate = 'المحافظة'`);
  assert(detectedMapping.address === "العنوان بالتفصيل", `Auto-detected address = 'العنوان بالتفصيل'`);
  assert(detectedMapping.order_total === "سعر الأوردر", `Auto-detected order_total = 'سعر الأوردر'`);
  assert(detectedMapping.paid_amount === "المدفوع مقدمًا", `Auto-detected paid_amount = 'المدفوع مقدمًا'`);

  // 4. Validate parsed rows using the detected mapping
  const roundtripValidation = parsedRows.map((r, i) => validateImportRow(r, detectedMapping, i + 1));
  assert(roundtripValidation[0].isValid, `Roundtrip Row 1 validated successfully`);
  assert(roundtripValidation[0].data?.customer_name === "تامر حسني", `Customer name preserved = 'تامر حسني'`);
  assert(roundtripValidation[0].data?.phone_primary === "01055443322", `Leading zero preserved = '01055443322'`);
  assert(roundtripValidation[0].data?.cod_amount === 2000, `COD calculated = 2000`);

  assert(roundtripValidation[1].isValid, `Roundtrip Row 2 validated successfully`);
  assert(roundtripValidation[1].data?.customer_name === "دينا الشربيني", `Customer name preserved = 'دينا الشربيني'`);
  assert(roundtripValidation[1].data?.cod_amount === 0, `Fully paid preserved with COD = 0`);

  // ----------------------------------------------------
  // Database Import & Print Queue Persistence Test
  // ----------------------------------------------------
  console.log("\n[DB Test] Inserting validated orders into Supabase & verifying Print Queue...");

  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });

  if (authError || !authData.user) {
    console.error("Auth failed:", authError?.message);
    process.exit(1);
  }

  const validPayload = roundtripValidation.map((r) => r.data);
  const { data: insertedOrders, error: insertError } = await supabase
    .from("orders")
    .insert(validPayload)
    .select();

  assert(!insertError, `Batch inserted 2 orders into Supabase`);
  assert(insertedOrders?.length === 2, `Confirmed 2 orders inserted`);

  const insertedIds = insertedOrders.map((o) => o.id);

  // Verify that imported orders are immediately in print queue
  const { data: queueCheck } = await supabase
    .from("orders")
    .select("id, print_status, cod_amount, net_profit")
    .in("id", insertedIds)
    .eq("print_status", "pending");

  assert(queueCheck?.length === 2, `All imported orders are immediately queued for printing (print_status = 'pending')`);
  assert(queueCheck?.[0].cod_amount === 2000, `Order 1 COD verified in DB = 2000`);
  assert(queueCheck?.[1].cod_amount === 0, `Order 2 COD verified in DB = 0`);

  // Clean up
  await supabase.from("orders").delete().in("id", insertedIds);
  console.log("  [Cleanup] Test imported orders cleaned up successfully.");

  if (allPassed) {
    console.log("\n>>> ALL MINI TASK 7 ACCEPTANCE TESTS PASSED! <<<");
  } else {
    console.error("\n>>> SOME MINI TASK 7 TESTS FAILED! <<<");
    process.exit(1);
  }
}

testMiniTask7().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
