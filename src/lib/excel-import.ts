import * as XLSX from "xlsx";
import type { OrderInsert } from "../types/database";
import { calculateCod, calculateNetProfit, derivePaymentStatus } from "./calculations";

export const COLUMN_ALIASES: Record<string, string[]> = {
  customer_name: [
    "اسم العميل",
    "العميل",
    "اسم المستلم",
    "المستلم",
    "الاسم",
    "customer_name",
    "client_name",
    "name",
  ],
  phone_primary: [
    "رقم الهاتف",
    "رقم الموبايل",
    "الموبايل",
    "الهاتف",
    "تليفون",
    "رقم التليفون",
    "phone_primary",
    "phone",
    "mobile",
    "phone1",
  ],
  phone_secondary: [
    "رقم احتياطي",
    "رقم إضافي",
    "هاتف آخر",
    "هاتف احتياطي",
    "موبايل 2",
    "phone_secondary",
    "phone2",
    "alt_phone",
  ],
  governorate: [
    "المحافظة",
    "محافظة",
    "المدينة",
    "governorate",
    "city",
    "gov",
  ],
  address: [
    "العنوان بالتفصيل",
    "العنوان",
    "تفاصيل العنوان",
    "address",
    "street",
  ],
  landmark: [
    "علامة مميزة",
    "علامة",
    "landmark",
    "nearest_landmark",
  ],
  order_total: [
    "سعر الأوردر",
    "إجمالي الأوردر",
    "المبلغ الإجمالي",
    "السعر",
    "الإجمالي",
    "المبلغ",
    "order_total",
    "total",
    "amount",
  ],
  paid_amount: [
    "المدفوع مقدمًا",
    "المدفوع مقدما",
    "المدفوع",
    "عربون",
    "مقدم",
    "paid_amount",
    "paid",
  ],
  shipping_cost: [
    "سعر الشحن",
    "تكلفة الشحن",
    "الشحن",
    "مصاريف الشحن",
    "shipping_cost",
    "shipping",
  ],
  important_notes: [
    "ملاحظات المندوب",
    "ملاحظات الشحن",
    "ملاحظات",
    "تعليمات المندوب",
    "important_notes",
    "notes",
    "instructions",
  ],
  order_date: [
    "تاريخ الأوردر",
    "التاريخ",
    "تاريخ الطلب",
    "order_date",
    "date",
  ],
};

export const FIELD_LABELS: Record<string, string> = {
  customer_name: "اسم العميل *",
  phone_primary: "رقم الهاتف الأساسي *",
  phone_secondary: "رقم هاتف احتياطي",
  governorate: "المحافظة *",
  address: "العنوان بالتفصيل *",
  landmark: "علامة مميزة",
  order_total: "سعر الأوردر *",
  paid_amount: "المدفوع مقدمًا",
  shipping_cost: "سعر الشحن",
  important_notes: "ملاحظات المندوب",
  order_date: "تاريخ الأوردر",
};

/**
 * Clean & normalize phone numbers, ensuring Egyptian leading zeros (010, 011, 012, 015)
 * are retained even if Excel stripped them into numbers like 1012345678.
 */
export function normalizePhoneNumber(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let str = String(raw).trim();

  // Remove spaces, dashes, parentheses
  str = str.replace(/[\s\-\(\)\.]/g, "");

  // Convert Arabic/Eastern digits (٠-٩) to English digits (0-9)
  str = str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

  // If number starts with international prefix +2 or 002, strip it
  if (str.startsWith("+2")) str = str.slice(2);
  if (str.startsWith("002")) str = str.slice(3);

  // If 10 digits starting with 1 (e.g. 1012345678 or 11..., 12..., 15...) add leading 0
  if (str.length === 10 && /^(10|11|12|15)/.test(str)) {
    str = "0" + str;
  }

  return str;
}

/**
 * Auto-detect matching column headers from the uploaded sheet.
 */
export function detectColumnMappings(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const [fieldKey, aliases] of Object.entries(COLUMN_ALIASES)) {
    // 1. Exact match check
    const exactMatch = headers.find((h) =>
      aliases.some((alias) => alias.toLowerCase() === h.trim().toLowerCase())
    );

    if (exactMatch) {
      mapping[fieldKey] = exactMatch;
      continue;
    }

    // 2. Fuzzy / contains match check
    const fuzzyMatch = headers.find((h) =>
      aliases.some(
        (alias) =>
          h.trim().toLowerCase().includes(alias.toLowerCase()) ||
          alias.toLowerCase().includes(h.trim().toLowerCase())
      )
    );

    if (fuzzyMatch) {
      mapping[fieldKey] = fuzzyMatch;
    }
  }

  return mapping;
}

export interface ValidatedImportRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
  data: OrderInsert | null;
}

/**
 * Validate a single parsed row according to Falcon business rules.
 */
export function validateImportRow(
  rawRow: Record<string, unknown>,
  mapping: Record<string, string>,
  rowNumber: number
): ValidatedImportRow {
  const errors: string[] = [];

  const getValue = (fieldKey: string) => {
    const colName = mapping[fieldKey];
    if (!colName) return undefined;
    return rawRow[colName];
  };

  const customerName = String(getValue("customer_name") ?? "").trim();
  const rawPhonePrimary = getValue("phone_primary");
  const phonePrimary = normalizePhoneNumber(rawPhonePrimary);
  const rawPhoneSecondary = getValue("phone_secondary");
  const phoneSecondary = rawPhoneSecondary ? normalizePhoneNumber(rawPhoneSecondary) : null;
  const governorate = String(getValue("governorate") ?? "").trim();
  const address = String(getValue("address") ?? "").trim();
  const landmark = getValue("landmark") ? String(getValue("landmark")).trim() : null;
  const importantNotes = getValue("important_notes")
    ? String(getValue("important_notes")).trim()
    : null;

  // Numeric fields
  const rawTotal = getValue("order_total");
  const orderTotal = rawTotal !== undefined && rawTotal !== null && rawTotal !== ""
    ? Number(rawTotal)
    : NaN;

  const rawPaid = getValue("paid_amount");
  const paidAmount = rawPaid !== undefined && rawPaid !== null && rawPaid !== ""
    ? Number(rawPaid)
    : 0;

  const rawShipping = getValue("shipping_cost");
  const shippingCost = rawShipping !== undefined && rawShipping !== null && rawShipping !== ""
    ? Number(rawShipping)
    : 0;

  let orderDate = getValue("order_date") ? String(getValue("order_date")).trim() : "";
  if (!orderDate || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
    orderDate = new Date().toISOString().split("T")[0];
  }

  // Required validations
  if (!customerName) {
    errors.push("اسم العميل مطلوب");
  }

  if (!phonePrimary) {
    errors.push("رقم الهاتف الأساسي مطلوب");
  } else if (!/^[0-9+]{7,15}$/.test(phonePrimary)) {
    errors.push("صيغة رقم الهاتف غير صالحة");
  }

  if (phoneSecondary && !/^[0-9+]{7,15}$/.test(phoneSecondary)) {
    errors.push("صيغة رقم الهاتف الاحتياطي غير صالحة");
  }

  if (!governorate) {
    errors.push("المحافظة مطلوبة");
  }

  if (!address) {
    errors.push("العنوان بالتفصيل مطلوب");
  }

  if (isNaN(orderTotal) || orderTotal < 0) {
    errors.push("سعر الأوردر يجب أن يكون رقماً موجباً");
  }

  if (isNaN(paidAmount) || paidAmount < 0) {
    errors.push("المبلغ المدفوع لا يمكن أن يكون سالباً");
  }

  if (!isNaN(orderTotal) && !isNaN(paidAmount) && paidAmount > orderTotal) {
    errors.push("المبلغ المدفوع مقدمًا لا يمكن أن يتجاوز سعر الأوردر");
  }

  if (isNaN(shippingCost) || shippingCost < 0) {
    errors.push("سعر الشحن يجب أن يكون رقماً موجباً أو صفر");
  }

  if (errors.length > 0) {
    return {
      rowNumber,
      raw: rawRow,
      isValid: false,
      errors,
      data: null,
    };
  }

  const codAmount = calculateCod(orderTotal, paidAmount);
  const netProfit = calculateNetProfit(orderTotal, shippingCost);
  const paymentStatus = derivePaymentStatus(orderTotal, paidAmount);

  const cleanOrder: OrderInsert = {
    order_date: orderDate,
    customer_name: customerName,
    phone_primary: phonePrimary,
    phone_secondary: phoneSecondary || null,
    governorate: governorate,
    address: address,
    landmark: landmark || null,
    important_notes: importantNotes || null,
    order_total: orderTotal,
    paid_amount: paidAmount,
    cod_amount: codAmount,
    shipping_cost: shippingCost,
    net_profit: netProfit,
    payment_status: paymentStatus,
    print_status: "pending", // Immediately queued for printing!
    delivery_status: "new",
    settlement_status: "pending",
  };

  return {
    rowNumber,
    raw: rawRow,
    isValid: true,
    errors: [],
    data: cleanOrder,
  };
}

/**
 * Generate a ready-to-use sample Excel template with Arabic headers.
 */
export function generateSampleExcelTemplate(): Uint8Array {
  const sampleRows = [
    {
      "اسم العميل": "أحمد محمود",
      "رقم الهاتف": "01012345678",
      "رقم احتياطي": "01198765432",
      "المحافظة": "القاهرة",
      "العنوان بالتفصيل": "مدينة نصر - الحي السابع - ش عباس العقاد",
      "علامة مميزة": "أمام ماكدونالدز",
      "سعر الأوردر": 1200,
      "المدفوع مقدمًا": 200,
      "سعر الشحن": 60,
      "ملاحظات المندوب": "يرجى الاتصال قبل التسليم بنصف ساعة",
      "تاريخ الأوردر": new Date().toISOString().split("T")[0],
    },
    {
      "اسم العميل": "سارة إبراهيم",
      "رقم الهاتف": "01234567890",
      "رقم احتياطي": "",
      "المحافظة": "الجيزة",
      "العنوان بالتفصيل": "الدقي - ميدان المساحة - عمارة 15",
      "علامة مميزة": "الدور الثاني شقة 4",
      "سعر الأوردر": 850,
      "المدفوع مقدمًا": 850,
      "سعر الشحن": 50,
      "ملاحظات المندوب": "شحنة مدفوعة مسبقاً بالكامل",
      "تاريخ الأوردر": new Date().toISOString().split("T")[0],
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);

  // Set explicit column widths
  ws["!cols"] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 35 },
    { wch: 20 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 30 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "قالب أوردرات فلكون");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(buffer);
}
