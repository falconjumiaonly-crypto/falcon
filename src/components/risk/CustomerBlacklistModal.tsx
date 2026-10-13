"use client";

import { useState, useEffect, useTransition } from "react";
import {
  ShieldAlert,
  Plus,
  Trash2,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserX,
  RefreshCw,
  Phone,
  FileText
} from "lucide-react";
import { BlacklistEntry } from "@/lib/risk/customerRiskEngine";
import {
  getBlacklistAction,
  addToBlacklistAction,
  removeFromBlacklistAction,
} from "@/app/actions/risk";

interface CustomerBlacklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhoneToAdd?: string;
  initialNameToAdd?: string;
}

export function CustomerBlacklistModal({
  isOpen,
  onClose,
  initialPhoneToAdd = "",
  initialNameToAdd = "",
}: CustomerBlacklistModalProps) {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Add Entry Form state
  const [showAddForm, setShowAddForm] = useState(Boolean(initialPhoneToAdd));
  const [newPhone, setNewPhone] = useState(initialPhoneToAdd);
  const [newName, setNewName] = useState(initialNameToAdd);
  const [newReason, setNewReason] = useState("رفض استلام متكرر مع المندوب");

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchBlacklist = async () => {
    setLoading(true);
    const res = await getBlacklistAction();
    if (res.success && res.data) {
      setBlacklist(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchBlacklist();
      if (initialPhoneToAdd) {
        setNewPhone(initialPhoneToAdd);
        setNewName(initialNameToAdd);
        setShowAddForm(true);
      }
    }
  }, [isOpen, initialPhoneToAdd, initialNameToAdd]);

  if (!isOpen) return null;

  const showStatus = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      showStatus("error", "يرجى كتابة رقم الهاتف");
      return;
    }

    startTransition(async () => {
      const res = await addToBlacklistAction(newPhone, newName, newReason);
      if (res.success && res.data) {
        setBlacklist((prev) => [res.data!, ...prev.filter((b) => b.phone !== res.data!.phone)]);
        setShowAddForm(false);
        setNewPhone("");
        setNewName("");
        showStatus("success", `تم إدراج الرقم (${res.data.phone}) بالقائمة السوداء بنجاح`);
      } else {
        showStatus("error", res.error || "فشل إضافة الرقم");
      }
    });
  };

  const handleRemove = (phone: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من فك الحظر عن العميل (${name || phone})؟`)) return;

    startTransition(async () => {
      const res = await removeFromBlacklistAction(phone);
      if (res.success) {
        setBlacklist((prev) => prev.filter((b) => b.phone !== phone));
        showStatus("success", `تم فك الحظر عن الرقم (${phone})`);
      } else {
        showStatus("error", res.error || "فشل فك الحظر");
      }
    });
  };

  const filtered = blacklist.filter((b) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return b.phone.includes(q) || b.name.toLowerCase().includes(q) || b.reason.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold border border-rose-500/30">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>سجل القائمة السوداء والعملاء المحظورين</span>
                <span className="px-2 py-0.5 bg-rose-500 text-white text-[11px] font-bold rounded-full">
                  حماية من الاحتيال
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                تنبيه فوري عند محاولة إنشاء أوردر لأي رقم مسجل هنا لمنع خسارة مصاريف الشحن على الفاضي.
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

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`m-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Controls Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالرقم أو اسم العميل..."
              className="w-full pr-8 pl-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>حظر رقم جديد</span>
          </button>
        </div>

        {/* Add Entry Form */}
        {showAddForm && (
          <form onSubmit={handleAddSubmit} className="p-4 bg-rose-50/40 border-b border-rose-200 space-y-3">
            <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>إدراج عميل بالقائمة السوداء:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم الهاتف *</label>
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم العميل (اختياري)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="محمد أحمد"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">سبب الحظر</label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="رفض استلام متكرر"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-600 font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isPending || !newPhone.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
              >
                تأكيد الحظر
              </button>
            </div>
          </form>
        )}

        {/* List Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto mb-2" />
              <span>جاري تحميل سجل المحظورين...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد أرقام مسجلة بالقائمة السوداء حالياً.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">رقم الهاتف</th>
                    <th className="p-3">اسم العميل</th>
                    <th className="p-3">سبب الحظر</th>
                    <th className="p-3">تاريخ الإدراج</th>
                    <th className="p-3 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((b) => (
                    <tr key={b.phone} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-rose-700" dir="ltr">
                        {b.phone}
                      </td>
                      <td className="p-3 font-bold text-slate-900">{b.name}</td>
                      <td className="p-3 text-slate-600">{b.reason}</td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">
                        {new Date(b.addedAt).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemove(b.phone, b.name)}
                          disabled={isPending}
                          className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="فك الحظر عن هذا الرقم"
                        >
                          فك الحظر
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            إجمالي الأرقام المحظورة: <strong className="font-mono font-bold text-slate-900">{blacklist.length}</strong> عميل
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
