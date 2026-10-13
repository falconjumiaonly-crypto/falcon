"use client";

import React from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
  Barcode,
  Layers,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import { calculateDispatchMetrics } from "@/lib/dispatchTracker";

interface DispatchTrackerCardsProps {
  orders: Order[];
  activeDeliveryStatus: string;
  onSelectDeliveryStatus: (status: string) => void;
  onOpenScanner: () => void;
}

export function DispatchTrackerCards({
  orders,
  activeDeliveryStatus,
  onSelectDeliveryStatus,
  onOpenScanner,
}: DispatchTrackerCardsProps) {
  const metrics = calculateDispatchMetrics(orders);

  return (
    <div className="space-y-3">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Remaining In Warehouse */}
        <div
          onClick={() => onSelectDeliveryStatus(activeDeliveryStatus === "new" ? "all" : "new")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
            activeDeliveryStatus === "new"
              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 ring-2 ring-blue-600/30"
              : "bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-black ${
                activeDeliveryStatus === "new" ? "text-blue-100" : "text-slate-800"
              }`}
            >
              في المخزن (لم يُشحن بعد)
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                activeDeliveryStatus === "new"
                  ? "bg-white/20 text-white"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              <Package className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono">
              {metrics.remainingInWarehouse.total}
            </span>
            <span
              className={`text-[11px] font-bold ${
                activeDeliveryStatus === "new" ? "text-blue-200" : "text-slate-400"
              }`}
            >
              شحنة
            </span>
          </div>

          <div
            className={`mt-2 pt-2 border-t text-[11px] font-medium flex items-center justify-between ${
              activeDeliveryStatus === "new"
                ? "border-white/20 text-blue-100"
                : "border-slate-100 text-slate-500"
            }`}
          >
            <span>
              جاهز: <b className="font-bold">{metrics.remainingInWarehouse.printedReady}</b> | ينتظر:{" "}
              <b>{metrics.remainingInWarehouse.unprinted}</b>
            </span>
            <span className="font-mono text-[10px] font-bold">
              {formatEgp(metrics.remainingInWarehouse.codAmount)}
            </span>
          </div>
        </div>

        {/* 2. Dispatched With Courier (In Transit) */}
        <div
          onClick={() =>
            onSelectDeliveryStatus(
              activeDeliveryStatus === "handed_to_carrier" ? "all" : "handed_to_carrier"
            )
          }
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
            activeDeliveryStatus === "handed_to_carrier"
              ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20 ring-2 ring-amber-600/30"
              : "bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-black ${
                activeDeliveryStatus === "handed_to_carrier"
                  ? "text-amber-100"
                  : "text-slate-800"
              }`}
            >
              خرج مع المندوب (قيد الشحن)
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                activeDeliveryStatus === "handed_to_carrier"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <Truck className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono">
              {metrics.dispatchedWithCarrier.total}
            </span>
            <span
              className={`text-[11px] font-bold ${
                activeDeliveryStatus === "handed_to_carrier"
                  ? "text-amber-200"
                  : "text-slate-400"
              }`}
            >
              شحنة
            </span>
          </div>

          <div
            className={`mt-2 pt-2 border-t text-[11px] font-medium flex items-center justify-between ${
              activeDeliveryStatus === "handed_to_carrier"
                ? "border-white/20 text-amber-100"
                : "border-slate-100 text-slate-500"
            }`}
          >
            <span>في السوق مع المناديب</span>
            <span className="font-mono text-[10px] font-bold">
              عهدة: {formatEgp(metrics.dispatchedWithCarrier.codAmount)}
            </span>
          </div>
        </div>

        {/* 3. Delivered Successfully */}
        <div
          onClick={() =>
            onSelectDeliveryStatus(activeDeliveryStatus === "delivered" ? "all" : "delivered")
          }
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
            activeDeliveryStatus === "delivered"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-600/30"
              : "bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-black ${
                activeDeliveryStatus === "delivered"
                  ? "text-emerald-100"
                  : "text-slate-800"
              }`}
            >
              تم التوصيل بنجاح للعميل
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                activeDeliveryStatus === "delivered"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono">
              {metrics.delivered.total}
            </span>
            <span
              className={`text-[11px] font-bold ${
                activeDeliveryStatus === "delivered"
                  ? "text-emerald-200"
                  : "text-slate-400"
              }`}
            >
              شحنة
            </span>
          </div>

          <div
            className={`mt-2 pt-2 border-t text-[11px] font-medium flex items-center justify-between ${
              activeDeliveryStatus === "delivered"
                ? "border-white/20 text-emerald-100"
                : "border-slate-100 text-slate-500"
            }`}
          >
            <span>تم استلامها من العميل</span>
            <span className="font-mono text-[10px] font-bold">
              {formatEgp(metrics.delivered.codAmount)}
            </span>
          </div>
        </div>

        {/* 4. Returned Orders */}
        <div
          onClick={() =>
            onSelectDeliveryStatus(activeDeliveryStatus === "returned" ? "all" : "returned")
          }
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden ${
            activeDeliveryStatus === "returned"
              ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20 ring-2 ring-rose-600/30"
              : "bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-black ${
                activeDeliveryStatus === "returned"
                  ? "text-rose-100"
                  : "text-slate-800"
              }`}
            >
              شحنات مرتجعة
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                activeDeliveryStatus === "returned"
                  ? "bg-white/20 text-white"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono">
              {metrics.returned.total}
            </span>
            <span
              className={`text-[11px] font-bold ${
                activeDeliveryStatus === "returned"
                  ? "text-rose-200"
                  : "text-slate-400"
              }`}
            >
              مرتجع
            </span>
          </div>

          <div
            className={`mt-2 pt-2 border-t text-[11px] font-medium flex items-center justify-between ${
              activeDeliveryStatus === "returned"
                ? "border-white/20 text-rose-100"
                : "border-slate-100 text-slate-500"
            }`}
          >
            <span>طرد لم يستلمه العميل</span>
            <span className="font-mono text-[10px] font-bold">
              {formatEgp(metrics.returned.codAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
