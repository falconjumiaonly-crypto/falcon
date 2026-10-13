"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  RotateCcw,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  PackageCheck,
  Truck,
  FileText,
  Clock,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { Order, DeliveryStatus } from "@/types/database";
import {
  formatEgp,
  getDeliveryStatusBadge,
} from "@/lib/calculations";
import {
  batchUpdatePrintStatusAction,
  getOrdersAction,
  batchHandoverToCarrierAction,
} from "@/app/actions/orders";
import { CarrierExportModal } from "@/components/orders/CarrierExportModal";
import { CourierManifestModal } from "@/components/printing/CourierManifestModal";
import {
  isPrintedWithinTimeframe,
  formatPrintedRelativeTime,
  PrintAuditTimeframe,
} from "@/lib/printQueueOrchestrator";

const GOVERNORATES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "الدقهلية",
  "الشرقية",
  "المنوفية",
  "القليوبية",
  "البحيرة",
  "الغربية",
  "بور سعيد",
  "دمياط",
  "الإسماعيلية",
  "السويس",
  "كفر الشيخ",
  "الفيوم",
  "بني سويف",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
  "البحر الأحمر",
  "الوادي الجديد",
  "مطروح",
  "شمال سيناء",
  "جنوب سيناء",
];

export function PrintArchiveView() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [governorate, setGovernorate] = useState("all");
  const [timeframe, setTimeframe] = useState<PrintAuditTimeframe>("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string>("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modals
  const [isCarrierExportOpen, setIsCarrierExportOpen] = useState(false);
  const [isManifestOpen, setIsManifestOpen] = useState(false);

  const fetchArchive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrdersAction({
        printStatus: "printed",
        pageSize: 150,
        search: searchTerm,
      });

      if (!res.success || !res.data) {
        setError(res.error || "تعذر تحميل أرشيف المطبوعات");
      } else {
        setOrders(res.data.orders);
      }
    } catch {
      setError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  // Filtered orders based on governorate, timeframe, and delivery status
  const filteredOrders = orders.filter((order) => {
    if (governorate !== "all" && order.governorate !== governorate) {
      return false;
    }
    if (!isPrintedWithinTimeframe(order.printed_at, timeframe)) {
      return false;
    }
    if (
      deliveryStatusFilter !== "all" &&
      order.delivery_status !== deliveryStatusFilter
    ) {
      return false;
    }
    return true;
  });

  // Checkbox Selection
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

  // Actions
  const handleReprintSelected = () => {
    const idsToPrint = selectedIds.length > 0 ? selectedIds : filteredOrders.map((o) => o.id);
    if (idsToPrint.length === 0) return;
    router.push(`/print/preview?ids=${idsToPrint.join(",")}`);
  };

  const handleReturnToQueue = (ids: string[]) => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await batchUpdatePrintStatusAction(ids, "pending");
      if (res.success) {
        setActionMessage(`تمت إعادة ${ids.length} بوليصة إلى قائمة الانتظار بنجاح`);
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
        fetchArchive();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        setError(res.error || "فشل إعادة البوالص إلى قائمة الانتظار");
      }
    });
  };

  const handleHandoverAction = async (ids: string[], carrierName: string) => {
    const res = await batchHandoverToCarrierAction(ids, carrierName);
    if (res.success) {
      setActionMessage(`تم تحديث ${ids.length} شحنة إلى مشحونة مع ${carrierName}!`);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      fetchArchive();
      setTimeout(() => setActionMessage(null), 4000);
      return true;
    } else {
      setError(res.error || "فشل تسجيل تسليم الشحنات");
      return false;
    }
  };

  // Summary Metrics
  const totalArchiveCod = filteredOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0);
  const totalArchiveValue = filteredOrders.reduce((sum, o) => sum + (o.order_total || 0), 0);
  const printedTodayCount = orders.filter((o) =>
    isPrintedWithinTimeframe(o.printed_at, "today")
  ).length;

  const selectedOrders = filteredOrders.filter((o) => selectedIds.includes(o.id));
  const selectedCod = selectedOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            أرشيف البوالص المطبوعة وسجل التدقيق
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            سجل وتاريخ توقيتات الطباعة مع إمكانية إعادة الطباعة الفورية وإصدار كشوف التسليم
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchArchive()}
            disabled={loading}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>تحديث</span>
          </button>

          {/* Courier Manifest Button */}
          <button
            onClick={() => setIsManifestOpen(true)}
            disabled={filteredOrders.length === 0}
            className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="إصدار بيان تسليم للمندوب من الأرشيف"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>كشف تسليم (Manifest)</span>
          </button>

          <Link
            href="/print/queue"
            className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>الذهاب لقائمة الطباعة</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">إجمالي البوالص المطبوعة</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{filteredOrders.length}</span>
              {printedTodayCount > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {printedTodayCount} اليوم
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">قيمة شحنات الأرشيف الإجمالية</span>
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatEgp(totalArchiveValue)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ArrowUpDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">تحصيل COD المطبوع</span>
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatEgp(totalArchiveCod)}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Multi-Dimension Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث في الأرشيف بالاسم، الهاتف، العنوان..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Timeframe Audit Filter */}
          <div>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as PrintAuditTimeframe)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
            >
              <option value="all">كل تواريخ وجلسات الطباعة</option>
              <option value="today">طُبعت اليوم فقط</option>
              <option value="yesterday">طُبعت أمس</option>
              <option value="this_week">طُبعت خلال آخر 7 أيام</option>
            </select>
          </div>

          {/* Delivery Status Filter */}
          <div>
            <select
              value={deliveryStatusFilter}
              onChange={(e) => setDeliveryStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
            >
              <option value="all">كل حالات التوصيل والشحن</option>
              <option value="new">جاهز للتسليم (New)</option>
              <option value="handed_to_carrier">مشحون مع المندوب</option>
              <option value="delivered">تم التسليم بنجاح</option>
              <option value="returned">مرتجع</option>
            </select>
          </div>

          {/* Governorate Dropdown */}
          <div>
            <select
              value={governorate}
              onChange={(e) => setGovernorate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
            >
              <option value="all">كل المحافظات</option>
              {GOVERNORATES.map((gov) => (
                <option key={gov} value={gov}>
                  {gov}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                تم تحديد <strong className="font-black">{selectedIds.length}</strong> بوليصة من الأرشيف
                {" | "}
                تحصيل COD: <strong className="font-black font-mono text-emerald-900">{formatEgp(selectedCod)}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Instant Reprint */}
              <button
                onClick={handleReprintSelected}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>إعادة طباعة ({selectedIds.length})</span>
              </button>

              {/* Courier Manifest from Archive */}
              <button
                onClick={() => setIsManifestOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>كشف تسليم للمندوب</span>
              </button>

              {/* Handover to Carrier */}
              <button
                onClick={() => handleHandoverAction(selectedIds, "شركة الشحن")}
                disabled={isPending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>تسليم لشركة الشحن</span>
              </button>

              {/* Move back to queue */}
              <button
                onClick={() => handleReturnToQueue(selectedIds)}
                disabled={isPending}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                title="إلغاء وسم الطباعة وإرجاعها للانتظار"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>إعادة لقائمة الانتظار</span>
              </button>

              {/* Multi-Carrier Excel Export */}
              <button
                onClick={() => setIsCarrierExportOpen(true)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                <span>تصدير لشركة الشحن</span>
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
      </div>

      {/* Archive Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">جاري فحص وتحميل أرشيف المطبوعات...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 opacity-70" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              لا توجد بوالص مطابقة في الأرشيف
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              لم يتم العثور على بوالص مطابقة للفلاتر وتاريخ جلسات الطباعة المحددة.
            </p>
            <Link
              href="/print/queue"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>الانتقال إلى قائمة الانتظار</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-bold">
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredOrders.length > 0 &&
                        selectedIds.length === filteredOrders.length
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">كود الأوردر</th>
                  <th className="p-4">جلسة وتوقيت الطباعة</th>
                  <th className="p-4">حالة الشحن</th>
                  <th className="p-4">بيانات العميل</th>
                  <th className="p-4">المحافظة والعنوان</th>
                  <th className="p-4">مبلغ COD</th>
                  <th className="p-4 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const isSelected = selectedIds.includes(order.id);
                  const deliveryBadge = getDeliveryStatusBadge(order.delivery_status);

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-4">
                        <span className="font-mono font-bold text-slate-900 block">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          {order.order_date}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{formatPrintedRelativeTime(order.printed_at)}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-bold rounded-lg border ${deliveryBadge.bgClass} ${deliveryBadge.textClass}`}
                        >
                          {deliveryBadge.label}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">
                          {order.customer_name}
                        </span>
                        <span className="font-mono text-xs text-slate-600 block mt-0.5" dir="ltr">
                          {order.phone_primary}
                        </span>
                      </td>

                      <td className="p-4 max-w-xs">
                        <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-xs font-bold inline-block mb-1">
                          {order.governorate}
                        </span>
                        <span className="text-xs text-slate-600 block line-clamp-1 leading-snug">
                          {order.address}
                        </span>
                      </td>

                      <td className="p-4">
                        {order.cod_amount === 0 ? (
                          <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            مدفوع بالكامل
                          </span>
                        ) : (
                          <span className="font-black text-slate-900 text-sm font-mono">
                            {formatEgp(order.cod_amount)}
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/print/preview?ids=${order.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="إعادة طباعة فورية"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleReturnToQueue([order.id])}
                            disabled={isPending}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                            title="إعادة إلى قائمة الانتظار"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-Carrier Export Modal */}
      <CarrierExportModal
        isOpen={isCarrierExportOpen}
        onClose={() => setIsCarrierExportOpen(false)}
        selectedIds={selectedIds}
        totalFilteredCount={filteredOrders.length}
        totalFilteredCod={totalArchiveCod}
        printStatus="printed"
        onExportSuccess={() => {
          fetchArchive();
          setSelectedIds([]);
        }}
      />

      {/* Courier Delivery Manifest Modal */}
      <CourierManifestModal
        isOpen={isManifestOpen}
        onClose={() => setIsManifestOpen(false)}
        orders={selectedOrders.length > 0 ? selectedOrders : filteredOrders}
        onHandoverAction={handleHandoverAction}
        onHandoverSuccess={() => {
          fetchArchive();
          setSelectedIds([]);
        }}
      />
    </div>
  );
}

