"use client";

import React, { useState } from "react";
import {
  X,
  Download,
  Loader2,
  CheckCircle2,
  Truck,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  PackageCheck,
  Info,
} from "lucide-react";
import { CARRIER_TEMPLATES, CarrierType, CarrierExportOptions } from "@/lib/excel";
import { formatEgp } from "@/lib/calculations";

interface CarrierExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds?: string[];
  totalFilteredCount?: number;
  totalFilteredCod?: number;
  // Filter context for bulk exporting filtered sets
  search?: string;
  printStatus?: string;
  deliveryStatus?: string;
  settlementStatus?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  // Callback after successful export (e.g. to reload data if status was updated)
  onExportSuccess?: () => void;
}

export function CarrierExportModal({
  isOpen,
  onClose,
  selectedIds = [],
  totalFilteredCount = 0,
  totalFilteredCod = 0,
  search = "",
  printStatus = "",
  deliveryStatus = "",
  settlementStatus = "",
  paymentStatus = "",
  startDate = "",
  endDate = "",
  onExportSuccess,
}: CarrierExportModalProps) {
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierType>("bosta");
  const [exportMode, setExportMode] = useState<"selected" | "filtered" | "all">(
    selectedIds.length > 0 ? "selected" : "filtered"
  );
  const [updateStatusToHanded, setUpdateStatusToHanded] = useState(true);
  const [allowOpenPackage, setAllowOpenPackage] = useState(true);
  const [packageDescription, setPackageDescription] = useState("منتجات تجزئة / ملابس");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const countToExport =
    exportMode === "selected"
      ? selectedIds.length
      : exportMode === "filtered"
      ? totalFilteredCount
      : "كل الشحنات المصرح بها";

  const handleExport = async () => {
    if (exportMode === "selected" && selectedIds.length === 0) {
      setError("لم يتم تحديد أي أوردرات للتصدير");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        mode: exportMode,
        carrier: selectedCarrier,
        selectedIds: exportMode === "selected" ? selectedIds : [],
        search,
        printStatus: printStatus === "all" ? undefined : printStatus,
        deliveryStatus: deliveryStatus === "all" ? undefined : deliveryStatus,
        settlementStatus: settlementStatus === "all" ? undefined : settlementStatus,
        paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
        startDate,
        endDate,
        updateStatusToHanded,
        options: {
          allowOpenPackage,
          defaultPackageDescription: packageDescription,
        } as CarrierExportOptions,
      };

      const res = await fetch("/api/orders/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "فشل تصدير كشف الشحنات");
      }

      // Extract filename from header if available
      const disposition = res.headers.get("Content-Disposition");
      let filename = `${CARRIER_TEMPLATES[selectedCarrier].filePrefix}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMessage(
        updateStatusToHanded
          ? `تم تحميل الملف وتحديث حالة الشحنات إلى "تم التسليم لشركة الشحن"`
          : `تم تصدير وتحميل الملف بنجاح`
      );

      if (onExportSuccess) {
        onExportSuccess();
      }

      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء التصدير";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const carrierOptions: CarrierType[] = ["bosta", "jt", "aramex", "mylerz", "standard", "carrier_settlement"];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">تصدير كشوف الشحن (Multi-Carrier Export)</h3>
              <p className="text-xs text-indigo-200/80">
                جهّز كشوفات إكسيل متوافقة 100% مع بوابات شركات الشحن (Bosta, J&T, Aramex, Mylerz)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Target Carrier Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2.5">
              1. اختر شركة الشحن أو نوع الكشف المطلوب:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {carrierOptions.map((cid) => {
                const info = CARRIER_TEMPLATES[cid];
                const isSelected = selectedCarrier === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => setSelectedCarrier(cid)}
                    className={`text-right p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-600/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isSelected ? "bg-indigo-600" : "bg-slate-300"
                          }`}
                        />
                        <span className="text-sm font-bold text-slate-900">{info.nameAr}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        .{info.filePrefix.split("_")[0]}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {info.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Range / Mode Selection */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              2. نطاق البيانات المحددة للتصدير:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExportMode("selected")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    exportMode === "selected"
                      ? "bg-white text-indigo-700 border-indigo-600 shadow-sm ring-1 ring-indigo-500/20"
                      : "bg-transparent text-slate-600 border-slate-200 hover:bg-white"
                  }`}
                >
                  المحددة فقط ({selectedIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setExportMode("filtered")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  exportMode === "filtered"
                    ? "bg-white text-indigo-700 border-indigo-600 shadow-sm ring-1 ring-indigo-500/20"
                    : "bg-transparent text-slate-600 border-slate-200 hover:bg-white"
                }`}
              >
                النتائج المفلترة ({totalFilteredCount})
              </button>
              <button
                type="button"
                onClick={() => setExportMode("all")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  exportMode === "all"
                    ? "bg-white text-indigo-700 border-indigo-600 shadow-sm ring-1 ring-indigo-500/20"
                    : "bg-transparent text-slate-600 border-slate-200 hover:bg-white"
                }`}
              >
                جميع الطلبات
              </button>
            </div>
          </div>

          {/* Carrier-specific Options & Status Workflow */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              3. خيارات التتبع والتسليم التلقائي:
            </label>

            {/* Auto status update toggle */}
            <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex items-start gap-3">
              <input
                id="update-status-check"
                type="checkbox"
                checked={updateStatusToHanded}
                onChange={(e) => setUpdateStatusToHanded(e.target.checked)}
                className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="update-status-check" className="cursor-pointer text-xs space-y-1">
                <span className="font-bold text-emerald-950 block">
                  تحديث حالة الطلبات تلقائياً إلى: &quot;تم التسليم لشركة الشحن&quot;
                </span>
                <span className="text-emerald-700 block text-[11px] leading-relaxed">
                  مهم جداً: يساعدك في معرفة أي الأوردرات خرجت للشحن فعلياً وحساب مستحقاتك بدقة من شركات
                  الشحن لاحقاً.
                </span>
              </label>
            </div>

            {/* Carrier Template Custom Inputs */}
            {(selectedCarrier === "bosta" || selectedCarrier === "jt") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    وصف محتوى الطرد الافتراضي:
                  </label>
                  <input
                    type="text"
                    value={packageDescription}
                    onChange={(e) => setPackageDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="مثال: ملابس، إلكترونيات، أحذية..."
                  />
                </div>

                {selectedCarrier === "bosta" && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      id="allow-open-check"
                      type="checkbox"
                      checked={allowOpenPackage}
                      onChange={(e) => setAllowOpenPackage(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label
                      htmlFor="allow-open-check"
                      className="cursor-pointer text-xs font-bold text-slate-700"
                    >
                      السماح للعميل بفتح الشحنة والمعاينة قبل الاستلام
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feedback & Alerts */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            سيتم تصدير: <span className="font-bold text-slate-800">{countToExport}</span> أوردر
            {totalFilteredCod > 0 && exportMode !== "selected" && (
              <span className="mr-2 text-indigo-600 font-bold">
                (COD: {formatEgp(totalFilteredCod)})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تجهيز الكشف...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>تصدير ملف Excel</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
