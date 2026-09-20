import * as XLSX from "xlsx";
import type { Order } from "../types/database";

export const ARABIC_ORDER_HEADERS = {
  id: "رقم الأوردر",
  order_date: "تاريخ الأوردر",
  customer_name: "اسم العميل",
  phone_primary: "رقم الهاتف",
  phone_secondary: "رقم احتياطي",
  governorate: "المحافظة",
  address: "العنوان بالتفصيل",
  landmark: "علامة مميزة",
  order_total: "سعر الأوردر",
  paid_amount: "المدفوع مقدمًا",
  cod_amount: "COD",
  shipping_cost: "سعر الشحن",
  net_profit: "صافي الربح",
  important_notes: "ملاحظات المندوب",
  payment_status: "حالة الدفع",
  print_status: "حالة الطباعة",
  printed_at: "تاريخ الطباعة",
  delivery_status: "حالة التوصيل",
  settlement_status: "حالة التسوية",
  settled_at: "تاريخ التسوية",
  created_at: "تاريخ إنشاء السجل",
  updated_at: "آخر تحديث",
};

export function translatePaymentStatus(status: string): string {
  switch (status) {
    case "fully_paid":
      return "مدفوع بالكامل";
    case "partially_paid":
      return "مدفوع جزئياً";
    case "unpaid":
    default:
      return "غير مدفوع";
  }
}

export function translatePrintStatus(status: string): string {
  switch (status) {
    case "printed":
      return "تمت الطباعة";
    case "pending":
    default:
      return "في الانتظار";
  }
}

export function translateDeliveryStatus(status: string): string {
  switch (status) {
    case "handed_to_carrier":
      return "تم التسليم لشركة الشحن";
    case "delivered":
      return "تم التوصيل";
    case "returned":
      return "مرتجع";
    case "new":
    default:
      return "جديد";
  }
}

export function translateSettlementStatus(status: string): string {
  switch (status) {
    case "settled":
      return "تمت التسوية";
    case "pending":
    default:
      return "معلق";
  }
}

/**
 * Converts Order array into Excel Workbook ensuring:
 * 1. Phone numbers are stored strictly as string cells (type: 's') with preserved leading zeros.
 * 2. Financials are stored as numbers for Excel calculations.
 * 3. Arabic headers and proper column widths.
 */
export function generateOrdersExcelBuffer(
  orders: Order[],
  sheetName: string = "الطلبات"
): Uint8Array {
  const headerKeys: (keyof typeof ARABIC_ORDER_HEADERS)[] = [
    "id",
    "order_date",
    "customer_name",
    "phone_primary",
    "phone_secondary",
    "governorate",
    "address",
    "landmark",
    "order_total",
    "paid_amount",
    "cod_amount",
    "shipping_cost",
    "net_profit",
    "important_notes",
    "payment_status",
    "print_status",
    "printed_at",
    "delivery_status",
    "settlement_status",
    "settled_at",
    "created_at",
    "updated_at",
  ];

  // Header row in Arabic
  const rows: (string | number)[][] = [
    headerKeys.map((k) => ARABIC_ORDER_HEADERS[k]),
  ];

  orders.forEach((order) => {
    const row = [
      order.id,
      order.order_date || "",
      order.customer_name || "",
      order.phone_primary ? String(order.phone_primary) : "", // Preserved text
      order.phone_secondary ? String(order.phone_secondary) : "", // Preserved text
      order.governorate || "",
      order.address || "",
      order.landmark || "",
      Number(order.order_total) || 0,
      Number(order.paid_amount) || 0,
      Number(order.cod_amount) || 0,
      Number(order.shipping_cost) || 0,
      Number(order.net_profit) || 0,
      order.important_notes || "",
      translatePaymentStatus(order.payment_status),
      translatePrintStatus(order.print_status),
      order.printed_at ? new Date(order.printed_at).toLocaleDateString("ar-EG") : "",
      translateDeliveryStatus(order.delivery_status),
      translateSettlementStatus(order.settlement_status),
      order.settled_at ? new Date(order.settled_at).toLocaleDateString("ar-EG") : "",
      order.created_at ? new Date(order.created_at).toLocaleDateString("ar-EG") : "",
      order.updated_at ? new Date(order.updated_at).toLocaleDateString("ar-EG") : "",
    ];
    rows.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Force phone number columns (column index 3 and 4) to be string type 's'
  // to guarantee leading zeros are never removed in Excel
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:V1");
  for (let R = 1; R <= range.e.r; ++R) {
    // Column 3: phone_primary
    const cellRefPrimary = XLSX.utils.encode_cell({ r: R, c: 3 });
    if (worksheet[cellRefPrimary]) {
      worksheet[cellRefPrimary].t = "s";
      worksheet[cellRefPrimary].v = String(worksheet[cellRefPrimary].v);
    }
    // Column 4: phone_secondary
    const cellRefSec = XLSX.utils.encode_cell({ r: R, c: 4 });
    if (worksheet[cellRefSec]) {
      worksheet[cellRefSec].t = "s";
      worksheet[cellRefSec].v = String(worksheet[cellRefSec].v);
    }
  }

  // Column widths
  worksheet["!cols"] = [
    { wch: 38 }, // ID
    { wch: 12 }, // Date
    { wch: 22 }, // Name
    { wch: 16 }, // Phone
    { wch: 16 }, // Secondary Phone
    { wch: 14 }, // Governorate
    { wch: 32 }, // Address
    { wch: 18 }, // Landmark
    { wch: 12 }, // Order Total
    { wch: 12 }, // Paid
    { wch: 12 }, // COD
    { wch: 12 }, // Shipping
    { wch: 12 }, // Net Profit
    { wch: 28 }, // Notes
    { wch: 14 }, // Payment
    { wch: 14 }, // Print
    { wch: 14 }, // Printed At
    { wch: 18 }, // Delivery
    { wch: 14 }, // Settlement
    { wch: 14 }, // Settled At
    { wch: 14 }, // Created
    { wch: 14 }, // Updated
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Output Uint8Array buffer
  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buf);
}

/**
 * Generates an official carrier settlement reconciliation statement in Excel format.
 * Focuses on delivered orders with unsettled COD cash to reconcile with shipping carriers.
 */
export function generateCarrierSettlementExcelBuffer(
  orders: Order[]
): Uint8Array {
  const headers = [
    "كود الأوردر",
    "تاريخ الأوردر",
    "اسم العميل",
    "رقم الهاتف",
    "المحافظة",
    "العنوان بالتفصيل",
    "مبلغ التحصيل (COD المطلوب توريده)",
    "حالة التوصيل",
    "حالة التسوية",
    "ملاحظات",
  ];

  const rows: (string | number)[][] = [headers];

  orders.forEach((order) => {
    rows.push([
      order.id,
      order.order_date || "",
      order.customer_name || "",
      order.phone_primary ? String(order.phone_primary) : "",
      order.governorate || "",
      order.address || "",
      Number(order.cod_amount) || 0,
      translateDeliveryStatus(order.delivery_status),
      translateSettlementStatus(order.settlement_status),
      order.important_notes || "",
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Preserve phone as string
  for (let R = 1; R <= orders.length; ++R) {
    const cellRef = XLSX.utils.encode_cell({ r: R, c: 3 });
    if (worksheet[cellRef]) {
      worksheet[cellRef].t = "s";
      worksheet[cellRef].v = String(worksheet[cellRef].v);
    }
  }

  worksheet["!cols"] = [
    { wch: 38 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 35 },
    { wch: 25 },
    { wch: 18 },
    { wch: 14 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "مستحقات شركة الشحن المعلقة");

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buf);
}
