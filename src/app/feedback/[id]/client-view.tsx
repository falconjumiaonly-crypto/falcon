"use client";

import React, { useState } from "react";
import {
  Star,
  Package,
  Truck,
  Heart,
  CheckCircle2,
  Copy,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { submitCustomerFeedbackAction } from "@/app/actions/feedback";

interface FeedbackClientViewProps {
  orderId: string;
  customerName: string;
  governorate: string;
  carrierName: string;
  deliveryStatus: string;
}

export function FeedbackClientView({
  orderId,
  customerName,
  governorate,
  carrierName,
  deliveryStatus,
}: FeedbackClientViewProps) {
  const [productRating, setProductRating] = useState<number>(5);
  const [courierRating, setCourierRating] = useState<number>(5);
  const [overallRating, setOverallRating] = useState<number>(5);
  const [comments, setComments] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [discountCode, setDiscountCode] = useState("FALCON10");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getRatingLabel = (score: number) => {
    switch (score) {
      case 5:
        return "ممتاز جداً 🌟";
      case 4:
        return "جيد جداً 👍";
      case 3:
        return "مقبول 😐";
      case 2:
        return "غير مرضي 👎";
      case 1:
      default:
        return "سيء جداً ⚠️";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await submitCustomerFeedbackAction({
        orderId,
        customerName: customerName || "عميل فلكون",
        phone,
        ratingProduct: productRating,
        ratingCourier: courierRating,
        overallRating,
        comment: comments.trim(),
        governorate,
        carrierName,
      });

      if (res.success && res.data) {
        setIsSubmitted(true);
        setDiscountCode(res.data.discountCode);
      } else {
        setErrorMsg(res.error || "تعذر حفظ التقييم، حاول مجدداً");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(discountCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderStarSelector = (
    label: string,
    icon: React.ReactNode,
    value: number,
    onChange: (val: number) => void
  ) => {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            {icon}
            <span>{label}</span>
          </div>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            {getRatingLabel(value)}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2.5 pt-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className="p-1 text-slate-300 hover:text-amber-400 focus:outline-none transition-all transform hover:scale-110 active:scale-95"
            >
              <Star
                className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                  star <= value
                    ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                    : "fill-transparent text-slate-300 dark:text-slate-600"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-slate-900 to-slate-950 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border border-emerald-500/30 animate-in fade-in zoom-in-95 duration-200 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              شكراً جزيلاً لمشاركتك! 🌸
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              تقييمك وصل لخدمة العملاء ويساعدنا جداً على تطوير مستوى المنتجات وسرعة الشحن.
            </p>
          </div>

          {/* Reward Coupon Box */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-700 p-4 rounded-2xl text-center space-y-2">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              هدية شكر خاصة لطلبك القادم
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="font-mono text-lg font-black tracking-widest text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-800 px-4 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-inner">
                {discountCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors shadow-xs"
                title="نسخ الكود"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copied && (
              <div className="text-[11px] font-bold text-emerald-600">
                تم نسخ كود الخصم بنجاح! 🎉
              </div>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              استخدم هذا الكود للحصول على خصم 10% عند طلبك القادم.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full h-11 px-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <span>العودة للمتجر</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 py-8" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-xl border border-slate-200 dark:border-slate-800 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto font-black text-xl border border-emerald-500/20">
            🦅
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            رأيك يهمنا في شحنتك 🌟
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            أهلاً بك يا <strong>{customerName || "فندم"}</strong>، شاركنا تقييمك لطلبك #{orderId.slice(0, 8).toUpperCase()} في {governorate} لمساعدتنا على تحسين الخدمة.
          </p>
        </div>

        {/* Survey Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {renderStarSelector(
            "جودة وحالة المنتجات المستلمة",
            <Package className="w-4 h-4 text-emerald-600" />,
            productRating,
            setProductRating
          )}

          {renderStarSelector(
            `تعامل وسرعة مندوب الشحن (${carrierName})`,
            <Truck className="w-4 h-4 text-teal-600" />,
            courierRating,
            setCourierRating
          )}

          {renderStarSelector(
            "الرضاء العام عن تجربة التسوق والتوصيل",
            <Heart className="w-4 h-4 text-rose-500" />,
            overallRating,
            setOverallRating
          )}

          {/* Comments Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              ملاحظات أو اقتراحات إضافية (اختياري):
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="اكتب أي ملاحظة عن المنتج أو المندوب لمساعدتنا..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
            />
          </div>

          {/* Optional Phone input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              رقم هاتفك للتواصل ومتابعة الشكاوى (اختياري):
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري إرسال التقييم...</span>
              </>
            ) : (
              <>
                <span>إرسال التقييم واستلام كود الخصم 🎁</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
