"use client";

import { useState, useEffect, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  CheckCircle,
  RotateCcw,
  Truck,
  Package,
  Layers,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  getOrdersAction,
  batchUpdateSettlementStatusAction,
} from "@/app/actions/orders";

export function SettlementsView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [settlementFilter, setSettlementFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load orders
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ordersRes = await getOrdersAction({
        deliveryStatus: deliveryFilter === "all" ? undefined : deliveryFilter,
        settlementStatus: settlementFilter === "all" ? undefined : settlementFilter,
        search: searchTerm,
        pageSize: 300,
      });

      if (ordersRes.success && ordersRes.data) {
        setOrders(ordersRes.data.orders);
      } else {
        setError(ordersRes.error || "تعذر تحميل بيانات الأوردرات والمستحقات");
      }
    } catch {
      setError("حدث خطأ أثناء تحميل بيانات المستحقات");
    } finally {
      setLoading(false);
    }
  }, [deliveryFilter, settlementFilter, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Prevent double counting: compute metrics accurately from the loaded unique orders
  const metrics = useMemo(() => {
    const seenIds = new Set<string>();
    let totalOrderValue = 0;
    let totalShippingCost = 0;
    let netDueToUs = 0; // Total COD amount to be collected
    let settledAmount = 0;
    let pendingAmount = 0;
    let ordersCount = 0;

    for (const ord of orders) {
      if (seenIds.has(ord.id)) continue;
      seenIds.add(ord.id);
      ordersCount++;

      const orderTotal = Number(ord.order_total || 0);
      const shippingCost = Number(ord.shipping_cost || 0);
      const codAmount = Number(ord.cod_amount || 0);

      totalOrderValue += orderTotal;
      totalShippingCost += shippingCost;
      netDueToUs += codAmount;

      if (ord.settlement_status === "settled") {
        settledAmount += codAmount;
      } else {
        pendingAmount += codAmount;
      }
    }

    return {
      totalOrderValue,
      totalShippingCost,
      netDueToUs,
      settledAmount,
      pendingAmount,
      ordersCount,
    };
  }, [orders]);

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length && orders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Settle or Revert Settlement Action
  const handleUpdateSettlement = (ids: string[], status: "settled" | "pending") => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await batchUpdateSettlementStatusAction(ids, status);
      if (res.success) {
        const msg =
          status === "settled"
            ? `تمت تسوية وتأكيد استلام مستحقات ${ids.length} أوردر بنجاح`
            : `تمت إعادة ${ids.length} أوردر إلى الحالة المعلقة`;
        setActionSuccess(msg);
        setSelectedIds([]);
        // Optimistically update local orders
        setOrders((prev) =>
          prev.map((o) =>
            ids.includes(o.id)
              ? {
                  ...o,
                  settlement_status: status,
                  settled_at: status === "settled" ? new Date().toISOString() : null,
                }
              : o
          )
        );
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setError(res.error || "فشل تحديث حالة التسوية");
      }
    });
  };

  // Export to Excel
  const handleExportPending = () => {
    window.location.href = "/api/orders/export?type=carrier_settlement";
  };

  const handleExportSelected = () => {
    const ids = selectedIds.length > 0 ? selectedIds : orders.map((o) => o.id);
    if (ids.length === 0) return;
    window.location.href = `/api/orders/export?ids=${ids.join(",")}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              المستحقات والتسويات | Shipping Settlements
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">
              حسابات شركة الشحن
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            متابعة الأموال المستحقة لدى شركة الشحن، مبالغ التحصيل (COD)، وصافي المستحقات المسواة والمعلقة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="h-10 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleExportPending}
            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير كشف المستحقات المعلقة (Excel)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid - The 6 Core Metrics Required */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Total Orders Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي قيمة الأوردرات</span>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {formatEgp(metrics.totalOrderValue)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            مجموع أسعار المنتجات لجميع شحنات المستحقات
          </p>
        </div>

        {/* 2. Total Shipping Cost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي قيمة الشحن</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-700">
              {formatEgp(metrics.totalShippingCost)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            تكاليف الشحن المحسوبة حسب المحافظات
          </p>
        </div>

        {/* 3. Net Due to Us */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-white to-blue-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900">صافي المستحق لنا (COD)</span>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-700">
              {formatEgp(metrics.netDueToUs)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            إجمالي المبالغ المطلوب تحصيلها من العملاء
          </p>
        </div>

        {/* 4. Settled Amounts */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">المبالغ التي تم تحصيلها / تسويتها</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700">
              {formatEgp(metrics.settledAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            تم توريدها واستلامها من شركة الشحن
          </p>
        </div>

        {/* 5. Pending Amounts */}
        <div className="bg-white p-5 rounded-2xl border border-rose-300 shadow-sm bg-gradient-to-br from-white to-rose-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">المبالغ التي ما زالت مستحقة (معلقة)</span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-600">
              {formatEgp(metrics.pendingAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            مستحقات بانتظار التوريد والتسوية من الشركة
          </p>
        </div>

        {/* 6. Linked Orders Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">عدد الأوردرات المرتبطة بالمستحقات</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-800">
              {metrics.ordersCount} أوردر
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            لا يتم احتساب أي أوردر محذوف أو مكرر مرتين
          </p>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Detailed Orders Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              تفاصيل الأوردرات ومستحقات الشحن
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              كشف تفصيلي بالأوردرات المكونة للمبالغ، مع تفاصيل العميل، المحافظة، الشحن، وحالة التسوية
            </p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم، الهاتف، الكود..."
                className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Delivery filter */}
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
            >
              <option value="all">كل حالات التوصيل</option>
              <option value="delivered">تم التوصيل للعميل</option>
              <option value="handed_to_carrier">مع شركة الشحن</option>
              <option value="returned">مرتجع</option>
              <option value="new">أوردر جديد</option>
            </select>

            {/* Settlement filter */}
            <select
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
            >
              <option value="all">كل حالات التسوية</option>
              <option value="pending">معلق (غير مسوى)</option>
              <option value="settled">تمت التسوية والتوريد</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-xs font-bold text-blue-900">
                تم تحديد {selectedIds.length} شحنة
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateSettlement(selectedIds, "settled")}
                disabled={isPending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تأكيد التسوية واستلام النقدية ({selectedIds.length})</span>
              </button>

              <button
                onClick={() => handleUpdateSettlement(selectedIds, "pending")}
                disabled={isPending}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-amber-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>إعادة كمعلق</span>
              </button>

              <button
                onClick={handleExportSelected}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>تصدير Excel للمحدد</span>
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 font-medium"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}

        {/* Detailed Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">جاري تحميل كشف المستحقات...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد شحنات مطابقة للفلاتر الحالية.
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">اسم العميل</th>
                  <th className="p-3">المحافظة</th>
                  <th className="p-3">قيمة الأوردر</th>
                  <th className="p-3">سعر الشحن</th>
                  <th className="p-3">صافي المستحق (COD)</th>
                  <th className="p-3">حالة الأوردر</th>
                  <th className="p-3">حالة التسوية المالية</th>
                  <th className="p-3">تاريخ الأوردر</th>
                  <th className="p-3 text-center">إجراء فوري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => {
                  const isSelected = selectedIds.includes(ord.id);
                  const isSettled = ord.settlement_status === "settled";

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(ord.id)}
                          className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                        />
                      </td>

                      {/* Order ID */}
                      <td className="p-3 font-mono font-bold text-slate-800">
                        #{ord.id.slice(0, 8).toUpperCase()}
                      </td>

                      {/* Customer Name & Phone */}
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">
                          {ord.customer_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5" dir="ltr">
                          {ord.phone_primary}
                        </span>
                      </td>

                      {/* Governorate */}
                      <td className="p-3 font-semibold text-slate-700">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold">
                          {ord.governorate}
                        </span>
                      </td>

                      {/* Order Total */}
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {formatEgp(ord.order_total)}
                      </td>

                      {/* Shipping Cost */}
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatEgp(ord.shipping_cost)}
                      </td>

                      {/* Net Due / COD Amount */}
                      <td className="p-3 font-black text-blue-700 whitespace-nowrap">
                        {ord.cod_amount === 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold">
                            مدفوع بالكامل
                          </span>
                        ) : (
                          formatEgp(ord.cod_amount)
                        )}
                      </td>

                      {/* Delivery Status */}
                      <td className="p-3 whitespace-nowrap">
                        {ord.delivery_status === "delivered" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            تم التوصيل
                          </span>
                        ) : ord.delivery_status === "handed_to_carrier" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            <Truck className="w-3 h-3" />
                            مع شركة الشحن
                          </span>
                        ) : ord.delivery_status === "returned" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            مرتجع
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-medium">جديد</span>
                        )}
                      </td>

                      {/* Settlement Status */}
                      <td className="p-3 whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            تمت التسوية والتوريد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            معلق عند شركة الشحن
                          </span>
                        )}
                      </td>

                      {/* Order Date */}
                      <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {ord.order_date}
                      </td>

                      {/* Quick Action */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {isSettled ? (
                          <button
                            onClick={() => handleUpdateSettlement([ord.id], "pending")}
                            disabled={isPending}
                            className="px-2 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                            title="إعادة الأوردر للحالة المعلقة"
                          >
                            إلغاء التسوية
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateSettlement([ord.id], "settled")}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                          >
                            تسوية الآن
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
