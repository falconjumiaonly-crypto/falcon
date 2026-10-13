"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  X,
  Truck,
  User,
  Phone,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  Copy,
  Download,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  generateDeliveryManifest,
  DeliveryManifestData,
} from "@/lib/printQueueOrchestrator";
import {
  printManifestIsolated,
  openManifestPrintPage,
} from "@/lib/printManifestHelper";

interface CourierManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onHandoverSuccess?: () => void;
  onHandoverAction?: (orderIds: string[], carrierName: string) => Promise<boolean>;
}

export function CourierManifestModal({
  isOpen,
  onClose,
  orders,
  onHandoverSuccess,
  onHandoverAction,
}: CourierManifestModalProps) {
  const [carrierName, setCarrierName] = useState("بوسطة (Bosta)");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [isHandingOver, setIsHandingOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen || orders.length === 0 || !isMounted) return null;

  const manifestData: DeliveryManifestData = generateDeliveryManifest(orders, {
    carrierName,
    driverName,
    driverPhone,
  });

  const handlePrint = () => {
    openManifestPrintPage(
      orders.map((o) => o.id),
      {
        carrierName,
        driverName,
        driverPhone,
        autoPrint: true,
      }
    );
  };

  const handleCopySummary = () => {
    const govSummaryText = manifestData.governoratesSummary
      .map((g) => `• ${g.governorate}: ${g.count} طرد (${formatEgp(g.cod)})`)
      .join("\n");

    const text = `📦 مانيفست تسليم شحنات - Falcon Shipping
📋 كود المانيفست: ${manifestData.manifestNumber}
🚚 شركة الشحن: ${carrierName || "غير محدد"}
👤 المندوب: ${driverName || "لم يحدد"} ${driverPhone ? `(${driverPhone})` : ""}
📅 التاريخ: ${new Date().toLocaleDateString("ar-EG")}
📦 إجمالي الطرود: ${manifestData.totalOrdersCount} شحنة
💰 إجمالي تحصيل COD: ${formatEgp(manifestData.totalCodAmount)}

توزيع المحافظات:
${govSummaryText}`;

    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

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

  const handleHandoverAndPrint = async () => {
    if (onHandoverAction) {
      setIsHandingOver(true);
      setStatusMessage(null);
      try {
        const orderIds = orders.map((o) => o.id);
        const success = await onHandoverAction(orderIds, carrierName);
        if (success) {
          setStatusMessage("تم تسليم الشحنات للمندوب بنجاح ونقلها لحالة الشحن!");
          if (onHandoverSuccess) {
            onHandoverSuccess();
          }
          openManifestPrintPage(orderIds, {
            carrierName,
            driverName,
            driverPhone,
            autoPrint: true,
          });
        } else {
          setStatusMessage("حدث خطأ أثناء تحديث حالة الشحنات");
        }
      } catch {
        setStatusMessage("حدث خطأ غير متوقع أثناء تسليم الشحنات");
      } finally {
        setIsHandingOver(false);
      }
    } else {
      handlePrint();
    }
  };

  return createPortal(
    <div
      id="falcon-manifest-modal-portal-root"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible"
    >
      {/* Dynamic Print Stylesheet for Clean Manifest Output */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .no-print-manifest, .no-print {
                display: none !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .manifest-signatures {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              @page {
                size: A4 portrait;
                margin: 10mm 8mm;
              }
            }
          `,
        }}
      />

      <div className="manifest-modal-card-wrapper bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:overflow-visible">
        {/* Modal Header (Hidden in Print) */}
        <div className="no-print-manifest bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">
                كشف وبيان تسليم الشحنات لمندوب الشحن (Delivery Manifest)
              </h2>
              <p className="text-xs text-slate-400">
                إجمالي <strong className="text-white">{orders.length}</strong> شحنة جاهزة للتسليم والتوقيع
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Manifest Config Toolbar (Hidden in Print) */}
        <div className="no-print-manifest bg-slate-50 border-b border-slate-200 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>شركة الشحن:</span>
            </label>
            <input
              type="text"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              placeholder="بوسطة / جي آند تي / أرامكس"
              list="manifest-carrier-suggestions"
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <datalist id="manifest-carrier-suggestions">
              <option value="بوسطة (Bosta)" />
              <option value="جي آند تي (J&T Express)" />
              <option value="أرامكس (Aramex)" />
              <option value="فاستلو (Fastlo)" />
              <option value="مندوب خاص (Direct Courier)" />
              <option value="البريد المصري (Egypt Post)" />
              <option value="شيب كاش (ShipCash)" />
              <option value="مشاوير (Mashaweer)" />
              <option value="رابيدو (Rapido)" />
            </datalist>
          </div>

          <div>
            <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>اسم المندوب المستلم:</span>
            </label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="اختياري - اسم الكابتن"
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              <span>هاتف المندوب:</span>
            </label>
            <input
              type="text"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div className="no-print-manifest mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Printable Manifest Sheet Content */}
        <div
          id="courier-manifest-content"
          className="flex-1 overflow-y-auto p-4 sm:p-6 text-slate-900 bg-white font-sans text-xs print:overflow-visible print:p-0 print:h-auto"
          dir="rtl"
        >
          {/* Manifest Official Header */}
          <div className="border-b-2 border-black pb-4 mb-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-black text-white rounded font-black text-xs flex items-center justify-center">
                  FAL
                </div>
                <h1 className="text-xl font-black tracking-tight">
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
                {carrierName || "مندوب الشحن"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 font-bold block">
                المندوب المستلم:
              </span>
              <span className="font-bold text-xs block">
                {driverName || "لم يحدد"} {driverPhone ? `(${driverPhone})` : ""}
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

        {/* Modal Bottom Actions (Hidden in Print) */}
        <div className="no-print-manifest bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="نسخ ملخص بيانات المانيفست لمشاركتها عبر واتساب"
            >
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span>{copyFeedback ? "تم النسخ بنجاح!" : "نسخ الملخص"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="تحميل كشف المانيفست بصيغة ملف Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>تصدير CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              إغلاق
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف فقط (A4)</span>
            </button>

            {onHandoverAction && (
              <button
                type="button"
                onClick={handleHandoverAndPrint}
                disabled={isHandingOver}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                <span>
                  {isHandingOver ? "جاري التسليم..." : "طباعة وتسليم للمندوب فوراً"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
