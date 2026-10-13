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
  Sliders,
  Barcode,
  Eye,
  Phone,
  MapPin,
  Package,
} from "lucide-react";
import { Order } from "@/types/database";
import {
  calculatePrintPagesCount,
  checkOrderPrintOverflow,
} from "@/lib/calculations";
import { getOrdersAction, getOrdersByIdsAction, batchUpdatePrintStatusAction } from "@/app/actions/orders";
import { getAppSettingsAction } from "@/app/actions/settings";
import { ShippingLabel, PrintLayoutMode } from "@/components/printing/ShippingLabel";

function PrintPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawIds = searchParams.get("ids");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>("فلكون للشحن");
  const [merchantPhone, setMerchantPhone] = useState<string>("");
  const [returnAddress, setReturnAddress] = useState<string>("");

  // Printing mode: "thermal_4x6" | 3 | 2 | 4
  const [mode, setMode] = useState<PrintLayoutMode>("thermal_4x6");
  const [isPending, startTransition] = useTransition();

  // Print customization options
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);
  const [showBarcode, setShowBarcode] = useState(true);
  const [allowInspection, setAllowInspection] = useState(true);
  const [customPackageDesc, setCustomPackageDesc] = useState("");

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
      if (res.success && res.data) {
        if (res.data.branding) {
          setLogoUrl(res.data.branding.logo_url || null);
          setCompanyName(res.data.branding.company_name || "فلكون للشحن");
        }
        if (res.data.companyInfo) {
          setMerchantPhone(res.data.companyInfo.sender_phone || "");
          setReturnAddress(res.data.companyInfo.return_address || "");
        }
      }
    });
  }, [rawIds]);

  // Check overflow across orders (relevant in A4 mode 3)
  const overflowingOrders = orders.filter(checkOrderPrintOverflow);
  const hasOverflow = overflowingOrders.length > 0;

  // Split orders into pages according to chosen mode
  const totalPages = calculatePrintPagesCount(orders.length, mode);
  const pages: Order[][] = [];
  const perPage = typeof mode === "number" ? mode : 1;
  for (let i = 0; i < orders.length; i += perPage) {
    pages.push(orders.slice(i, i + perPage));
  }

  // Handle Trigger Print
  const handlePrint = () => {
    window.print();
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
      {/* DYNAMIC MEDIA PRINT STYLESHEET                            */}
      {/* ========================================================= */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              ${
                mode === "thermal_4x6"
                  ? `
                @page {
                  size: 100mm 150mm;
                  margin: 0;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-page-thermal {
                  width: 100mm !important;
                  max-width: 100mm !important;
                  height: 150mm !important;
                  min-height: 150mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  page-break-after: always !important;
                  break-after: page !important;
                }
              `
                  : `
                @page {
                  size: A4 portrait;
                  margin: ${mode === 4 ? "5mm" : "8mm 6mm"};
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-page-a4 {
                  width: 100% !important;
                  max-width: 210mm !important;
                  height: 285mm !important;
                  min-height: 285mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  page-break-after: always !important;
                  break-after: page !important;
                }
              `
              }
            }
          `,
        }}
      />

      {/* ========================================================= */}
      {/* TOP CONTROL BAR (HIDDEN IN PRINT)                         */}
      {/* ========================================================= */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
              <h1 className="text-lg font-black text-slate-900 leading-tight">
                محرك طباعة البوالص المتطور
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي <strong className="text-slate-800 font-bold">{orders.length}</strong> بوليصة
                {" ⟵ "}
                <span className="font-bold text-blue-600">
                  {totalPages} {mode === "thermal_4x6" ? "ملصق حراري" : "صفحة A4"}
                </span>
              </p>
            </div>
          </div>

          {/* Mode Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Mode Switcher Pill */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode("thermal_4x6")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  mode === "thermal_4x6"
                    ? "bg-white text-blue-700 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="لطابعات الرول الحرارية (Xprinter, Zebra, HPRT)"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>حراري 4×6 (A6)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(3)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  mode === 3
                    ? "bg-white text-blue-700 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="A4 عادي مقسم 3 بوالص"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>A4 (3 بوالص)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(2)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  mode === 2
                    ? "bg-white text-blue-700 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="A4 مقسم بوليصتين كبيرتين"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>A4 (2 بوليصة)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode(4)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  mode === 4
                    ? "bg-white text-blue-700 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="ورق ملصقات لاصق مقسم 4 خانات (2x2)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>A4 ملصقات (4 شبكة)</span>
              </button>
            </div>

            {/* Toggle Settings Button */}
            <button
              type="button"
              onClick={() => setShowOptionsPanel(!showOptionsPanel)}
              className={`p-2 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5 ${
                showOptionsPanel
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="تخصيص الباركود والبيانات"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">خيارات</span>
            </button>

            {/* Quick action: Mark as printed */}
            <button
              onClick={() => handleConfirmPrinted()}
              disabled={isPending}
              className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span className="hidden sm:inline">نقل للأرشيف كـ تمت الطباعة</span>
              <span className="sm:hidden">أرشفة</span>
            </button>

            {/* Primary Print Button */}
            <button
              onClick={handlePrint}
              className="px-5 py-2 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة (Ctrl + P)</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CUSTOMIZATION OPTIONS PANEL (COLLAPSIBLE)                 */}
        {/* ========================================================= */}
        {showOptionsPanel && (
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-3 animate-in fade-in duration-150">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>إعدادات تخصيص محتوى البوليصة:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Toggle Barcode */}
              <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={showBarcode}
                  onChange={(e) => setShowBarcode(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <Barcode className="w-4 h-4 text-slate-500" />
                <span className="font-bold">إظهار الباركود (Code 128)</span>
              </label>

              {/* Toggle Allow Inspection */}
              <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={allowInspection}
                  onChange={(e) => setAllowInspection(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <Eye className="w-4 h-4 text-slate-500" />
                <span className="font-bold">شارة &quot;مسموح بالمعاينة&quot;</span>
              </label>

              {/* Sender Phone */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
                  <Phone className="w-3.5 h-3.5" />
                  <span>هاتف الراسل:</span>
                </div>
                <input
                  type="text"
                  value={merchantPhone}
                  onChange={(e) => setMerchantPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full text-xs font-mono px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800"
                />
              </div>

              {/* Custom Package Description */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
                  <Package className="w-3.5 h-3.5" />
                  <span>وصف الطرد العام:</span>
                </div>
                <input
                  type="text"
                  value={customPackageDesc}
                  onChange={(e) => setCustomPackageDesc(e.target.value)}
                  placeholder="مثال: ملابس / إلكترونيات"
                  className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800"
                />
              </div>
            </div>

            {/* Return Address row */}
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-slate-500 font-semibold shrink-0">عنوان المرتجعات:</span>
              <input
                type="text"
                value={returnAddress}
                onChange={(e) => setReturnAddress(e.target.value)}
                placeholder="مثال: القاهرة - مخزن مدينة نصر"
                className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
            </div>
          </div>
        )}

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
              <span className="mx-1">أو نمط</span>
              <button
                onClick={() => setMode("thermal_4x6")}
                className="inline-flex items-center gap-1 font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
              >
                (حراري 4×6)
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
      {/* POST-PRINT CONFIRMATION MODAL                             */}
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
      {/* PRINTABLE CONTAINER (DYNAMIC FOR THERMAL OR A4)           */}
      {/* ========================================================= */}
      {mode === "thermal_4x6" ? (
        /* THERMAL 4x6 ROLL CONTAINER: One label per page */
        <div className="space-y-6 print:space-y-0 flex flex-col items-center">
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={`thermal-page-${pageIndex}`}
              className="print-page-thermal w-full max-w-[100mm] bg-white border border-slate-300 shadow-md rounded-xl p-0 print:border-none print:shadow-none print:rounded-none overflow-hidden"
              style={{
                minHeight: "150mm",
                boxSizing: "border-box",
              }}
            >
              {/* Preview tag hidden in print */}
              <div className="no-print px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[11px] text-slate-500 font-bold flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-blue-600" />
                  <span>رول حراري 4×6 (100×150 مم)</span>
                </span>
                <span>
                  بوليصة {pageIndex + 1} من {orders.length}
                </span>
              </div>

              <ShippingLabel
                order={pageOrders[0]}
                mode="thermal_4x6"
                logoUrl={logoUrl}
                companyName={companyName}
                merchantPhone={merchantPhone}
                returnAddress={returnAddress}
                allowInspection={allowInspection}
                showBarcode={showBarcode}
                packageDescription={customPackageDesc || undefined}
                showCutLine={false}
              />
            </div>
          ))}
        </div>
      ) : (
        /* A4 SHEET CONTAINER (Stacked 3, 2 or 2x2 Grid 4) */
        <div className="space-y-8 print:space-y-0 flex flex-col items-center">
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={`a4-page-${pageIndex}`}
              className="print-page-a4 w-full max-w-[210mm] bg-white border border-slate-300 shadow-lg rounded-xl p-3 print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none flex flex-col justify-between"
              style={{
                minHeight: "285mm",
                boxSizing: "border-box",
              }}
            >
              {/* Page Header Indicator (Hidden in print) */}
              <div className="no-print pb-2 mb-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>
                  Falcon Shipping - معاينة صفحة A4 (
                  {mode === 4
                    ? "شبكة 4 ملصقات 2×2"
                    : mode === 2
                    ? "2 بوليصة موسعة"
                    : "3 بوالص قياسية"}
                  )
                </span>
                <span>
                  صفحة {pageIndex + 1} من {totalPages}
                </span>
              </div>

              {/* Render labels on this page */}
              {mode === 4 ? (
                /* 2x2 Grid for 4-up sticker paper */
                <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 h-full">
                  {pageOrders.map((order) => (
                    <ShippingLabel
                      key={order.id}
                      order={order}
                      mode={4}
                      logoUrl={logoUrl}
                      companyName={companyName}
                      merchantPhone={merchantPhone}
                      returnAddress={returnAddress}
                      allowInspection={allowInspection}
                      showBarcode={showBarcode}
                      packageDescription={customPackageDesc || undefined}
                      showCutLine={false}
                    />
                  ))}
                </div>
              ) : (
                /* Stacked layout for 2 or 3 labels */
                <div className="flex-1 flex flex-col justify-between">
                  {pageOrders.map((order, orderIdx) => (
                    <ShippingLabel
                      key={order.id}
                      order={order}
                      mode={mode}
                      logoUrl={logoUrl}
                      companyName={companyName}
                      merchantPhone={merchantPhone}
                      returnAddress={returnAddress}
                      allowInspection={allowInspection}
                      showBarcode={showBarcode}
                      packageDescription={customPackageDesc || undefined}
                      showCutLine={orderIdx < pageOrders.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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

