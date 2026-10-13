"use client";

import { useState, useTransition, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  Check,
  Search,
  Filter,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Layers,
  ChevronDown,
  Info,
  Clock,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  CarrierSettlementRow,
  ReconciledOrderResult,
  ReconciliationReport,
  ReconciliationStatus,
  parseCourierSettlementRecords,
  reconcileSettlement,
} from "@/lib/settlementReconciliation";
import { applySettlementReconciliationAction } from "@/app/actions/orders";

interface SettlementReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemOrders: Order[];
  onReconciliationApplied: () => void;
}

type FilterTab = "all" | "matched_perfect" | "matched_discrepancy" | "not_found" | "already_settled" | "missing_from_carrier";

export function SettlementReconciliationModal({
  isOpen,
  onClose,
  systemOrders,
  onReconciliationApplied,
}: SettlementReconciliationModalProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [markAsDelivered, setMarkAsDelivered] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  if (!isOpen) return null;

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          setFeedback({ type: "error", message: "الملف فارغ أو لا يحتوي على صفوف بيانات صالحة" });
          return;
        }

        const parsedRows = parseCourierSettlementRecords(rawJson);
        const rep = reconcileSettlement(parsedRows, systemOrders);

        setReport(rep);
        // By default, select all perfect matches
        setSelectedResultIds(rep.summary.readyToSettleOrderIds);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "تعذر قراءة ملف الإكسيل";
        setFeedback({ type: "error", message: `حدث خطأ في فك شفرة الملف: ${msg}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Filtered rows
  const filteredResults = useMemo(() => {
    if (!report) return [];
    return report.results.filter((res) => {
      // Tab filter
      if (activeTab === "matched_perfect" && res.status !== "matched_perfect") return false;
      if (activeTab === "matched_discrepancy" && res.status !== "matched_discrepancy") return false;
      if (activeTab === "not_found" && res.status !== "not_found_in_system") return false;
      if (activeTab === "already_settled" && res.status !== "already_settled") return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = res.orderIdOrRef.toLowerCase().includes(q);
        const matchesName = res.customerName?.toLowerCase().includes(q) || false;
        const matchesPhone = res.phone?.includes(q) || false;
        if (!matchesRef && !matchesName && !matchesPhone) return false;
      }

      return true;
    });
  }, [report, activeTab, searchQuery]);

  // Selection toggle
  const toggleSelectOrder = (orderId: string) => {
    setSelectedResultIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const selectAllEligible = () => {
    if (!report) return;
    const eligibleIds = report.results
      .filter((r) => r.matchedOrder && r.status !== "already_settled")
      .map((r) => r.matchedOrder!.id);

    if (selectedResultIds.length === eligibleIds.length) {
      setSelectedResultIds([]);
    } else {
      setSelectedResultIds(eligibleIds);
    }
  };

  // Apply settlements action
  const handleApplySettlement = () => {
    if (selectedResultIds.length === 0) return;

    startTransition(async () => {
      const res = await applySettlementReconciliationAction(selectedResultIds, {
        markAsDelivered,
        settlementNotes: `تسوية عبر كشف المطابقة: ${fileName || "Excel"}`,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `تم اعتماد وتسوية ${res.data?.updatedCount || selectedResultIds.length} أوردر بنجاح!`,
        });
        setTimeout(() => {
          onReconciliationApplied();
          onClose();
        }, 1500);
      } else {
        setFeedback({
          type: "error",
          message: res.error || "فشل اعتماد التسوية للأوردرات المحددة",
        });
      }
    });
  };

  const resetAll = () => {
    setFileName(null);
    setReport(null);
    setSelectedResultIds([]);
    setFeedback(null);
    setActiveTab("all");
    setSearchQuery("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>مطابقة كشف تسوية شركة الشحن</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Carrier Reconciliation
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ارفع شيت التسوية الوارد من (بوسطة، J&T، أرامكس، مايلرز) لمقارنة التحصيلات ومصاريف الشحن وكشف الفروقات فوراً.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* STEP 1: Upload Carrier Statement */}
          {!report && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-3xl p-10 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-all text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4 shadow-sm">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-800 mb-1">
                اختر أو اسحب ملف كشف الحساب / التسوية من شركة الشحن
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                يدعم صيغ Excel (.xlsx, .xls) و CSV. يتعرف النظام تلقائياً على أعمدة (رقم الشحنة، COD، مصاريف الشحن، الصافي) مهما اختلف تنسيق الشركة.
              </p>

              <label className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 transition-all">
                <FileSpreadsheet className="w-4 h-4" />
                <span>اختيار ملف الإكسيل الآن</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* STEP 2: Reconciliation Dashboard & Review */}
          {report && (
            <div className="space-y-6">
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total Courier Net Payable */}
                <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400">صافي كشف شركة الشحن</div>
                  <div className="text-xl font-black text-blue-400 font-mono mt-1">
                    {formatEgp(report.summary.netCourierPayable)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    تحصيل: {formatEgp(report.summary.totalCourierCod)} | شحن: {formatEgp(report.summary.totalCourierShipping)}
                  </div>
                </div>

                {/* 2. Expected Net */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500">الصافي المتوقع بنظام فلكون</div>
                  <div className="text-xl font-black text-slate-800 font-mono mt-1">
                    {formatEgp(report.summary.netExpectedPayable)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    تحصيل: {formatEgp(report.summary.totalExpectedCod)} | شحن: {formatEgp(report.summary.totalExpectedShipping)}
                  </div>
                </div>

                {/* 3. Discrepancy Variance */}
                <div
                  className={`p-4 rounded-2xl shadow-sm border ${
                    Math.abs(report.summary.netVariance) < 1
                      ? "bg-emerald-50 text-emerald-950 border-emerald-200"
                      : report.summary.netVariance < 0
                      ? "bg-rose-50 text-rose-950 border-rose-200"
                      : "bg-blue-50 text-blue-950 border-blue-200"
                  }`}
                >
                  <div className="text-[11px] font-bold">
                    {report.summary.netVariance < 0
                      ? "عجز مالي في التوريد ⚠️"
                      : report.summary.netVariance > 0
                      ? "فائض توريد لصالحك"
                      : "مطابقة تامة 100% ✨"}
                  </div>
                  <div
                    className={`text-xl font-black font-mono mt-1 ${
                      report.summary.netVariance < 0
                        ? "text-rose-700"
                        : report.summary.netVariance > 0
                        ? "text-blue-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {formatEgp(report.summary.netVariance)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    فرق COD: {formatEgp(report.summary.totalCodDiscrepancy)} | فرق الشحن: {formatEgp(report.summary.totalShippingDiscrepancy)}
                  </div>
                </div>

                {/* 4. Match Ratio */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500">جاهز للتسوية الفورية</div>
                  <div className="text-xl font-black text-emerald-600 font-mono mt-1">
                    {report.summary.perfectMatchesCount} / {report.summary.totalCourierRows}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    فروقات: {report.summary.discrepanciesCount} | غير مسجل: {report.summary.notFoundCount}
                  </div>
                </div>
              </div>

              {/* Warning Banner: Missing System Orders */}
              {report.unsettledSystemOrders.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-amber-900">
                      تنبيه هام: توجد {report.unsettledSystemOrders.length} شحنة معلقة مع شركة الشحن لم يذكرها هذا الكشف!
                    </h4>
                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                      هذه الشحنات مسلّمة لشركة الشحن في نظام فلكون ولم يتم تحويل مستحقاتها في هذا الكشف. يرجى مراجعة مندوب الشركة عنها.
                    </p>
                  </div>
                </div>
              )}

              {/* Filter Tabs & Search Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`px-3 py-1.5 rounded-xl transition-colors ${
                      activeTab === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    الكل ({report.results.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("matched_perfect")}
                    className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 ${
                      activeTab === "matched_perfect"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>مطابق تماماً ({report.summary.perfectMatchesCount})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("matched_discrepancy")}
                    className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 ${
                      activeTab === "matched_discrepancy"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>فروقات مالية ({report.summary.discrepanciesCount})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("not_found")}
                    className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 ${
                      activeTab === "not_found"
                        ? "bg-rose-600 text-white"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>غير مسجل ({report.summary.notFoundCount})</span>
                  </button>
                  {report.summary.alreadySettledCount > 0 && (
                    <button
                      onClick={() => setActiveTab("already_settled")}
                      className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 ${
                        activeTab === "already_settled"
                          ? "bg-blue-600 text-white"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>مسوى مسبقاً ({report.summary.alreadySettledCount})</span>
                    </button>
                  )}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث برقم الأوردر أو العميل..."
                    className="w-full h-9 pr-9 pl-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Table of Reconciled Rows */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              selectedResultIds.length > 0 &&
                              selectedResultIds.length ===
                                report.results.filter(
                                  (r) => r.matchedOrder && r.status !== "already_settled"
                                ).length
                            }
                            onChange={selectAllEligible}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="p-3">رقم الأوردر والعميل</th>
                        <th className="p-3">COD الكشف vs المتوقع</th>
                        <th className="p-3">الشحن بالكشف vs المتوقع</th>
                        <th className="p-3">صافي المستحق</th>
                        <th className="p-3">نتيجة المطابقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredResults.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            لا توجد أوردرات مطابقة للفلتر المحدد
                          </td>
                        </tr>
                      ) : (
                        filteredResults.map((res) => {
                          const isEligible = res.matchedOrder && res.status !== "already_settled";
                          const isSelected = res.matchedOrder ? selectedResultIds.includes(res.matchedOrder.id) : false;

                          return (
                            <tr
                              key={res.rowId}
                              className={`hover:bg-slate-50 transition-colors ${
                                isSelected ? "bg-blue-50/40" : ""
                              }`}
                            >
                              {/* Selection Checkbox */}
                              <td className="p-3 text-center">
                                {isEligible ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectOrder(res.matchedOrder!.id)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                  />
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* Order & Customer */}
                              <td className="p-3">
                                <div className="font-bold text-slate-900 font-mono text-xs">
                                  {res.orderIdOrRef}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>{res.customerName || res.matchedOrder?.customer_name || "بدون اسم"}</span>
                                  <span>•</span>
                                  <span>{res.phone || res.matchedOrder?.phone_primary || "-"}</span>
                                </div>
                              </td>

                              {/* COD Comparison */}
                              <td className="p-3 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">{formatEgp(res.courierCod)}</span>
                                  {res.matchedOrder && (
                                    <span className="text-[10px] text-slate-400">
                                      (المتوقع: {formatEgp(res.expectedCod)})
                                    </span>
                                  )}
                                </div>
                                {Math.abs(res.codDiscrepancy) > 0.5 && (
                                  <div
                                    className={`text-[10px] font-bold mt-0.5 ${
                                      res.codDiscrepancy > 0 ? "text-emerald-600" : "text-rose-600"
                                    }`}
                                  >
                                    فارق: {res.codDiscrepancy > 0 ? "+" : ""}
                                    {formatEgp(res.codDiscrepancy)}
                                  </div>
                                )}
                              </td>

                              {/* Shipping Fee Comparison */}
                              <td className="p-3 font-mono">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">{formatEgp(res.courierShippingFee)}</span>
                                  {res.matchedOrder && (
                                    <span className="text-[10px] text-slate-400">
                                      (المتوقع: {formatEgp(res.expectedShippingFee)})
                                    </span>
                                  )}
                                </div>
                                {Math.abs(res.shippingDiscrepancy) > 0.5 && (
                                  <div
                                    className={`text-[10px] font-bold mt-0.5 ${
                                      res.shippingDiscrepancy > 0 ? "text-rose-600" : "text-emerald-600"
                                    }`}
                                  >
                                    {res.shippingDiscrepancy > 0
                                      ? `خصم زيادة: +${formatEgp(res.shippingDiscrepancy)}`
                                      : `وفر شحن: ${formatEgp(res.shippingDiscrepancy)}`}
                                  </div>
                                )}
                              </td>

                              {/* Net Receivable */}
                              <td className="p-3 font-mono font-bold text-slate-900">
                                {formatEgp(res.courierNet)}
                              </td>

                              {/* Match Result Badge */}
                              <td className="p-3">
                                {res.status === "matched_perfect" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    مطابق 100%
                                  </span>
                                )}

                                {res.status === "matched_discrepancy" && (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold">
                                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                                      يوجد فرق مالي
                                    </span>
                                    <div className="text-[10px] text-amber-700 font-medium">
                                      {res.discrepancyNotes[0]}
                                    </div>
                                  </div>
                                )}

                                {res.status === "not_found_in_system" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold">
                                    <HelpCircle className="w-3 h-3 text-rose-600" />
                                    غير مسجل بنظام فلكون
                                  </span>
                                )}

                                {res.status === "already_settled" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold">
                                    <RotateCcw className="w-3 h-3 text-blue-600" />
                                    تمت تسويته مسبقاً
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {report ? (
            <>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={resetAll}
                  disabled={isPending}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  رفع ملف آخر
                </button>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={markAsDelivered}
                    onChange={(e) => setMarkAsDelivered(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>تحديث حالة التوصيل إلى "تم التسليم" للأوردرات المسواة</span>
                </label>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={onClose}
                  disabled={isPending}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  إلغاء
                </button>

                <button
                  onClick={handleApplySettlement}
                  disabled={isPending || selectedResultIds.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isPending
                      ? "جاري اعتماد التسوية..."
                      : `اعتماد وتسوية الأوردرات المحددة (${selectedResultIds.length})`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-end w-full">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                إغلاق
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
