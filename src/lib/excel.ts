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

export type CarrierType =
  | "bosta"
  | "jt"
  | "aramex"
  | "mylerz"
  | "standard"
  | "carrier_settlement";

export interface CarrierTemplateInfo {
  id: CarrierType;
  name: string;
  nameAr: string;
  description: string;
  filePrefix: string;
  sheetName: string;
  badgeColor: string;
}

export const CARRIER_TEMPLATES: Record<CarrierType, CarrierTemplateInfo> = {
  bosta: {
    id: "bosta",
    name: "Bosta",
    nameAr: "بوسطة (Bosta)",
    description: "قالب رفع الشحنات الجماعي المعتمد لشركة بوسطة مع مبالغ COD والعناوين وتصريح فتح الشحنة",
    filePrefix: "Bosta_Shipments",
    sheetName: "شحنات بوسطة",
    badgeColor: "rose",
  },
  jt: {
    id: "jt",
    name: "J&T Express",
    nameAr: "جي آند تي (J&T Express)",
    description: "نموذج كشف شحنات جي آند تي إكسبريس المتوافق مع بوابة العملاء الرسمية",
    filePrefix: "JT_Express_Shipments",
    sheetName: "شحنات J&T",
    badgeColor: "red",
  },
  aramex: {
    id: "aramex",
    name: "Aramex",
    nameAr: "أرامكس (Aramex)",
    description: "تنسيق أرامكس المعتمد للشحن الداخلي والتحصيل عند الاستلام في مصر",
    filePrefix: "Aramex_Shipments",
    sheetName: "شحنات أرامكس",
    badgeColor: "orange",
  },
  mylerz: {
    id: "mylerz",
    name: "Mylerz",
    nameAr: "مايلرز (Mylerz)",
    description: "قالب استيراد كشف الشحنات لبوابة تجار مايلرز للتحصيل السريع",
    filePrefix: "Mylerz_Shipments",
    sheetName: "شحنات مايلرز",
    badgeColor: "indigo",
  },
  standard: {
    id: "standard",
    name: "Falcon Standard",
    nameAr: "النموذج القياسي لفلكون",
    description: "التقرير الشامل لكافة بيانات الأوردرات والأرباح وحالات الدفع والطباعة",
    filePrefix: "Falcon_Orders",
    sheetName: "الطلبات",
    badgeColor: "emerald",
  },
  carrier_settlement: {
    id: "carrier_settlement",
    name: "Carrier Settlement",
    nameAr: "كشف مطابقة مستحقات الشحن",
    description: "كشف الأوردرات المسلمة المعلقة لمطابقة الكاش المحصل مع شركة الشحن",
    filePrefix: "Falcon_Carrier_Settlements",
    sheetName: "مستحقات الشحن المعلقة",
    badgeColor: "blue",
  },
};

export interface CarrierExportOptions {
  allowOpenPackage?: boolean;
  defaultPackageDescription?: string;
}

/**
 * Generates an Excel buffer formatted specifically for 3rd-party carrier bulk uploads:
 * Bosta, J&T Express, Aramex, Mylerz, or Falcon Standard.
 */
export function generateCarrierOrdersExcelBuffer(
  orders: Order[],
  carrier: CarrierType = "standard",
  options?: CarrierExportOptions
): Uint8Array {
  if (carrier === "standard") {
    return generateOrdersExcelBuffer(orders, CARRIER_TEMPLATES.standard.sheetName);
  }

  if (carrier === "carrier_settlement") {
    return generateCarrierSettlementExcelBuffer(orders);
  }

  let headers: string[] = [];
  let rowsData: (string | number)[][] = [];
  let colWidths: { wch: number }[] = [];
  let phoneColIndices: number[] = [];
  const sheetName = CARRIER_TEMPLATES[carrier].sheetName;

  if (carrier === "bosta") {
    headers = [
      "اسم المستلم",
      "رقم الهاتف",
      "رقم إضافي",
      "المحافظة / المدينة",
      "العنوان بالتفصيل",
      "علامة مميزة",
      "مبلغ التحصيل (COD)",
      "رقم الأوردر (المرجع)",
      "ملاحظات الشحنة",
      "محتوى الشحنة",
      "السماح بفتح الشحنة",
    ];
    phoneColIndices = [1, 2];
    colWidths = [
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 35 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 16 },
    ];

    rowsData = orders.map((o) => [
      o.customer_name || "",
      o.phone_primary ? String(o.phone_primary) : "",
      o.phone_secondary ? String(o.phone_secondary) : "",
      o.governorate || "",
      o.address || "",
      o.landmark || "",
      Number(o.cod_amount) || 0,
      o.id.slice(0, 8).toUpperCase(),
      o.important_notes || "",
      options?.defaultPackageDescription || "بضائع عامة / ملابس",
      options?.allowOpenPackage !== false ? "نعم" : "لا",
    ]);
  } else if (carrier === "jt") {
    headers = [
      "Customer Order No (رقم الطلب)",
      "Consignee Name (اسم المستلم)",
      "Consignee Phone (رقم الهاتف)",
      "Consignee Backup Phone (هاتف بديل)",
      "Destination Province (المحافظة)",
      "Destination Address (العنوان التفصيلي)",
      "COD Amount (مبلغ التحصيل)",
      "Goods Description (محتوى الشحنة)",
      "Remarks (ملاحظات التوصيل)",
    ];
    phoneColIndices = [2, 3];
    colWidths = [
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 35 },
      { wch: 16 },
      { wch: 24 },
      { wch: 28 },
    ];

    rowsData = orders.map((o) => [
      o.id.slice(0, 8).toUpperCase(),
      o.customer_name || "",
      o.phone_primary ? String(o.phone_primary) : "",
      o.phone_secondary ? String(o.phone_secondary) : "",
      o.governorate || "",
      o.address || "",
      Number(o.cod_amount) || 0,
      options?.defaultPackageDescription || o.important_notes || "شحنة تجارة إلكترونية",
      o.landmark ? `علامة مميزة: ${o.landmark}` : o.important_notes || "",
    ]);
  } else if (carrier === "aramex") {
    headers = [
      "Reference 1 (رقم المرجع)",
      "Recipient Name (اسم المستلم)",
      "Recipient Phone 1 (رقم الهاتف)",
      "Recipient Phone 2 (رقم إضافي)",
      "Recipient City (المدينة)",
      "Recipient Address 1 (العنوان بالتفصيل)",
      "COD Amount (قيمة التحصيل)",
      "Special Instructions (تعليمات خاصة)",
      "Goods Description (الوصف)",
    ];
    phoneColIndices = [2, 3];
    colWidths = [
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 35 },
      { wch: 16 },
      { wch: 28 },
      { wch: 22 },
    ];

    rowsData = orders.map((o) => [
      o.id.slice(0, 8).toUpperCase(),
      o.customer_name || "",
      o.phone_primary ? String(o.phone_primary) : "",
      o.phone_secondary ? String(o.phone_secondary) : "",
      o.governorate || "",
      o.address || "",
      Number(o.cod_amount) || 0,
      o.important_notes || "",
      options?.defaultPackageDescription || "منتجات تجزئة",
    ]);
  } else if (carrier === "mylerz") {
    headers = [
      "Merchant Reference (مرجع التاجر)",
      "Customer Name (اسم العميل)",
      "Mobile No (الموبايل)",
      "Alternate Mobile (موبايل آخر)",
      "City / Area (المنطقة / المحافظة)",
      "Street Address (العنوان بالشارع)",
      "COD Value (قيمة التحصيل)",
      "Description (الوصف والملاحظات)",
    ];
    phoneColIndices = [2, 3];
    colWidths = [
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 35 },
      { wch: 16 },
      { wch: 30 },
    ];

    rowsData = orders.map((o) => [
      o.id.slice(0, 8).toUpperCase(),
      o.customer_name || "",
      o.phone_primary ? String(o.phone_primary) : "",
      o.phone_secondary ? String(o.phone_secondary) : "",
      o.governorate || "",
      o.address || "",
      Number(o.cod_amount) || 0,
      [o.important_notes, o.landmark].filter(Boolean).join(" - ") ||
        options?.defaultPackageDescription ||
        "طلب شحن",
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rowsData]);

  // Ensure phone columns retain string type with leading zeros
  for (let R = 1; R <= rowsData.length; ++R) {
    phoneColIndices.forEach((colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: colIdx });
      if (worksheet[cellRef]) {
        worksheet[cellRef].t = "s";
        worksheet[cellRef].v = String(worksheet[cellRef].v);
      }
    });
  }

  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buf);
}
