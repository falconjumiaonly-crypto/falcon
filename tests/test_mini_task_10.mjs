import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducmdiaXNydGx6ZmxxYmJocHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MTQwNjQsImV4cCI6MjEwNTQ5MDA2NH0.5Pgm0YPSHgo-uofz5DVmscVsP3HM9_rIl-YwbKJONSc";

async function testMiniTask10() {
  console.log("==================================================");
  console.log("=== RUNNING MINI TASK 10 ACCEPTANCE TESTS ===");
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

  // 1. Supabase Client Setup & Authentication
  console.log("\n[Step 1] Authenticating with Supabase...");
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });
  assert(!authError && authData.session, `Authenticated as ${authData?.user?.email}`);

  // 2. Test Branding Settings Persistence
  console.log("\n[Step 2] Testing Falcon Branding Settings (app_settings)...");
  const testBranding = {
    company_name: "فلكون لخدمات الشحن السريع",
    slogan: "أسرع توصيل في مصر",
    logo_url: "https://wnrgbisrtlzflqbbhpzy.supabase.co/storage/v1/object/public/falcon-assets/test-logo.png",
  };

  const { error: brandSaveError } = await supabase.from("app_settings").upsert(
    {
      key: "branding",
      value: testBranding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  assert(!brandSaveError, `Saved branding settings without error`);

  const { data: loadedBrand, error: brandLoadError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "branding")
    .single();

  assert(!brandLoadError, `Loaded branding settings successfully`);
  assert(
    loadedBrand?.value?.company_name === testBranding.company_name,
    `Retrieved correct company_name: "${loadedBrand?.value?.company_name}"`
  );
  assert(
    loadedBrand?.value?.logo_url === testBranding.logo_url,
    `Retrieved correct logo_url: "${loadedBrand?.value?.logo_url}"`
  );

  // 3. Test Company Info & Return Address Settings
  console.log("\n[Step 3] Testing Company Info & Return Address...");
  const testCompanyInfo = {
    sender_phone: "01099881122",
    return_address: "مخازن فلكون المركزية - المنطقة الصناعية - 6 أكتوبر",
    default_notes: "فتح الشحنة ومعاينتها مسموح مع المندوب",
  };

  const { error: infoSaveError } = await supabase.from("app_settings").upsert(
    {
      key: "company_info",
      value: testCompanyInfo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  assert(!infoSaveError, `Saved company info settings`);

  const { data: loadedInfo, error: infoLoadError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "company_info")
    .single();

  assert(!infoLoadError, `Loaded company info successfully`);
  assert(
    loadedInfo?.value?.sender_phone === "01099881122",
    `Retrieved correct sender_phone: ${loadedInfo?.value?.sender_phone}`
  );
  assert(
    loadedInfo?.value?.return_address === testCompanyInfo.return_address,
    `Retrieved correct return_address: ${loadedInfo?.value?.return_address}`
  );

  // 4. Test Webhook Configuration Persistence
  console.log("\n[Step 4] Testing Webhook Configuration...");
  const testWebhook = {
    webhook_url: "https://hook.eu1.make.com/test-falcon-webhook-12345",
    webhook_secret: "whsec_test_secret_key_888",
    events_enabled: {
      order_created: true,
      order_delivered: true,
      order_settled: false,
    },
  };

  const { error: webhookSaveError } = await supabase.from("app_settings").upsert(
    {
      key: "webhook_config",
      value: testWebhook,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  assert(!webhookSaveError, `Saved webhook configuration`);

  const { data: loadedWebhook, error: webhookLoadError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "webhook_config")
    .single();

  assert(!webhookLoadError, `Loaded webhook config successfully`);
  assert(
    loadedWebhook?.value?.webhook_url === testWebhook.webhook_url,
    `Retrieved correct webhook_url: ${loadedWebhook?.value?.webhook_url}`
  );
  assert(
    loadedWebhook?.value?.events_enabled?.order_settled === false,
    `Retrieved correct event subscription toggles`
  );

  // 5. Test Storage Bucket 'falcon-assets' upload and retrieval
  console.log("\n[Step 5] Testing Storage Bucket 'falcon-assets'...");
  const dummySvg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="black" /></svg>'
  );
  const testFileName = `test-upload-${Date.now()}.svg`;

  const { error: uploadError } = await supabase.storage
    .from("falcon-assets")
    .upload(testFileName, dummySvg, {
      contentType: "image/svg+xml",
      upsert: true,
    });
  assert(!uploadError, `Successfully uploaded asset to 'falcon-assets' bucket`);

  const { data: publicUrlData } = supabase.storage
    .from("falcon-assets")
    .getPublicUrl(testFileName);
  assert(
    publicUrlData && publicUrlData.publicUrl.includes(testFileName),
    `Generated public URL: ${publicUrlData?.publicUrl}`
  );

  // Delete test asset
  const { error: removeError } = await supabase.storage
    .from("falcon-assets")
    .remove([testFileName]);
  assert(!removeError, `Cleaned up test asset from 'falcon-assets' bucket`);

  // 6. Reset settings to clean default state
  console.log("\n[Step 6] Resetting settings to standard defaults...");
  await supabase.from("app_settings").upsert({
    key: "branding",
    value: {
      company_name: "Falcon - فلكون",
      slogan: "شحن لوجستي سريع وموثوق",
      logo_url: null,
    },
    updated_at: new Date().toISOString(),
  });

  await supabase.from("app_settings").upsert({
    key: "company_info",
    value: {
      sender_phone: "01000000000",
      return_address: "القاهرة - جمهورية مصر العربية",
      default_notes: "معاينة مسموحة قبل الاستلام",
    },
    updated_at: new Date().toISOString(),
  });

  console.log("  [Cleaned] Settings restored to standard defaults.");

  if (allPassed) {
    console.log("\n>>> ALL MINI TASK 10 ACCEPTANCE TESTS PASSED! <<<");
  } else {
    console.error("\n>>> SOME MINI TASK 10 TESTS FAILED! <<<");
    process.exit(1);
  }
}

testMiniTask10().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
