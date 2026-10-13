"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import {
  X,
  Barcode,
  Truck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Search,
  Volume2,
  Printer,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Order } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import { soundSynth } from "@/lib/sound";
import { matchScannedBarcode } from "@/lib/dispatchTracker";
import { batchUpdateDeliveryStatusAction } from "@/app/actions/orders";
import { CourierManifestModal } from "@/components/printing/CourierManifestModal";

interface BarcodeHandoverScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onHandoverComplete: () => void;
}

export function BarcodeHandoverScannerModal({
  isOpen,
  onClose,
  orders,
  onHandoverComplete,
}: BarcodeHandoverScannerModalProps) {
  const [scannedOrders, setScannedOrders] = useState<Order[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [lastScanMessage, setLastScanMessage] = useState<{
    text: string;
    type: "success" | "warning" | "error";
  } | null>(null);

  const [selectedCarrier, setSelectedCarrier] = useState("بوسطة (Bosta)");
  const [isHandingOver, startTransition] = useTransition();
  const [isManifestOpen, setIsManifestOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setScannedOrders([]);
      setInputValue("");
      setLastScanMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    // Check if already scanned in current session
    const isAlreadyScannedInSession = scannedOrders.some(
      (o) =>
        o.id.toLowerCase() === query.toLowerCase() ||
        o.id.toLowerCase().startsWith(query.toLowerCase()) ||
        o.phone_primary === query
    );

    if (isAlreadyScannedInSession) {
      soundSynth.playWarningBeep();
      setLastScanMessage({
        text: `الشحنة (${query}) تم فحصها مسبقاً وموجودة بالفعل في هذا المحضر!`,
        type: "warning",
      });
      setInputValue("");
      return;
    }

    const matchResult = matchScannedBarcode(query, orders);

    if (!matchResult.order) {
      soundSynth.playWarningBeep();
      setLastScanMessage({
        text: `لم يتم العثور على أوردر يطابق الكود أو الباركود (${query})!`,
        type: "error",
      });
      setInputValue("");
      return;
    }

    // Found order
    soundSynth.playSuccessBeep();
    const matched = matchResult.order;
    setScannedOrders((prev) => [matched, ...prev]);

    const isAlreadyHanded = matched.delivery_status === "handed_to_carrier";
    setLastScanMessage({
      text: isAlreadyHanded
        ? `تمت إضافة: ${matched.customer_name} (تنبيه: مسجلة كمسلمة مسبقاً)`
        : `تمت الإضافة بنجاح: ${matched.customer_name} (${formatEgp(matched.cod_amount)})`,
      type: isAlreadyHanded ? "warning" : "success",
    });

    setInputValue("");
  };

  const removeScannedOrder = (orderId: string) => {
    setScannedOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  // Action: Hand over to carrier in database
  const handleConfirmHandover = (openManifestAfter = false) => {
    if (scannedOrders.length === 0) return;

    startTransition(async () => {
      const ids = scannedOrders.map((o) => o.id);
      const res = await batchUpdateDeliveryStatusAction(ids, "handed_to_carrier");

      if (res.success) {
        soundSynth.playSuccessBeep();
        if (openManifestAfter) {
          setIsManifestOpen(true);
        } else {
          onHandoverComplete();
          onClose();
        }
      } else {
        soundSynth.playWarningBeep();
        setLastScanMessage({
          text: res.error || "فشل تحديث حالة الشحنات المسلمة",
          type: "error",
        });
      }
    });
  };

  const totalCod = scannedOrders.reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>الماسح السريع لتسليم الشحنات للمندوب</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Handover Scanner
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  امسح باركود البوليصة بمسدس الباركود (أو اكتب كود الأوردر / الهاتف) لتحويل حالتها فوراً لشركة الشحن وتجهيز محضر التسليم.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* Carrier Selection & Continuous Barcode Input Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">شركة الشحن المستلمة:</span>
                  <select
                    value={selectedCarrier}
                    onChange={(e) => setSelectedCarrier(e.target.value)}
                    className="h-8 px-2.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="بوسطة (Bosta)">بوسطة (Bosta)</option>
                    <option value="جي آند تي (J&T Express)">جي آند تي (J&T Express)</option>
                    <option value="أرامكس (Aramex)">أرامكس (Aramex)</option>
                    <option value="مايلرز (Mylerz)">مايلرز (Mylerz)</option>
                    <option value="مندوب شحن خاص">مندوب شحن خاص</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>تنبيه صوتي مفعل تلقائياً مع كل مسحة باركود</span>
                </div>
              </div>

              {/* Fast Barcode Input Form */}
              <form onSubmit={handleScanSubmit} className="relative">
                <Barcode className="w-5 h-5 text-blue-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="وجّه مسدس الباركود هنا، أو اكتب كود الأوردر / الموبايل واضغط Enter..."
                  className="w-full h-12 pr-11 pl-24 text-sm font-bold bg-white border-2 border-blue-500 rounded-xl text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-sm"
                />
                <button
                  type="submit"
                  className="absolute left-2 top-2 bottom-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  إضافة
                </button>
              </form>

              {/* Scan Feedback Banner */}
              {lastScanMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                    lastScanMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : lastScanMessage.type === "warning"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  {lastScanMessage.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  )}
                  <span>{lastScanMessage.text}</span>
                </div>
              )}
            </div>

            {/* Counters KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500">عدد الطرود المسلمة في المحضر</span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {scannedOrders.length} <span className="text-xs font-normal text-slate-400">طرد</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500">إجمالي عهدة الكاش (COD)</span>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  {formatEgp(totalCod)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-slate-500">الشركة المستلمة</span>
                <div className="text-sm font-black text-blue-700 mt-2 truncate">
                  {selectedCarrier}
                </div>
              </div>
            </div>

            {/* Scanned Items Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800">
                  قائمة الطرود الممسوحة ({scannedOrders.length})
                </h3>
                {scannedOrders.length > 0 && (
                  <button
                    onClick={() => setScannedOrders([])}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تفريغ القائمة</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto max-h-[300px]">
                {scannedOrders.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    لم يتم مسح أي طرد بعد. ابدأ بمسح باركود البوليصة بالمسدس ليظهر هنا فوراً.
                  </div>
                ) : (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">كود الأوردر</th>
                        <th className="p-3">العميل والموبايل</th>
                        <th className="p-3">المحافظة والعنوان</th>
                        <th className="p-3">مبلغ التحصيل (COD)</th>
                        <th className="p-3 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {scannedOrders.map((ord, idx) => (
                        <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono text-slate-400 text-[11px]">
                            {scannedOrders.length - idx}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {ord.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{ord.customer_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {ord.phone_primary}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-700">{ord.governorate}</span>
                            <span className="text-slate-400 text-[11px] mr-1 truncate max-w-[140px] inline-block align-bottom">
                              {ord.address}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-black text-emerald-700">
                            {formatEgp(ord.cod_amount)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => removeScannedOrder(ord.id)}
                              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center mx-auto transition-colors"
                              title="حذف من المحضر"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={onClose}
              disabled={isHandingOver}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors w-full sm:w-auto"
            >
              إلغاء
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleConfirmHandover(true)}
                disabled={isHandingOver || scannedOrders.length === 0}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>تسليم + طباعة محضر استلام للمندوب ({scannedOrders.length})</span>
              </button>

              <button
                onClick={() => handleConfirmHandover(false)}
                disabled={isHandingOver || scannedOrders.length === 0}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isHandingOver
                    ? "جاري اعتماد التسليم..."
                    : `اعتماد التسليم للمندوب فقط (${scannedOrders.length})`}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Embedded Delivery Manifest Modal for Instant Signature Sheet Printing */}
      <CourierManifestModal
        isOpen={isManifestOpen}
        onClose={() => {
          setIsManifestOpen(false);
          onHandoverComplete();
          onClose();
        }}
        orders={scannedOrders}
        onHandoverSuccess={() => {
          setIsManifestOpen(false);
          onHandoverComplete();
          onClose();
        }}
      />
    </>
  );
}
