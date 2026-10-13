"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu, Calendar, ShieldCheck, Bot, Star } from "lucide-react";
import { useEffect, useState } from "react";

const CustomerFeedbackModal = dynamic(
  () => import("@/components/feedback/CustomerFeedbackModal").then((m) => m.CustomerFeedbackModal),
  { ssr: false }
);

interface HeaderProps {
  onToggleSidebar: () => void;
}

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "لوحة التحكم", subtitle: "نظرة عامة على أداء الشحن والعمليات" },
  "/orders/create": { title: "إنشاء بوليصة شحن جديدة", subtitle: "إدخال بيانات العميل والطلب وحساب COD" },
  "/orders": { title: "إدارة الطلبات", subtitle: "عرض وتعديل وتصفية جميع طلبات الشحن" },
  "/import": { title: "استيراد ملف Excel", subtitle: "رفع ملفات إكسيل وإدراج الطلبات جماعياً" },
  "/print/queue": { title: "قائمة الطباعة", subtitle: "أوامر الشحن الجاهزة لطباعة البوالص" },
  "/print/archive": { title: "تم الطباعة", subtitle: "أرشيف البوالص المطبوعة وإعادة الطباعة" },
  "/finance": { title: "المالية والتسويات", subtitle: "متابعة مستحقات شركة الشحن والأرباح والتسويات" },
  "/settings": { title: "الإعدادات والتكاملات", subtitle: "إعدادات فلكون، الشعار، ومفاتيح Make / n8n" },
};

export function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const [currentDate, setCurrentDate] = useState<string>("");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);

  useEffect(() => {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    setCurrentDate(formatted);
  }, []);

  const pageInfo = Object.entries(pageTitles).find(([route]) =>
    pathname === route || (route !== "/dashboard" && pathname.startsWith(route))
  )?.[1] || { title: "Falcon - فلكون", subtitle: "نظام إدارة الشحن اللوجستي" };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30 print:hidden">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden focus:outline-none"
          aria-label="فتح القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            {pageInfo.title}
          </h2>
          {pageInfo.subtitle && (
            <p className="text-xs text-slate-500 hidden sm:block">
              {pageInfo.subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentDate && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentDate}</span>
          </div>
        )}

        <div
          data-webmcp-status="active"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700"
          title="واجهة WebMCP مفعلة وجاهزة للاتصال مع وكلاء الذكاء الاصطناعي"
        >
          <Bot className="w-3.5 h-3.5 text-indigo-600" />
          <span>WebMCP متصل</span>
        </div>

        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 transition-colors cursor-pointer"
          title="استعراض تقييمات العملاء واستبيانات رضاء ما بعد الاستلام"
        >
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
          <span>تقييمات العملاء</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>نظام فلكون نشط</span>
        </div>

        <CustomerFeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
        />
      </div>
    </header>
  );
}
