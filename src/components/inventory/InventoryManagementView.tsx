"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Boxes,
  Warehouse,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Truck,
  RotateCcw,
  Edit2,
  Trash2,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  X,
  Save,
  DollarSign,
  PackageCheck,
  AlertCircle
} from "lucide-react";
import { InventoryProduct, StockAdjustmentReason } from "@/lib/inventory/types";
import {
  calculateAvailableStock,
  isLowStock,
  calculateInventoryMetrics,
} from "@/lib/inventory/inventoryEngine";
import { formatEgp } from "@/lib/calculations";
import {
  saveInventoryProductAction,
  deleteInventoryProductAction,
  adjustProductStockAction,
} from "@/app/actions/inventory";

interface InventoryManagementViewProps {
  initialProducts: InventoryProduct[];
}

export function InventoryManagementView({ initialProducts }: InventoryManagementViewProps) {
  const [products, setProducts] = useState<InventoryProduct[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Edit / Add Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<InventoryProduct> | null>(null);

  // Quick Adjust Modal state
  const [adjustingProduct, setAdjustingProduct] = useState<InventoryProduct | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<StockAdjustmentReason>("new_shipment");

  // Transitions
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Metrics
  const metrics = useMemo(() => calculateInventoryMetrics(products), [products]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "all" && p.category !== selectedCategory) {
        return false;
      }

      if (onlyLowStock && !isLowStock(p)) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const skuMatch = p.sku.toLowerCase().includes(query);
        const nameMatch = p.name.toLowerCase().includes(query);
        const locMatch = (p.warehouseLocation || "").toLowerCase().includes(query);
        if (!skuMatch && !nameMatch && !locMatch) return false;
      }

      return true;
    });
  }, [products, selectedCategory, onlyLowStock, searchTerm]);

  // Quick Stock Adjustment (+ / -)
  const handleQuickDelta = (product: InventoryProduct, delta: number) => {
    startTransition(async () => {
      const res = await adjustProductStockAction(product.id, delta, "manual_correction");
      if (res.success && res.data !== undefined) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, stockQuantity: res.data! } : p))
        );
        showFeedback("success", `تم تحديث رصيد ${product.name} إلى ${res.data} قطعة`);
      } else {
        showFeedback("error", res.error || "فشل تعديل المخزون");
      }
    });
  };

  // Handle Save Product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.sku) {
      showFeedback("error", "يرجى كتابة اسم المنتج وكود الـ SKU");
      return;
    }

    const sku = editingProduct.sku.trim();
    const name = editingProduct.name.trim();
    const prodId = editingProduct.id;
    const category = editingProduct.category || "عام";
    const stockQuantity = Number(editingProduct.stockQuantity || 0);
    const lowStockThreshold = Number(editingProduct.lowStockThreshold || 5);
    const unitCost = Number(editingProduct.unitCost || 0);
    const sellingPrice = Number(editingProduct.sellingPrice || 0);
    const warehouseLocation = editingProduct.warehouseLocation || "المخزن الرئيسي";

    startTransition(async () => {
      const res = await saveInventoryProductAction({
        id: prodId,
        sku,
        name,
        category,
        stockQuantity,
        lowStockThreshold,
        unitCost,
        sellingPrice,
        warehouseLocation,
      });

      if (res.success && res.data) {
        setProducts((prev) => {
          const exists = prev.some((p) => p.id === res.data!.id);
          if (exists) {
            return prev.map((p) => (p.id === res.data!.id ? res.data! : p));
          }
          return [res.data!, ...prev];
        });
        setIsEditModalOpen(false);
        setEditingProduct(null);
        showFeedback("success", `تم حفظ المنتج (${res.data.name}) بنجاح`);
      } else {
        showFeedback("error", res.error || "فشل حفظ المنتج");
      }
    });
  };

  // Handle Delete Product
  const handleDeleteProduct = (productId: string, productName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المنتج "${productName}" من المخزون؟`)) return;

    startTransition(async () => {
      const res = await deleteInventoryProductAction(productId);
      if (res.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        showFeedback("success", `تم حذف المنتج "${productName}" بنجاح`);
      } else {
        showFeedback("error", res.error || "فشل حذف المنتج");
      }
    });
  };

  // Handle Detailed Adjustment Modal Submission
  const handleConfirmAdjustment = () => {
    if (!adjustingProduct) return;
    startTransition(async () => {
      const res = await adjustProductStockAction(adjustingProduct.id, adjustDelta, adjustReason);
      if (res.success && res.data !== undefined) {
        setProducts((prev) =>
          prev.map((p) => (p.id === adjustingProduct.id ? { ...p, stockQuantity: res.data! } : p))
        );
        showFeedback("success", `تم تسجيل التوريد/التسوية بنجاح: الرصيد الجديد ${res.data} قطعة`);
        setAdjustingProduct(null);
      } else {
        showFeedback("error", res.error || "فشل تطبيق التسوية المخزنية");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              إدارة المخزون وعهدة البضاعة وحجز الأوردرات
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">
              رقابة المخزن
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            متابعة الأصناف المتاحة للبيع، الكميات المحجوزة للطلبات الجديدة، البضائع المشحونة في السوق، وتنبيهات النواقص.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEditingProduct({
                sku: "",
                name: "",
                category: "عام",
                stockQuantity: 10,
                lowStockThreshold: 5,
                unitCost: 100,
                sellingPrice: 200,
                warehouseLocation: "المخزن الرئيسي",
              });
              setIsEditModalOpen(true);
            }}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف جديد بالمخزن</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Physical Stock & Asset Cost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">إجمالي البضاعة بالمخزن</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Warehouse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.totalPhysicalStock}
            </span>
            <span className="text-xs text-slate-500 font-bold mr-1">قطعة</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            تكلفة البضاعة: <strong className="text-slate-900 font-mono">{formatEgp(metrics.totalInventoryCostValue)}</strong>
          </p>
        </div>

        {/* Card 2: Net Available for Sale */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/20 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">المتاح للبيع الفوري</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {metrics.totalAvailableStock}
            </span>
            <span className="text-xs text-emerald-600 font-bold mr-1">قطعة متاحة</span>
          </div>
          <p className="text-[11px] text-emerald-800 mt-2 font-medium">
            بعد خصم المحجوز للأوردرات المعلقة
          </p>
        </div>

        {/* Card 3: In Transit & Reserved */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/20 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950">محجوز وفي السوق مع الشحن</span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-700 font-mono">
              {metrics.totalReservedStock + metrics.totalInTransitStock}
            </span>
            <span className="text-xs text-amber-600 font-bold mr-1">قطعة</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            محجوز: <strong className="font-mono text-slate-800">{metrics.totalReservedStock}</strong> | في السوق: <strong className="font-mono text-slate-800">{metrics.totalInTransitStock}</strong>
          </p>
        </div>

        {/* Card 4: Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/20 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-950">تنبيهات نواقص المخزن</span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-700 font-mono">
              {metrics.lowStockCount}
            </span>
            <span className="text-xs text-rose-600 font-bold mr-1">أصناف قاربت على النفاد</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            تحتاج إلى إعادة طلب من المورد فوراً
          </p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter and Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالـ SKU، اسم المنتج، الرف..."
                className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
              />
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
            >
              <option value="all">كل الأقسام</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Low stock toggle */}
            <button
              type="button"
              onClick={() => setOnlyLowStock((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                onlyLowStock
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>النواقص فقط</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            عرض <strong className="text-slate-900">{filteredProducts.length}</strong> صنف
          </div>
        </div>

        {/* Inventory Products Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد منتجات مطابقة للبحث أو الفلتر.
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3">كود الصنف (SKU)</th>
                  <th className="p-3">اسم المنتج والقسم</th>
                  <th className="p-3">مكان التخزين</th>
                  <th className="p-3 text-center">الرصيد الفعلي بالمخزن</th>
                  <th className="p-3 text-center">المتاح للبيع</th>
                  <th className="p-3 text-center">المحجوز للأوردرات</th>
                  <th className="p-3 text-center">في السوق (شحن)</th>
                  <th className="p-3 text-center">المباع</th>
                  <th className="p-3">سعر البيع / التكلفة</th>
                  <th className="p-3 text-center">حالة المخزون</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const available = calculateAvailableStock(p);
                  const low = isLowStock(p);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* SKU */}
                      <td className="p-3 font-mono font-bold text-slate-900">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono">
                          {p.sku}
                        </span>
                      </td>

                      {/* Name & Category */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <span className="text-[10px] text-slate-400">{p.category}</span>
                      </td>

                      {/* Warehouse Location */}
                      <td className="p-3 text-slate-600 text-[11px]">
                        {p.warehouseLocation || "المخزن الرئيسي"}
                      </td>

                      {/* Physical Stock with Quick Controls */}
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleQuickDelta(p, -1)}
                            disabled={isPending || p.stockQuantity <= 0}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                            title="خصم قطعة"
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                          </button>

                          <span className="font-mono font-black text-slate-900 w-8 text-center text-xs">
                            {p.stockQuantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleQuickDelta(p, 1)}
                            disabled={isPending}
                            className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                            title="إضافة قطعة"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Available Stock */}
                      <td className="p-3 text-center font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            available > 0
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {available}
                        </span>
                      </td>

                      {/* Reserved Stock */}
                      <td className="p-3 text-center font-mono text-slate-600">
                        {p.reservedQuantity > 0 ? (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-bold">
                            {p.reservedQuantity}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>

                      {/* In Transit */}
                      <td className="p-3 text-center font-mono text-slate-600">
                        {p.inTransitQuantity > 0 ? (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] font-bold">
                            {p.inTransitQuantity}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>

                      {/* Sold */}
                      <td className="p-3 text-center font-mono text-slate-600">
                        {p.soldQuantity}
                      </td>

                      {/* Prices */}
                      <td className="p-3 font-mono">
                        <div className="font-bold text-slate-900">{formatEgp(p.sellingPrice)}</div>
                        <div className="text-[10px] text-slate-400">تكلفة: {formatEgp(p.unitCost)}</div>
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {low ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[10px] font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>كمية حرجة</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                            متوفر
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingProduct(p);
                              setAdjustDelta(10);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold cursor-pointer"
                            title="تسجيل توريد أو جرد"
                          >
                            تسوية
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                            title="تعديل الصنف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="حذف من المخزون"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal 1: Add or Edit Product */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-600" />
                <span>{editingProduct.id ? "تعديل بيانات الصنف" : "إضافة صنف جديد للمخزون"}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingProduct(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كود الصنف (SKU) *</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.sku || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    placeholder="مثال: SHOE-BLK-42"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">القسم / التصنيف</label>
                  <input
                    type="text"
                    value={editingProduct.category || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    placeholder="مثال: أحذية، ملابس"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج كاملاً *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="مثال: سنيكرز الترا لايت طبي أسود مقاس 42"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية الفعلية بالمخزن</label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.stockQuantity ?? 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, stockQuantity: Number(e.target.value) })
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حد التنبيه للنفاد</label>
                  <input
                    type="number"
                    min="1"
                    value={editingProduct.lowStockThreshold ?? 5}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, lowStockThreshold: Number(e.target.value) })
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر التكلفة (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.unitCost ?? 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, unitCost: Number(e.target.value) })
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع للعميل (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.sellingPrice ?? 0}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sellingPrice: Number(e.target.value) })
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مكان التخزين / رقم الرف</label>
                <input
                  type="text"
                  value={editingProduct.warehouseLocation || ""}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, warehouseLocation: e.target.value })
                  }
                  placeholder="مثال: مخزن القاهرة - رف A3"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ الصنف</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
              <Boxes className="w-5 h-5 text-emerald-600" />
              <span>تسوية كميات المخزون ({adjustingProduct.name})</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب التسوية:</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="new_shipment">توريد شحنة جديدة من المصنع (+)</option>
                  <option value="inventory_count">تسوية جرد مخزني دوري</option>
                  <option value="damaged_goods">إتلاف أو تلف منتج بالمخزن (-)</option>
                  <option value="return_shelved">إرجاع طرد مرتجع سليم على الرف (+)</option>
                  <option value="manual_correction">تعديل يدوي مباشر</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الكمية المراد إضافتها أو خصمها (اكتب بالسالب للخصم مثل -5):
                </label>
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center font-bold text-lg"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  الرصيد الحالي: {adjustingProduct.stockQuantity} قطعة ← الرصيد الجديد:{" "}
                  <strong>{Math.max(0, adjustingProduct.stockQuantity + adjustDelta)} قطعة</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjustment}
                disabled={isPending || adjustDelta === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                تأكيد التسوية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
