"use client";

import { useState, useMemo } from "react";
import {
  Truck,
  Award,
  Zap,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Clock,
  DollarSign,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Filter,
  Search
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  calculateCarrierAnalytics,
  CarrierAnalyticsOverview,
} from "@/lib/analytics/carrierAnalytics";

interface CarrierAnalyticsDashboardProps {
  orders: Order[];
}

export function CarrierAnalyticsDashboard({ orders }: CarrierAnalyticsDashboardProps) {
  const [govFilter, setGovFilter] = useState("all");
  const [searchGov, setSearchGov] = useState("");

  const analytics: CarrierAnalyticsOverview = useMemo(() => {
    return calculateCarrierAnalytics(orders);
  }, [orders]);

  const filteredGovs = useMemo(() => {
    return analytics.governorateComparisons.filter((g) => {
      if (govFilter !== "all" && g.governorate !== govFilter) return false;
      if (searchGov.trim() && !g.governorate.includes(searchGov.trim())) return false;
      return true;
    });
  }, [analytics, govFilter, searchGov]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
              تحليل ومقارنة أداء شركات الشحن (Carrier Performance Matrix)
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>ذكاء التوصيل</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            مقارنة دقيقة لنسب التسليم الفعلية، سرعة التوصيل بالأيام، وخسائر شحن المرتجعات لاختيار شركة الشحن الأفضل في كل محافظة.
          </p>
        </div>

        <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 self-start md:self-auto">
          تم تحليل <strong className="text-blue-600 font-mono text-sm">{analytics.totalShipmentsAnalyzed}</strong> شحنة
        </div>
      </div>

      {/* Top Winner Badges (Trophies) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Highest Delivery Success */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
              أعلى نسبة تسليم للعملاء
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black">{analytics.bestOverallCarrier}</h3>
            <p className="text-xs text-emerald-100 mt-1">
              أعلى معدل تسليم ونجاح في تحصيل المبالغ النقدية
            </p>
          </div>
        </div>

        {/* Fastest Delivery Speed */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">
              أسرع تسليم للعميل (Speed)
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black">{analytics.fastestCarrier}</h3>
            <p className="text-xs text-blue-100 mt-1">
              أقل متوسط أيام من التسليم للمندوب حتى وصول الطرد للعميل
            </p>
          </div>
        </div>

        {/* Lowest Return Loss */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-100 uppercase tracking-wider">
              أقل نسبة ارتداد وخسارة شحن
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-black">{analytics.lowestReturnCarrier}</h3>
            <p className="text-xs text-amber-100 mt-1">
              أقل نسبة مرتجعات مخصومة التكلفة من أرباح المتجر
            </p>
          </div>
        </div>
      </div>

      {/* Head-to-Head Carrier Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics.carrierStats.map((c) => (
          <div
            key={c.carrierKey}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{c.carrierName}</h3>
                  <span className="text-xs text-slate-500 font-mono">
                    إجمالي الشحنات: {c.totalShipments} أوردر
                  </span>
                </div>
              </div>

              <div className="text-left font-mono" dir="ltr">
                <span className="text-xs font-bold text-slate-400 block">متوسط سرعة التسليم</span>
                <span className="text-base font-black text-slate-900 flex items-center justify-end gap-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>{c.avgDeliverySpeedDays} يوم</span>
                </span>
              </div>
            </div>

            {/* Performance Bars */}
            <div className="space-y-3">
              {/* Delivery Success Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">نسبة نجاح التسليم (Delivered)</span>
                  <span className="font-black text-emerald-700 font-mono text-sm">
                    {c.deliverySuccessRate}% ({c.deliveredCount} أوردر)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(c.deliverySuccessRate, 2)}%` }}
                  />
                </div>
              </div>

              {/* Return Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">نسبة المرتجعات (Returned)</span>
                  <span className="font-black text-rose-700 font-mono text-sm">
                    {c.returnRate}% ({c.returnedCount} أوردر)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(c.returnRate, 2)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Detailed Financial Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px] block">التحصيل (COD)</span>
                <span className="font-black font-mono text-slate-900 block mt-0.5">
                  {formatEgp(c.totalCodCollected)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px] block">مصاريف الشحن</span>
                <span className="font-black font-mono text-slate-900 block mt-0.5">
                  {formatEgp(c.totalShippingPaid)}
                </span>
              </div>

              <div className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                <span className="text-rose-700 text-[11px] font-bold block">خسارة المرتجعات</span>
                <span className="font-black font-mono text-rose-700 block mt-0.5">
                  {formatEgp(c.shippingPenaltyLoss)}
                </span>
              </div>

              <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                <span className="text-blue-700 text-[11px] font-bold block">قيد الشحن بالسوق</span>
                <span className="font-black font-mono text-blue-700 block mt-0.5">
                  {c.inTransitCount} طرد
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Governorate Intelligence & Recommendations Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <span>مصفوفة التوصيات الذكية حسب المحافظة (Governorate Carrier Routing)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              توجيه كل شحنة للشركة صاحبة أعلى نسبة تسليم في محافظتها لرفع نسبة تسليم متجرك وتقليل المرتجعات.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchGov}
                onChange={(e) => setSearchGov(e.target.value)}
                placeholder="ابحث بالمحافظة..."
                className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="p-3">المحافظة</th>
                <th className="p-3">الشركة الموصى بها للشحن</th>
                <th className="p-3">سبب التوصية الذكية</th>
                <th className="p-3">مقارنة أداء الشركات بالأرقام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGovs.map((gov) => (
                <tr key={gov.governorate} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                    {gov.governorate}
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{gov.recommendedCarrier}</span>
                    </span>
                  </td>

                  <td className="p-3 text-slate-600 font-medium">
                    {gov.recommendedReason}
                  </td>

                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {gov.carriers.map((c) => (
                        <div
                          key={c.carrierName}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono flex items-center gap-2"
                        >
                          <span className="font-bold text-slate-800 font-sans">{c.carrierName}:</span>
                          <span className="text-emerald-700 font-bold">تسليم {c.deliveryRate}%</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-rose-700">مرتجع {c.returnRate}%</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
