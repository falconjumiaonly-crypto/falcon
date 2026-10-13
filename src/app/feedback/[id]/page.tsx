import { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getOrderForFeedbackAction } from "@/app/actions/feedback";
import { FeedbackClientView } from "./client-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const short = id.slice(0, 8).toUpperCase();
  return {
    title: `تقييم طلبك #${short} | فلكون شيبنج`,
    description: `شاركنا رأيك في طلبك رقم ${short} ومستوى خدمة التوصيل.`,
  };
}

export default async function CustomerFeedbackPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getOrderForFeedbackAction(id);

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            تعذر العثور على الطلب
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            {res.error || "تأكد من فتح رابط التقييم المباشر المرسل لك في رسالة الواتساب."}
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/"
              className="inline-flex items-center justify-center w-full h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
            >
              الذهاب للصفحة الرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const order = res.data;

  return (
    <FeedbackClientView
      orderId={order.id}
      customerName={order.customerName}
      governorate={order.governorate}
      carrierName={order.carrierName}
      deliveryStatus={order.deliveryStatus}
    />
  );
}
