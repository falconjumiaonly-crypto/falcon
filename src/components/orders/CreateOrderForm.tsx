"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Printer,
  PackagePlus,
  ArrowRight,
  Clock,
} from "lucide-react";
import { calculateCod, calculateNetProfit, formatEgp } from "@/lib/calculations";
import { createOrderAction, findDuplicateOrdersAction } from "@/app/actions/orders";
import { getShippingRatesAction } from "@/app/actions/settings";
import { DEFAULT_GOVERNORATES, matchGovernorate } from "@/lib/governorates";
import { useOrderDraft, OrderFormData } from "@/hooks/useOrderDraft";
import { Order, GovernorateRate } from "@/types/database";

const commonGovernorates = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "القليوبية",
  "الشرقية",
  "الدقهلية",
  "الغربية",
  "المنوفية",
  "البحيرة",
  "كفر الشيخ",
  "دمياط",
  "بورسعيد",
  "الإسماعيلية",
  "السويس",
  "الفيوم",
  "بني سويف",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
];

export function CreateOrderForm() {
  const router = useRouter();
  const {
    formData,
    updateField,
    clearDraft,
    hasRestoredDraft,
    lastSavedAt,
  } = useOrderDraft();

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Governorate shipping rates state
  const [shippingRates, setShippingRates] = useState<GovernorateRate[]>(DEFAULT_GOVERNORATES);
  const [autoMatchedGov, setAutoMatchedGov] = useState<string | null>(null);

  // Duplicate Order Warning State
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    reason: string;
    matchedOrder: Order;
  } | null>(null);

  useEffect(() => {
    getShippingRatesAction().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setShippingRates(res.data);
      }
    });
  }, []);

  const handleFieldChange = (field: keyof OrderFormData, value: string) => {
    updateField(field, value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleGovernorateChange = (val: string) => {
    handleFieldChange("governorate", val);
    const match = matchGovernorate(val, shippingRates);
    if (match.matched && match.rate !== undefined) {
      handleFieldChange("shipping_cost", String(match.rate));
      setAutoMatchedGov(match.standardName || val);
    } else {
      setAutoMatchedGov(null);
    }
  };

  const handleDiscardDraft = () => {
    if (window.confirm("هل أنت متأكد من مسح بيانات المسودة والبدء من جديد؟")) {
      clearDraft();
      setErrorMessage(null);
    }
  };

  // Financial calculations
  const totalNum = parseFloat(formData.order_total) || 0;
  const paidNum = parseFloat(formData.paid_amount) || 0;
  const shippingNum = parseFloat(formData.shipping_cost) || 0;

  const codAmount = calculateCod(totalNum, paidNum);
  const netProfit = calculateNetProfit(totalNum, shippingNum);
  const isFullyPaid = totalNum > 0 && paidNum >= totalNum;
  const isPaidExceedsTotal = paidNum > totalNum;

  const executeCreateOrder = () => {
    startTransition(async () => {
      const res = await createOrderAction({
        customer_name: formData.customer_name,
        phone_primary: formData.phone_primary,
        phone_secondary: formData.phone_secondary,
        governorate: formData.governorate,
        address: formData.address,
        landmark: formData.landmark,
        order_total: totalNum,
        paid_amount: paidNum,
        shipping_cost: shippingNum,
        important_notes: formData.important_notes,
        order_date: formData.order_date,
      });

      if (!res.success) {
        setErrorMessage(res.error || "فشل في حفظ الأوردر");
        return;
      }

      // Success: Clear draft ONLY after verified database persistence
      clearDraft();
      setCreatedOrder(res.data!);
      setDuplicateWarning(null);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!formData.customer_name.trim()) {
      setErrorMessage("يرجى إدخال اسم العميل");
      return;
    }
    if (!formData.phone_primary.trim()) {
      setErrorMessage("يرجى إدخال رقم الهاتف الأساسي");
      return;
    }
    if (!formData.governorate.trim()) {
      setErrorMessage("يرجى إدخال المحافظة");
      return;
    }
    if (!formData.address.trim()) {
      setErrorMessage("يرجى إدخال العنوان بالتفصيل");
      return;
    }
    if (isNaN(totalNum) || totalNum <= 0) {
      setErrorMessage("يرجى إدخال سعر الأوردر بشكل صحيح (أكبر من 0)");
      return;
    }
    if (isNaN(paidNum) || paidNum < 0) {
      setErrorMessage("المبلغ المدفوع لا يمكن أن يكون سالباً");
      return;
    }
    if (isPaidExceedsTotal) {
      setErrorMessage("المبلغ المدفوع مقدماً لا يمكن أن يتجاوز سعر الأوردر الكامل");
      return;
    }
    if (isNaN(shippingNum) || shippingNum < 0) {
      setErrorMessage("يرجى إدخال سعر الشحن (0 أو أكثر)");
      return;
    }

    // Check for potential duplicates
    setCheckingDuplicate(true);
    try {
      const dupRes = await findDuplicateOrdersAction({
        phone_primary: formData.phone_primary,
        customer_name: formData.customer_name,
        address: formData.address,
        order_total: totalNum,
      });

      if (dupRes.success && dupRes.data?.isDuplicate && dupRes.data.matches.length > 0) {
        setDuplicateWarning({
          reason: dupRes.data.reason || "يوجد أوردر مشابه مسجل بالفعل وقد يكون هذا الأوردر مكررًا.",
          matchedOrder: dupRes.data.matches[0],
        });
        setCheckingDuplicate(false);
        return;
      }
    } catch {
      // If check fails, do not block creation
    } finally {
      setCheckingDuplicate(false);
    }

    executeCreateOrder();
  };

  const handleResetForNextOrder = () => {
    setCreatedOrder(null);
    clearDraft();
  };

  // If order was created successfully, show success confirmation card
  if (createdOrder) {
    return (
      <div className="bg-white rounded-3xl p-6 lg:p-10 border border-slate-200 shadow-sm max-w-2xl mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            تم حفظ الأوردر بنجاح!
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تم إضافة الأوردر لقاعدة البيانات وجاهز في قائمة الطباعة
          </p>
        </div>

        {/* Order Summary Pill */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-right space-y-3">
          <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">اسم العميل:</span>
            <span className="font-bold text-slate-900">{createdOrder.customer_name}</span>
          </div>
          <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">رقم الهاتف:</span>
            <span className="font-mono font-bold text-slate-900" dir="ltr">{createdOrder.phone_primary}</span>
          </div>
          <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">المحافظة والعنوان:</span>
            <span className="font-semibold text-slate-800">{createdOrder.governorate} - {createdOrder.address}</span>
          </div>
          <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">المطلوب تحصيله (COD):</span>
            <span className="font-bold text-blue-700 text-base">
              {createdOrder.cod_amount === 0 ? "مدفوع بالكامل" : formatEgp(createdOrder.cod_amount)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">صافي ربح فلكون:</span>
            <span className="font-bold text-emerald-700">{formatEgp(createdOrder.net_profit)}</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleResetForNextOrder}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 transition-colors"
          >
            <PackagePlus className="w-5 h-5" />
            <span>+ إنشاء أوردر آخر</span>
          </button>

          <button
            onClick={() => router.push("/print/queue")}
            className="h-12 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Printer className="w-5 h-5 text-slate-600" />
            <span>الذهاب لقائمة الطباعة</span>
          </button>

          <button
            onClick={() => router.push("/orders")}
            className="h-12 px-5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <span>عرض الطلبات</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Restored Draft Alert */}
      {hasRestoredDraft && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-blue-800 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">💾</span>
            <div>
              <span className="font-bold">تم استعادة مسودة غير مكتملة تلقائياً!</span>
              <p className="text-xs text-blue-600 mt-0.5">
                يمكنك إكمال إدخال البيانات دون أن تفقد أي معلومات كتبتها سابقاً.
                {lastSavedAt && ` (آخر حفظ: ${lastSavedAt})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="px-3 py-1.5 bg-white hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold text-rose-600 flex items-center gap-1.5 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>مسح المسودة</span>
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-800 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Customer & Delivery Info */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <span>بيانات العميل والشحن</span>
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {lastSavedAt && (
                <span className="hidden sm:inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  تم الحفظ تلقائياً ({lastSavedAt})
                </span>
              )}
              <span>* الحقول المطلوبة</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                اسم العميل <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => handleFieldChange("customer_name", e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Primary Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                رقم الهاتف الأساسي <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  id="phone_primary"
                  value={formData.phone_primary}
                  onChange={(e) => handleFieldChange("phone_primary", e.target.value)}
                  placeholder="مثال: 01012345678"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors text-right"
                  dir="ltr"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">يتم حفظ الصفر في بداية الرقم تلقائياً كنص</p>
            </div>

            {/* Secondary Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                رقم احتياطي <span className="text-slate-400 font-normal">(اختياري)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                id="phone_secondary"
                value={formData.phone_secondary}
                onChange={(e) => handleFieldChange("phone_secondary", e.target.value)}
                placeholder="مثال: 01198765432"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors text-right"
                dir="ltr"
              />
            </div>

            {/* Governorate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  المحافظة <span className="text-rose-500">*</span>
                </label>
                {autoMatchedGov && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    تم التعرف: {autoMatchedGov}
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                id="governorate"
                list="governorates-list"
                value={formData.governorate}
                onChange={(e) => handleGovernorateChange(e.target.value)}
                placeholder="اكتب اسم المحافظة (مثال: الجيزة)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
              />
              <datalist id="governorates-list">
                {shippingRates.map((gov) => (
                  <option key={gov.name} value={gov.name}>
                    {gov.name} ({gov.rate} ج.م)
                  </option>
                ))}
              </datalist>
            </div>

            {/* Detailed Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                العنوان بالتفصيل <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                id="address"
                value={formData.address}
                onChange={(e) => handleFieldChange("address", e.target.value)}
                placeholder="اسم الشارع، رقم العقار، الدور، الشقة"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors resize-none"
              />
            </div>

            {/* Landmark */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                علامة مميزة <span className="text-slate-400 font-normal">(اختياري)</span>
              </label>
              <input
                type="text"
                id="landmark"
                value={formData.landmark}
                onChange={(e) => handleFieldChange("landmark", e.target.value)}
                placeholder="بجوار مسجد / صيدلية / مدرسة"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
              />
            </div>

            {/* Order Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                تاريخ الأوردر <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  id="order_date"
                  value={formData.order_date}
                  onChange={(e) => handleFieldChange("order_date", e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Financial Details & Automated COD Calculation */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>المبالغ المالية والحساب التلقائي لـ COD</span>
            </h3>
            <span className="text-xs text-slate-400">حساب فوري</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Full Order Price */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                سعر الأوردر الكامل <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  id="order_total"
                  value={formData.order_total}
                  onChange={(e) => handleFieldChange("order_total", e.target.value)}
                  placeholder="0"
                  className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
                />
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs text-slate-400 font-semibold">
                  ج.م
                </span>
              </div>
            </div>

            {/* Prepaid Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                المبلغ المدفوع مقدمًا
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  id="paid_amount"
                  value={formData.paid_amount}
                  onChange={(e) => handleFieldChange("paid_amount", e.target.value)}
                  placeholder="0"
                  className={`w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-base font-bold focus:outline-none focus:ring-2 focus:bg-white transition-colors ${
                    isPaidExceedsTotal
                      ? "border-rose-300 focus:ring-rose-500 bg-rose-50/40"
                      : "border-slate-300 focus:ring-blue-600"
                  }`}
                />
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs text-slate-400 font-semibold">
                  ج.م
                </span>
              </div>
              {isPaidExceedsTotal && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">
                  لا يمكن أن يتجاوز المدفوع سعر الأوردر
                </p>
              )}
            </div>

            {/* Shipping Cost */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                سعر الشحن <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  id="shipping_cost"
                  value={formData.shipping_cost}
                  onChange={(e) => handleFieldChange("shipping_cost", e.target.value)}
                  placeholder="0"
                  className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
                />
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs text-slate-400 font-semibold">
                  ج.م
                </span>
              </div>
            </div>
          </div>

          {/* Live Calculation Display Box */}
          <div className="mt-4 p-5 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white shadow-lg grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-700/80">
            {/* COD Value */}
            <div className="pt-3 sm:pt-0 sm:pr-4">
              <span className="text-xs text-slate-300 font-medium block">
                COD المتبقي المطلوب تحصيله:
              </span>
              <div className="mt-1.5 flex items-baseline gap-2">
                {isFullyPaid ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm font-bold rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    مدفوع بالكامل (0 ج.م)
                  </span>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-amber-400 tracking-tight">
                      {formatEgp(codAmount)}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                {isFullyPaid ? "لن يقوم المندوب بتحصيل أي مبلغ" : "order_total - paid_amount"}
              </span>
            </div>

            {/* Falcon Net Profit */}
            <div className="pt-3 sm:pt-0 sm:pr-4">
              <span className="text-xs text-slate-300 font-medium block">
                صافي ربح فلكون المحسوب:
              </span>
              <div className="mt-1.5">
                <span className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatEgp(netProfit)}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                سعر الأوردر ({totalNum}) - سعر الشحن ({shippingNum})
              </span>
            </div>

            {/* Payment Status Preview */}
            <div className="pt-3 sm:pt-0 sm:pr-4">
              <span className="text-xs text-slate-300 font-medium block">
                حالة الدفع الحالية:
              </span>
              <div className="mt-2">
                {paidNum <= 0 ? (
                  <span className="px-3 py-1 bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold">
                    غير مدفوع
                  </span>
                ) : isFullyPaid ? (
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold">
                    مدفوع بالكامل
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-500 text-slate-900 rounded-lg text-xs font-semibold">
                    مدفوع جزئياً ({formatEgp(paidNum)})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Notes for Courier */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <span>ملاحظات مهمة للمندوب</span>
            </h3>
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md">
              تظهر بخط واضح على بوليصة الشحن المطبوعة
            </span>
          </div>

          <div>
            <textarea
              rows={2}
              id="important_notes"
              value={formData.important_notes}
              onChange={(e) => handleFieldChange("important_notes", e.target.value)}
              placeholder="مثال: يرجى الاتصال قبل الوصول بنصف ساعة، مسموح بفتح الشحنة والمعاينة"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors resize-none"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium text-sm flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-slate-400" />
            <span>مسح النموذج</span>
          </button>

          <button
            type="submit"
            disabled={isPending || checkingDuplicate || isPaidExceedsTotal}
            className="h-12 px-8 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-base rounded-xl shadow-md shadow-blue-600/30 flex items-center gap-2 transition-colors"
          >
            {checkingDuplicate ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري فحص التكرار...</span>
              </>
            ) : isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري حفظ الأوردر...</span>
              </>
            ) : (
              <>
                <span>+ حفظ وإنشاء البوليصة</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Duplicate Order Warning Modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-amber-200 space-y-5 text-right">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تنبيه: أوردر مشابه مسجل بالفعل</h3>
                <p className="text-xs text-amber-700 font-semibold">{duplicateWarning.reason}</p>
              </div>
            </div>

            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/80 space-y-2 text-xs">
              <div className="font-bold text-slate-700 mb-2 border-b border-amber-200/60 pb-1.5 flex justify-between">
                <span>بيانات الأوردر السابق المطابق:</span>
                <span className="font-mono text-slate-500">#{duplicateWarning.matchedOrder.id.slice(0, 8)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block">اسم العميل:</span>
                  <span className="font-bold text-slate-900">{duplicateWarning.matchedOrder.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">رقم الهاتف:</span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">{duplicateWarning.matchedOrder.phone_primary}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">المحافظة:</span>
                  <span className="font-bold text-slate-800">{duplicateWarning.matchedOrder.governorate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">إجمالي الأوردر:</span>
                  <span className="font-bold text-blue-600">{formatEgp(duplicateWarning.matchedOrder.order_total)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">العنوان:</span>
                  <span className="text-slate-700">{duplicateWarning.matchedOrder.address}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">تاريخ التسجيل:</span>
                  <span className="font-semibold text-slate-700">{duplicateWarning.matchedOrder.order_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">حالة التوصيل:</span>
                  <span className="font-bold text-slate-700">
                    {duplicateWarning.matchedOrder.delivery_status === "delivered" ? "تم التوصيل" :
                     duplicateWarning.matchedOrder.delivery_status === "handed_to_carrier" ? "مع المندوب" :
                     duplicateWarning.matchedOrder.delivery_status === "returned" ? "مرتجع" : "جديد"}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              يوجد أوردر مشابه مسجل بالفعل وقد يكون هذا الأوردر مكررًا. يمكنك اتخاذ القرار بإلغاء الإضافة أو إكمال الحفظ على أي حال.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="w-full sm:flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeCreateOrder}
                disabled={isPending}
                className="w-full sm:flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-600/20"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <span>إكمال / إضافة الأوردر على أي حال</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
