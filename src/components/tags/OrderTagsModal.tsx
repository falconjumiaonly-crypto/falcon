"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Tag,
  Plus,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Palette,
  Sparkles,
} from "lucide-react";
import { OrderTag, PRESET_TAGS, COLOR_PALETTES } from "@/lib/tags/tagsEngine";
import {
  getCustomTagsAction,
  createCustomTagAction,
  assignTagsToOrderAction,
  batchAssignTagsAction,
} from "@/app/actions/tags";

interface OrderTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If targetOrderId is provided, single order mode
  targetOrderId?: string;
  initialSelectedTagIds?: string[];
  // If targetOrderIds is provided, bulk batch tagging mode
  targetOrderIds?: string[];
  onSuccess?: () => void;
}

export function OrderTagsModal({
  isOpen,
  onClose,
  targetOrderId,
  initialSelectedTagIds = [],
  targetOrderIds = [],
  onSuccess,
}: OrderTagsModalProps) {
  const [customTags, setCustomTags] = useState<OrderTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialSelectedTagIds);
  const [loading, setLoading] = useState(true);

  // New custom tag form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("indigo");

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isBulkMode = targetOrderIds.length > 0;

  useEffect(() => {
    if (isOpen) {
      setSelectedTagIds(initialSelectedTagIds);
      setLoading(true);
      getCustomTagsAction().then((res) => {
        if (res.success && res.data) {
          setCustomTags(res.data);
        }
        setLoading(false);
      });
    }
  }, [isOpen, initialSelectedTagIds]);

  if (!isOpen) return null;

  const showStatus = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    startTransition(async () => {
      const res = await createCustomTagAction(newTagName, newTagColor);
      if (res.success && res.data) {
        setCustomTags((prev) => [...prev, res.data!]);
        setSelectedTagIds((prev) => [...prev, res.data!.id]);
        setNewTagName("");
        setShowCreateForm(false);
        showStatus("success", `تم إنشاء الوسم "${res.data.name}" بنجاح`);
      } else {
        showStatus("error", res.error || "فشل إنشاء الوسم");
      }
    });
  };

  const handleSaveAssignments = () => {
    startTransition(async () => {
      if (isBulkMode) {
        const res = await batchAssignTagsAction(targetOrderIds, selectedTagIds, true);
        if (res.success) {
          showStatus("success", `تم تطبيق الوسوم على ${targetOrderIds.length} أوردر بنجاح`);
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 800);
        } else {
          showStatus("error", res.error || "فشل تطبيق الوسوم");
        }
      } else if (targetOrderId) {
        const res = await assignTagsToOrderAction(targetOrderId, selectedTagIds, true);
        if (res.success) {
          showStatus("success", "تم تحديث وسوم الأوردر بنجاح");
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 800);
        } else {
          showStatus("error", res.error || "فشل تحديث الوسوم");
        }
      }
    });
  };

  const allTags = [...PRESET_TAGS, ...customTags];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>وسوم وتصنيفات الشحنات</span>
                {isBulkMode && (
                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                    محدد: {targetOrderIds.length} أوردر
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                تصنيف عملي للطلبات وتضمين تعليمات المعاينة والاستبدال لبوالص الشحن تلقائياً.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700">اختر الوسوم المطلوبة:</h4>
            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>وسم مخصص جديد</span>
            </button>
          </div>

          {/* New Tag Form */}
          {showCreateForm && (
            <form
              onSubmit={handleCreateTagSubmit}
              className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                <span className="flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-indigo-600" />
                  إنشاء وسم جديد
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  إلغاء
                </button>
              </div>

              <div>
                <input
                  type="text"
                  required
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="اسم الوسم (مثال: شحن سريع طيران)"
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              {/* Color Choices */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">اللون:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Object.keys(COLOR_PALETTES).map((colorKey) => (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setNewTagColor(colorKey)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        COLOR_PALETTES[colorKey].bgClass
                      } ${
                        newTagColor === colorKey
                          ? "scale-125 border-slate-900 shadow-sm"
                          : "border-transparent"
                      }`}
                      title={colorKey}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isPending || !newTagName.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  إضافة الوسم
                </button>
              </div>
            </form>
          )}

          {/* Tags Chips Grid */}
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin mx-auto mb-2" />
              <span>جاري تحميل الوسوم...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {allTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? `${tag.bgClass} ${tag.borderClass} ring-2 ring-indigo-500/20 shadow-sm`
                        : "bg-slate-50/70 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? "bg-indigo-600" : "bg-slate-300"
                        }`}
                      />
                      <span className={`text-xs font-bold ${tag.textClass}`}>{tag.name}</span>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              <strong>ملاحظة للمندوب:</strong> الوسوم المحددة مثل <strong>مسموح المعاينة</strong> أو <strong>عاجل</strong> سيتم إدراجها آلياً في كشوفات وبوالص الشحن المطبوعة ليراها المندوب مباشرة.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSaveAssignments}
            disabled={isPending || (!targetOrderId && !isBulkMode)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <span>حفظ الوسوم المختارة</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
