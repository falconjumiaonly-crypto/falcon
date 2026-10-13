"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  RotateCcw,
  Barcode,
  Search,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  ShieldAlert,
  X,
  FileSpreadsheet,
  Building,
  RefreshCw,
  Clock,
  ArrowRight
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import { playScanSuccessSound, playScanErrorSound } from "@/lib/sound";
import {
  calculateReturnsMetrics,
  isPhysicalReturnReceived,
  isReturnDisputedLost,
  PHYSICAL_RETURN_TAG,
  DISPUTED_LOST_TAG
} from "@/lib/returnsManager";
import {
  markOrderReturnReceivedAction,
  markOrderReturnDisputedAction
} from "@/app/actions/orders";

interface ReturnReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onRefresh: () => void;
}

export function ReturnReceivingModal({
  isOpen,
  onClose,
  orders,
  onRefresh,
}: ReturnReceivingModalProps) {
  const [scanInput, setScanInput] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [disputeModalOrder, setDisputeModalOrder] = useState<Order | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [activeTab, setActiveTab] = useState<"missing" | "received" | "disputed" | "governorates">("missing");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Compute returns metrics
  const metrics = useMemo(() => {
    return calculateReturnsMetrics(orders);
  }, [orders]);

  // Returned orders subset
  const returnedOrders = useMemo(() => {
    return orders.filter((o) => o.delivery_status === "returned");
  }, [orders]);

  const missingReturns = useMemo(() => {
    return returnedOrders.filter((o) => !isPhysicalReturnReceived(o) && !isReturnDisputedLost(o));
  }, [returnedOrders]);

  const receivedReturns = useMemo(() => {
    return returnedOrders.filter((o) => isPhysicalReturnReceived(o));
  }, [returnedOrders]);

  const disputedReturns = useMemo(() => {
    return returnedOrders.filter((o) => isReturnDisputedLost(o));
  }, [returnedOrders]);

  if (!isOpen) return null;

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanInput.trim();
    if (!query) return;

    // Find order matching ID, phone, or code
    const cleanQuery = query.replace(/^#/, "").toUpperCase();
    const match = returnedOrders.find((o) => {
      const idUpper = o.id.toUpperCase();
      const shortId = o.id.slice(0, 8).toUpperCase();
      return (
        idUpper === cleanQuery ||
        shortId === cleanQuery ||
        o.phone_primary === query ||
        o.phone_secondary === query
      );
    });

    if (!match) {
      // Also check if it exists in all orders but isn't marked returned yet
      const anyMatch = orders.find((o) => {
        const idUpper = o.id.toUpperCase();
        const shortId = o.id.slice(0, 8).toUpperCase();
        return (
          idUpper === cleanQuery ||
          shortId === cleanQuery ||
          o.phone_primary === query ||
          o.phone_secondary === query
        );
      });

      if (anyMatch) {
        // Automatically mark as returned AND received!
        setIsProcessing(true);
        try {
          const res = await markOrderReturnReceivedAction(anyMatch.id);
          if (res.success) {
            playScanSuccessSound();
            setFeedback({
              type: "success",
              message: `تم تحويل الأوردر #${anyMatch.id.slice(0, 8)} لمرتجع واستلامه بالمخزن بنجاح!`,
            });
            setScanInput("");
            onRefresh();
          } else {
            playScanErrorSound();
            setFeedback({ type: "error", message: res.error || "فشل تسجيل الاستلام" });
          }
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      playScanErrorSound();
      setFeedback({
        type: "error",
        message: `لم يتم العثور على أوردر يطابق الكود أو الرقم (${query})`,
      });
      return;
    }

    if (isPhysicalReturnReceived(match)) {
      playScanErrorSound();
      setFeedback({
        type: "warning",
        message: `الأوردر #${match.id.slice(0, 8)} تم استلامه بالمخزن بالفعل سابقاً!`,
      });
      setScanInput("");
      return;
    }

    // Process check-in
    setIsProcessing(true);
    try {
      const res = await markOrderReturnReceivedAction(match.id);
      if (res.success) {
        playScanSuccessSound();
        setFeedback({
          type: "success",
          message: `تم فحص واستلام الطرد المرتجع #${match.id.slice(0, 8)} (${match.customer_name}) بالمخزن بنجاح!`,
        });
        setScanInput("");
        onRefresh();
      } else {
        playScanErrorSound();
        setFeedback({ type: "error", message: res.error || "فشل تسجيل الاستلام" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickCheckin = async (orderId: string) => {
    setIsProcessing(true);
    try {
      const res = await markOrderReturnReceivedAction(orderId);
      if (res.success) {
        playScanSuccessSound();
        setFeedback({
          type: "success",
          message: `تم تأكيد استلام الطرد بنجاح في عهدة المخزن!`,
        });
        onRefresh();
      } else {
        playScanErrorSound();
        setFeedback({ type: "error", message: res.error || "فشل تسجيل الاستلام" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDispute = async () => {
    if (!disputeModalOrder) return;
    setIsProcessing(true);
    try {
      const res = await markOrderReturnDisputedAction(
        disputeModalOrder.id,
        disputeReason.trim() || "لم يتم تسليم الطرد للمخزن بواسطة المندوب"
      );
      if (res.success) {
        setFeedback({
          type: "warning",
          message: `تم تسجيل مطالبة رسمية بفقدان الطرد #${disputeModalOrder.id.slice(0, 8)} لمطالبة شركة الشحن بالتعويض`,
        });
        setDisputeModalOrder(null);
        setDisputeReason("");
        onRefresh();
      } else {
        setFeedback({ type: "error", message: res.error || "فشل تسجيل المطالبة" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold border border-rose-500/30">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>إدارة عهدة المرتجعات وفحص الاستلام بالمخزن</span>
                <span className="px-2 py-0.5 bg-rose-500 text-white text-[11px] font-bold rounded-full">
                  حماية البضاعة
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                تأكيد دخول الطرود المرتجعة فعلياً للمخزن لمنع سرقة أو ضياع البضائع لدى مندوبي شركات الشحن.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">إجمالي المرتجعات</span>
            <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
              {metrics.totalReturnedCount} طرد
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              نسبة الارتجاع العامة: {metrics.returnRate}%
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20">
            <span className="text-[11px] font-bold text-emerald-800 block">مستلم بالمخزن (آمن)</span>
            <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
              {metrics.physicalReceivedCount} طرد
            </span>
            <span className="text-[10px] text-emerald-600 font-bold">
              تم فحص البضاعة واستردادها
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/30">
            <span className="text-[11px] font-bold text-rose-800 block">مفقود / مع المندوب</span>
            <span className="text-xl font-black text-rose-700 font-mono mt-1 block">
              {metrics.physicalMissingCount} طرد
            </span>
            <span className="text-[10px] text-rose-600 font-bold">
              قيمة معلقة: {formatEgp(metrics.merchandiseValueAtRisk)}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20">
            <span className="text-[11px] font-bold text-amber-800 block">خسارة شحن المرتجعات</span>
            <span className="text-xl font-black text-amber-700 font-mono mt-1 block">
              {formatEgp(metrics.totalShippingPenaltyLoss)}
            </span>
            <span className="text-[10px] text-amber-600 font-bold">
              مصاريف شحن مخصومة
            </span>
          </div>
        </div>

        {/* Barcode Fast Scanner Bar */}
        <div className="p-4 bg-white border-b border-slate-200">
          <form onSubmit={handleScanSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="امسح الباركود أو اكتب كود الأوردر / رقم الهاتف لفحص واستلام المرتجع فوراً..."
                className="w-full pr-11 pl-4 py-2.5 text-sm bg-slate-50 border-2 border-rose-300 focus:border-rose-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-rose-500/10 font-mono"
                disabled={isProcessing}
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing || !scanInput.trim()}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>استلام بالمخزن</span>
            </button>
          </form>

          {feedback && (
            <div
              className={`mt-3 p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                feedback.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : feedback.type === "warning"
                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-700 text-xs"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab("missing")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "missing"
                ? "border-rose-600 text-rose-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>بانتظار الاستلام بالمخزن ({missingReturns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("received")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "received"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>تم استلامها بالمخزن ({receivedReturns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("disputed")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "disputed"
                ? "border-amber-600 text-amber-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>مطالبات طرود مفقودة ({disputedReturns.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("governorates")}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "governorates"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building className="w-3.5 h-3.5 text-blue-600" />
            <span>تحليل المحافظات وخسائر الشحن ({metrics.returnsByGovernorate.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "governorates" ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">المحافظة</th>
                    <th className="p-3">إجمالي الأوردرات</th>
                    <th className="p-3">المرتجعات</th>
                    <th className="p-3">نسبة الارتجاع</th>
                    <th className="p-3">إجمالي خسارة مصاريف الشحن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.returnsByGovernorate.map((g) => (
                    <tr key={g.governorate} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{g.governorate}</td>
                      <td className="p-3 font-mono">{g.totalOrders}</td>
                      <td className="p-3 font-mono font-bold text-rose-700">{g.returnedCount}</td>
                      <td className="p-3 font-mono">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          g.returnRate > 30 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-800"
                        }`}>
                          {g.returnRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 font-mono font-black text-rose-700">
                        {formatEgp(g.penaltyLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {(() => {
                const list =
                  activeTab === "missing"
                    ? missingReturns
                    : activeTab === "received"
                    ? receivedReturns
                    : disputedReturns;

                if (list.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      لا توجد أوردرات في هذا القسم حالياً.
                    </div>
                  );
                }

                return (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">كود الأوردر</th>
                        <th className="p-3">العميل والمحافظة</th>
                        <th className="p-3">قيمة المنتجات</th>
                        <th className="p-3">تكلفة الشحن الضائعة</th>
                        <th className="p-3">حالة العهدة</th>
                        <th className="p-3 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {list.map((ord) => {
                        const isReceived = isPhysicalReturnReceived(ord);
                        const isDisputed = isReturnDisputedLost(ord);
                        const merchandiseVal = Math.max(0, (ord.order_total || 0) - (ord.shipping_cost || 0));

                        return (
                          <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-900">
                              #{ord.id.slice(0, 8).toUpperCase()}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{ord.customer_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {ord.governorate} - {ord.phone_primary}
                              </div>
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-700">
                              {formatEgp(merchandiseVal)}
                            </td>
                            <td className="p-3 font-mono font-black text-rose-700">
                              {formatEgp(ord.shipping_cost)}
                            </td>
                            <td className="p-3">
                              {isReceived ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  مستلم بالمخزن
                                </span>
                              ) : isDisputed ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                                  مطالبة طرد مفقود
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  مع المندوب (لم يصل المخزن)
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {!isReceived && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleQuickCheckin(ord.id)}
                                    disabled={isProcessing}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="تأكيد وصول الطرد للرفوف بالمخزن"
                                  >
                                    <PackageCheck className="w-3 h-3" />
                                    <span>استلام المخزن</span>
                                  </button>

                                  {!isDisputed && (
                                    <button
                                      onClick={() => setDisputeModalOrder(ord)}
                                      disabled={isProcessing}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="تسجيل مطالبة فقدان طرد لمتابعة شركة الشحن"
                                    >
                                      <ShieldAlert className="w-3 h-3" />
                                      <span>مطالبة</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            يتم فحص الطرود المرتجعة فور وصول المندوب بالمخزن لضمان عدم ضياع أي منتجات.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Submodal for Filing a Lost Dispute */}
      {disputeModalOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>تسجيل مطالبة طرد مفقود ضد شركة الشحن</span>
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              الأوردر: #{disputeModalOrder.id.slice(0, 8).toUpperCase()} - العميل: {disputeModalOrder.customer_name}
              <br />
              قيمة البضاعة المعرضة للفقدان: <strong className="text-rose-700">{formatEgp(Math.max(0, (disputeModalOrder.order_total || 0) - (disputeModalOrder.shipping_cost || 0)))}</strong>
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">سبب المطالبة أو ملاحظة المندوب:</label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="مثال: المندوب سجل الأوردر مرتجع من أسبوع ولم يقم بتسليم الطرد للمخزن حتى الآن"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setDisputeModalOrder(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDispute}
                disabled={isProcessing}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                تأكيد تسجيل المطالبة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
