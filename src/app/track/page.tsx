"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Package,
  Truck,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { getPublicOrderTrackingAction } from "@/app/actions/tracking";

export default function TrackSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim().replace(/^#+/, "");
    if (!clean) {
      setError("يرجى إدخال رقم الشحنة أو رقم الهاتف");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await getPublicOrderTrackingAction(clean);
      if (res.success && res.data) {
        router.push(`/track/${res.data.orderId}`);
      } else {
        setError(res.error || "لم يتم العثور على شحنة تطابق هذا الرقم");
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-900/5 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] py-12 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Brand Card */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-xl shadow-blue-600/20 mb-3">
            🦅
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            تتبع شحنتك لحظة بلحظة
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            أدخل كود الأوردر أو رقم البوليصة أو رقم الهاتف لمتابعة موقع طردك وموعد التسليم المتوقع.
          </p>
        </div>

        {/* Search Box Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="رقم الشحنة (مثال: 9F8E7D6C) أو رقم الهاتف..."
                className="w-full h-13 pr-12 pl-4 text-sm font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10 transition-all"
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>{isPending ? "جاري البحث عن الشحنة..." : "تتبع الشحنة الآن"}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Help */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>تتبع آمن ومشفر للطرود</span>
            <div className="flex items-center gap-1 text-emerald-600 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>فلكون شيبنج</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
