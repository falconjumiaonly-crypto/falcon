"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  Volume2,
  VolumeX,
  Trash2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Package,
  TrendingUp,
  Coins,
  ClipboardPaste,
  Loader2,
  Bot,
  RefreshCw,
  Phone,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { sendCopilotMessageAction } from "@/app/actions/copilot";
import {
  CopilotMessage,
  COPILOT_DEFAULT_PROMPTS,
} from "@/lib/copilot/merchantCopilotEngine";
import { playScanSuccessSound } from "@/lib/sound";

const INITIAL_MESSAGE: CopilotMessage = {
  id: "welcome_init",
  sender: "copilot",
  text: `أهلاً بك يا فندم! أنا **مساعد فلكون الذكي (Falcon Copilot)** 🦅.\nمستشارك اللحظي لحساب مستحقاتك، كشف سوابق العملاء، وتسجيل الشحنات بالعامية مباشرة.\n\nجرّب سؤالاً من الاقتراحات أدناه أو اكتب استفسارك مباشرة:`,
  timestamp: "الآن",
  actionType: "info",
  suggestedPrompts: COPILOT_DEFAULT_PROMPTS,
};

export function MerchantCopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([INITIAL_MESSAGE]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: CopilotMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await sendCopilotMessageAction(query);
      if (res.success && res.message) {
        setMessages((prev) => [...prev, res.message!]);
        if (soundEnabled) {
          playScanSuccessSound();
        }
      } else {
        const errorMsg: CopilotMessage = {
          id: `err_${Date.now()}`,
          sender: "copilot",
          text: `عذراً، حدث خطأ: ${res.error || "تعذر معالجة الطلب"}`,
          timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
          actionType: "error",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: CopilotMessage = {
        id: `err_${Date.now()}`,
        sender: "copilot",
        text: `تعذر الاتصال بالخادم: ${err.message}`,
        timestamp: "الآن",
        actionType: "error",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInput(text);
          inputRef.current?.focus();
        }
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  // Helper to render bold markdown and linebreaks
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Replace **text** with <strong>
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={idx} className="block min-h-[1.25em]">
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={pIdx} className="font-bold text-emerald-800 dark:text-emerald-300">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith("`") && part.endsWith("`")) {
              return (
                <code key={pIdx} className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-xs font-mono">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </span>
      );
    });
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 left-6 z-50 print:hidden flex flex-col items-start gap-2">
        {!isOpen && (
          <button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="group relative flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-emerald-400/30"
            title="مساعد فلكون الذكي (AI Copilot)"
          >
            <div className="relative">
              <Bot className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-emerald-700 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-emerald-700" />
            </div>
            <span className="font-bold text-sm tracking-wide flex items-center gap-1.5">
              مساعد فلكون الذكي
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </span>
          </button>
        )}
      </div>

      {/* Copilot Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 left-6 z-50 print:hidden transition-all duration-200 ${
            isMinimized
              ? "w-80 h-14"
              : "w-[92vw] sm:w-[420px] h-[600px] max-h-[85vh]"
          } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl`}
          dir="rtl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white px-4 py-3 flex items-center justify-between border-b border-slate-700 select-none">
            <div
              className="flex items-center gap-2.5 cursor-pointer flex-1"
              onClick={() => setIsMinimized((prev) => !prev)}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm flex items-center gap-1.5 leading-none">
                  مساعد فلكون الذكي
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  AI Merchant Copilot • متصل بالنظام
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={soundEnabled ? "كتم الصوت" : "تفعيل التنبيهات الصوتية"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="مسح سجل المحادثة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized((prev) => !prev)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-mono"
                title={isMinimized ? "تكبير" : "تصغير"}
              >
                {isMinimized ? "▲" : "▼"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 dark:bg-slate-950/70 text-sm">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-start" : "items-end"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3.5 leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-emerald-600 text-white rounded-br-none"
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-bl-none"
                      }`}
                    >
                      {msg.sender === "copilot" && (
                        <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="w-3 h-3" />
                          <span>فلكون AI</span>
                        </div>
                      )}

                      <div className="text-xs sm:text-[13px] whitespace-pre-wrap">
                        {renderFormattedText(msg.text)}
                      </div>

                      {/* Render Interactive Action Card if available */}
                      {msg.card && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                          {msg.card.type === "risk_check" && (
                            <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                              <div className="flex items-center justify-between font-bold">
                                <span>{msg.card.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    msg.card.data.risk_level === "high"
                                      ? "bg-rose-100 text-rose-700 border border-rose-300"
                                      : msg.card.data.risk_level === "medium"
                                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                                      : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                  }`}
                                >
                                  درجة المخاطر: {msg.card.data.risk_score}/100
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                                <div>طلبات سابقة: {msg.card.data.total_previous_orders}</div>
                                <div>نسبة المرتجع: {msg.card.data.return_rate_percentage}%</div>
                              </div>
                            </div>
                          )}

                          {msg.card.type === "dues" && (
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs space-y-2">
                              <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                <Coins className="w-4 h-4 text-emerald-600" />
                                {msg.card.title}
                              </div>
                              {msg.card.primaryAction && (
                                <Link
                                  href={msg.card.primaryAction.href || "/settlements"}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                                >
                                  {msg.card.primaryAction.label}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          )}

                          {msg.card.type === "order_created" && (
                            <div className="bg-teal-50 dark:bg-teal-950/30 p-2.5 rounded-xl border border-teal-200 dark:border-teal-800 text-xs space-y-1.5">
                              <div className="font-bold text-teal-800 dark:text-teal-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Package className="w-4 h-4 text-teal-600" />
                                  {msg.card.title}
                                </span>
                              </div>
                              {msg.card.primaryAction && (
                                <Link
                                  href={msg.card.primaryAction.href || "/orders"}
                                  className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-300 hover:underline mt-1"
                                >
                                  {msg.card.primaryAction.label}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          )}

                          {msg.card.type === "tracking" && (
                            <div className="bg-sky-50 dark:bg-sky-950/30 p-2.5 rounded-xl border border-sky-200 dark:border-sky-800 text-xs space-y-1.5">
                              <div className="font-bold text-sky-800 dark:text-sky-300">
                                {msg.card.title}
                              </div>
                              {msg.card.primaryAction?.href && (
                                <Link
                                  href={msg.card.primaryAction.href}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 font-bold text-sky-700 dark:text-sky-300 hover:underline"
                                >
                                  {msg.card.primaryAction.label}
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div
                        className={`text-[10px] mt-1 text-right ${
                          msg.sender === "user" ? "text-emerald-100" : "text-slate-400"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {/* Suggested Prompts Pills */}
                    {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-[95%]">
                        {msg.suggestedPrompts.map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => handleSend(prompt)}
                            disabled={isLoading}
                            className="bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-700 dark:text-slate-300 text-[11px] px-2.5 py-1 rounded-full shadow-2xs transition-colors flex items-center gap-1 active:scale-95"
                          >
                            <span>{prompt}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>فلكون AI يحلل البيانات ويجهز الرد...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="لصق رسالة أوردر من الحافظة"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="اسأل عن مستحقاتك، افحص عميل، أو الصق أوردر..."
                    disabled={isLoading}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center"
                    title="إرسال"
                  >
                    <Send className="w-4 h-4 transform rotate-180" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
