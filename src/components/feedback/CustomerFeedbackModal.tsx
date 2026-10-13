"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Star,
  Package,
  Truck,
  Heart,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
  X,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Filter,
} from "lucide-react";
import {
  CustomerFeedbackRecord,
  FeedbackAnalytics,
} from "@/lib/feedback/customerFeedbackEngine";
import {
  getFeedbackAnalyticsAction,
  resolveFeedbackAction,
} from "@/app/actions/feedback";

interface CustomerFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerFeedbackModal({
  isOpen,
  onClose,
}: CustomerFeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [feedbacks, setFeedbacks] = useState<CustomerFeedbackRecord[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "complaints">("all");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFeedbackAnalyticsAction();
      if (res.success && res.data) {
        setAnalytics(res.data.analytics);
        setFeedbacks(res.data.feedbacks);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      const res = await resolveFeedbackAction(id, "تم الاتصال بالعميل وحل الشكوى");
      if (res.success) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === id ? { ...f, isResolved: true } : f))
        );
      }
    } catch {
      // Ignore
    } finally {
      setResolvingId(null);
    }
  };

  const displayedList = feedbacks.filter((f) => {
    if (filterMode === "complaints") return f.isComplaint;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Star className="w-6 h-6 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                رادار تقييمات العملاء واستبيان ما بعد الاستلام
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-normal">
                  Feedback Loop 🌟
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                متابعة رضاء المشترين، رصد أداء مناديب شركات الشحن، وحل الشكاوى الفوري
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Analytics Top Bar */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                متوسط التقييم العام
              </div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-baseline gap-1">
                {analytics.averageOverallRating}
                <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                رضاء جودة المنتجات
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-baseline gap-1">
                {analytics.averageProductRating}
                <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                <Truck className="w-3.5 h-3.5 text-teal-600" />
                تقييم مناديب التوصيل
              </div>
              <div className="text-xl font-bold text-teal-600 dark:text-teal-400 mt-1 flex items-baseline gap-1">
                {analytics.averageCourierRating}
                <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${
              analytics.unresolvedComplaintsCount > 0
                ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700"
            }`}>
              <div className="text-[11px] flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                شكاوى بانتظار المتابعة
              </div>
              <div className="text-xl font-bold mt-1">
                {analytics.unresolvedComplaintsCount}
                <span className="text-xs font-normal opacity-70"> شكوى</span>
              </div>
            </div>
          </div>
        )}

        {/* Carrier Ranking Badges */}
        {analytics && Object.keys(analytics.carrierRatings).length > 0 && (
          <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-950/30 flex flex-wrap items-center gap-2 text-xs border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-600 dark:text-slate-400">تقييم العملاء لشركات الشحن:</span>
            {Object.entries(analytics.carrierRatings).map(([carrier, stat]) => (
              <span
                key={carrier}
                className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1"
              >
                <span>{carrier}:</span>
                <span className="text-amber-500 font-black flex items-center gap-0.5">
                  ★ {stat.avgRating}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">({stat.count} تقييم)</span>
              </span>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="px-5 py-2 bg-white dark:bg-slate-900 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                filterMode === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              جميع التقييمات ({feedbacks.length})
            </button>
            <button
              onClick={() => setFilterMode("complaints")}
              className={`px-3 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                filterMode === "complaints"
                  ? "bg-rose-600 text-white"
                  : "text-rose-600 hover:bg-rose-50"
              }`}
            >
              الشكاوى المنخفضة ({feedbacks.filter((f) => f.isComplaint).length})
            </button>
          </div>
        </div>

        {/* Reviews List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {displayedList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <Star className="w-8 h-8 mx-auto text-slate-300" />
              <p>لا توجد تقييمات مسجلة حالياً في هذا القسم.</p>
            </div>
          ) : (
            displayedList.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.isComplaint
                    ? item.isResolved
                      ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                      : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                    : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.customerName}
                    </span>
                    {item.governorate && (
                      <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                        {item.governorate}
                      </span>
                    )}
                    {item.carrierName && (
                      <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                        {item.carrierName}
                      </span>
                    )}
                    {item.isComplaint && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.isResolved
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                            : "bg-rose-100 text-rose-700 border border-rose-300 animate-pulse"
                        }`}
                      >
                        {item.isResolved ? "تم حل الشكوى ✅" : "شكوى مفتوحة ⚠️"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-amber-500 font-black text-sm">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>{item.overallRating} / 5</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>

                {/* Star Sub-Scores */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    <span>المنتج: {item.ratingProduct}★</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-teal-600" />
                    <span>المندوب: {item.ratingCourier}★</span>
                  </div>
                </div>

                {/* Comment text */}
                {item.comment && (
                  <p className="mt-2 text-xs bg-slate-100/60 dark:bg-slate-900/60 p-2.5 rounded-lg text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50">
                    "{item.comment}"
                  </p>
                )}

                {/* Action buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {item.phone && (
                      <a
                        href={`https://wa.me/2${item.phone.replace(/^0/, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>محادثة واتساب ({item.phone})</span>
                      </a>
                    )}
                  </div>

                  {item.isComplaint && !item.isResolved && (
                    <button
                      onClick={() => handleResolve(item.id)}
                      disabled={resolvingId === item.id}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1 transition-colors"
                    >
                      {resolvingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>تأكيد حل الشكوى</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
