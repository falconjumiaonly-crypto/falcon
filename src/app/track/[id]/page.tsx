import { Metadata } from "next";
import Link from "next/link";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  AlertCircle,
  Copy,
  ChevronRight,
  ShieldCheck,
  Building2,
  HelpCircle,
  Share2,
} from "lucide-react";
import { getPublicOrderTrackingAction } from "@/app/actions/tracking";
import { formatEgp } from "@/lib/calculations";
import { getCustomerFriendlyStatus } from "@/lib/publicTracking";
import { PublicTrackingClientView } from "./client-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const short = id.slice(0, 8).toUpperCase();
  return {
    title: `تتبع شحنتك #${short} | فلكون للشحن`,
    description: `متابعة حالة الشحنة رقم ${short} في الوقت الفعلي وموعد التسليم المتوقع.`,
  };
}

export default async function PublicTrackingPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getPublicOrderTrackingAction(id);

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl border border-slate-200/80">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            تعذر العثور على الشحنة
          </h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {res.error || "تأكد من صحة رقم الشحنة أو كود الأوردر المرسل لك في رسالة التأكيد."}
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <Link
              href="/track"
              className="inline-flex items-center justify-center w-full h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all"
            >
              البحث برقم شحنة آخر
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tracking = res.data;
  const statusInfo = getCustomerFriendlyStatus(tracking.deliveryStatus);

  return (
    <div className="min-h-screen bg-slate-900/5 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] py-8 px-3 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-4">
        
        {/* Merchant Brand Header */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black shadow-md shadow-blue-600/20">
              🦅
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>فلكون تتبع الشحنات</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  مباشر
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">بوابة متابعة وتسليم الطرود</p>
            </div>
          </div>

          <Link
            href="/track"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            بحث جديد
          </Link>
        </div>

        {/* Interactive Client View (Timeline, COD Card, Share, Support) */}
        <PublicTrackingClientView tracking={tracking} statusInfo={statusInfo} />

        {/* Footer Guarantee */}
        <div className="text-center pt-2 pb-6 text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>تتبع موثق ومحمي عبر منصة فلكون للشحن والتوزيع</span>
        </div>

      </div>
    </div>
  );
}
