import {
  calculateAvailableStock,
  isLowStock,
  calculateInventoryMetrics,
  DEFAULT_INVENTORY_PRODUCTS,
} from "../src/lib/inventory/inventoryEngine.js";

let testsRun = 0;
let testsPassed = 0;

function assert(condition, message) {
  testsRun++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log("=== Testing Mini Task 18: Multi-Warehouse Inventory Custody & Stock Reservation ===");

// 1. Available Stock Calculation Tests
console.log("\n[Group 1] Available Stock & Reservation Deductions:");
const prodNormal = {
  id: "p1",
  sku: "SHOE-42",
  name: "حذاء رياضي",
  category: "أحذية",
  stockQuantity: 50,
  reservedQuantity: 10,
  unitCost: 200,
  sellingPrice: 400,
  lowStockThreshold: 5,
};
assert(calculateAvailableStock(prodNormal) === 40, "Available stock is 50 - 10 = 40");

const prodFullyReserved = {
  id: "p2",
  sku: "SHOE-43",
  name: "حذاء رياضي",
  category: "أحذية",
  stockQuantity: 15,
  reservedQuantity: 15,
  unitCost: 200,
  sellingPrice: 400,
  lowStockThreshold: 5,
};
assert(calculateAvailableStock(prodFullyReserved) === 0, "Available stock is 0 when fully reserved");

const prodOverReserved = {
  id: "p3",
  sku: "SHOE-44",
  name: "حذاء رياضي",
  category: "أحذية",
  stockQuantity: 5,
  reservedQuantity: 12,
  unitCost: 200,
  sellingPrice: 400,
  lowStockThreshold: 5,
};
assert(calculateAvailableStock(prodOverReserved) === 0, "Available stock does not go negative when over-reserved (floors at 0)");

// 2. Low Stock Alerts
console.log("\n[Group 2] Low Stock Threshold Detection:");
const prodSafe = {
  id: "p4",
  sku: "BAG-01",
  name: "شنطة",
  category: "حقائب",
  stockQuantity: 20,
  reservedQuantity: 2, // available = 18
  lowStockThreshold: 5,
};
assert(isLowStock(prodSafe) === false, "Product with 18 available and threshold 5 is safe");

const prodCritical = {
  id: "p5",
  sku: "BAG-02",
  name: "شنطة جلد",
  category: "حقائب",
  stockQuantity: 7,
  reservedQuantity: 3, // available = 4
  lowStockThreshold: 5,
};
assert(isLowStock(prodCritical) === true, "Product with 4 available and threshold 5 is low stock");

const prodExact = {
  id: "p6",
  sku: "BAG-03",
  name: "شنطة قماش",
  category: "حقائب",
  stockQuantity: 5,
  reservedQuantity: 0, // available = 5
  lowStockThreshold: 5,
};
assert(isLowStock(prodExact) === true, "Product exactly at threshold is flagged as low stock");

// 3. High-level Inventory KPI Metrics Aggregations
console.log("\n[Group 3] High-level Inventory Metrics Aggregations:");
const sampleInventory = [
  {
    id: "item-1",
    sku: "ITEM-A",
    name: "منتج أ",
    category: "ملابس",
    stockQuantity: 100,
    reservedQuantity: 20,
    inTransitQuantity: 30,
    unitCost: 50,
    sellingPrice: 120,
    lowStockThreshold: 10,
  },
  {
    id: "item-2",
    sku: "ITEM-B",
    name: "منتج ب",
    category: "ملابس",
    stockQuantity: 20,
    reservedQuantity: 15, // available = 5 <= threshold 5 (Low Stock!)
    inTransitQuantity: 10,
    unitCost: 100,
    sellingPrice: 250,
    lowStockThreshold: 5,
  },
];

const metrics = calculateInventoryMetrics(sampleInventory);
assert(metrics.totalSkus === 2, `Total SKUs is 2 (got ${metrics.totalSkus})`);
assert(metrics.totalPhysicalStock === 120, `Total physical stock is 120 (got ${metrics.totalPhysicalStock})`);
assert(metrics.totalReservedStock === 35, `Total reserved stock is 35 (got ${metrics.totalReservedStock})`);
assert(metrics.totalAvailableStock === 85, `Total available stock is 80 + 5 = 85 (got ${metrics.totalAvailableStock})`);
assert(metrics.totalInTransitStock === 40, `Total in-transit stock is 40 (got ${metrics.totalInTransitStock})`);

// Valuation: 100 * 50 + 20 * 100 = 5000 + 2000 = 7000 EGP Cost Value
assert(metrics.totalInventoryCostValue === 7000, `Total inventory cost value is 7000 EGP (got ${metrics.totalInventoryCostValue})`);

// Retail Valuation: 100 * 120 + 20 * 250 = 12000 + 5000 = 17000 EGP Retail Value
assert(metrics.totalInventoryRetailValue === 17000, `Total inventory retail value is 17000 EGP (got ${metrics.totalInventoryRetailValue})`);

assert(metrics.lowStockCount === 1, `Low stock items count is 1 (got ${metrics.lowStockCount})`);

// 4. Default Seed Products Integrity
console.log("\n[Group 4] Default Seed Products Integrity:");
assert(DEFAULT_INVENTORY_PRODUCTS.length >= 4, "Default inventory provides at least 4 realistic Egyptian products");
assert(DEFAULT_INVENTORY_PRODUCTS.every((p) => p.sku && p.name && p.stockQuantity >= 0), "All seed products have valid SKU, name, and stock");

console.log(`\n========================================`);
console.log(`Mini Task 18 Test Results: ${testsPassed}/${testsRun} passed.`);
if (testsPassed === testsRun) {
  console.log("All tests passed successfully! ✓");
} else {
  process.exit(1);
}
