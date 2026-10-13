"use client";

import React, { useState } from "react";
import {
  Bot,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  Activity,
  Sparkles,
  Layers,
} from "lucide-react";
import { useWebMcp } from "./WebMcpProvider";

export function WebMcpInspectorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [executionOutput, setExecutionOutput] = useState<{
    tool: string;
    success: boolean;
    data?: any;
    error?: string;
  } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const { mcp, state } = useWebMcp();
  const tools = mcp ? mcp.listTools() : [];

  const handleRunTool = async (toolName: string) => {
    setExecutingTool(toolName);
    setExecutionOutput(null);
    try {
      const res = await mcp?.executeTool(toolName);
      setExecutionOutput({ tool: toolName, success: true, data: res });
    } catch (err: any) {
      setExecutionOutput({ tool: toolName, success: false, error: err.message });
    } finally {
      setExecutingTool(null);
    }
  };

  const sampleSnippet = `// In-Browser WebMCP interaction snippet for AI extensions
const falcon = window.__FALCON_WEBMCP__;
console.log("Falcon WebMCP State:", falcon.getState());

// Trigger actions directly
await falcon.executeTool("select_all_orders");
await falcon.executeTool("open_manifest_modal");`;

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-40 bg-slate-900/90 hover:bg-slate-900 text-white px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-500/40 shadow-lg shadow-indigo-500/20 backdrop-blur-md flex items-center gap-2 cursor-pointer transition-all hover:scale-105 print:hidden"
        title="فتح لوحة فحص وبرمجة WebMCP للذكاء الاصطناعي"
        dir="ltr"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <Bot className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-mono text-[11px] text-slate-200">WebMCP 1.0</span>
      </button>

      {/* Inspector Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight flex items-center gap-2">
                    <span>واجهة WebMCP التفاعلية للذكاء الاصطناعي</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                      Active 🟢
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    بروتوكول تفاعل وكلاء المتصفح والـ Browser Subagents مع عناصر الصفحة
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-right" dir="rtl">
              {/* State Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">المسار الحالي:</span>
                  <span className="font-mono font-bold text-slate-900 truncate block text-left" dir="ltr">
                    {state.currentPath || "/"}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">حالة البروتوكول:</span>
                  <span className="font-bold text-emerald-700 block">
                    جاهز للاستدعاء ⚡
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">الأدوات المفعلة:</span>
                  <span className="font-bold text-indigo-700 block">
                    {tools.length} أداة تفاعلية
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold block mb-0.5">الكائن العام:</span>
                  <span className="font-mono text-[11px] text-slate-700 block text-left truncate" dir="ltr">
                    window.__FALCON_WEBMCP__
                  </span>
                </div>
              </div>

              {/* Execution Feedback */}
              {executionOutput && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold flex flex-col gap-1.5 animate-in fade-in ${
                    executionOutput.success
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                      : "bg-rose-50 text-rose-900 border-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {executionOutput.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>
                      تنفيذ أداة <code className="font-mono bg-white/60 px-1 py-0.5 rounded">{executionOutput.tool}</code>:{" "}
                      {executionOutput.success ? "نجح بنجاح" : "حدث خطأ"}
                    </span>
                  </div>
                  <pre
                    className="p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto text-left max-h-32"
                    dir="ltr"
                  >
                    {JSON.stringify(executionOutput.data || executionOutput.error, null, 2)}
                  </pre>
                </div>
              )}

              {/* Registered In-Browser Tools */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    <span>قائمة أدوات الـ WebMCP المتاحة للذكاء الاصطناعي:</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    يمكنك تشغيل أي أداة تجريبياً
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition-colors text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-indigo-600 font-bold font-mono text-[11px]">
                            {tool.name}
                          </code>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {tool.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRunTool(tool.name)}
                        disabled={executingTool === tool.name}
                        className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-indigo-600" />
                        <span>{executingTool === tool.name ? "جاري..." : "تشغيل"}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Console Code Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-600" />
                    <span>كود الاستدعاء البرمجي لوكلاء الذكاء الاصطناعي (Browser Agent SDK):</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sampleSnippet);
                      setCopiedSnippet(true);
                      setTimeout(() => setCopiedSnippet(false), 2500);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>نسخ الكود</span>
                      </>
                    )}
                  </button>
                </div>

                <pre
                  className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-xl overflow-x-auto text-left leading-relaxed"
                  dir="ltr"
                >
                  {sampleSnippet}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3.5 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                متوافق مع أدوات المتصفح AI DevTools & WebMCP 2024-11
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all"
              >
                إغلاق اللوحة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
