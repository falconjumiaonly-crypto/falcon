"use client";

import { useState, useEffect, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Printer,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { Order } from "@/types/database";
import {
  calculatePrintPagesCount,
  checkOrderPrintOverflow,
} from "@/lib/calculations";
import { getOrdersAction, getOrdersByIdsAction, batchUpdatePrintStatusAction } from "@/app/actions/orders";
import { getAppSettingsAction } from "@/app/actions/settings";
import { ShippingLabel } from "@/components/printing/ShippingLabel";

function PrintPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawIds = searchParams.get("ids");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Printing mode: 3 (default) or 2 per page
  const [mode, setMode] = useState<2 | 3>(3);
  const [isPending, startTransition] = useTransition();

  // Post-print confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [markedDone, setMarkedDone] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError(null);

      try {
        if (rawIds && rawIds !== "all") {
          const ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
          if (ids.length > 0) {
            const res = await getOrdersByIdsAction(ids);
            if (res.success && res.data) {
              setOrders(res.data);
            } else {
              setError(res.error || "تعذر تحميل البوالص المحددة");
            }
          } else {
            setOrders([]);
          }
        } else {
          // Default: load all pending orders
          const res = await getOrdersAction({
            printStatus: "pending",
            pageSize: 100,
          });
          if (res.success && res.data) {
            setOrders(res.data.orders);
          } else {
            setError(res.error || "تعذر تحميل قائمة الطباعة");
          }
        }
      } catch {
        setError("حدث خطأ غير متوقع أثناء تحميل بيانات البوالص");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();

    getAppSettingsAction().then((res) => {
      if (res.success && res.data?.branding) {
        setLogoUrl(res.data.branding.logo_url);
        setCompanyName(res.data.branding.company_name);
      }
    });
  }, [rawIds]);

  // Check overflow across orders
  const overflowingOrders = orders.filter(checkOrderPrintOverflow);
  const hasOverflow = overflowingOrders.length > 0;

  // Split orders into pages according to chosen mode
  const totalPages = calculatePrintPagesCount(orders.length, mode);
  const pages: Order[][] = [];
  for (let i = 0; i < orders.length; i += mode) {
    pages.push(orders.slice(i, i + mode));
  }

  // Handle Trigger Print
  const handlePrint = () => {
    window.print();
    // After triggering print dialog, show post-print confirmation prompt
    setShowConfirmModal(true);
  };

  // Mark all currently previewed orders as printed
  const handleConfirmPrinted = () => {
    const ids = orders.map((o) => o.id);
    if (ids.length === 0) return;

    startTransition(async () => {
      const res = await batchUpdatePrintStatusAction(ids, "printed");
      if (res.success) {
        setMarkedDone(true);
        setShowConfirmModal(false);
        setTimeout(() => {
          router.push("/print/archive");
        }, 1500);
      } else {
        setError(res.error || "فشل نقل البوالص إلى الأرشيف");
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">جاري إعداد معاينة الطباعة...</p>
      </div>
    );
  }

  if (error || orders.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <Printer className="w-8 h-8 opacity-70" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {error || "لم يتم العثور على بوالص للطباعة"}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          تأكد من تحديد بوالص صالحة من قائمة الانتظار أو الأرشيف.
        </p>
        <Link
          href="/print/queue"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى قائمة الطباعة</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-0 print:m-0 print:p-0">
      {/* ========================================================= */}
      {/* TOP CONTROL BAR (HIDDEN IN PRINT)                          */}
      {/* ========================================================= */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Back button & info */}
          <div className="flex items-center gap-3">
            <Link
              href="/print/queue"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              title="العودة لقائمة الطباعة"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>

            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                معاينة بوالص الشحن للطباعة
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي <strong className="text-slate-800 font-bold">{orders.length}</strong> بوليصة
                {" ⟵ "}
                <span className="font-semibold text-blue-600">
                  {totalPages} {totalPages === 1 ? "صفحة" : "صفحات"} A4
                </span>
              </p>
            </div>
          </div>

          {/* Mode Selector & Print CTA */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode(3)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  mode === 3
                    ? "bg-white text-blue-700 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>3 بوالص / صفحة (افتراضي)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(2)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  mode === 2
                    ? "bg-white text-blue-700 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2 بوليصة / صفحة (موسعة)</span>
              </button>
            </div>

            {/* Quick action: Mark as printed */}
            <button
              onClick={() => handleConfirmPrinted()}
              disabled={isPending}
              className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span>نقل للأرشيف كـ تمت الطباعة</span>
            </button>

            {/* Primary Print Button */}
            <button
              onClick={handlePrint}
              className="px-5 py-2 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الآن (Ctrl + P)</span>
            </button>
          </div>
        </div>

        {/* OVERFLOW WARNING BANNER (When mode 3 and orders have long content) */}
        {hasOverflow && mode === 3 && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-sm mb-0.5">
                تنبيه كثافة البيانات (حماية من التجاوز)
              </span>
              <span>
                تم رصد <strong>{overflowingOrders.length}</strong> بوليصة تحتوي على عناوين أو
                ملاحظات تفصيلية طويلة. لتجنب أي تداخل في الورق وضمان وضوح فائق، نوصي بالتبديل إلى نمط:
              </span>
              <button
                onClick={() => setMode(2)}
                className="mr-2 inline-flex items-center gap-1 font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
              >
                (2 بوليصة في الصفحة)
              </button>
            </div>
          </div>
        )}

        {/* Success Alert if marked as done */}
        {markedDone && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>تم بنجاح نقل البوالص إلى أرشيف المطبوعات! جاري تحويلك للأرشيف...</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* POST-PRINT CONFIRMATION MODAL                              */}
      {/* ========================================================= */}
      {showConfirmModal && !markedDone && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Printer className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              هل تمت طباعة البوالص بنجاح؟
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              إذا كانت الطباعة خرجت من الطابعة بشكل سليم، يمكنك نقل هذه البوالص ({orders.length} بوليصة)
              مباشرة إلى أرشيف المطبوعات لتنظيف قائمة الانتظار.
            </p>

            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={handleConfirmPrinted}
                disabled={isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                نعم، نقل للأرشيف
              </button>

              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                إبقاء في قائمة الانتظار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINTABLE A4 PAGES CONTAINER                               */}
      {/* ========================================================= */}
      <div className="space-y-8 print:space-y-0 flex flex-col items-center">
        {pages.map((pageOrders, pageIndex) => (
          <div
            key={`page-${pageIndex}`}
            className="print-page w-full max-w-[210mm] bg-white border border-slate-300 shadow-lg rounded-xl p-3 print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none flex flex-col justify-between"
            style={{
              minHeight: "285mm",
              boxSizing: "border-box",
            }}
          >
            {/* Page Header Indicator (Hidden in print) */}
            <div className="no-print pb-2 mb-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span>Falcon Shipping - معاينة صفحة A4</span>
              <span>
                صفحة {pageIndex + 1} من {totalPages}
              </span>
            </div>

            {/* Render labels on this page */}
            <div className="flex-1 flex flex-col justify-between">
              {pageOrders.map((order, orderIdx) => (
                <ShippingLabel
                  key={order.id}
                  order={order}
                  mode={mode}
                  logoUrl={logoUrl}
                  companyName={companyName}
                  showCutLine={orderIdx < pageOrders.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PrintPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">جاري تحميل معاينة الطباعة...</p>
        </div>
      }
    >
      <PrintPreviewContent />
    </Suspense>
  );
}
