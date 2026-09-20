"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
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
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  getDashboardMetricsAction,
  getOrdersAction,
  batchUpdateSettlementStatusAction,
  DashboardMetrics,
} from "@/app/actions/orders";

export function FinanceView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [settlementFilter, setSettlementFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("delivered");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, ordersRes] = await Promise.all([
        getDashboardMetricsAction(),
        getOrdersAction({
          deliveryStatus: deliveryFilter === "all" ? undefined : deliveryFilter,
          settlementStatus: settlementFilter === "all" ? undefined : settlementFilter,
          search: searchTerm,
          pageSize: 100,
        }),
      ]);

      if (metricsRes.success && metricsRes.data) {
        setMetrics(metricsRes.data);
      } else {
        setError(metricsRes.error || "تعذر تحميل المؤشرات المالية");
      }

      if (ordersRes.success && ordersRes.data) {
        setOrders(ordersRes.data.orders);
      }
    } catch {
      setError("حدث خطأ أثناء تحميل البيانات المالية");
    } finally {
      setLoading(false);
    }
  }, [deliveryFilter, settlementFilter, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        fetchData();
        setTimeout(() => setActionSuccess(null), 4000);
      } else {
        setError(res.error || "فشل تحديث حالة التسوية");
      }
    });
  };

  // Export Pending Carrier Settlement
  const handleExportPendingCarrier = () => {
    window.location.href = "/api/orders/export?type=carrier_settlement";
  };

  const handleExportSelected = () => {
    const ids = selectedIds.length > 0 ? selectedIds : orders.map((o) => o.id);
    if (ids.length === 0) return;
    window.location.href = `/api/orders/export?ids=${ids.join(",")}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Direct Export Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">المالية والتسويات النقدية 💰</h1>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
              حسابات فلكون
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            متابعة أرباح فلكون، تسويات النقدية المحصلة من شركات الشحن والمناديب
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
            onClick={handleExportPendingCarrier}
            className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير كشف المستحقات المعلقة (Excel)</span>
          </button>
        </div>
      </div>

      {/* Financial KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">صافي أرباح فلكون</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700">
              {metrics ? formatEgp(metrics.falconNetProfit) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            إجمالي السعر - تكلفة الشحن المحسوبة
          </p>
        </div>

        {/* Pending with Carrier (Unsettled) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-300 shadow-sm bg-gradient-to-br from-white to-rose-50/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">مستحقات معلقة عند شركة الشحن</span>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-600">
              {metrics ? formatEgp(metrics.pendingCarrierCod) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            شحنات تم تسليمها بنجاح وبانتظار توريد الـ COD
          </p>
        </div>

        {/* Settled Carrier COD */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مبالغ تمت تسويتها واستلامها</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-700">
              {metrics ? formatEgp(metrics.settledCarrierCod) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">تم توريدها من شركة الشحن</p>
        </div>

        {/* Total Orders Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي قيمة الأوردرات</span>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {metrics ? formatEgp(metrics.totalOrderValue) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            مدفوع مقدماً: {metrics ? formatEgp(metrics.totalPaidAmount) : "..."}
          </p>
        </div>

        {/* Total COD Required */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي COD لكل الطلبات</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-700">
              {metrics ? formatEgp(metrics.totalCod) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">شامل كافة الحالات</p>
        </div>

        {/* Total Shipping Cost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي تكاليف الشحن</span>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-800">
              {metrics ? formatEgp(metrics.totalShippingCost) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">مستحقات شركات الشحن</p>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Settlements Operation Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              مطابقة وتسوية شحنات شركة الشحن
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              حدد الشحنات المسلمة لتأكيد استلام النقدية أو تصدير كشف التسوية
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
                placeholder="ابحث بالاسم، الهاتف..."
                className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Delivery status filter */}
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="delivered">تم التوصيل للعميل (فقط)</option>
              <option value="handed_to_carrier">مع شركة الشحن</option>
              <option value="returned">مرتجع</option>
              <option value="all">كل حالات التوصيل</option>
            </select>

            {/* Settlement status filter */}
            <select
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="all">كل حالات التسوية</option>
              <option value="pending">معلق عند شركة الشحن (غير مسوى)</option>
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
                <span>إعادة كـ معلق</span>
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

        {/* Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">جاري تحميل شحنات التسوية...</p>
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
                  <th className="p-3">كود وتاريخ الأوردر</th>
                  <th className="p-3">العميل والهاتف</th>
                  <th className="p-3">المحافظة والعنوان</th>
                  <th className="p-3">حالة التوصيل</th>
                  <th className="p-3">المطلوب تحصيله (COD)</th>
                  <th className="p-3">حالة التسوية</th>
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

                      <td className="p-3 font-mono">
                        <span className="font-bold text-slate-800 block">
                          #{ord.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {ord.order_date}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">
                          {ord.customer_name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono block mt-0.5" dir="ltr">
                          {ord.phone_primary}
                        </span>
                      </td>

                      <td className="p-3 max-w-xs">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold inline-block mb-0.5">
                          {ord.governorate}
                        </span>
                        <span className="text-slate-600 block truncate">
                          {ord.address}
                        </span>
                      </td>

                      <td className="p-3">
                        {ord.delivery_status === "delivered" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            تم التوصيل
                          </span>
                        ) : ord.delivery_status === "handed_to_carrier" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            <Truck className="w-3 h-3" />
                            مع الشركة
                          </span>
                        ) : ord.delivery_status === "returned" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                            مرتجع
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">جديد</span>
                        )}
                      </td>

                      <td className="p-3 font-bold text-slate-900 text-sm">
                        {ord.cod_amount === 0 ? (
                          <span className="text-emerald-700 text-xs font-bold">مدفوع بالكامل</span>
                        ) : (
                          formatEgp(ord.cod_amount)
                        )}
                      </td>

                      <td className="p-3">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            تمت التسوية
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            معلق عند شركة الشحن
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        {isSettled ? (
                          <button
                            onClick={() => handleUpdateSettlement([ord.id], "pending")}
                            disabled={isPending}
                            className="px-2 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                            title="إلغاء التسوية"
                          >
                            إلغاء
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateSettlement([ord.id], "settled")}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
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
