const BASE_URL = "http://localhost:3000/api/v1/orders";
const API_KEY = "falcon_sec_live_9f83a02bb4e1423c91a78e2d4099ce";

async function testMiniTask9() {
  console.log("==================================================");
  console.log("=== RUNNING MINI TASK 9 ACCEPTANCE TESTS ===");
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

  // 1. Unauthorized check
  console.log("\n[Step 1] Testing unauthorized rejection (401)...");
  const unauthRes = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_name: "test" }),
  });
  assert(unauthRes.status === 401, `Unauthenticated request returned 401 Unauthorized (got ${unauthRes.status})`);

  // 2. Single order creation with Bearer auth
  console.log("\n[Step 2] Testing authorized order creation with calculations...");
  const uniqueKey = "idemp-" + Date.now() + "-" + Math.random().toString(36).substring(7);

  const newOrderPayload = {
    customer_name: "عميل أوتوميشن تجريبي",
    phone_primary: "01099887766",
    governorate: "القاهرة",
    address: "المعادي الجديدة - شارع النصر",
    order_total: 1800,
    paid_amount: 300,
    shipping_cost: 75,
    important_notes: "طلب مرسل عبر Make.com",
  };

  const createRes = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "Idempotency-Key": uniqueKey,
    },
    body: JSON.stringify(newOrderPayload),
  });

  assert(createRes.status === 201, `Order created with 201 Created (got ${createRes.status})`);
  const createJson = await createRes.json();
  if (createRes.status !== 201) {
    console.error("Create order failed with body:", createJson);
  }
  const createdOrder = createJson.data;

  assert(createdOrder && createdOrder.id, `Received valid created order object with ID ${createdOrder?.id}`);
  assert(createdOrder.cod_amount === 1500, `COD calculated correctly: 1800 - 300 = 1500 (got ${createdOrder.cod_amount})`);
  assert(createdOrder.net_profit === 1725, `Net profit calculated: 1800 - 75 = 1725 (got ${createdOrder.net_profit})`);
  assert(createdOrder.print_status === "pending", `Order default print_status is 'pending'`);

  // 3. TEST G — Idempotency Key Verification
  console.log("\n[TEST G] Testing Idempotency Key replay protection...");
  const replayRes = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "Idempotency-Key": uniqueKey, // EXACT SAME KEY
    },
    body: JSON.stringify(newOrderPayload),
  });

  assert(replayRes.status === 201, `Replay request returned 201 Created (got ${replayRes.status})`);
  const replayHeader = replayRes.headers.get("x-idempotent-replay");
  assert(replayHeader === "true", `Response has 'X-Idempotent-Replay: true' header`);

  const replayJson = await replayRes.json();
  assert(replayJson.data.id === createdOrder.id, `Replay returned EXACT same order ID without duplicate insertion`);

  // 4. Retrieve single order
  console.log("\n[Step 4] Testing GET /api/v1/orders/:id...");
  const getSingleRes = await fetch(`${BASE_URL}/${createdOrder.id}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  assert(getSingleRes.status === 200, `Retrieved single order with 200 OK`);
  const singleJson = await getSingleRes.json();
  assert(singleJson.data.id === createdOrder.id, `Retrieved correct order data`);

  // 5. PATCH order
  console.log("\n[Step 5] Testing PATCH /api/v1/orders/:id with financial recalculation...");
  const patchRes = await fetch(`${BASE_URL}/${createdOrder.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      order_total: 2000,
      paid_amount: 500,
      delivery_status: "delivered",
    }),
  });
  assert(patchRes.status === 200, `PATCH returned 200 OK`);
  const patchedOrder = (await patchRes.json()).data;
  assert(patchedOrder.cod_amount === 1500, `COD updated to 2000 - 500 = 1500`);
  assert(patchedOrder.delivery_status === "delivered", `Delivery status updated to 'delivered'`);

  // 6. Print Status Update
  console.log("\n[Step 6] Testing POST /api/v1/orders/:id/print-status...");
  const printStatusRes = await fetch(`${BASE_URL}/${createdOrder.id}/print-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ status: "printed" }),
  });
  assert(printStatusRes.status === 200, `Print status update returned 200 OK`);
  const printedOrder = (await printStatusRes.json()).data;
  assert(printedOrder.print_status === "printed", `Print status updated to 'printed'`);
  assert(printedOrder.printed_at !== null, `printed_at timestamp recorded`);

  // 7. Settlement Status Update
  console.log("\n[Step 7] Testing POST /api/v1/orders/:id/settlement...");
  const settleRes = await fetch(`${BASE_URL}/${createdOrder.id}/settlement`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ status: "settled" }),
  });
  assert(settleRes.status === 200, `Settlement update returned 200 OK`);
  const settledOrder = (await settleRes.json()).data;
  assert(settledOrder.settlement_status === "settled", `Settlement status updated to 'settled'`);
  assert(settledOrder.settled_at !== null, `settled_at timestamp recorded`);

  // 8. Bulk Order Creation
  console.log("\n[Step 8] Testing POST /api/v1/orders/bulk...");
  const bulkRes = await fetch(`${BASE_URL}/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      orders: [
        {
          customer_name: "عميل دفعة 1",
          phone_primary: "01011223344",
          governorate: "الجيزة",
          address: "الدقي",
          order_total: 900,
          paid_amount: 100,
          shipping_cost: 50,
        },
        {
          customer_name: "عميل دفعة 2",
          phone_primary: "01233445566",
          governorate: "القاهرة",
          address: "شبرا",
          order_total: 1100,
          paid_amount: 0,
          shipping_cost: 60,
        },
      ],
    }),
  });
  assert(bulkRes.status === 201, `Bulk creation returned 201 Created (got ${bulkRes.status})`);
  const bulkJson = await bulkRes.json();
  assert(bulkJson.count === 2, `Bulk creation inserted exactly 2 orders`);

  // 9. Cleanup
  console.log("\n[Cleanup] Cleaning up test orders...");
  const idsToDelete = [createdOrder.id, ...(bulkJson.orders || []).map((o) => o.id)];
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    "https://wnrgbisrtlzflqbbhpzy.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc"
  );
  await supabase.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });
  await supabase.from("orders").delete().in("id", idsToDelete);
  await supabase.from("api_idempotency_keys").delete().eq("idempotency_key", uniqueKey);
  console.log("  [Cleanup] Deleted test orders & idempotency keys.");

  if (allPassed) {
    console.log("\n>>> ALL MINI TASK 9 ACCEPTANCE TESTS PASSED! <<<");
  } else {
    console.error("\n>>> SOME MINI TASK 9 TESTS FAILED! <<<");
    process.exit(1);
  }
}

testMiniTask9().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
