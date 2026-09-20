"use client";

import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";

interface ShippingLabelProps {
  order: Order;
  mode: 2 | 3;
  logoUrl?: string | null;
  companyName?: string | null;
  showCutLine?: boolean;
}

export function ShippingLabel({
  order,
  mode,
  logoUrl,
  companyName,
  showCutLine = true,
}: ShippingLabelProps) {
  const isFullyPaid = order.paid_amount >= order.order_total && order.order_total > 0;
  const isCodZero = order.cod_amount === 0 || isFullyPaid;

  // Exact height constraints in mm for standard A4 portrait:
  // Printable A4 height = 297mm - 12mm margins = ~285mm
  // Mode 3: ~91mm per label (including cut line)
  // Mode 2: ~138mm per label (including cut line)
  const containerHeightClass =
    mode === 3
      ? "h-[91mm] max-h-[91mm] p-3 text-[11px]"
      : "h-[138mm] max-h-[138mm] p-5 text-[13px]";

  return (
    <div className="w-full break-inside-avoid page-break-inside-avoid relative flex flex-col justify-between box-border bg-white text-black font-sans">
      {/* Label Main Box */}
      <div
        className={`w-full border-2 border-black rounded-lg flex flex-col justify-between overflow-hidden ${containerHeightClass}`}
        style={{ boxSizing: "border-box" }}
      >
        {/* Header Row: Falcon Branding & Order Date */}
        <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-1.5">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl || "/falcon-logo.png"}
              alt="فلكون"
              className="h-7 w-auto object-contain"
            />
            <div>
              <span className="text-base font-black tracking-tight leading-none block">
                {companyName || "فلكون"}
              </span>
            </div>
          </div>

          <div className="text-left" dir="ltr">
            <span className="text-[10px] font-bold block text-black">
              {order.order_date || new Date().toISOString().split("T")[0]}
            </span>
            <span className="text-[9px] font-mono text-black font-bold block">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Customer & Destination Section */}
        <div className="flex-1 flex flex-col justify-start space-y-1 overflow-hidden">
          {/* Customer Name & Phones */}
          <div className="grid grid-cols-2 gap-2 border-b border-black pb-1">
            <div>
              <span className="text-[10px] font-semibold text-black block">
                العميل:
              </span>
              <span className="text-sm font-black text-black block truncate">
                {order.customer_name}
              </span>
            </div>

            <div className="text-left" dir="ltr">
              <span className="text-[10px] font-semibold text-black block text-right" dir="rtl">
                الهاتف:
              </span>
              <span className="text-sm font-black text-black font-mono block">
                {order.phone_primary}
              </span>
              {order.phone_secondary && (
                <span className="text-[11px] font-bold text-black font-mono block mt-0.5">
                  احتياطي: {order.phone_secondary}
                </span>
              )}
            </div>
          </div>

          {/* Governorate & Detailed Address */}
          <div className="pt-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-black text-black">
                {order.governorate}:
              </span>
              <span className="text-xs font-bold text-black leading-snug break-words">
                {order.address}
              </span>
            </div>
            {order.landmark && (
              <div className="text-[10px] font-bold text-black mt-0.5">
                علامة مميزة: {order.landmark}
              </div>
            )}
          </div>

          {/* Courier Notes Box */}
          {order.important_notes && (
            <div className="mt-1 p-1 bg-black/5 border border-black rounded text-black">
              <span className="text-[10px] font-black underline block">
                ملاحظات المندوب:
              </span>
              <span className="text-[11px] font-extrabold leading-tight block">
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

          <div className="text-center">
            {isCodZero ? (
              <div className="border-2 border-black px-3 py-1 bg-black text-white font-black text-sm tracking-wider rounded">
                مدفوع بالكامل
              </div>
            ) : (
              <div className="border-2 border-black px-3 py-0.5 rounded flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-black">تحصيل:</span>
                <span className="text-base sm:text-lg font-black text-black tracking-tight">
                  {formatEgp(order.cod_amount)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cutting Line Between Labels */}
      {showCutLine && (
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
