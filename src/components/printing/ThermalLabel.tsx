"use client";

import React from "react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import { BarcodeView } from "./BarcodeView";

export interface ThermalLabelOptions {
  logoUrl?: string | null;
  companyName?: string | null;
  merchantPhone?: string | null;
  returnAddress?: string | null;
  allowInspection?: boolean;
  showBarcode?: boolean;
  packageDescription?: string | null;
}

interface ThermalLabelProps {
  order: Order;
  options?: ThermalLabelOptions;
  className?: string;
}

/**
 * 4x6 inch (100mm x 150mm) Industry-Standard Thermal Waybill.
 * Designed specifically for thermal roll printers (Xprinter, Zebra, HPRT, Rongta, etc.).
 * High-contrast, pixel-perfect, 0-margin vector layout for 203 DPI and 300 DPI thermal print heads.
 */
export function ThermalLabel({
  order,
  options = {},
  className = "",
}: ThermalLabelProps) {
  const {
    logoUrl,
    companyName = "فلكون للشحن",
    merchantPhone,
    returnAddress,
    allowInspection = true,
    showBarcode = true,
    packageDescription,
  } = options;

  const isFullyPaid = order.paid_amount >= order.order_total && order.order_total > 0;
  const isCodZero = order.cod_amount === 0 || isFullyPaid;
  const orderRef = `#FAL-${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <div
      className={`thermal-label w-[100mm] max-w-[100mm] h-[150mm] max-h-[150mm] bg-white text-black p-[3mm] flex flex-col justify-between border-2 border-black box-border font-sans text-xs select-none break-inside-avoid page-break-inside-avoid ${className}`}
      style={{ boxSizing: "border-box" }}
      dir="rtl"
    >
      {/* 1. Header: Branding & Order Meta */}
      <div className="border-b-2 border-black pb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className="h-8 w-auto max-w-[28mm] object-contain"
            />
          ) : (
            <div className="w-8 h-8 rounded border-2 border-black bg-black text-white flex items-center justify-center font-black text-xs">
              FAL
            </div>
          )}
          <div>
            <span className="text-base font-black tracking-tight leading-none block">
              {companyName || "فلكون"}
            </span>
            <span className="text-[10px] font-bold text-black/80 block mt-0.5">
              بوليصة شحن وتوصيل
            </span>
          </div>
        </div>

        <div className="text-left font-mono" dir="ltr">
          <span className="text-xs font-black block">{orderRef}</span>
          <span className="text-[10px] font-bold text-black/80 block">
            {order.order_date || new Date().toISOString().split("T")[0]}
          </span>
        </div>
      </div>

      {/* 2. Vector Barcode Row */}
      {showBarcode && (
        <div className="border-b-2 border-black py-1 flex flex-col items-center justify-center bg-black/[0.02]">
          <BarcodeView
            value={order.id.slice(0, 8).toUpperCase()}
            height={36}
            moduleWidth={1.5}
            showText={true}
          />
        </div>
      )}

      {/* 3. Primary Destination & Courier Routing Hub Banner */}
      <div className="border-b-2 border-black bg-black text-white p-1.5 flex items-center justify-between">
        <div>
          <span className="text-[9px] uppercase font-bold tracking-wider opacity-90 block">
            المحافظة والتوجيه:
          </span>
          <span className="text-base font-black tracking-wide block">
            {order.governorate}
          </span>
        </div>
        <div className="text-left" dir="ltr">
          <span className="text-[9px] uppercase font-bold tracking-wider opacity-90 block">
            DESTINATION HUB
          </span>
          <span className="text-sm font-black font-mono block">
            EG-{order.governorate.slice(0, 3)}
          </span>
        </div>
      </div>

      {/* 4. Recipient Details Box */}
      <div className="flex-1 border-b-2 border-black py-2 space-y-1.5 overflow-hidden flex flex-col justify-between">
        {/* Recipient Name & Contact Numbers */}
        <div className="grid grid-cols-2 gap-2 border-b border-black pb-1.5">
          <div>
            <span className="text-[10px] font-bold text-black/70 block">
              اسم المستلم:
            </span>
            <span className="text-sm font-black text-black leading-tight block truncate">
              {order.customer_name}
            </span>
          </div>

          <div className="text-left" dir="ltr">
            <span className="text-[10px] font-bold text-black/70 block text-right" dir="rtl">
              رقم الهاتف:
            </span>
            <span className="text-sm font-black font-mono text-black block">
              {order.phone_primary}
            </span>
            {order.phone_secondary && (
              <span className="text-[11px] font-bold font-mono text-black block mt-0.5">
                بديل: {order.phone_secondary}
              </span>
            )}
          </div>
        </div>

        {/* Detailed Address & Landmark */}
        <div className="space-y-0.5 flex-1">
          <span className="text-[10px] font-bold text-black/70 block">
            العنوان بالتفصيل:
          </span>
          <span className="text-xs font-black text-black leading-snug block line-clamp-3">
            {order.address}
          </span>
          {order.landmark && (
            <div className="text-[11px] font-bold text-black mt-1 bg-black/5 p-1 rounded">
              <span className="font-black">علامة مميزة:</span> {order.landmark}
            </div>
          )}
        </div>

        {/* Shipment Description & Courier Notes */}
        <div className="border-t border-black pt-1 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-black font-bold truncate">
              <span className="text-black/70">المحتوى:</span>{" "}
              {packageDescription || order.important_notes || "بضائع عامة / طرد تجزئة"}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                allowInspection
                  ? "bg-black text-white"
                  : "border border-black text-black"
              }`}
            >
              {allowInspection ? "✓ مسموح بالمعاينة" : "غير مسموح بالفتح"}
            </span>
          </div>

          {order.important_notes && order.important_notes !== packageDescription && (
            <div className="text-[10px] font-extrabold text-black bg-black/5 px-1.5 py-0.5 rounded leading-tight">
              <span className="font-black underline">ملاحظة للمندوب:</span> {order.important_notes}
            </div>
          )}
        </div>
      </div>

      {/* 5. Collection / COD Box (The Most Critical Section) */}
      <div className="border-b-2 border-black py-2">
        {isCodZero ? (
          <div className="border-2 border-black bg-black text-white text-center py-2 px-3 rounded">
            <span className="text-xs font-bold block opacity-90">شحنة مدفوعة إلكترونياً مسبقاً</span>
            <span className="text-base font-black tracking-wider block">
              لا يتم تحصيل أي مبالغ من العميل (0 ج.م)
            </span>
          </div>
        ) : (
          <div className="border-2 border-black rounded p-2 flex items-center justify-between bg-black/[0.03]">
            <div>
              <span className="text-[10px] font-black uppercase text-black/80 block">
                مبلغ التحصيل المطلوب (COD):
              </span>
              <span className="text-[10px] font-bold text-black block">
                تحصيل نقدًا عند التسليم
              </span>
            </div>
            <div className="text-left font-mono" dir="ltr">
              <span className="text-xl sm:text-2xl font-black text-black tracking-tight block">
                {formatEgp(order.cod_amount)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. Footer: Sender / Return Details */}
      <div className="pt-1.5 flex items-center justify-between text-[10px] font-bold text-black/80">
        <div>
          <span>الراسل: {companyName || "فلكون"}</span>
          {merchantPhone && (
            <span className="mr-2 font-mono">هاتف: {merchantPhone}</span>
          )}
        </div>
        <div>
          <span>مرتجع إلى: {returnAddress || order.governorate}</span>
        </div>
      </div>
    </div>
  );
}
