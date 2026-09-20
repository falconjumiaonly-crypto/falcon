"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  Printer,
  FileSpreadsheet,
  PlusCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Truck,
  RotateCcw,
  Building2,
  Wallet,
} from "lucide-react";
import { formatEgp } from "@/lib/calculations";
import { getDashboardMetricsAction, DashboardMetrics } from "@/app/actions/orders";

export function DashboardView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardMetricsAction();
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        setError(res.error || "تعذر تحميل مؤشرات لوحة التحكم");
      }
    } catch {
      setError("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-black text-slate-900">
              لوحة التحكم والعمليات 🦅
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full">
              Falcon Shipping Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            متابعة حركة الشحن، بوالص الطباعة، والتسويات المالية النقدية في الوقت الفعلي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchMetrics()}
            disabled={loading}
            className="h-10 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>تحديث</span>
          </button>

          <Link
            href="/orders/create"
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>إنشاء بوليصة</span>
          </Link>

          <Link
            href="/print/queue"
            className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors relative"
          >
            <Printer className="w-4 h-4 text-purple-600" />
            <span>قائمة الطباعة</span>
            {Boolean(metrics && metrics.printPendingCount > 0) && (
              <span className="w-5 h-5 bg-purple-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {metrics?.printPendingCount}
              </span>
            )}
          </Link>

          <Link
            href="/import"
            className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>استيراد Excel</span>
          </Link>

          <Link
            href="/finance"
            className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Wallet className="w-4 h-4 text-blue-600" />
            <span>المالية والتسويات</span>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <Link
          href="/orders"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الطلبات</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {metrics ? metrics.totalOrders : "..."}
            </span>
            <span className="text-xs text-slate-400 mr-2">أوردر</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">عرض وإدارة جميع الطلبات</p>
        </Link>

        {/* Total Order Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي قيمة الأوردرات</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {metrics ? formatEgp(metrics.totalOrderValue) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            المدفوع مقدماً: {metrics ? formatEgp(metrics.totalPaidAmount) : "..."}
          </p>
        </div>

        {/* Total COD */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي تحصيل COD</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-700">
              {metrics ? formatEgp(metrics.totalCod) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">المطلوب تحصيله عند التسليم</p>
        </div>

        {/* Net Profit (Falcon) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">صافي ربح فلكون</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700">
              {metrics ? formatEgp(metrics.falconNetProfit) : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            إجمالي السعر - تكلفة الشحن ({metrics ? formatEgp(metrics.totalShippingCost) : "..."})
          </p>
        </div>

        {/* Print Pending */}
        <Link
          href="/print/queue"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">جاهز للطباعة</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Printer className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-700">
              {metrics ? metrics.printPendingCount : "..."}
            </span>
            <span className="text-xs text-slate-400 mr-2">بوليصة</span>
          </div>
          <p className="text-[11px] text-purple-600 font-medium mt-2">
            اضغط للانتقال لقائمة الطباعة ⟵
          </p>
        </Link>

        {/* Printed */}
        <Link
          href="/print/archive"
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تمت الطباعة</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">
              {metrics ? metrics.printedCount : "..."}
            </span>
            <span className="text-xs text-slate-400 mr-2">بوليصة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">أرشيف البوالص المطبوعة</p>
        </Link>

        {/* Pending with Carrier (Settlement) */}
        <Link
          href="/finance"
          className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm sm:col-span-2 hover:border-rose-400 hover:shadow-md transition-all group bg-gradient-to-r from-white to-rose-50/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-rose-800 block">
                مبالغ معلقة عند شركة الشحن (COD المستلم)
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                شحنات تم تسليمها بنجاح للعملاء وبانتظار توريد النقدية من شركة الشحن
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600">
              {metrics ? formatEgp(metrics.pendingCarrierCod) : "..."}
            </span>
            <span className="text-xs font-bold text-rose-700 bg-rose-100/70 px-2.5 py-1 rounded-lg">
              فتح شاشة التسويات ⟵
            </span>
          </div>
        </Link>
      </div>

      {/* Delivery Pipeline Counters */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          مراحل ومسار التوصيل للطلبات
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">أوردرات جديدة</span>
              <span className="text-lg font-black text-slate-900">
                {metrics?.deliveryCounts.new ?? 0}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">مع شركة الشحن</span>
              <span className="text-lg font-black text-slate-900">
                {metrics?.deliveryCounts.handed_to_carrier ?? 0}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">تم التوصيل</span>
              <span className="text-lg font-black text-emerald-700">
                {metrics?.deliveryCounts.delivered ?? 0}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">مرتجع</span>
              <span className="text-lg font-black text-rose-700">
                {metrics?.deliveryCounts.returned ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Split Section: Recent Orders & Top Governorates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">أحدث أوردرات مسجلة</h3>
            <Link
              href="/orders"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>عرض كل الطلبات</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!metrics || metrics.recentOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد طلبات مسجلة بعد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 pb-2">
                    <th className="pb-2 font-semibold">كود الأوردر</th>
                    <th className="pb-2 font-semibold">العميل</th>
                    <th className="pb-2 font-semibold">المحافظة</th>
                    <th className="pb-2 font-semibold">المطلوب (COD)</th>
                    <th className="pb-2 font-semibold">حالة الطباعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.recentOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 font-mono font-bold text-slate-800">
                        #{ord.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-2.5 font-bold text-slate-900">
                        {ord.customer_name}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {ord.governorate}
                      </td>
                      <td className="py-2.5 font-bold text-slate-900">
                        {ord.cod_amount === 0 ? (
                          <span className="text-emerald-700">مدفوع بالكامل</span>
                        ) : (
                          formatEgp(ord.cod_amount)
                        )}
                      </td>
                      <td className="py-2.5">
                        {ord.print_status === "printed" ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                            تم الطباعة
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold">
                            في الانتظار
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Governorates (1 Column) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">توزيع المحافظات</h3>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>

          {!metrics || metrics.topGovernorates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد بيانات متاحة بعد.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.topGovernorates.map((gov) => {
                const percentage = Math.round(
                  (gov.count / (metrics.totalOrders || 1)) * 100
                );
                return (
                  <div key={gov.governorate} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{gov.governorate}</span>
                      <span className="text-slate-500 font-mono">
                        {gov.count} أوردر ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 text-left" dir="ltr">
                      COD: {formatEgp(gov.totalCod)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
