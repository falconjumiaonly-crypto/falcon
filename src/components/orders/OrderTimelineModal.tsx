"use client";

import { useState, useEffect, useTransition } from "react";
import {
  History,
  X,
  PackagePlus,
  Printer,
  Truck,
  CheckCircle2,
  RotateCcw,
  DollarSign,
  MessageSquare,
  PackageCheck,
  RefreshCw,
  Tag,
  Clock,
  User,
  Plus,
  Loader2,
  Calendar,
} from "lucide-react";
import { Order } from "@/types/database";
import { OrderAuditEvent, AuditActionType } from "@/lib/audit/orderAuditEngine";
import { getOrderTimelineAction, recordOrderAuditAction } from "@/app/actions/audit";
import { formatEgp } from "@/lib/calculations";

interface OrderTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function OrderTimelineModal({
  isOpen,
  onClose,
  orderId,
}: OrderTimelineModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual note state
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();

  const fetchTimeline = async (id: string) => {
    setLoading(true);
    const res = await getOrderTimelineAction(id);
    if (res.success && res.data) {
      setOrder(res.data.order);
      setTimeline(res.data.timeline);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchTimeline(orderId);
      setShowAddNote(false);
      setNoteTitle("");
      setNoteText("");
    }
  }, [isOpen, orderId]);

  if (!isOpen || !orderId) return null;

  const handleAddManualNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    startTransition(async () => {
      const title = noteTitle.trim() || "ملاحظة ومتابعة داخلية";
      const res = await recordOrderAuditAction(
        orderId,
        "order_edited",
        title,
        noteText.trim(),
        "التاجر"
      );
      if (res.success && res.data) {
        setTimeline((prev) => [res.data!, ...prev]);
        setNoteTitle("");
        setNoteText("");
        setShowAddNote(false);
      }
    });
  };

  const getEventIcon = (action: AuditActionType) => {
    switch (action) {
      case "order_created":
        return <PackagePlus className="w-4 h-4 text-blue-600" />;
      case "printed":
        return <Printer className="w-4 h-4 text-purple-600" />;
      case "handed_to_carrier":
        return <Truck className="w-4 h-4 text-amber-600" />;
      case "delivered":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "returned":
        return <RotateCcw className="w-4 h-4 text-rose-600" />;
      case "return_received":
        return <PackageCheck className="w-4 h-4 text-rose-600" />;
      case "settled":
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case "whatsapp_sent":
        return <MessageSquare className="w-4 h-4 text-emerald-600" />;
      case "carrier_synced":
        return <RefreshCw className="w-4 h-4 text-indigo-600" />;
      case "tag_updated":
        return <Tag className="w-4 h-4 text-indigo-600" />;
      default:
        return <History className="w-4 h-4 text-slate-600" />;
    }
  };

  const getEventBadgeClass = (action: AuditActionType) => {
    switch (action) {
      case "order_created":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "printed":
        return "bg-purple-50 border-purple-200 text-purple-800";
      case "handed_to_carrier":
        return "bg-amber-50 border-amber-200 text-amber-800";
      case "delivered":
        return "bg-emerald-50 border-emerald-200 text-emerald-800";
      case "returned":
      case "return_received":
        return "bg-rose-50 border-rose-200 text-rose-800";
      case "settled":
        return "bg-emerald-50 border-emerald-200 text-emerald-800";
      case "carrier_synced":
        return "bg-indigo-50 border-indigo-200 text-indigo-800";
      default:
        return "bg-slate-100 border-slate-200 text-slate-800";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>سجل العمليات وتاريخ الشحنة (Audit Trail)</span>
              </h2>
              {order ? (
                <p className="text-xs text-slate-300 mt-0.5">
                  العميل: <strong className="text-white">{order.customer_name}</strong> | المحافظة: {order.governorate} | المطلوب: {formatEgp(order.cod_amount)}
                </p>
              ) : (
                <p className="text-xs text-slate-300 mt-0.5">تتبع تاريخ التغييرات وتفاصيل خط سير الشحنة</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>إجمالي الأحداث المسجلة: <strong className="font-bold text-slate-900">{timeline.length}</strong> حدث</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddNote((prev) => !prev)}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>+ تسجيل ملاحظة داخلية</span>
          </button>
        </div>

        {/* Manual Note Form */}
        {showAddNote && (
          <form onSubmit={handleAddManualNote} className="p-4 bg-blue-50/50 border-b border-blue-200 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-blue-950">
              <span>إضافة ملاحظة أو متابعة لسجل الشحنة:</span>
              <button type="button" onClick={() => setShowAddNote(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                إلغاء
              </button>
            </div>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="عنوان الحدث (مثال: اتصال هاتفي بالعميل)"
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl"
            />
            <textarea
              rows={2}
              required
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="اكتب تفاصيل ما حدث بدقة (مثال: تم الاتصال بالعميل وأكد استلامه غداً من المندوب بعد الساعة 3 عصراً)..."
              className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl resize-none"
            />
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isPending || !noteText.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
              >
                تثبيت في السجل
              </button>
            </div>
          </form>
        )}

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
              <span>جاري تحميل السجل الكامل للشحنة...</span>
            </div>
          ) : timeline.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              لا توجد سجلات مسجلة لهذه الشحنة حتى الآن.
            </div>
          ) : (
            <div className="relative border-r-2 border-slate-200 mr-4 space-y-6">
              {timeline.map((evt, idx) => {
                const dateObj = new Date(evt.timestamp);
                const isRecent = idx === 0;

                return (
                  <div key={evt.id} className="relative pr-6">
                    {/* Circle Node */}
                    <div
                      className={`absolute -right-[13px] top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white shadow-sm ${
                        isRecent ? "border-blue-600 ring-4 ring-blue-500/10" : "border-slate-300"
                      }`}
                    >
                      {getEventIcon(evt.action)}
                    </div>

                    {/* Event Card */}
                    <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all space-y-1.5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{evt.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getEventBadgeClass(evt.action)}`}>
                            {evt.actor}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono" dir="ltr">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            {dateObj.toLocaleDateString("ar-EG", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            {dateObj.toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {evt.description}
                      </p>

                      {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                          {Object.entries(evt.metadata).map(([k, v]) => (
                            <span key={k} className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                              {k}: <strong>{String(v)}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
