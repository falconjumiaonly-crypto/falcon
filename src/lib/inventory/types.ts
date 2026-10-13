export interface InventoryProduct {
  id: string;
  sku: string; // Stock Keeping Unit (e.g. "SHOE-BLK-42")
  name: string; // Product name in Arabic
  category: string; // Category (e.g. "أحذية", "ملابس", "إلكترونيات")
  stockQuantity: number; // Physical stock on warehouse shelves
  reservedQuantity: number; // Reserved for pending/new orders
  inTransitQuantity: number; // Out with couriers/in transit
  soldQuantity: number; // Delivered successfully
  returnedPendingCheckin: number; // Returned by carrier but not yet checked into shelves
  unitCost: number; // Merchant purchase/production cost in EGP
  sellingPrice: number; // Retail price in EGP
  lowStockThreshold: number; // Alert threshold (e.g. 5)
  warehouseLocation?: string; // Shelf or warehouse location
  updatedAt?: string;
}

export interface InventoryMetrics {
  totalSkus: number;
  totalPhysicalStock: number;
  totalAvailableStock: number;
  totalReservedStock: number;
  totalInTransitStock: number;
  totalInventoryCostValue: number;
  totalInventoryRetailValue: number;
  lowStockCount: number;
}

export type StockAdjustmentReason =
  | "new_shipment" // توريد بضاعة جديدة من المصنع
  | "inventory_count" // تسوية جرد مخزني دوري
  | "damaged_goods" // إتلاف أو تلف منتج
  | "return_shelved" // إعادة فحص مرتجع على الرف
  | "manual_correction"; // تعديل يدوي
