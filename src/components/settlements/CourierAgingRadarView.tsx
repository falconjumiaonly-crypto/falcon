"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  AlertTriangle,
  ShieldAlert,
  Coins,
  Truck,
  Copy,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  FileText,
  Check,
  Building,
  Loader2,
  X,
} from "lucide-react";
import {
  CourierAgingReport,
  CarrierDebtProfile,
  generateCourierCollectionDemandLetter,
} from "@/lib/settlements/courierAgingEngine";
import {
  getCourierAgingReportAction,
  batchSettleCarrierDebtsAction,
} from "@/app/actions/settlementAlerts";
import { playScanSuccessSound } from "@/lib/sound";

export function CourierAgingRadarView() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<CourierAgingReport | null>(null);
  const [selectedCarrierForLetter, setSelectedCarrierForLetter] = useState<CarrierDebtProfile | null>(null);
  const [managerPhone, setManagerPhone] = useState("");
  const [copiedLetter, setCopiedLetter] = useState(false);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCourierAgingReportAction();
      if (res.success && res.data) {
        setReport(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyLetter = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLetter(true);
      playScanSuccessSound();
      setTimeout(() => setCopiedLetter(false), 2000);
    }
  };

  const handleBatchSettle = async (carrierKey: string, carrierName: string) => {
    if (!confirm(`هل أنت متأكد من تسوية جميع مبالغ شركة ${carrierName} وتأكيد استلامها بحسابك؟`)) {
      return;
    }

    setSettlingKey(carrierKey);
    try {
      const res = await batchSettleCarrierDebtsAction(carrierKey);
      if (res.success && res.data) {
        playScanSuccessSound();
        setSuccessMessage(`تم تسوية ${res.data.settledCount} شحنة بقيمة ${res.data.totalCodSettled.toLocaleString()} ج.م بنجاح!`);
        await loadData();
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch {
      // Ignore
    } finally {
      setSettlingKey(null);
    }
  };

  if (loading && !report) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>جاري تحليل تقادم مستحقات الشحن وفحص ديون الشركات...</span>
      </div>
    );
  }

  if (!report) return null;

  const brackets = report.bracketTotals;
  const totalCod = report.totalUnsettledCod || 1; // avoid divide by zero

  const pct0_7 = Math.round((brackets["0-7"].cod / totalCod) * 100);
  const pct8_14 = Math.round((brackets["8-14"].cod / totalCod) * 100);
  const pct15_30 = Math.round((brackets["15-30"].cod / totalCod) * 100);
  const pct30plus = Math.round((brackets["30+"].cod / totalCod) * 100);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Aging Bar Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              رادار تقادم ديون شركات الشحن (Courier Aging Debt Radar)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              متابعة مبالغ الـ COD المسلّمة للعملاء وحساب أعمار الديون المعلقة لدى الشركات
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث الرادار</span>
          </button>
        </div>

        {/* Visual Progress Bar for Aging Brackets */}
        <div className="space-y-2">
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${pct0_7}%` }}
              className="bg-emerald-500 transition-all"
              title={`0-7 أيام: ${brackets["0-7"].cod.toLocaleString()} ج (${pct0_7}%)`}
            />
            <div
              style={{ width: `${pct8_14}%` }}
              className="bg-amber-400 transition-all"
              title={`8-14 يوم: ${brackets["8-14"].cod.toLocaleString()} ج (${pct8_14}%)`}
            />
            <div
              style={{ width: `${pct15_30}%` }}
              className="bg-orange-500 transition-all"
              title={`15-30 يوم: ${brackets["15-30"].cod.toLocaleString()} ج (${pct15_30}%)`}
            />
            <div
              style={{ width: `${pct30plus}%` }}
              className="bg-rose-600 transition-all animate-pulse"
              title={`+30 يوم: ${brackets["30+"].cod.toLocaleString()} ج (${pct30plus}%)`}
            />
          </div>

          {/* Legend and bracket amounts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>0 - 7 أيام (حديثة)</span>
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                {brackets["0-7"].cod.toLocaleString()} ج
                <span className="text-[10px] text-slate-400 font-normal mr-1">({brackets["0-7"].count} أوردر)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>8 - 14 يوم (مستحقة)</span>
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                {brackets["8-14"].cod.toLocaleString()} ج
                <span className="text-[10px] text-slate-400 font-normal mr-1">({brackets["8-14"].count} أوردر)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span>15 - 30 يوم (متأخرة ⚠️)</span>
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                {brackets["15-30"].cod.toLocaleString()} ج
                <span className="text-[10px] text-slate-400 font-normal mr-1">({brackets["15-30"].count} أوردر)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                <span>أكثر من 30 يوم (حرجة 🚨)</span>
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                {brackets["30+"].cod.toLocaleString()} ج
                <span className="text-[10px] text-slate-400 font-normal mr-1">({brackets["30+"].count} أوردر)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carrier Debt Profiles Grid */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          موقف شركات الشحن والمبالغ المعلقة لكل شركة:
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(report.carrierProfiles).map((prof) => {
            const overdueSum = prof.overdueCod + prof.criticalCod;
            const overdueCountSum = prof.overdueCount + prof.criticalCount;

            return (
              <div
                key={prof.carrierKey}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${
                  prof.riskStatus === "critical"
                    ? "border-rose-300 dark:border-rose-800 shadow-rose-100 dark:shadow-none"
                    : prof.riskStatus === "overdue"
                    ? "border-amber-300 dark:border-amber-800"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <Truck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {prof.carrierName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {prof.totalUnsettledCount} شحنة مسلّمة معلقة
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      prof.riskStatus === "critical"
                        ? "bg-rose-100 text-rose-700 border-rose-300 animate-pulse"
                        : prof.riskStatus === "overdue"
                        ? "bg-amber-100 text-amber-700 border-amber-300"
                        : "bg-emerald-100 text-emerald-700 border-emerald-300"
                    }`}
                  >
                    {prof.riskStatus === "critical"
                      ? "ديون حرجة 🚨"
                      : prof.riskStatus === "overdue"
                      ? "متأخرة ⚠️"
                      : "دورة منتظمة ✅"}
                  </span>
                </div>

                {/* Key Numbers */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">إجمالي المستحق:</span>
                    <span className="font-black text-sm text-slate-900 dark:text-white mt-0.5 block">
                      {prof.totalUnsettledCod.toLocaleString()} ج
                    </span>
                  </div>
                  <div>
                    <span className="text-rose-600 text-[11px] block font-semibold">متأخر (+14 يوم):</span>
                    <span className="font-black text-sm text-rose-600 mt-0.5 block">
                      {overdueSum.toLocaleString()} ج
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>أقدم شحنة مسلّمة:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    منذ {prof.oldestDeliveryDays} يوم ({new Date(prof.oldestDeliveryDate).toLocaleDateString("ar-EG")})
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedCarrierForLetter(prof)}
                    className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>خطاب المطالبة</span>
                  </button>

                  <button
                    onClick={() => handleBatchSettle(prof.carrierKey, prof.carrierName)}
                    disabled={settlingKey === prof.carrierKey || prof.totalUnsettledCount === 0}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    title="تأكيد تحصيل وتسوية مبالغ هذه الشركة"
                  >
                    {settlingKey === prof.carrierKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>تسوية</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demand Letter Modal */}
      {selectedCarrierForLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  خطاب المطالبة المالية الرسمي: {selectedCarrierForLetter.carrierName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCarrierForLetter(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                يمكنك نسخ هذا الخطاب وإرساله لإدارة الحسابات أو عبر واتساب لمسؤول الشركة للمطالبة الفورية:
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                {generateCourierCollectionDemandLetter(selectedCarrierForLetter)}
              </div>

              {/* Phone input for direct WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رقم هاتف مدير الحسابات أو منسق الشركة (اختياري):
                </label>
                <input
                  type="tel"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => handleCopyLetter(generateCourierCollectionDemandLetter(selectedCarrierForLetter))}
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedLetter ? "تم النسخ بنجاح! ✓" : "نسخ الخطاب بالكامل"}</span>
                </button>

                {managerPhone && (
                  <a
                    href={`https://wa.me/2${managerPhone.replace(/^0/, "")}?text=${encodeURIComponent(
                      generateCourierCollectionDemandLetter(selectedCarrierForLetter)
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>إرسال واتساب</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
