"use client";

import React from "react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import { BarcodeView } from "./BarcodeView";
import { ThermalLabel, ThermalLabelOptions } from "./ThermalLabel";

export type PrintLayoutMode = 2 | 3 | 4 | "thermal_4x6";

interface ShippingLabelProps {
  order: Order;
  mode: PrintLayoutMode;
  logoUrl?: string | null;
  companyName?: string | null;
  merchantPhone?: string | null;
  returnAddress?: string | null;
  allowInspection?: boolean;
  showBarcode?: boolean;
  packageDescription?: string | null;
  showCutLine?: boolean;
}

export function ShippingLabel({
  order,
  mode,
  logoUrl,
  companyName = "فلكون",
  merchantPhone,
  returnAddress,
  allowInspection = true,
  showBarcode = true,
  packageDescription,
  showCutLine = true,
}: ShippingLabelProps) {
  // If thermal 4x6 mode, delegate directly to specialized ThermalLabel component
  if (mode === "thermal_4x6") {
    return (
      <ThermalLabel
        order={order}
        options={{
          logoUrl,
          companyName,
          merchantPhone,
          returnAddress,
          allowInspection,
          showBarcode,
          packageDescription,
        }}
      />
    );
  }

  const isFullyPaid = order.paid_amount >= order.order_total && order.order_total > 0;
  const isCodZero = order.cod_amount === 0 || isFullyPaid;
  const orderRef = `#FAL-${order.id.slice(0, 8).toUpperCase()}`;

  // Sizing by mode on A4:
  // Mode 3: 3 per A4 page (~91mm height)
  // Mode 2: 2 per A4 page (~138mm height)
  // Mode 4: 4-up 2x2 grid (~136mm height, 50% width)
  const containerHeightClass =
    mode === 3
      ? "h-[90mm] max-h-[90mm] p-2.5 text-[11px]"
      : mode === 4
      ? "h-[136mm] max-h-[136mm] p-3 text-[12px]"
      : "h-[138mm] max-h-[138mm] p-4 text-[13px]";

  return (
    <div
      className={`w-full break-inside-avoid page-break-inside-avoid relative flex flex-col justify-between box-border bg-white text-black font-sans ${
        mode === 4 ? "p-1.5" : ""
      }`}
      dir="rtl"
    >
      {/* Label Main Box */}
      <div
        className={`w-full border-2 border-black rounded-lg flex flex-col justify-between overflow-hidden ${containerHeightClass}`}
        style={{ boxSizing: "border-box" }}
      >
        {/* Header Row: Branding, Barcode, & Order Date */}
        <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-1">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="h-6 sm:h-7 w-auto object-contain"
              />
            ) : (
              <div className="w-6 h-6 rounded border border-black bg-black text-white flex items-center justify-center font-black text-[10px]">
                FAL
              </div>
            )}
            <div>
              <span className="text-sm sm:text-base font-black tracking-tight leading-none block">
                {companyName || "فلكون للشحن"}
              </span>
            </div>
          </div>

          {/* Barcode in Header if enabled and mode is 2 or 4 */}
          {showBarcode && mode !== 3 && (
            <div className="hidden sm:block">
              <BarcodeView
                value={order.id.slice(0, 8).toUpperCase()}
                height={28}
                moduleWidth={1.2}
                showText={false}
              />
            </div>
          )}

          <div className="text-left font-mono" dir="ltr">
            <span className="text-[10px] font-bold block text-black">
              {order.order_date || new Date().toISOString().split("T")[0]}
            </span>
            <span className="text-[9px] font-black text-black block">
              {orderRef}
            </span>
          </div>
        </div>

        {/* Customer & Destination Section */}
        <div className="flex-1 flex flex-col justify-start space-y-1 overflow-hidden">
          {/* Customer Name & Phones */}
          <div className="grid grid-cols-2 gap-2 border-b border-black pb-1">
            <div>
              <span className="text-[10px] font-semibold text-black/70 block">
                العميل:
              </span>
              <span className="text-sm font-black text-black block truncate">
                {order.customer_name}
              </span>
            </div>

            <div className="text-left font-mono" dir="ltr">
              <span className="text-[10px] font-semibold text-black/70 block text-right" dir="rtl">
                الهاتف:
              </span>
              <span className="text-sm font-black text-black block">
                {order.phone_primary}
              </span>
              {order.phone_secondary && (
                <span className="text-[11px] font-bold text-black block mt-0.5">
                  احتياطي: {order.phone_secondary}
                </span>
              )}
            </div>
          </div>

          {/* Destination: Governorate & Detailed Address */}
          <div className="pt-0.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xs font-black text-white bg-black px-1.5 py-0.5 rounded text-[11px]">
                {order.governorate}
              </span>
              <span className="text-xs font-bold text-black leading-snug break-words">
                {order.address}
              </span>
            </div>
            {order.landmark && (
              <div className="text-[10px] font-bold text-black mt-0.5">
                <span className="underline">علامة مميزة:</span> {order.landmark}
              </div>
            )}
          </div>

          {/* Package Description & Allow Inspection */}
          <div className="flex items-center justify-between text-[10px] border-t border-black/30 pt-0.5">
            <span className="text-black font-semibold truncate">
              المحتوى: {packageDescription || order.important_notes || "طرد تجزئة / بضائع"}
            </span>
            <span className="font-bold border border-black px-1 rounded text-[9px] shrink-0">
              {allowInspection ? "مسموح بالمعاينة" : "غير مسموح بالفتح"}
            </span>
          </div>

          {/* Courier Notes Box */}
          {order.important_notes && (
            <div className="mt-0.5 p-1 bg-black/5 border border-black rounded text-black leading-tight">
              <span className="text-[9px] font-black underline block">
                ملاحظات المندوب:
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold block">
                {order.important_notes}
              </span>
            </div>
          )}
        </div>

        {/* Footer: COD / Payment Collection Box */}
        <div className="border-t-2 border-black pt-1.5 mt-1 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold block text-black">
              المطلوب من العميل:
            </span>
            <span className="text-[9px] text-black">
              {isCodZero ? "شحنة مدفوعة مسبقاً" : "تحصيل نقدي عند الاستلام"}
            </span>
          </div>

          {/* Barcode in mode 3 */}
          {showBarcode && mode === 3 && (
            <div className="hidden sm:block">
              <BarcodeView
                value={order.id.slice(0, 8).toUpperCase()}
                height={22}
                moduleWidth={1.1}
                showText={false}
              />
            </div>
          )}

          <div className="text-center">
            {isCodZero ? (
              <div className="border-2 border-black px-2.5 py-0.5 bg-black text-white font-black text-xs sm:text-sm tracking-wider rounded">
                مدفوع بالكامل
              </div>
            ) : (
              <div className="border-2 border-black px-2.5 py-0.5 rounded flex items-baseline gap-1 bg-black/[0.02]">
                <span className="text-[10px] font-bold text-black">تحصيل:</span>
                <span className="text-sm sm:text-base font-black text-black font-mono tracking-tight">
                  {formatEgp(order.cod_amount)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cutting Line Between Labels on A4 */}
      {showCutLine && mode !== 4 && (
        <div className="w-full flex items-center justify-center my-1.5 print:my-1 opacity-80">
          <div className="w-full border-b-2 border-dashed border-black"></div>
          <span className="px-2 text-[9px] font-bold font-mono tracking-widest text-black uppercase bg-white whitespace-nowrap">
            ✂ قص هنا
          </span>
          <div className="w-full border-b-2 border-dashed border-black"></div>
        </div>
      )}
    </div>
  );
}
