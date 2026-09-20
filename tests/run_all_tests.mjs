import { execSync } from "child_process";

const testFiles = [
  { file: "test_mini_task_2.mjs", label: "Mini Task 2: Authentication & Database Schema" },
  { file: "test_mini_task_3.mjs", label: "Mini Task 3: Create Order & Calculations (TEST B)" },
  { file: "test_mini_task_4.mjs", label: "Mini Task 4: Draft Persistence & Recovery (TEST C)" },
  { file: "test_mini_task_5.mjs", label: "Mini Task 5: Operations Management & Excel Export (TEST H)" },
  { file: "test_mini_task_6.mjs", label: "Mini Task 6: Printing Dual Modes & Contrast (TEST D, E, F)" },
  { file: "test_mini_task_7.mjs", label: "Mini Task 7: Excel Import & 100% Roundtrip (TEST H, S)" },
  { file: "test_mini_task_8.mjs", label: "Mini Task 8: Dashboard KPIs & Carrier Settlement (TEST J, Q)" },
  { file: "test_mini_task_9.mjs", label: "Mini Task 9: Automation APIs & Idempotency (TEST G)" },
  { file: "test_mini_task_10.mjs", label: "Mini Task 10: Branding, Logo & Settings Persistence" },
];

console.log("================================================================================");
console.log("             FALCON (فلكون) - MASTER QA REGRESSION SUITE (MINI TASK 11)         ");
console.log("================================================================================");

const results = [];
let overallPass = true;

for (const suite of testFiles) {
  process.stdout.write(`\n⏳ Running ${suite.label} (${suite.file})...\n`);
  const startTime = Date.now();
  try {
    const output = execSync(`npx tsx tests/${suite.file}`, {
      stdio: "pipe",
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(output.trim());
    console.log(`✅ ${suite.label}: PASSED (${duration}s)`);
    results.push({ ...suite, status: "PASSED", duration: `${duration}s` });
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ ${suite.label}: FAILED (${duration}s)`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    results.push({ ...suite, status: "FAILED", duration: `${duration}s` });
    overallPass = false;
  }
}

console.log("\n================================================================================");
console.log("                            FINAL QA SCORECARD                                  ");
console.log("================================================================================");
console.table(results);

if (overallPass) {
  console.log("\n🎉 ALL 9 MINI TASK TEST SUITES PASSED (100% PASS RATE)!");
  console.log("🚀 The Falcon Shipping application is PRODUCTION READY for Vercel deployment.");
  process.exit(0);
} else {
  console.error("\n💥 SOME TEST SUITES FAILED! Please inspect errors above.");
  process.exit(1);
}
