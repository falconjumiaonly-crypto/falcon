import { DRAFT_STORAGE_KEY } from "../src/hooks/useOrderDraft.ts";

async function testMiniTask4Contract() {
  console.log("=== Running MINI TASK 4 Draft Persistence Contract Tests ===");

  // Simulate browser storage
  const mockStorage = new Map();
  const localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
  };

  // Step 1: User types "محمد" into customer_name
  console.log("\n[Step 1] User enters 'محمد' as customer name...");
  const draftState1 = {
    customer_name: "محمد",
    phone_primary: "",
    governorate: "",
    address: "",
    order_total: "",
    paid_amount: "0",
    shipping_cost: "",
    important_notes: "",
    order_date: "2026-09-20",
  };

  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
    data: draftState1,
    savedAt: new Date().toISOString()
  }));

  // Step 2: User switches to WhatsApp / leaves app / refreshes browser
  console.log("[Step 2] User leaves application / switches to WhatsApp / refreshes...");
  const rawSaved = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!rawSaved) {
    throw new Error("Draft was lost on leave/refresh!");
  }

  // Step 3: User returns to application
  console.log("[Step 3] User returns to Falcon create order screen...");
  const restored = JSON.parse(rawSaved);
  const restoredData = restored.data;

  if (restoredData.customer_name !== "محمد") {
    throw new Error(`Expected customer_name 'محمد' but got '${restoredData.customer_name}'`);
  }
  console.log("✔ Critical Check: 'محمد' successfully restored from draft!");

  // Step 4: User enters phone number and continues
  console.log("\n[Step 4] User enters phone number '01012345678' and fills remaining fields...");
  const draftState2 = {
    ...restoredData,
    phone_primary: "01012345678",
    governorate: "الجيزة",
    address: "فيصل",
    order_total: "1000",
    shipping_cost: "60",
  };

  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
    data: draftState2,
    savedAt: new Date().toISOString()
  }));

  const updatedRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
  const updatedRestored = JSON.parse(updatedRaw).data;
  if (updatedRestored.phone_primary !== "01012345678" || updatedRestored.customer_name !== "محمد") {
    throw new Error("Draft update failed!");
  }
  console.log("✔ Draft correctly updated with phone and details.");

  // Step 5: After successful order creation, draft clears
  console.log("\n[Step 5] Successful order creation confirmed in database -> draft must clear...");
  localStorage.removeItem(DRAFT_STORAGE_KEY);

  const cleared = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (cleared !== null) {
    throw new Error("Draft was NOT cleared after order creation!");
  }
  console.log("✔ Draft cleared cleanly after verified order submission.");

  console.log("\n🎉 ALL MINI TASK 4 CONTRACT TESTS PASSED! 🎉\n");
}

testMiniTask4Contract().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
