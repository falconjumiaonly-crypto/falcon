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
  Wallet,
  ShieldAlert,
  ChevronDown,
  Building,
} from "lucide-react";
import { Order, DeliveryStatus, SettlementStatus } from "@/types/database";
import {
  formatEgp,
  getDeliveryStatusBadge,
} from "@/lib/calculations";
import {
  calculateCourierSettlementMetrics,
  CourierSettlementMetrics,
} from "@/lib/settlementCalculations";
import {
  getOrdersAction,
  batchUpdateSettlementStatusAction,
} from "@/app/actions/orders";
import { SettlementReconciliationModal } from "./SettlementReconciliationModal";
import { ReturnReceivingModal } from "@/components/returns/ReturnReceivingModal";
import { CourierAgingRadarView } from "./CourierAgingRadarView";

type SettlementTab = "all" | "delivered_pending" | "in_transit" | "settled" | "returned" | "aging_radar";

export function SettlementsView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<SettlementTab>("all");

  // Reconciliation Modal state
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [isReturnReceivingModalOpen, setIsReturnReceivingModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [governorate, setGovernorate] = useState("all");

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
        search: searchTerm,
        pageSize: 400,
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
  }, [searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Overall settlement metrics computed from all active orders
  const metrics: CourierSettlementMetrics = useMemo(() => {
    return calculateCourierSettlementMetrics(orders);
  }, [orders]);

  // Filter orders according to active tab, governorate, and search term
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === "delivered_pending") {
        if (order.delivery_status !== "delivered" || order.settlement_status === "settled") {
          return false;
        }
      } else if (activeTab === "in_transit") {
        if (order.delivery_status !== "handed_to_carrier" || order.settlement_status === "settled") {
          return false;
        }
      } else if (activeTab === "settled") {
        if (order.settlement_status !== "settled") {
          return false;
        }
      } else if (activeTab === "returned") {
        if (order.delivery_status !== "returned") {
          return false;
        }
      }

      // Governorate filter
      if (governorate !== "all" && order.governorate !== governorate) {
        return false;
      }

      return true;
    });
  }, [orders, activeTab, governorate]);

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Settle or Revert Settlement Action
  const handleUpdateSettlement = (ids: string[], status: SettlementStatus) => {
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
    const ids = selectedIds.length > 0 ? selectedIds : filteredOrders.map((o) => o.id);
    if (ids.length === 0) return;
    window.location.href = `/api/orders/export?ids=${ids.join(",")}`;
  };

  const selectedOrders = filteredOrders.filter((o) => selectedIds.includes(o.id));
  const selectedCod = selectedOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0);
  const selectedShipping = selectedOrders.reduce((sum, o) => sum + (o.shipping_cost || 0), 0);
  const selectedNet = selectedCod - selectedShipping;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              حاسبة مستحقات شركات الشحن والرصيد المعلق
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">
              حسابات وعهدة الشحن
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            متابعة دقيقة لأموالك المعلقة في السوق: التحصيلات النقدية (COD)، مصاريف الشحن المخصومة، وصافي المستحق الفعلي لك.
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
            onClick={() => setIsReconciliationModalOpen(true)}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all"
            title="مطابقة كشف تسوية شركة الشحن Excel وكشف الفروقات"
          >
            <Layers className="w-4 h-4" />
            <span>مطابقة كشف تسوية شركة الشحن</span>
          </button>

          <button
            onClick={() => setIsReturnReceivingModalOpen(true)}
            className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all"
            title="فحص واستلام المرتجعات بالمخزن وحماية العهدة المفقودة"
          >
            <RotateCcw className="w-4 h-4" />
            <span>فحص واستلام المرتجعات بالمخزن</span>
          </button>

          <button
            onClick={handleExportPending}
            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير كشف المستحقات (Excel)</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards Grid - The Accurate Courier Financial Formula */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Confirmed Payout Due to You (Delivered & Pending) */}
        <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/20 to-white shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-950">
              الصافي المؤكد بانتظار التوريد
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {formatEgp(metrics.deliveredPendingNet)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            شحنات تم تسليمها للعملاء ({metrics.deliveredPendingCount} شحنة) بعد خصم الشحن
          </p>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">
            تحصيل: {formatEgp(metrics.deliveredPendingCod)} | شحن: {formatEgp(metrics.deliveredPendingShippingCost)}
          </div>
        </div>

        {/* 2. Floating Cash in Market (In-Transit with Couriers) */}
        <div className="bg-white p-5 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50/20 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-950">
              أموال في السوق مع المناديب
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-700 font-mono">
              {formatEgp(metrics.inTransitCod)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            شحنات قيد التوصيل في الشارع ({metrics.inTransitCount} شحنة)
          </p>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">
            تكاليف شحنها المتوقعة: {formatEgp(metrics.inTransitShippingCost)}
          </div>
        </div>

        {/* 3. Settled & Transferred (المبالغ المسواة فعلياً) */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/20 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-blue-950">
              المبالغ المسواة والمستلمة
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-800 font-mono">
              {formatEgp(metrics.settledNet)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            تم توريدها واستلامها بالكامل ({metrics.settledCount} شحنة)
          </p>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">
            إجمالي COD: {formatEgp(metrics.settledCod)} | شحن: {formatEgp(metrics.settledShippingCost)}
          </div>
        </div>

        {/* 4. Returns Shipping Loss / Deductions */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/20 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-rose-950">
              مصاريف شحن المرتجعات المخصومة
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-700 font-mono">
              {formatEgp(metrics.returnsShippingCost)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            عدد ({metrics.returnsCount}) طرد مرتجع تخصم شركته تكلفة شحنه
          </p>
          <div className="mt-2 pt-2 border-t border-rose-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">تخصم من دفعات التحصيل</span>
            <button
              type="button"
              onClick={() => setIsReturnReceivingModalOpen(true)}
              className="text-[11px] text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer"
            >
              فحص المخزن ←
            </button>
          </div>
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

      {/* View Tabs & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        {/* Interactive Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>كل الشحنات</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delivered_pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "delivered_pending"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>مستحقات مؤكدة بانتظار التوريد</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">
              {metrics.deliveredPendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("in_transit")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "in_transit"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>قيد الشحن في السوق</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">
              {metrics.inTransitCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settled")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "settled"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>تمت التسوية بنجاح</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">
              {metrics.settledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("returned")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "returned"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>المرتجعات ومصاريفها</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px]">
              {metrics.returnsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("aging_radar")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "aging_radar"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>رادار تقادم الديون 🚨</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم، الهاتف، الكود..."
                className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Governorate filter */}
            <select
              value={governorate}
              onChange={(e) => setGovernorate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
            >
              <option value="all">كل المحافظات</option>
              {metrics.byGovernorate.map((g) => (
                <option key={g.governorate} value={g.governorate}>
                  {g.governorate} ({g.count})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            عرض <strong className="text-slate-900">{filteredOrders.length}</strong> شحنة
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-950">
                تم تحديد <strong className="font-black">{selectedIds.length}</strong> شحنة
                {" | "}
                صافي التحصيل المستحق: <strong className="font-black font-mono text-emerald-900">{formatEgp(selectedNet)}</strong>
                {" (COD: "}{formatEgp(selectedCod)}{" - شحن: "}{formatEgp(selectedShipping)}{")"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateSettlement(selectedIds, "settled")}
                disabled={isPending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تأكيد استلام وتسوية المحدد ({selectedIds.length})</span>
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
                <span>تصدير Excel</span>
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 font-bold"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}

        {/* Content Section: Aging Radar View vs Orders Table */}
        {activeTab === "aging_radar" ? (
          <CourierAgingRadarView />
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
            {loading ? (
              <div className="py-16 text-center">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">جاري احتساب كشف المستحقات...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
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
                      checked={
                        selectedIds.length === filteredOrders.length &&
                        filteredOrders.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                    />
                  </th>
                  <th className="p-3">كود الأوردر</th>
                  <th className="p-3">المستلم والمحافظة</th>
                  <th className="p-3">حالة الشحن والتسليم</th>
                  <th className="p-3">قيمة التحصيل (COD)</th>
                  <th className="p-3">تكلفة الشحن</th>
                  <th className="p-3">الصافي لك من الشركة</th>
                  <th className="p-3">حالة التسوية والتوريد</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3 text-center">إجراء فوري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((ord) => {
                  const isSelected = selectedIds.includes(ord.id);
                  const isSettled = ord.settlement_status === "settled";
                  const netToMerchant = Number(ord.cod_amount || 0) - Number(ord.shipping_cost || 0);
                  const deliveryBadge = getDeliveryStatusBadge(ord.delivery_status);

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-emerald-50/40" : ""
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
                      <td className="p-3 font-mono font-bold text-slate-900">
                        #{ord.id.slice(0, 8).toUpperCase()}
                      </td>

                      {/* Customer & Governorate */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-bold text-slate-900">
                            {ord.customer_name}
                          </span>
                          <span className="px-1.5 py-0.2 bg-slate-100 rounded text-[10px] font-bold text-slate-700">
                            {ord.governorate}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono block" dir="ltr">
                          {ord.phone_primary}
                        </span>
                      </td>

                      {/* Delivery Status Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-lg border ${deliveryBadge.bgClass} ${deliveryBadge.textClass}`}
                        >
                          {deliveryBadge.label}
                        </span>
                      </td>

                      {/* Gross COD */}
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap font-mono">
                        {ord.cod_amount === 0 ? (
                          <span className="text-emerald-700 text-[11px]">مدفوع (0)</span>
                        ) : (
                          formatEgp(ord.cod_amount)
                        )}
                      </td>

                      {/* Shipping Cost */}
                      <td className="p-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {formatEgp(ord.shipping_cost)}
                      </td>

                      {/* Net Receivable to Merchant */}
                      <td className="p-3 whitespace-nowrap font-mono">
                        <span
                          className={`font-black text-sm ${
                            netToMerchant > 0
                              ? "text-emerald-700"
                              : netToMerchant < 0
                              ? "text-rose-700"
                              : "text-slate-600"
                          }`}
                        >
                          {formatEgp(netToMerchant)}
                        </span>
                      </td>

                      {/* Settlement Status */}
                      <td className="p-3 whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            تم التوريد والتسوية
                          </span>
                        ) : ord.delivery_status === "delivered" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3 text-emerald-600" />
                            جاهز للصرف والتوريد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3 text-amber-600" />
                            معلق في السوق
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
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
                            تسوية واستلام
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
      )}
    </div>

      {/* Carrier Settlement Reconciliation Modal */}
      <SettlementReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => setIsReconciliationModalOpen(false)}
        systemOrders={orders}
        onReconciliationApplied={() => fetchData()}
      />

      {/* Return Receiving & Custody Audit Modal */}
      <ReturnReceivingModal
        isOpen={isReturnReceivingModalOpen}
        onClose={() => setIsReturnReceivingModalOpen(false)}
        orders={orders}
        onRefresh={() => fetchData()}
      />
    </div>
  );
}

