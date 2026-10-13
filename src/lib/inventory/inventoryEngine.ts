import { InventoryProduct, InventoryMetrics } from "./types";

/**
 * Calculates net available stock ready for new customer sales
 */
export function calculateAvailableStock(product: InventoryProduct): number {
  return Math.max(0, (product.stockQuantity || 0) - (product.reservedQuantity || 0));
}

/**
 * Checks whether a product has reached or breached its low-stock alert threshold
 */
export function isLowStock(product: InventoryProduct): boolean {
  const available = calculateAvailableStock(product);
  const threshold = product.lowStockThreshold ?? 5;
  return available <= threshold;
}

/**
 * Computes high-level warehouse inventory KPI metrics
 */
export function calculateInventoryMetrics(products: InventoryProduct[]): InventoryMetrics {
  let totalPhysicalStock = 0;
  let totalAvailableStock = 0;
  let totalReservedStock = 0;
  let totalInTransitStock = 0;
  let totalInventoryCostValue = 0;
  let totalInventoryRetailValue = 0;
  let lowStockCount = 0;

  products.forEach((p) => {
    const physical = Number(p.stockQuantity || 0);
    const reserved = Number(p.reservedQuantity || 0);
    const inTransit = Number(p.inTransitQuantity || 0);
    const available = Math.max(0, physical - reserved);
    const cost = Number(p.unitCost || 0);
    const price = Number(p.sellingPrice || 0);

    totalPhysicalStock += physical;
    totalAvailableStock += available;
    totalReservedStock += reserved;
    totalInTransitStock += inTransit;
    totalInventoryCostValue += physical * cost;
    totalInventoryRetailValue += physical * price;

    if (available <= (p.lowStockThreshold ?? 5)) {
      lowStockCount++;
    }
  });

  return {
    totalSkus: products.length,
    totalPhysicalStock,
    totalAvailableStock,
    totalReservedStock,
    totalInTransitStock,
    totalInventoryCostValue,
    totalInventoryRetailValue,
    lowStockCount,
  };
}

/**
 * Realistic default starter inventory products for Egyptian merchants
 */
export const DEFAULT_INVENTORY_PRODUCTS: InventoryProduct[] = [
  {
    id: "prod-sneaker-blk",
    sku: "SHOE-ULTRA-BLK-42",
    name: "سنيكرز الترا لايت طبي - أسود مقاس 42",
    category: "أحذية رجالي",
    stockQuantity: 45,
    reservedQuantity: 6,
    inTransitQuantity: 12,
    soldQuantity: 85,
    returnedPendingCheckin: 1,
    unitCost: 260,
    sellingPrice: 499,
    lowStockThreshold: 10,
    warehouseLocation: "مخزن القاهرة - رف A1",
  },
  {
    id: "prod-sneaker-wht",
    sku: "SHOE-ULTRA-WHT-43",
    name: "سنيكرز الترا لايت طبي - أبيض مقاس 43",
    category: "أحذية رجالي",
    stockQuantity: 18,
    reservedQuantity: 4,
    inTransitQuantity: 8,
    soldQuantity: 52,
    returnedPendingCheckin: 0,
    unitCost: 260,
    sellingPrice: 499,
    lowStockThreshold: 10,
    warehouseLocation: "مخزن القاهرة - رف A2",
  },
  {
    id: "prod-bag-cross",
    sku: "BAG-CRSS-BRN-01",
    name: "شنطة كروس جلد طبيعي كلاسيك - بني غامق",
    category: "حقائب وإكسسوارات",
    stockQuantity: 32,
    reservedQuantity: 3,
    inTransitQuantity: 7,
    soldQuantity: 64,
    returnedPendingCheckin: 1,
    unitCost: 175,
    sellingPrice: 380,
    lowStockThreshold: 8,
    warehouseLocation: "مخزن الجيزة - قسم B",
  },
  {
    id: "prod-polo-blk",
    sku: "POLO-CTN-BLK-XL",
    name: "تيشيرت بولو قطن مصري 100% - أسود مقاس XL",
    category: "ملابس رجالي",
    stockQuantity: 8,
    reservedQuantity: 5,
    inTransitQuantity: 9,
    soldQuantity: 110,
    returnedPendingCheckin: 2,
    unitCost: 140,
    sellingPrice: 290,
    lowStockThreshold: 10,
    warehouseLocation: "مخزن القاهرة - رف C4",
  },
  {
    id: "prod-watch-slv",
    sku: "WTCH-CHRN-SLV",
    name: "ساعة كرونوغراف ستانلس ستيل مقاومة للماء - فضي",
    category: "ساعات وإكسسوارات",
    stockQuantity: 4, // Low stock trigger!
    reservedQuantity: 2,
    inTransitQuantity: 5,
    soldQuantity: 40,
    returnedPendingCheckin: 0,
    unitCost: 350,
    sellingPrice: 750,
    lowStockThreshold: 5,
    warehouseLocation: "خزينة المنتجات القيمة - V1",
  },
];
