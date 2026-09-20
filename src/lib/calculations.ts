import type { PaymentStatus } from "../types/database";

/**
 * Authoritative business calculation functions for Falcon - فلكون
 */

export function calculateCod(orderTotal: number, paidAmount: number): number {
  const total = Number(orderTotal) || 0;
  const paid = Number(paidAmount) || 0;
  return Math.max(total - paid, 0);
}

export function calculateNetProfit(orderTotal: number, shippingCost: number): number {
  const total = Number(orderTotal) || 0;
  const shipping = Number(shippingCost) || 0;
  return total - shipping;
}

export function derivePaymentStatus(orderTotal: number, paidAmount: number): PaymentStatus {
  const total = Number(orderTotal) || 0;
  const paid = Number(paidAmount) || 0;

  if (paid <= 0) {
    return "unpaid";
  }
  if (paid >= total) {
    return "fully_paid";
  }
  return "partially_paid";
}

export function formatEgp(amount: number): string {
  return `${new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)} ج.م`;
}

export function getPaymentStatusBadge(status: PaymentStatus): {
  label: string;
  bgClass: string;
  textClass: string;
} {
  switch (status) {
    case "fully_paid":
      return {
        label: "مدفوع بالكامل",
        bgClass: "bg-emerald-50 border-emerald-200",
        textClass: "text-emerald-700",
      };
    case "partially_paid":
      return {
        label: "مدفوع جزئياً",
        bgClass: "bg-amber-50 border-amber-200",
        textClass: "text-amber-700",
      };
    case "unpaid":
    default:
      return {
        label: "غير مدفوع",
        bgClass: "bg-slate-100 border-slate-200",
        textClass: "text-slate-700",
      };
  }
}

export function checkOrderPrintOverflow(order: {
  address?: string | null;
  important_notes?: string | null;
}): boolean {
  const addressLen = (order.address || "").trim().length;
  const notesLen = (order.important_notes || "").trim().length;
  return addressLen > 70 || notesLen > 50 || addressLen + notesLen > 115;
}

export function calculatePrintPagesCount(totalOrders: number, mode: 2 | 3): number {
  if (totalOrders <= 0) return 0;
  return Math.ceil(totalOrders / mode);
}
