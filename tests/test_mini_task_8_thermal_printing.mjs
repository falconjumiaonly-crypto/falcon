import assert from "node:assert";
import { generateCode128Svg } from "../src/lib/barcode.ts";
import { calculatePrintPagesCount } from "../src/lib/calculations.ts";

console.log("🚀 Testing Mini Task 8: Thermal Waybill (4x6 / A6) & Vector Barcode Engine...\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}:`, err.message);
  }
}

// 1. Barcode Code 128 Generation Tests
it("generateCode128Svg creates a valid SVG string for standard order IDs", () => {
  const svg = generateCode128Svg("FAL-A1B2C3D4");
  assert(typeof svg === "string", "SVG should be a string");
  assert(svg.includes("<svg"), "Output must contain <svg tag");
  assert(svg.includes("</svg>"), "Output must contain </svg> closing tag");
  assert(svg.includes("viewBox="), "Output must include responsive viewBox");
  assert(svg.includes("<rect"), "Output must contain barcode bars as rects");
});

it("generateCode128Svg handles numeric courier tracking numbers", () => {
  const svg = generateCode128Svg("20261013998877");
  assert(svg.includes("<svg"), "Must encode numeric tracking strings");
  assert(svg.includes('height="'), "Must include height parameter");
});

it("generateCode128Svg handles empty string gracefully", () => {
  const svg = generateCode128Svg("");
  assert.strictEqual(svg, "", "Empty string should return empty string");
});

it("generateCode128Svg cleans and encodes non-ASCII characters without throwing", () => {
  const svg = generateCode128Svg("طلب-1234");
  assert(typeof svg === "string");
  assert(svg.length > 0, "Should sanitize and encode ASCII component");
});

it("generateCode128Svg supports custom dimensions and options", () => {
  const svg = generateCode128Svg("TEST1234", {
    height: 60,
    moduleWidth: 2,
    quietZone: 15,
    fill: "#111111",
  });
  assert(svg.includes('height="60"'), "Height must match option");
  assert(svg.includes('fill="#111111"'), "Fill color must match option");
});

// 2. Page Count Calculations for all Layout Modes
it("calculatePrintPagesCount returns exact count for thermal_4x6 (1 label = 1 page)", () => {
  assert.strictEqual(calculatePrintPagesCount(0, "thermal_4x6"), 0);
  assert.strictEqual(calculatePrintPagesCount(1, "thermal_4x6"), 1);
  assert.strictEqual(calculatePrintPagesCount(15, "thermal_4x6"), 15);
  assert.strictEqual(calculatePrintPagesCount(120, "thermal_4x6"), 120);
});

it("calculatePrintPagesCount computes 3-up mode (A4 standard) correctly", () => {
  assert.strictEqual(calculatePrintPagesCount(1, 3), 1);
  assert.strictEqual(calculatePrintPagesCount(3, 3), 1);
  assert.strictEqual(calculatePrintPagesCount(4, 3), 2);
  assert.strictEqual(calculatePrintPagesCount(6, 3), 2);
  assert.strictEqual(calculatePrintPagesCount(7, 3), 3);
});

it("calculatePrintPagesCount computes 2-up mode (A4 expanded) correctly", () => {
  assert.strictEqual(calculatePrintPagesCount(1, 2), 1);
  assert.strictEqual(calculatePrintPagesCount(2, 2), 1);
  assert.strictEqual(calculatePrintPagesCount(3, 2), 2);
  assert.strictEqual(calculatePrintPagesCount(5, 2), 3);
});

it("calculatePrintPagesCount computes 4-up mode (A4 2x2 sticker grid) correctly", () => {
  assert.strictEqual(calculatePrintPagesCount(1, 4), 1);
  assert.strictEqual(calculatePrintPagesCount(4, 4), 1);
  assert.strictEqual(calculatePrintPagesCount(5, 4), 2);
  assert.strictEqual(calculatePrintPagesCount(8, 4), 2);
  assert.strictEqual(calculatePrintPagesCount(9, 4), 3);
});

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 All Mini Task 8 tests passed successfully!");
}
