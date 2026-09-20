"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  CheckCircle,
  FileSpreadsheet,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowUpDown,
  PlusCircle,
  SlidersHorizontal,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp, getPaymentStatusBadge } from "@/lib/calculations";
import { batchUpdatePrintStatusAction, getOrdersAction } from "@/app/actions/orders";

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

export function PrintQueueView() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [governorate, setGovernorate] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrdersAction({
        printStatus: "pending",
        pageSize: 100, // get large batch for print queue
        search: searchTerm,
      });

      if (!res.success || !res.data) {
        setError(res.error || "تعذر تحميل قائمة الطباعة");
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
    fetchQueue();
  }, [fetchQueue]);

  // Filtered orders based on governorate & payment filter
  const filteredOrders = orders.filter((order) => {
    if (governorate !== "all" && order.governorate !== governorate) {
      return false;
    }
    if (paymentFilter === "fully_paid" && order.cod_amount > 0) {
      return false;
    }
    if (paymentFilter === "cod" && order.cod_amount === 0) {
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
  const handlePrintSelected = () => {
    const idsToPrint = selectedIds.length > 0 ? selectedIds : filteredOrders.map((o) => o.id);
    if (idsToPrint.length === 0) return;
    router.push(`/print/preview?ids=${idsToPrint.join(",")}`);
  };

  const handleMarkAsPrinted = (ids: string[]) => {
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await batchUpdatePrintStatusAction(ids, "printed");
      if (res.success) {
        setActionMessage(`تم نقل ${ids.length} بوليصة إلى الأرشيف بنجاح`);
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
        fetchQueue();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        setError(res.error || "فشل تحديث حالة الطباعة");
      }
    });
  };

  const handleExportSelected = () => {
    const idsToExport = selectedIds.length > 0 ? selectedIds : filteredOrders.map((o) => o.id);
    if (idsToExport.length === 0) return;
    window.location.href = `/api/orders/export?ids=${idsToExport.join(",")}`;
  };

  // Summary Metrics
  const totalQueueCod = filteredOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0);
  const fullyPaidCount = filteredOrders.filter((o) => o.cod_amount === 0).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">قائمة انتظار الطباعة</h1>
          <p className="text-sm text-slate-500 mt-1">
            البوالص الجاهزة للطباعة والتقطيع وتجهيز الشحن مع المناديب
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchQueue()}
            disabled={loading}
            className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>تحديث</span>
          </button>

          <button
            onClick={handlePrintSelected}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>
              {selectedIds.length > 0
                ? `معاينة وطباعة المحدد (${selectedIds.length})`
                : `طباعة كل المعلق (${filteredOrders.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">بوالص جاهزة للطباعة</span>
            <span className="text-2xl font-black text-slate-900">{filteredOrders.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ArrowUpDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">إجمالي تحصيل COD</span>
            <span className="text-2xl font-black text-slate-900">{formatEgp(totalQueueCod)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">شحنات مدفوعة مسبقاً</span>
            <span className="text-2xl font-black text-emerald-700">{fullyPaidCount}</span>
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم، الهاتف، العنوان..."
              className="w-full pr-9 pl-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Governorate Dropdown */}
          <div className="relative">
            <select
              value={governorate}
              onChange={(e) => setGovernorate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">كل المحافظات</option>
              {GOVERNORATES.map((gov) => (
                <option key={gov} value={gov}>
                  {gov}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="relative">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">كل حالات التحصيل</option>
              <option value="cod">تحصيل نقدي عند الاستلام (COD)</option>
              <option value="fully_paid">مدفوع بالكامل مسبقاً</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar (Visible when orders selected) */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-sm font-bold text-blue-900">
                تم تحديد {selectedIds.length} من أصل {filteredOrders.length} بوليصة
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintSelected}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>معاينة وطباعة ({selectedIds.length})</span>
              </button>

              <button
                onClick={() => handleMarkAsPrinted(selectedIds)}
                disabled={isPending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تحديد كـ تمت الطباعة</span>
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
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 font-medium"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Orders Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">جاري تحميل قائمة الطباعة...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Printer className="w-8 h-8 opacity-70" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              لا توجد بوالص في قائمة الطباعة
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              جميع الأوردرات الحالية تمت طباعتها، أو لم يتم إنشاء أوردرات جديدة بعد.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/orders/create"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إنشاء بوليصة جديدة</span>
              </Link>
              <Link
                href="/print/archive"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all"
              >
                <span>عرض أرشيف المطبوعات</span>
              </Link>
            </div>
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
                  <th className="p-4">كود وتاريخ الأوردر</th>
                  <th className="p-4">بيانات العميل</th>
                  <th className="p-4">المحافظة والعنوان</th>
                  <th className="p-4">المطلوب تحصيله (COD)</th>
                  <th className="p-4">ملاحظات المندوب</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const isSelected = selectedIds.includes(order.id);
                  const isFullyPaid = order.cod_amount === 0;

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-blue-50/40" : ""
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
                        <span className="text-xs text-slate-500 block mt-0.5">
                          {order.order_date}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">
                          {order.customer_name}
                        </span>
                        <span className="font-mono text-xs text-slate-600 block mt-0.5" dir="ltr">
                          {order.phone_primary}
                        </span>
                        {order.phone_secondary && (
                          <span className="font-mono text-[11px] text-slate-400 block" dir="ltr">
                            {order.phone_secondary}
                          </span>
                        )}
                      </td>

                      <td className="p-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                            {order.governorate}
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 line-clamp-2 mt-1 leading-snug">
                          {order.address}
                        </span>
                        {order.landmark && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            علامة: {order.landmark}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        {isFullyPaid ? (
                          <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black rounded-lg">
                            مدفوع بالكامل
                          </span>
                        ) : (
                          <div>
                            <span className="font-black text-slate-900 text-base">
                              {formatEgp(order.cod_amount)}
                            </span>
                            {order.paid_amount > 0 && (
                              <span className="text-[11px] text-slate-400 block">
                                (مدفوع: {formatEgp(order.paid_amount)})
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-4 max-w-[180px]">
                        {order.important_notes ? (
                          <span className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2 py-1 rounded block line-clamp-2">
                            {order.important_notes}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/print/preview?ids=${order.id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="معاينة وطباعة"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleMarkAsPrinted([order.id])}
                            disabled={isPending}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="تحديد كـ تمت الطباعة"
                          >
                            <CheckCircle className="w-4 h-4" />
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
    </div>
  );
}
