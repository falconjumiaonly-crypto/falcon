"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  Layers,
  ClipboardPaste,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus,
  Loader2,
  ArrowRight,
  DollarSign,
  Package,
} from "lucide-react";
import { parseBulkOrderText } from "@/lib/orderTextParser";
import { matchGovernorate } from "@/lib/governorates";
import { batchCreateOrdersAction } from "@/app/actions/orders";
import { calculateCod, calculateNetProfit, derivePaymentStatus } from "@/lib/calculations";
import type { GovernorateRate, OrderInsert } from "@/types/database";

interface BulkOrderPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  shippingRates: GovernorateRate[];
  onSuccess?: () => void;
}

interface EditableBulkOrder {
  id: string;
  customer_name: string;
  phone_primary: string;
  phone_secondary: string;
  governorate: string;
  address: string;
  landmark: string;
  order_total: number;
  paid_amount: number;
  shipping_cost: number;
  important_notes: string;
  isValid: boolean;
  errors: string[];
}

const BULK_SAMPLE = `الاسم: أحمد مصطفى
الموبايل: 01012345678
المحافظة: الجيزة
العنوان: شارع الهرم الرئيسي
المبلغ: 750 جنيه
الطلب: 2 تيشرت اسود
---
محمود سعيد
01198765432
طنطا شارع النحاس
السعر: 850 جنيه
الطلب: 3 قميص ابيض
---
سارة محمود الشافعي
01099887766
المعادي شارع 9 امام جراند مول
المبلغ: 600 جنيه
مدفوع: 100
ملاحظات: الاتصال قبل الوصول`;

export function BulkOrderPasteModal({
  isOpen,
  onClose,
  shippingRates,
  onSuccess,
}: BulkOrderPasteModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rawText, setRawText] = useState("");
  const [orders, setOrders] = useState<EditableBulkOrder[]>([]);
  const [step, setStep] = useState<"input" | "review">("input");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    if (!rawText.trim()) return;

    const parsedList = parseBulkOrderText(rawText, shippingRates);
    if (parsedList.length === 0) {
      setErrorMessage("لم نتمكن من التعرف على أوردرات صالحة في النص المدخل.");
      return;
    }

    const initialOrders: EditableBulkOrder[] = parsedList.map((p, idx) => {
      // Lookup shipping rate for matched governorate
      let shipCost = 65; // fallback
      if (p.governorate) {
        const rateMatch = matchGovernorate(p.governorate, shippingRates);
        if (rateMatch.matched && rateMatch.rate !== undefined) {
          shipCost = rateMatch.rate;
        }
      }

      const errors: string[] = [];
      if (!p.customer_name) errors.push("اسم العميل مفقود");
      if (!p.phone_primary) errors.push("رقم الهاتف مفقود");
      if (!p.governorate) errors.push("المحافظة مفقودة");
      if (!p.address) errors.push("العنوان مفقود");

      return {
        id: `bulk-${Date.now()}-${idx}`,
        customer_name: p.customer_name,
        phone_primary: p.phone_primary,
        phone_secondary: p.phone_secondary,
        governorate: p.governorate,
        address: p.address,
        landmark: p.landmark,
        order_total: p.order_total,
        paid_amount: p.paid_amount,
        shipping_cost: shipCost,
        important_notes: [p.items_summary, p.important_notes].filter(Boolean).join(" | "),
        isValid: errors.length === 0,
        errors,
      };
    });

    setOrders(initialOrders);
    setStep("review");
    setErrorMessage(null);
  };

  const handleUpdateField = (
    id: string,
    field: keyof EditableBulkOrder,
    value: any
  ) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== id) return ord;

        const updated = { ...ord, [field]: value };

        // If governorate changed, recalculate shipping_cost
        if (field === "governorate") {
          const rateMatch = matchGovernorate(value, shippingRates);
          if (rateMatch.matched && rateMatch.rate !== undefined) {
            updated.shipping_cost = rateMatch.rate;
          }
        }

        // Re-validate row
        const errors: string[] = [];
        if (!updated.customer_name?.trim()) errors.push("اسم العميل مفقود");
        if (!updated.phone_primary?.trim()) errors.push("رقم الهاتف مفقود");
        if (!updated.governorate?.trim()) errors.push("المحافظة مفقودة");
        if (!updated.address?.trim()) errors.push("العنوان مفقود");
        if (isNaN(updated.order_total) || updated.order_total < 0) errors.push("المبلغ غير صالح");

        updated.isValid = errors.length === 0;
        updated.errors = errors;

        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRawText(text);
    } catch {}
  };

  const handleLoadSample = () => {
    setRawText(BULK_SAMPLE);
  };

  const handleSaveAll = () => {
    if (orders.length === 0) return;

    // Check if any row has errors
    const invalidCount = orders.filter((o) => !o.isValid).length;
    if (invalidCount > 0) {
      if (
        !window.confirm(
          `هناك ${invalidCount} أوردر(ات) ينقصها بعض الحقول المطلوبة. هل تريد حفظ الأوردرات الصالحة فقط وتجاهل الناقصة؟`
        )
      ) {
        return;
      }
    }

    const validOrders = orders.filter((o) => o.isValid);
    if (validOrders.length === 0) {
      setErrorMessage("لا توجد أوردرات صالحة للإدراج. يرجى استكمال الحقول المطلوبة.");
      return;
    }

    startTransition(async () => {
      const orderDate = new Date().toISOString().split("T")[0];

      const payloads: OrderInsert[] = validOrders.map((ord) => {
        const codAmount = calculateCod(ord.order_total, ord.paid_amount);
        const netProfit = calculateNetProfit(ord.order_total, ord.shipping_cost);
        const paymentStatus = derivePaymentStatus(ord.order_total, ord.paid_amount);

        return {
          order_date: orderDate,
          customer_name: ord.customer_name.trim(),
          phone_primary: ord.phone_primary.trim(),
          phone_secondary: ord.phone_secondary?.trim() || null,
          governorate: ord.governorate.trim(),
          address: ord.address.trim(),
          landmark: ord.landmark?.trim() || null,
          important_notes: ord.important_notes?.trim() || null,
          order_total: ord.order_total,
          paid_amount: ord.paid_amount,
          cod_amount: codAmount,
          shipping_cost: ord.shipping_cost,
          net_profit: netProfit,
          payment_status: paymentStatus,
          print_status: "pending",
          delivery_status: "new",
          settlement_status: "pending",
        };
      });

      const res = await batchCreateOrdersAction(payloads);
      if (!res.success) {
        setErrorMessage(res.error || "فشل إدراج الأوردرات");
        return;
      }

      setSuccessCount(res.data?.count || validOrders.length);
      router.refresh();
      if (onSuccess) onSuccess();
    });
  };

  const handleReset = () => {
    setOrders([]);
    setRawText("");
    setStep("input");
    setSuccessCount(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  اللصق المتعدد للأوردرات (Bulk Fast Paste)
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                  دفعة واحدة ⚡
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                الصق محادثات أو نصوص عدة أوردرات معاً لتحويلها فوراً إلى قائمة طلبات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Screen */}
          {successCount !== null ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-bold text-slate-900">
                تم حفظ {successCount} أوردر بنجاح!
              </h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                تم إضافة كافة الأوردرات لقاعدة البيانات وتم ترحيلها إلى قائمة الانتظار والطباعة
              </p>
              <div className="flex items-center justify-center gap-3 pt-3">
                <button
                  onClick={() => {
                    onClose();
                    router.push("/orders");
                  }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  الذهاب لجدول الطلبات
                </button>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors"
                >
                  لصق دفعة أخرى
                </button>
              </div>
            </div>
          ) : step === "input" ? (
            /* STEP 1: Input Raw Text */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>الصق النص المجمع هنا (افصل بين كل أوردر بـ --- أو سطرين فارغين):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                  >
                    تجربة نموذج 3 أوردرات
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>لصق من الحافظة</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={9}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`مثال لصق عدة أوردرات:\n\nأحمد ممدوح 01012345678 المعادي شارع 9 - 750 جنيه\n---\nمحمود سعيد 01198765432 الهرم الجيزة - 850 جنيه\n---\nسارة علي 01234567890 طنطا - 600 جنيه`}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-mono leading-relaxed"
                dir="auto"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={!rawText.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>تحليل واستخراج الأوردرات</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: Review & Edit Table */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 text-xs text-indigo-900">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">تم التعرف على {orders.length} أوردرات</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-emerald-700 font-semibold">
                    {orders.filter((o) => o.isValid).length} جاهز للحفظ
                  </span>
                  {orders.some((o) => !o.isValid) && (
                    <>
                      <span className="text-slate-400">|</span>
                      <span className="text-amber-700 font-semibold">
                        {orders.filter((o) => !o.isValid).length} بحاجة لاستكمال حقول
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStep("input")}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold hover:underline"
                >
                  ← العودة للنص الأصلي
                </button>
              </div>

              {/* Table of Orders */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3 min-w-[130px]">الاسم</th>
                      <th className="py-2.5 px-3 min-w-[120px]">الهاتف</th>
                      <th className="py-2.5 px-3 min-w-[110px]">المحافظة</th>
                      <th className="py-2.5 px-3 min-w-[160px]">العنوان</th>
                      <th className="py-2.5 px-3 min-w-[90px]">المبلغ</th>
                      <th className="py-2.5 px-3 min-w-[70px]">مدفوع</th>
                      <th className="py-2.5 px-3 min-w-[70px]">شحن</th>
                      <th className="py-2.5 px-3 min-w-[130px]">ملاحظات</th>
                      <th className="py-2.5 px-3 w-12 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((ord, idx) => (
                      <tr
                        key={ord.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !ord.isValid ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={ord.customer_name}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "customer_name", e.target.value)
                            }
                            placeholder="الاسم"
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={ord.phone_primary}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "phone_primary", e.target.value)
                            }
                            placeholder="01xxxxxxxxx"
                            dir="ltr"
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 text-left"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={ord.governorate}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "governorate", e.target.value)
                            }
                            placeholder="المحافظة"
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={ord.address}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "address", e.target.value)
                            }
                            placeholder="العنوان"
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={ord.order_total}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "order_total", parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 text-left"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={ord.paid_amount}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "paid_amount", parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 text-left"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={ord.shipping_cost}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "shipping_cost", parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 text-left"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={ord.important_notes}
                            onChange={(e) =>
                              handleUpdateField(ord.id, "important_notes", e.target.value)
                            }
                            placeholder="ملاحظات"
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(ord.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                            title="حذف هذا الأوردر"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  <span>إجمالي المبالغ: </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {orders.reduce((sum, o) => sum + (o.order_total || 0), 0)} ج.م
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAll}
                    disabled={isPending || orders.length === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ الأوردرات...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>حفظ وإضافة {orders.length} أوردرات</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
