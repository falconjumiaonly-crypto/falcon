"use client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  User,
  DollarSign,
  Package,
  FileText,
  ArrowDownToLine,
  Layers,
} from "lucide-react";
import { parseOrderText, ParsedOrderResult } from "@/lib/orderTextParser";
import { matchGovernorate } from "@/lib/governorates";
import type { GovernorateRate } from "@/types/database";

interface SmartOrderPasteBarProps {
  shippingRates: GovernorateRate[];
  onOpenBulkModal?: () => void;
  onApply: (data: {
    customer_name: string;
    phone_primary: string;
    phone_secondary: string;
    governorate: string;
    address: string;
    landmark: string;
    order_total: string;
    paid_amount: string;
    shipping_cost: string;
    important_notes: string;
  }) => void;
}

const SAMPLE_MESSAGES = [
  `الاسم: أحمد مصطفى إبراهيم
الموبايل: 01012345678
المحافظة: الجيزة
العنوان: 15 شارع الهرم الرئيسي محطة العريش بجوار بنك مصر
المنتجات: 2 تيشرت اوفر سايز اسود + كوتشي ابيض 42
المبلغ: 850 جنيه
مدفوع: 100
ملاحظات: الاتصال قبل الوصول بعد الظهر`,
  `محمد علاء حسان 01156789012 المنصورة شارع الجمهورية برج الأطباء الدور الرابع 3 قمصان 750ج`,
  `سارة محمود الشافعي
01099887766
المعادي شارع 9 امام جراند مول
الطلب: شنطة جلد هافان
السعر: 450 جنيه
توصيل سريع من فضلك`,
];

export function SmartOrderPasteBar({
  shippingRates,
  onOpenBulkModal,
  onApply,
}: SmartOrderPasteBarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [rawText, setRawText] = useState("");
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Real-time parsing with governorate matching
  const parsed: ParsedOrderResult = useMemo(() => {
    return parseOrderText(rawText, shippingRates);
  }, [rawText, shippingRates]);

  // Governorate rate lookup
  const matchedRate = useMemo(() => {
    if (!parsed.governorate) return null;
    const match = matchGovernorate(parsed.governorate, shippingRates);
    return match.matched && match.rate !== undefined ? match.rate : null;
  }, [parsed.governorate, shippingRates]);

  const hasAnyData = Boolean(
    parsed.customer_name ||
    parsed.phone_primary ||
    parsed.governorate ||
    parsed.address ||
    parsed.order_total > 0
  );

  const handleApply = () => {
    if (!hasAnyData) return;

    onApply({
      customer_name: parsed.customer_name,
      phone_primary: parsed.phone_primary,
      phone_secondary: parsed.phone_secondary,
      governorate: parsed.governorate,
      address: parsed.address,
      landmark: parsed.landmark,
      order_total: parsed.order_total > 0 ? String(parsed.order_total) : "",
      paid_amount: parsed.paid_amount > 0 ? String(parsed.paid_amount) : "0",
      shipping_cost: matchedRate !== null ? String(matchedRate) : "",
      important_notes: parsed.important_notes || "",
    });

    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
      }
    } catch {
      // Browser permissions fallback
    }
  };

  const handleLoadSample = () => {
    const random = SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)];
    setRawText(random);
  };

  const handleClear = () => {
    setRawText("");
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900/90 via-slate-900 to-blue-950 text-white rounded-3xl p-5 lg:p-6 shadow-xl border border-indigo-700/30 overflow-hidden relative">
      {/* Background Glow */}
      <div className="absolute -top-16 -left-16 w-52 h-52 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                اللصق السريع الذكي (Smart AI Omnibox)
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30">
                جديد ⚡
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              الصق نص محادثة العميل من فيسبوك أو واتساب لتعبئة الأوردر تلقائياً بنقرة واحدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenBulkModal && (
            <button
              type="button"
              onClick={onOpenBulkModal}
              className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-500/30 to-blue-500/30 hover:from-indigo-500/40 hover:to-blue-500/40 text-blue-200 rounded-xl transition-all border border-blue-400/30 flex items-center gap-1.5 shadow-sm"
              title="فتح نافذة اللصق المتعدد للأوردرات"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>لصق متعدد (Bulk)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl transition-colors border border-white/10 flex items-center gap-1.5"
            title="تجربة نص رسالة حقيقية"
          >
            <span>تجربة نموذج</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            title={isOpen ? "طي الصندوق" : "توسيع الصندوق"}
          >
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 relative z-10">
          {/* Textarea with Actions */}
          <div className="relative">
            <textarea
              id="smart_paste_input"
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="الصق نص الرسالة هنا... مثال: أحمد 01012345678 المعادي شارع 9 - 2 تيشرت - 750 جنيه"
              className="w-full bg-slate-950/60 border border-indigo-400/30 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all resize-y font-sans leading-relaxed"
              dir="auto"
            />

            {/* Quick Action Buttons inside Textarea */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-2.5 py-1 text-xs bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg flex items-center gap-1 shadow-sm transition-colors border border-indigo-400/30"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>لصق من الحافظة</span>
              </button>

              {rawText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 text-slate-400 hover:text-rose-300 rounded-md transition-colors"
                  title="مسح النص"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Live Extracted Preview Chips */}
          {hasAnyData && (
            <div className="bg-slate-950/40 rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  البيانات المستخرجة تلقائياً:
                </span>
                <span className="text-[11px] text-blue-300">
                  تحقق من الحقول قبل الاعتماد
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {/* Customer Name */}
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <User className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-slate-400">الاسم:</span>
                  <span className="font-semibold text-white truncate">
                    {parsed.customer_name || <span className="text-slate-500 font-normal">لم يتم التعرف</span>}
                  </span>
                </div>

                {/* Primary Phone */}
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-400">الهاتف:</span>
                  <span className="font-mono font-bold text-white truncate" dir="ltr">
                    {parsed.phone_primary || <span className="text-slate-500 font-normal">لم يتم التعرف</span>}
                  </span>
                  {parsed.phone_secondary && (
                    <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                      (+{parsed.phone_secondary})
                    </span>
                  )}
                </div>

                {/* Governorate & Shipping Rate */}
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-slate-400">المحافظة:</span>
                  <span className="font-semibold text-white truncate">
                    {parsed.governorate ? (
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {parsed.governorate}
                        {parsed.district && (
                          <span className="text-[10px] text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded font-medium">
                            {parsed.district}
                          </span>
                        )}
                        {matchedRate !== null && (
                          <span className="text-[11px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                            {matchedRate} ج.م
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-normal">غير محدد</span>
                    )}
                  </span>
                </div>

                {/* Auto-Correction Alert if Applicable */}
                {parsed.was_governorate_corrected && (
                  <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-1.5 text-[11px] text-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      تصحيح توجيه: تم تعديل المحافظة تلقائياً إلى <b>{parsed.governorate}</b> نظراً لأن &quot;{parsed.district}&quot; تتبعها لشركات الشحن.
                    </span>
                  </div>
                )}

                {/* Address & Landmark */}
                <div className="sm:col-span-2 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-slate-400">العنوان:</span>
                  <span className="text-white truncate">
                    {parsed.address || <span className="text-slate-500 font-normal">لم يتم التعرف</span>}
                    {parsed.landmark && <span className="text-purple-300 mr-1.5">({parsed.landmark})</span>}
                  </span>
                </div>

                {/* Total & Paid */}
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <DollarSign className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-400">المبلغ:</span>
                  <span className="font-bold text-emerald-300 font-mono">
                    {parsed.order_total > 0 ? `${parsed.order_total} ج.م` : "0"}
                  </span>
                  {parsed.paid_amount > 0 && (
                    <span className="text-[10px] text-slate-400">
                      (مدفوع: {parsed.paid_amount})
                    </span>
                  )}
                </div>

                {/* Items & Notes */}
                {(parsed.items_summary || parsed.important_notes) && (
                  <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                    <Package className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-slate-400">الطلب / ملاحظات:</span>
                    <span className="text-slate-200 truncate">
                      {[parsed.items_summary, parsed.important_notes].filter(Boolean).join(" - ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Apply Action Bar */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  {copiedSuccess ? (
                    <span className="text-emerald-300 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      تم تعبئة بيانات الأوردر في النموذج بنجاح!
                    </span>
                  ) : (
                    "اضغط زر التطبيق لتعبئة بيانات النموذج فوراً"
                  )}
                </span>

                <button
                  type="button"
                  id="btn_apply_smart_paste"
                  onClick={handleApply}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>تطبيق وتعبئة بيانات الأوردر</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
