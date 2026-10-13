"use client";

import React, { useState } from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  Copy,
  Check,
  Share2,
  Calendar,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { PublicOrderTrackingData } from "@/lib/publicTracking";
import { formatEgp } from "@/lib/calculations";

interface ClientViewProps {
  tracking: PublicOrderTrackingData;
  statusInfo: {
    headline: string;
    badgeClass: string;
    color: string;
  };
}

export function PublicTrackingClientView({ tracking, statusInfo }: ClientViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const formattedDate = new Date(tracking.orderDate).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Primary Status Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">رقم الشحنة</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-black font-mono text-slate-900">
                #{tracking.shortId}
              </span>
              <button
                onClick={handleCopyLink}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="نسخ الرابط"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{statusInfo.headline}</span>
          </div>
        </div>

        {/* Expected Cash on Delivery (COD) Callout Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-950 block">
              المبلغ المطلوب تحضيره عند الاستلام
            </span>
            <span className="text-[11px] text-emerald-700 font-medium">
              يرجى تجهيز المبلغ للمندوب لتسهيل الاستلام
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-800 font-mono">
              {formatEgp(tracking.codAmount)}
            </span>
          </div>
        </div>

        {/* Destination & Customer Summary */}
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">المستلم</span>
            <span className="font-bold text-slate-800 block truncate">
              {tracking.customerName}
            </span>
            <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
              {tracking.maskedPhone}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">الوجهة والمحافظة</span>
            <span className="font-bold text-slate-800 block truncate">
              {tracking.governorate}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
              {tracking.maskedAddress}
            </span>
          </div>
        </div>
      </div>

      {/* Real-Time Live Status Timeline */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 mb-5 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>خطوات تتبع الشحنة</span>
        </h3>

        <div className="relative pr-4 space-y-6 before:content-[''] before:absolute before:right-7 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {tracking.timeline.map((step, idx) => {
            const isCompleted = step.isCompleted;
            const isCurrent = step.isCurrent;
            const isAlert = step.isAlert;

            return (
              <div key={step.stepId} className="relative flex items-start gap-4">
                {/* Timeline Icon Node */}
                <div
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isAlert
                      ? "bg-rose-500 text-white ring-4 ring-rose-100"
                      : isCompleted
                      ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {isAlert ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 -mt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs font-black ${
                        isCurrent
                          ? "text-blue-600"
                          : isCompleted
                          ? "text-slate-900"
                          : "text-slate-400"
                      }`}
                    >
                      {step.title}
                    </h4>
                    {step.timestamp && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(step.timestamp).toLocaleDateString("ar-EG")}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] mt-0.5 leading-relaxed ${
                      isCompleted ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Support Action Cards */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-black text-slate-800">هل تحتاج مساعدة بخصوص طلبك؟</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            فريق خدمة العملاء جاهز للإجابة على استفساراتك فوراً.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopyLink}
            className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors flex-1 sm:flex-initial"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? "تم النسخ" : "مشاركة الرابط"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
