"use client";

import React, { useState, useMemo } from "react";
import {
  Truck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Coins,
  Clock,
  ShieldCheck,
  X,
  Loader2,
  ArrowRight,
  Filter,
} from "lucide-react";
import { Order } from "@/types/database";
import {
  batchSmartRouteOrders,
  RoutingWeights,
  BatchRoutingSummary,
} from "@/lib/routing/carrierSmartRouter";
import { applySmartCarrierRoutingAction } from "@/app/actions/routing";
import { playScanSuccessSound } from "@/lib/sound";

interface SmartCarrierRoutingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: Order[];
  onSuccess?: () => void;
}

type StrategyType = "balanced" | "max_delivery" | "lowest_cost" | "fastest";

export function SmartCarrierRoutingModal({
  isOpen,
  onClose,
  selectedOrders,
  onSuccess,
}: SmartCarrierRoutingModalProps) {
  const [strategy, setStrategy] = useState<StrategyType>("balanced");
  const [isApplying, setIsApplying] = useState(false);
  const [successResult, setSuccessResult] = useState<{ updatedCount: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Derive weights from strategy
  const weights: RoutingWeights = useMemo(() => {
    switch (strategy) {
      case "max_delivery":
        return { deliverySuccessWeight: 0.75, costWeight: 0.15, speedWeight: 0.10 };
      case "lowest_cost":
        return { deliverySuccessWeight: 0.30, costWeight: 0.60, speedWeight: 0.10 };
      case "fastest":
        return { deliverySuccessWeight: 0.35, costWeight: 0.15, speedWeight: 0.50 };
      case "balanced":
      default:
        return { deliverySuccessWeight: 0.50, costWeight: 0.30, speedWeight: 0.20 };
    }
  }, [strategy]);

  // Compute live recommendations
  const summary: BatchRoutingSummary = useMemo(() => {
    if (!selectedOrders || selectedOrders.length === 0) {
      return {
        totalOrders: 0,
        assignedBreakdown: {},
        projectedAvgDeliveryRate: 0,
        projectedTotalShippingCost: 0,
        estimatedCostSavings: 0,
        recommendations: [],
      };
    }
    return batchSmartRouteOrders(selectedOrders, weights);
  }, [selectedOrders, weights]);

  if (!isOpen) return null;

  const handleApply = async () => {
    if (selectedOrders.length === 0) return;
    setIsApplying(true);
    setErrorMsg(null);

    try {
      const orderIds = selectedOrders.map((o) => o.id);
      const res = await applySmartCarrierRoutingAction(orderIds, weights);

      if (res.success && res.data) {
        setSuccessResult({ updatedCount: res.data.updatedCount });
        playScanSuccessSound();
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res.error || "فشل تطبيق التوجيه الذكي");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                التوجيه الذكي لشركات الشحن
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-normal">
                  Smart Courier Router 🎯
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                توزيع الشحنات آلياً على أفضل شركة شحن لكل محافظة حسب نسبة التسليم وتفادي المرتجعات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Strategy Selector Bar */}
        <div className="bg-slate-50 dark:bg-slate-950/50 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>استراتيجية التوجيه:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStrategy("balanced")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                strategy === "balanced"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              متوازنة (الأفضل للجميع)
            </button>
            <button
              onClick={() => setStrategy("max_delivery")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                strategy === "max_delivery"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              أعلى نسبة تسليم (ضمان الاستلام)
            </button>
            <button
              onClick={() => setStrategy("lowest_cost")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                strategy === "lowest_cost"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              أقل سعر شحن (أقصى توفير)
            </button>
            <button
              onClick={() => setStrategy("fastest")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                strategy === "fastest"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              أقصى سرعة توصيل
            </button>
          </div>
        </div>

        {/* Live KPI Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">إجمالي الشحنات المحددة</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {summary.totalOrders} <span className="text-xs font-normal text-slate-500">شحنة</span>
            </div>
          </div>
          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              متوسط نسبة التسليم المتوقعة
            </div>
            <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
              {summary.projectedAvgDeliveryRate}%
            </div>
          </div>
          <div className="bg-teal-50/60 dark:bg-teal-950/30 p-3 rounded-xl border border-teal-200 dark:border-teal-800">
            <div className="text-[11px] text-teal-700 dark:text-teal-400 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" />
              إجمالي تكلفة الشحن المتوقعة
            </div>
            <div className="text-xl font-bold text-teal-800 dark:text-teal-300 mt-1">
              {summary.projectedTotalShippingCost.toLocaleString()} <span className="text-xs font-normal">ج</span>
            </div>
          </div>
          <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              التوفير المالي المحقق
            </div>
            <div className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1">
              {summary.estimatedCostSavings.toLocaleString()} <span className="text-xs font-normal">ج</span>
            </div>
          </div>
        </div>

        {/* Carrier Breakdown Badges */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-950/30 flex flex-wrap items-center gap-2 text-xs border-b border-slate-200 dark:border-slate-800">
          <span className="font-semibold text-slate-600 dark:text-slate-400">توزيع الشحنات:</span>
          {Object.entries(summary.assignedBreakdown).map(([carrier, count]) => (
            <span
              key={carrier}
              className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1"
            >
              <span>{carrier}:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-black">{count}</span>
            </span>
          ))}
        </div>

        {/* Orders Table Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {successResult ? (
            <div className="p-8 text-center space-y-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 my-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                تم تطبيق التوجيه الذكي بنجاح على {successResult.updatedCount} شحنة!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                تم تحديث بيانات شركات الشحن وحسابات التكلفة في النظام وتسجيل أثر التدقيق التلقائي.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 shadow-md"
              >
                إغلاق والعودة لجدول الشحنات
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">العميل والمحافظة</th>
                    <th className="p-3">الشركة الموصى بها</th>
                    <th className="p-3">نسبة التسليم</th>
                    <th className="p-3">سعر الشحن</th>
                    <th className="p-3">سبب الاختيار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summary.recommendations.map((rec) => (
                    <tr key={rec.orderId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{rec.customerName}</div>
                        <div className="text-[11px] text-slate-500">{rec.governorate}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                          <Truck className="w-3 h-3 text-emerald-600" />
                          {rec.recommendedCarrierName}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        {rec.expectedRate}%
                      </td>
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                        {rec.expectedCost} ج
                      </td>
                      <td className="p-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {rec.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {!successResult && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold"
            >
              إلغاء
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || selectedOrders.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التوجيه الذكي وتحديث الشحنات...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>تطبيق التوجيه الذكي على {summary.totalOrders} شحنة</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
