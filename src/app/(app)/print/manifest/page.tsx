"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Printer,
  ArrowRight,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Truck,
  User,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  generateDeliveryManifest,
  DeliveryManifestData,
} from "@/lib/printQueueOrchestrator";
import { getOrdersByIdsAction } from "@/app/actions/orders";

function DeliveryManifestPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawIds = searchParams.get("ids");
  const carrierParam = searchParams.get("carrier") || "بوسطة (Bosta)";
  const driverParam = searchParams.get("driver") || "";
  const phoneParam = searchParams.get("phone") || "";
  const autoPrint = searchParams.get("auto") === "1" || searchParams.get("auto") === "true";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      if (!rawIds) {
        setError("لم يتم تحديد أي شحنات لعرض الكشف");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const idList = rawIds.split(",").map((id) => id.trim()).filter(Boolean);
        if (idList.length === 0) {
          setError("قائمة الشحنات فارغة");
          setLoading(false);
          return;
        }

        const res = await getOrdersByIdsAction(idList);
        if (res.success && res.data) {
          setOrders(res.data);
        } else {
          setError(res.error || "تعذر تحميل بيانات الشحنات المحددة");
        }
      } catch {
        setError("حدث خطأ غير متوقع أثناء تحميل بيانات الكشف");
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [rawIds]);

  // Trigger print after render if autoPrint requested
  useEffect(() => {
    if (!loading && orders.length > 0 && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, orders, autoPrint]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-700">جاري تجهيز كشف تسليم الشحنات (A4)...</p>
      </div>
    );
  }

  if (error || orders.length === 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">تعذر عرض الكشف</h2>
        <p className="text-xs text-slate-500 mb-4">{error || "لا توجد شحنات مطابقة"}</p>
        <Link
          href="/orders"
          className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowRight className="w-4 h-4 ml-1" />
          <span>الرجوع لجدول الطلبات</span>
        </Link>
      </div>
    );
  }

  const manifestData: DeliveryManifestData = generateDeliveryManifest(orders, {
    carrierName: carrierParam,
    driverName: driverParam,
    driverPhone: phoneParam,
  });

  const handleExportCsv = () => {
    const headers = [
      "م",
      "كود الشحنة",
      "اسم العميل",
      "الهاتف الأساسي",
      "الهاتف الإضافي",
      "المحافظة",
      "العنوان بالتفصيل",
      "المبلغ المطلوب (COD)",
      "ملاحظات",
    ];

    const rows = manifestData.orders.map((o, idx) => [
      String(idx + 1),
      o.id.slice(0, 8).toUpperCase(),
      `"${(o.customer_name || "").replace(/"/g, '""')}"`,
      `"${o.phone_primary || ""}"`,
      `"${o.phone_secondary || ""}"`,
      `"${o.governorate || ""}"`,
      `"${(o.address || "").replace(/"/g, '""')}"`,
      String(o.cod_amount || 0),
      `"${(o.important_notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `manifest-${manifestData.manifestNumber}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:m-0 print:p-0">
      {/* Top Action Toolbar (Hidden in Print) */}
      <div className="no-print bg-slate-900 text-white p-3 sm:p-4 sticky top-0 z-40 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4 ml-1" />
            <span>الرجوع للطلبات</span>
          </Link>
          <div className="h-5 w-px bg-slate-700 hidden sm:block" />
          <div>
            <h1 className="text-sm font-black flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>كشف وبيان تسليم الشحنات (A4 Manifest)</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
              {manifestData.manifestNumber} &bull; {orders.length} شحنة &bull; COD: {formatEgp(manifestData.totalCodAmount)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>تصدير CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition-all shadow-md shadow-blue-500/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الكشف الآن (A4)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Viewport */}
      <div className="max-w-[210mm] mx-auto my-4 p-4 sm:p-8 bg-white shadow-xl border border-slate-200 rounded-2xl print:max-w-none print:m-0 print:p-0 print:shadow-none print:border-none print:rounded-none">
        <div id="courier-manifest-content" className="text-slate-900 bg-white font-sans text-xs" dir="rtl">
          {/* Manifest Official Header */}
          <div className="border-b-2 border-black pb-4 mb-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-black text-white rounded font-black text-xs flex items-center justify-center">
                  FAL
                </div>
                <h1 className="text-xl font-black tracking-tight text-black">
                  كشف وبيان تسليم طرود لشركة الشحن
                </h1>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">
                وثيقة رسمية لإثبات تسليم الشحنات والتحصيلات النقدية المستحقة (COD)
              </p>
            </div>

            <div className="text-left font-mono" dir="ltr">
              <span className="text-xs font-black block text-black">
                {manifestData.manifestNumber}
              </span>
              <span className="text-[10px] text-slate-600 block mt-0.5">
                {new Date().toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Info & Dispatch Meta Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-300 p-3 rounded-lg mb-4 text-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block">
                شركة الشحن / الجهة:
              </span>
              <span className="font-black text-sm block truncate">
                {carrierParam || "مندوب الشحن"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold block">
                المندوب المستلم:
              </span>
              <span className="font-bold text-xs block">
                {driverParam || "لم يحدد"} {phoneParam ? `(${phoneParam})` : ""}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold block">
                إجمالي عدد الطرود:
              </span>
              <span className="font-black text-sm text-blue-800 block">
                {manifestData.totalOrdersCount} شحنة
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold block">
                إجمالي تحصيل COD المطلوب:
              </span>
              <span className="font-black text-sm text-emerald-800 block font-mono">
                {formatEgp(manifestData.totalCodAmount)}
              </span>
            </div>
          </div>

          {/* Governorate Breakdown Pills */}
          <div className="mb-4">
            <span className="text-[11px] font-black text-slate-700 block mb-1.5">
              توزيع الشحنات حسب المحافظات:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {manifestData.governoratesSummary.map((item) => (
                <span
                  key={item.governorate}
                  className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold text-slate-800"
                >
                  {item.governorate}: <strong>{item.count}</strong> طرد (
                  {formatEgp(item.cod)})
                </span>
              ))}
            </div>
          </div>

          {/* Detailed Orders Table */}
          <table className="w-full border-collapse border border-black text-right text-[11px] mb-6">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-black text-black font-black">
                <th className="border border-black p-1.5 w-8 text-center">م</th>
                <th className="border border-black p-1.5 w-24">كود الشحنة</th>
                <th className="border border-black p-1.5">اسم العميل</th>
                <th className="border border-black p-1.5">رقم الهاتف</th>
                <th className="border border-black p-1.5">المحافظة والعنوان</th>
                <th className="border border-black p-1.5 w-24 text-left font-mono">
                  المطلوب (COD)
                </th>
                <th className="border border-black p-1.5 w-28">ملاحظات المندوب</th>
                <th className="border border-black p-1.5 w-12 text-center">استلام</th>
              </tr>
            </thead>
            <tbody>
              {manifestData.orders.map((order, idx) => (
                <tr key={order.id} className="border-b border-slate-300">
                  <td className="border border-black p-1.5 text-center font-bold">
                    {idx + 1}
                  </td>
                  <td className="border border-black p-1.5 font-mono font-bold">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="border border-black p-1.5 font-bold">
                    {order.customer_name}
                  </td>
                  <td className="border border-black p-1.5 font-mono" dir="ltr">
                    {order.phone_primary}
                    {order.phone_secondary && (
                      <span className="block text-[9px] text-slate-500">
                        {order.phone_secondary}
                      </span>
                    )}
                  </td>
                  <td className="border border-black p-1.5">
                    <span className="font-bold underline ml-1">
                      {order.governorate}:
                    </span>
                    <span>{order.address}</span>
                  </td>
                  <td
                    className="border border-black p-1.5 text-left font-mono font-black text-black"
                    dir="ltr"
                  >
                    {order.cod_amount === 0 ? "مدفوع (0)" : formatEgp(order.cod_amount)}
                  </td>
                  <td className="border border-black p-1.5 text-[10px] text-slate-600">
                    {order.important_notes || "-"}
                  </td>
                  <td className="border border-black p-1.5 text-center">
                    <div className="w-4 h-4 border border-black mx-auto rounded-sm"></div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black border-t-2 border-black">
                <td colSpan={5} className="border border-black p-2 text-right">
                  الإجمالي العام (عدد {manifestData.totalOrdersCount} شحنة):
                </td>
                <td
                  colSpan={3}
                  className="border border-black p-2 text-left font-mono text-sm"
                  dir="ltr"
                >
                  {formatEgp(manifestData.totalCodAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Legal Acknowledgement & Signatures */}
          <div className="manifest-signatures border border-black p-3 rounded-lg grid grid-cols-2 gap-6 mt-4">
            <div className="space-y-4">
              <span className="font-black block text-xs underline">
                إقرار وتوقيع مسؤول المتجر / الراسل:
              </span>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                أقر بأني قمت بتسليم عدد ({manifestData.totalOrdersCount}) طرد سليم ومغلق
                إلى مندوب شركة الشحن المذكورة بياناته أعلاه.
              </p>
              <div className="pt-4 border-t border-dashed border-slate-400 flex justify-between text-[11px] font-bold">
                <span>اسم المسؤول: ........................</span>
                <span>التوقيع: ........................</span>
              </div>
            </div>

            <div className="space-y-4">
              <span className="font-black block text-xs underline">
                إقرار واستلام مندوب شركة الشحن:
              </span>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                استلمت أنا المندوب المذكور أعلاه الطرود الموضحة بهذا الكشف وعددها (
                {manifestData.totalOrdersCount}) بحالة سليمة وأتعهد بتوريد تحصيلات الـ
                COD وقيمتها ({formatEgp(manifestData.totalCodAmount)}) وفق سياسة
                الشركة.
              </p>
              <div className="pt-4 border-t border-dashed border-slate-400 flex justify-between text-[11px] font-bold">
                <span>اسم المندوب: ........................</span>
                <span>التوقيع: ........................</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeliveryManifestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm font-bold text-slate-700">جاري تحميل كشف التسليم...</p>
        </div>
      }
    >
      <DeliveryManifestPrintContent />
    </Suspense>
  );
}
