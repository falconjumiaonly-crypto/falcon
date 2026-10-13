"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  MessageSquare,
  Send,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Settings,
  Sparkles,
  Phone,
  User,
  ShoppingBag,
  Clock,
  Share2,
} from "lucide-react";
import { Order } from "@/types/database";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WhatsAppTemplateConfig,
  normalizePhoneForWhatsApp,
  interpolateWhatsAppTemplate,
  generateWhatsAppUrl,
} from "@/lib/whatsappNotifications";

interface WhatsAppNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

export function WhatsAppNotificationModal({
  isOpen,
  onClose,
  orders,
}: WhatsAppNotificationModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("printed_packing");
  const [customTemplateText, setCustomTemplateText] = useState<string>("");
  const [storeName, setStoreName] = useState("فلكون شيبنج");
  const [carrierName, setCarrierName] = useState("بوسطة (Bosta)");
  const [supportPhone, setSupportPhone] = useState("");

  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const [sentOrderIds, setSentOrderIds] = useState<string[]>([]);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => {
    return (
      DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      DEFAULT_WHATSAPP_TEMPLATES[0]
    );
  }, [selectedTemplateId]);

  const activeTemplateBody = customTemplateText || selectedTemplate.template;

  const currentOrder: Order | undefined = orders[activeOrderIndex] || orders[0];

  const currentMessage = useMemo(() => {
    if (!currentOrder) return "";
    return interpolateWhatsAppTemplate(activeTemplateBody, currentOrder, {
      storeName,
      carrierName,
      supportPhone,
    });
  }, [activeTemplateBody, currentOrder, storeName, carrierName, supportPhone]);

  if (!isOpen || orders.length === 0) return null;

  const handleSendSingle = (order: Order) => {
    const msg = interpolateWhatsAppTemplate(activeTemplateBody, order, {
      storeName,
      carrierName,
      supportPhone,
    });
    const url = generateWhatsAppUrl(order.phone_primary, msg);
    if (url) {
      window.open(url, "_blank");
      setSentOrderIds((prev) => (prev.includes(order.id) ? prev : [...prev, order.id]));
    }
  };

  const handleCopySingle = (order: Order) => {
    const msg = interpolateWhatsAppTemplate(activeTemplateBody, order, {
      storeName,
      carrierName,
      supportPhone,
    });
    navigator.clipboard.writeText(msg);
    setCopiedOrderId(order.id);
    setTimeout(() => setCopiedOrderId(null), 2500);
  };

  const handleSelectTemplate = (t: WhatsAppTemplateConfig) => {
    setSelectedTemplateId(t.id);
    setCustomTemplateText("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/60 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>إشعارات تتبع الأوردرات عبر واتساب</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-700/80 text-emerald-200 border border-emerald-500/30">
                  WhatsApp Dispatcher
                </span>
              </h2>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                إرسال رسائل المتابعة وتأكيد الشحن لعملاء المتجر مع مبالغ التحصيل وروابط التتبع بنقرة واحدة.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Template Selection & Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Template Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                اختر نوع الإشعار أو الرسالة:
              </label>
              <div className="space-y-2">
                {DEFAULT_WHATSAPP_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-white hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">
                          {tmpl.name}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Variables (Store Name, Carrier) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>إعدادات المتغيرات التلقائية</span>
              </h4>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    اسم المتجر
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    شركة الشحن
                  </label>
                  <input
                    type="text"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Edit Template Text Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نص القالب (يمكنك تعديله مباشرة):
              </label>
              <textarea
                value={activeTemplateBody}
                onChange={(e) => setCustomTemplateText(e.target.value)}
                rows={4}
                className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-1">
                <span>المتغيرات المتاحة:</span>
                <code className="text-emerald-700">{"{{customer_name}}"}</code>
                <code className="text-emerald-700">{"{{order_id}}"}</code>
                <code className="text-emerald-700">{"{{cod_amount}}"}</code>
                <code className="text-emerald-700">{"{{address}}"}</code>
              </div>
            </div>
          </div>

          {/* Right Column: WhatsApp Live Bubble Preview & Recipient Queue (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Live WhatsApp Bubble Preview */}
            <div className="bg-[#efeae2] border border-slate-300 rounded-2xl p-4 shadow-inner relative overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-black/10 mb-3 text-slate-600 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  معاينة الرسالة الفعلية للعميل
                </span>
                <span className="text-[10px] text-slate-500 font-mono">WhatsApp Preview</span>
              </div>

              {/* Chat Bubble */}
              <div className="bg-white rounded-2xl rounded-tr-none p-3.5 shadow-sm border border-black/5 max-w-sm mr-auto text-slate-800 text-xs whitespace-pre-line leading-relaxed font-sans relative">
                {currentMessage}
                <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400 font-mono">
                  <span>الآن</span>
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                </div>
              </div>
            </div>

            {/* Recipient Orders Queue List */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-slate-800">
                    قائمة المستلمين ({orders.length} عميل)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    تم الإرسال لـ: {sentOrderIds.length}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {orders.map((ord, idx) => {
                  const isSent = sentOrderIds.includes(ord.id);
                  const isCurrent = idx === activeOrderIndex;
                  const isCopied = copiedOrderId === ord.id;

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setActiveOrderIndex(idx)}
                      className={`p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isCurrent
                          ? "bg-emerald-50/50"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Left: Customer Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isSent
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isSent ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {ord.customer_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              #{ord.id.slice(0, 8).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                            <span>{ord.phone_primary}</span>
                            <span>•</span>
                            <span className="font-bold text-emerald-700">
                              {Number(ord.cod_amount || 0)} ج.م
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySingle(ord);
                          }}
                          className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="نسخ النص للحافظة"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendSingle(ord);
                          }}
                          className={`h-8 px-3 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm ${
                            isSent
                              ? "bg-slate-700 hover:bg-slate-800"
                              : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                          }`}
                          title="فتح محادثة واتساب وإرسال الرسالة"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSent ? "إعادة إرسال" : "إرسال واتساب"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            يتم تجهيز رسائل الواتساب بصيغة دولية موحدة متوافقة مع تطبيق واتساب للأجهزة والهواتف (wa.me).
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              إغلاق
            </button>

            {currentOrder && (
              <button
                onClick={() => handleSendSingle(currentOrder)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>إرسال واتساب للعميل الحالي ({currentOrder.customer_name})</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
