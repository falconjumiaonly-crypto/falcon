"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  CheckCircle,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowUpDown,
  PlusCircle,
  SlidersHorizontal,
  Truck,
  FileText,
  MapPin,
  Sparkles,
  Layers,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  batchUpdatePrintStatusAction,
  getOrdersAction,
  batchHandoverToCarrierAction,
} from "@/app/actions/orders";
import { CarrierExportModal } from "@/components/orders/CarrierExportModal";
import { CourierManifestModal } from "@/components/printing/CourierManifestModal";
import { WhatsAppNotificationModal } from "@/components/orders/WhatsAppNotificationModal";
import {
  REGION_DEFINITIONS,
  PrintQueueSortOption,
  QuickSelectPreset,
  sortPrintQueueOrders,
  getOrderIdsByPreset,
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

export function PrintQueueView() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [governorate, setGovernorate] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<PrintQueueSortOption>("gov_asc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modals
  const [isCarrierExportOpen, setIsCarrierExportOpen] = useState(false);
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppOrders, setWhatsAppOrders] = useState<Order[]>([]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrdersAction({
        printStatus: "pending",
        pageSize: 150,
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

  // Filtered & Sorted orders
  const filteredOrders = sortPrintQueueOrders(
    orders.filter((order) => {
      // Region filter
      if (regionFilter !== "all") {
        const regionGovs = REGION_DEFINITIONS[regionFilter]?.governorates || [];
        if (!regionGovs.includes(order.governorate)) {
          return false;
        }
      }

      // Governorate filter
      if (governorate !== "all" && order.governorate !== governorate) {
        return false;
      }

      // Payment filter
      if (paymentFilter === "fully_paid" && order.cod_amount > 0) {
        return false;
      }
      if (paymentFilter === "cod" && order.cod_amount === 0) {
        return false;
      }
      return true;
    }),
    sortBy
  );

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

  const handleApplyPreset = (preset: QuickSelectPreset) => {
    const matchedIds = getOrderIdsByPreset(filteredOrders, preset);
    setSelectedIds(matchedIds);
  };

  const invertSelection = () => {
    const inverted = filteredOrders
      .filter((o) => !selectedIds.includes(o.id))
      .map((o) => o.id);
    setSelectedIds(inverted);
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

  const handleHandoverAction = async (ids: string[], carrierName: string) => {
    const res = await batchHandoverToCarrierAction(ids, carrierName);
    if (res.success) {
      setActionMessage(`تم تسليم ${ids.length} شحنة إلى ${carrierName} بنجاح!`);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      fetchQueue();
      setTimeout(() => setActionMessage(null), 4000);
      return true;
    } else {
      setError(res.error || "فشل تسجيل تسليم الشحنات");
      return false;
    }
  };

  // Summary Metrics
  const totalQueueCod = filteredOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0);
  const fullyPaidCount = filteredOrders.filter((o) => o.cod_amount === 0).length;

  const selectedOrders = filteredOrders.filter((o) => selectedIds.includes(o.id));
  const selectedCod = selectedOrders.reduce((sum, o) => sum + (o.cod_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            مركز إدارة رتل الطباعة وتسليم الشحنات
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            تجهيز وفرز بوالص الشحن وطباعتها متسلسلة وإصدار كشوف التسليم الرسمية للمناديب (Manifest)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchQueue()}
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
            title="إصدار بيان تسليم رسمي مع توقيع المندوب"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>كشف تسليم مندوب (Manifest)</span>
          </button>

          {/* WhatsApp Notification Button */}
          <button
            onClick={() => {
              const targets = selectedIds.length > 0 ? filteredOrders.filter((o) => selectedIds.includes(o.id)) : filteredOrders;
              setWhatsAppOrders(targets);
              setIsWhatsAppModalOpen(true);
            }}
            disabled={filteredOrders.length === 0}
            className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            title="إرسال إشعارات تتبع وتأكيد الشحنة عبر واتساب"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>إشعار واتساب ({selectedIds.length > 0 ? selectedIds.length : filteredOrders.length})</span>
          </button>

          {/* Primary Print Button */}
          <button
            onClick={handlePrintSelected}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
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
            <span className="text-xs font-semibold text-slate-500 block">إجمالي تحصيل COD المعلق</span>
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatEgp(totalQueueCod)}
            </span>
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
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium flex items-center gap-2 animate-in fade-in">
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

      {/* Multi-Dimension Filters & Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative lg:col-span-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، العنوان..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Region Filter */}
          <div>
            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                setGovernorate("all"); // reset specific governorate when region changes
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-700"
            >
              <option value="all">كل الأقاليم الجغرافية</option>
              {Object.entries(REGION_DEFINITIONS).map(([key, def]) => (
                <option key={key} value={key}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Governorate Dropdown */}
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

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
            >
              <option value="all">كل حالات الدفع</option>
              <option value="cod">تحصيل نقدي عند الاستلام (COD)</option>
              <option value="fully_paid">مدفوع بالكامل مسبقاً</option>
            </select>
          </div>

          {/* Sort By Order */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PrintQueueSortOption)}
              className="w-full px-3 py-2 text-xs bg-blue-50/50 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-blue-900"
            >
              <option value="gov_asc">ترتيب: المحافظة أ-ي (مثالي للفرز)</option>
              <option value="date_desc">ترتيب: الأحدث أولاً</option>
              <option value="date_asc">ترتيب: الأقدم أولاً</option>
              <option value="cod_desc">ترتيب: أعلى تحصيل COD</option>
              <option value="cod_asc">ترتيب: أقل تحصيل COD</option>
              <option value="name_asc">ترتيب: اسم العميل أ-ي</option>
            </select>
          </div>
        </div>

        {/* Quick Selection Preset Chips */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400 font-bold flex items-center gap-1 ml-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>تحديد سريع بنقرة:</span>
          </span>

          <button
            type="button"
            onClick={() => handleApplyPreset("cairo_giza")}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
          >
            القاهرة والجيزة
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("delta")}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
          >
            محافظات الدلتا
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("upper_egypt")}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
          >
            محافظات الصعيد
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("alex_canal")}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
          >
            الإسكندرية والقناة
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("cod_only")}
            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg transition-colors"
          >
            التحصيل COD فقط
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("prepaid_only")}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg transition-colors"
          >
            المدفوع مسبقاً
          </button>

          <button
            type="button"
            onClick={invertSelection}
            className="px-2.5 py-1 text-slate-500 hover:text-slate-800 font-bold rounded-lg transition-colors mr-auto"
          >
            عكس التحديد
          </button>
        </div>

        {/* Enhanced Bulk Action Bar (Visible when orders selected) */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-xs sm:text-sm font-bold text-blue-900">
                تم تحديد <strong className="font-black text-blue-950">{selectedIds.length}</strong> بوليصة
                {" | "}
                تحصيل COD: <strong className="font-black font-mono text-emerald-800">{formatEgp(selectedCod)}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Print Selected */}
              <button
                onClick={handlePrintSelected}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>معاينة وطباعة ({selectedIds.length})</span>
              </button>

              {/* Courier Manifest */}
              <button
                onClick={() => setIsManifestOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>كشف تسليم للمندوب</span>
              </button>

              {/* Handover directly */}
              <button
                onClick={() => handleHandoverAction(selectedIds, "شركة الشحن")}
                disabled={isPending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                title="تسليم مباشر وتغيير الحالة إلى مشحونة مع المندوب"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>تسليم لشركة الشحن</span>
              </button>

              {/* Multi-Carrier Export */}
              <button
                onClick={() => setIsCarrierExportOpen(true)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                <span>تصدير إكسيل</span>
              </button>

              {/* Mark as printed */}
              <button
                onClick={() => handleMarkAsPrinted(selectedIds)}
                disabled={isPending}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>أرشفة كـ مطبوع</span>
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

      {/* Orders Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">جاري ترتيب وتحميل رتل الطباعة...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Printer className="w-8 h-8 opacity-70" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              لا توجد بوالص مطابقة في قائمة الانتظار
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              جميع الأوردرات الحالية تمت طباعتها، أو لا توجد شحنات مطابقة للفلاتر المحددة.
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
                  <th className="p-4">بيانات المستلم</th>
                  <th className="p-4">المحافظة والعنوان</th>
                  <th className="p-4">المطلوب تحصيله (COD)</th>
                  <th className="p-4">ملاحظات التوصيل</th>
                  <th className="p-4 text-center">إجراءات سريعة</th>
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
                          <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-xs font-bold">
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
                            <span className="font-black text-slate-900 text-base font-mono">
                              {formatEgp(order.cod_amount)}
                            </span>
                            {order.paid_amount > 0 && (
                              <span className="text-[11px] text-slate-400 block font-mono">
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
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/print/preview?ids=${order.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="معاينة وطباعة البوليصة"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => {
                              setWhatsAppOrders([order]);
                              setIsWhatsAppModalOpen(true);
                            }}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="إرسال إشعار تتبع عبر واتساب"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleMarkAsPrinted([order.id])}
                            disabled={isPending}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
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

      {/* Multi-Carrier Export Modal */}
      <CarrierExportModal
        isOpen={isCarrierExportOpen}
        onClose={() => setIsCarrierExportOpen(false)}
        selectedIds={selectedIds}
        totalFilteredCount={filteredOrders.length}
        totalFilteredCod={totalQueueCod}
        printStatus="pending"
        onExportSuccess={() => {
          fetchQueue();
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
          fetchQueue();
          setSelectedIds([]);
        }}
      />

      {/* WhatsApp Notification Dispatcher Modal */}
      <WhatsAppNotificationModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        orders={whatsAppOrders}
      />
    </div>
  );
}

