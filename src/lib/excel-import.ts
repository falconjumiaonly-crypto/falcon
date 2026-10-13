import * as XLSX from "xlsx";
import type { OrderInsert, GovernorateRate } from "../types/database";
import { calculateCod, calculateNetProfit, derivePaymentStatus } from "./calculations";
import { matchGovernorate, DEFAULT_GOVERNORATES, normalizeArabic } from "./governorates";
import { standardizeAddress } from "./addressStandardizer";

export const COLUMN_ALIASES: Record<string, string[]> = {
  customer_name: [
    "اسم العميل",
    "العميل",
    "اسم المستلم",
    "المستلم",
    "الاسم",
    "اسم المشتري",
    "المشتري",
    "المرسل إليه",
    "customer_name",
    "client_name",
    "name",
    "shipping_name",
    "shipping name",
    "recipient_name",
    "receiver_name",
    "consignee_name",
    "buyer_name",
    "first_name",
    "full_name",
    "customer",
    "billing_name",
    "billing name",
  ],
  phone_primary: [
    "رقم الهاتف",
    "رقم الموبايل",
    "الموبايل",
    "الهاتف",
    "تليفون",
    "رقم التليفون",
    "الجوال",
    "رقم الجوال",
    "هاتف المستلم",
    "رقم المستلم",
    "phone_primary",
    "phone",
    "mobile",
    "phone1",
    "shipping_phone",
    "shipping phone",
    "receiver_phone",
    "recipient_phone",
    "telephone",
    "cellphone",
    "billing_phone",
  ],
  phone_secondary: [
    "رقم احتياطي",
    "رقم إضافي",
    "هاتف آخر",
    "هاتف احتياطي",
    "موبايل 2",
    "تليفون آخر",
    "هاتف بديل",
    "phone_secondary",
    "phone2",
    "alt_phone",
    "secondary_phone",
  ],
  governorate: [
    "المحافظة",
    "محافظة",
    "المدينة",
    "مدينة",
    "المنطقة",
    "المحافظة / المدينة",
    "مدينة المستلم",
    "محافظة المستلم",
    "governorate",
    "city",
    "gov",
    "province",
    "shipping_city",
    "shipping city",
    "shipping_province",
    "shipping province",
    "receiver_city",
    "destination_city",
    "drop_off_city",
    "dest_city",
    "state",
    "region",
  ],
  address: [
    "العنوان بالتفصيل",
    "العنوان",
    "تفاصيل العنوان",
    "عنوان الشحن",
    "عنوان المستلم",
    "مكان التوصيل",
    "الشارع",
    "العنوان الوطني",
    "address",
    "street",
    "shipping_address",
    "shipping address",
    "shipping_address_1",
    "shipping_address1",
    "shipping address 1",
    "address1",
    "address 1",
    "receiver_address",
    "delivery_address",
    "drop_off_address",
    "billing_address",
  ],
  landmark: [
    "علامة مميزة",
    "علامة",
    "اقرب معلم",
    "معلم مميز",
    "بجوار",
    "landmark",
    "nearest_landmark",
    "address_landmark",
  ],
  order_total: [
    "سعر الأوردر",
    "إجمالي الأوردر",
    "المبلغ الإجمالي",
    "السعر",
    "الإجمالي",
    "المبلغ",
    "قيمة الأوردر",
    "إجمالي الطلب",
    "المجموع الكلي",
    "المبلغ المطلوب تحصيله",
    "قيمة التحصيل",
    "المحصل",
    "order_total",
    "total",
    "amount",
    "cod",
    "cod_amount",
    "cash_on_delivery",
    "total_price",
    "invoice_total",
    "subtotal",
  ],
  paid_amount: [
    "المدفوع مقدمًا",
    "المدفوع مقدما",
    "المدفوع",
    "عربون",
    "مقدم",
    "تم تحويله",
    "تحويل مسبق",
    "paid_amount",
    "paid",
    "advance_payment",
    "deposit",
  ],
  shipping_cost: [
    "سعر الشحن",
    "تكلفة الشحن",
    "الشحن",
    "مصاريف الشحن",
    "قيمة الشحن",
    "shipping_cost",
    "shipping",
    "delivery_fee",
  ],
  important_notes: [
    "ملاحظات المندوب",
    "ملاحظات الشحن",
    "ملاحظات",
    "تعليمات المندوب",
    "المنتجات",
    "الأصناف",
    "محتوى الشحنة",
    "الطلب",
    "تفاصيل الطلب",
    "الوصف",
    "important_notes",
    "notes",
    "instructions",
    "customer_note",
    "special_instructions",
    "lineitem_name",
    "items",
    "description",
    "package_details",
    "package details",
    "details",
    "تفاصيل الشحنة",
  ],
  order_date: [
    "تاريخ الأوردر",
    "التاريخ",
    "تاريخ الطلب",
    "تاريخ الإنشاء",
    "order_date",
    "date",
    "created_at",
    "timestamp",
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

export interface PlatformPreset {
  id: string;
  name: string;
  description: string;
}

export const PLATFORM_PRESETS: Record<string, PlatformPreset> = {
  shopify: {
    id: "shopify",
    name: "Shopify (شوبيفاي)",
    description: "تنسيق تصدير طلبات شوبيفاي مع عناوين الشحن والمنتجات",
  },
  salla: {
    id: "salla",
    name: "Salla / Zid (سلة / زد)",
    description: "تنسيق المتاجر العربية مع أرقام الجوال وعناوين الشحن",
  },
  bosta: {
    id: "bosta",
    name: "Bosta / Carriers (شركات الشحن)",
    description: "تنسيق كشوف بوسطة وشركات الشحن بقيم COD وعناوين التسليم",
  },
  falcon: {
    id: "falcon",
    name: "Falcon Standard (فلكون)",
    description: "النموذج القياسي لنظام فلكون",
  },
};

/**
 * Detailed result of sanitizing phone numbers from Excel cells.
 */
export interface SanitizedPhoneResult {
  primary: string;
  secondary: string | null;
  wasRepaired: boolean;
  repairs: string[];
}

/**
 * Intelligent phone number extraction and normalization:
 * - Converts Arabic/Eastern digits (٠-٩) to English (0-9)
 * - Detects multiple numbers separated by slash, comma, hyphen, "و", etc.
 * - Restores missing leading 0 for 10-digit Egyptian numbers (10, 11, 12, 15)
 * - Strips international prefixes (+2, 002, 20)
 */
export function splitAndNormalizePhoneNumbers(raw: unknown): SanitizedPhoneResult {
  if (raw === null || raw === undefined) {
    return { primary: "", secondary: null, wasRepaired: false, repairs: [] };
  }

  let str = String(raw).trim();
  if (!str) {
    return { primary: "", secondary: null, wasRepaired: false, repairs: [] };
  }

  const repairs: string[] = [];

  // Convert Arabic/Eastern digits (٠-٩) to English digits (0-9)
  if (/[٠-٩]/.test(str)) {
    str = str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
    repairs.push("تحويل الأرقام الشرقية");
  }

  // Split on multiple phone separators: slash, comma, 'و', '-', '|', 'or'
  const chunks = str
    .split(/[\/\,\;\،\|\-]|(?:\s+و\s+)|\bor\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const cleanChunk = (s: string) => {
    let cleaned = s.replace(/[^0-9+]/g, "");
    if (cleaned.startsWith("+20")) {
      cleaned = cleaned.slice(3);
      repairs.push("إزالة كود +20");
    } else if (cleaned.startsWith("+2")) {
      cleaned = cleaned.slice(2);
      repairs.push("إزالة كود +2");
    } else if (cleaned.startsWith("0020")) {
      cleaned = cleaned.slice(4);
      repairs.push("إزالة كود 0020");
    } else if (cleaned.startsWith("002")) {
      cleaned = cleaned.slice(3);
      repairs.push("إزالة كود 002");
    } else if (
      cleaned.startsWith("20") &&
      cleaned.length === 12 &&
      /^(2010|2011|2012|2015)/.test(cleaned)
    ) {
      cleaned = cleaned.slice(2);
      repairs.push("إزالة بادئة 20");
    }

    // Restore missing 0 if 10 digits starting with 10, 11, 12, 15
    if (cleaned.length === 10 && /^(10|11|12|15)/.test(cleaned)) {
      cleaned = "0" + cleaned;
      repairs.push("استرجاع الصفر المفقود");
    }

    return cleaned;
  };

  const candidatePhones = chunks.map(cleanChunk).filter((p) => p.length >= 7);

  if (candidatePhones.length === 0) {
    const single = cleanChunk(str);
    return {
      primary: single,
      secondary: null,
      wasRepaired: repairs.length > 0,
      repairs,
    };
  }

  const primary = candidatePhones[0] || "";
  const secondary = candidatePhones.length > 1 ? candidatePhones[1] : null;

  if (candidatePhones.length > 1) {
    repairs.push("فصل الرقم الإضافي");
  }

  return {
    primary,
    secondary,
    wasRepaired: repairs.length > 0,
    repairs,
  };
}

/**
 * Clean & normalize phone numbers, ensuring Egyptian leading zeros (010, 011, 012, 015)
 * are retained even if Excel stripped them into numbers like 1012345678.
 */
export function normalizePhoneNumber(raw: unknown): string {
  return splitAndNormalizePhoneNumbers(raw).primary;
}

/**
 * Detect which e-commerce platform or carrier format the headers most likely belong to.
 */
export function detectPlatformPreset(headers: string[]): {
  preset: string;
  name: string;
  confidence: number;
} {
  const normHeaders = headers.map((h) => normalizeArabic(h).toLowerCase());

  // Check Shopify indicators
  const shopifySignals = ["shipping address1", "shipping city", "billing name", "lineitem name", "total price"];
  const shopifyMatches = shopifySignals.filter((sig) => normHeaders.some((h) => h.includes(sig))).length;

  if (shopifyMatches >= 2) {
    return { preset: "shopify", name: PLATFORM_PRESETS.shopify.name, confidence: 95 };
  }

  // Check Shipping Carrier (Bosta / J&T / Aramex) indicators
  const carrierSignals = ["cod amount", "cod", "drop off address", "receiver name", "recipient name", "awb", "consignee"];
  const carrierMatches = carrierSignals.filter((sig) => normHeaders.some((h) => h.includes(sig))).length;

  if (carrierMatches >= 2) {
    return { preset: "bosta", name: PLATFORM_PRESETS.bosta.name, confidence: 90 };
  }

  // Check Salla / Zid indicators
  const sallaSignals = ["عنوان الشحن", "رقم الجوال", "اسم المشتري", "اجمالي الطلب"];
  const sallaMatches = sallaSignals.filter((sig) => normHeaders.some((h) => h.includes(sig))).length;

  if (sallaMatches >= 2) {
    return { preset: "salla", name: PLATFORM_PRESETS.salla.name, confidence: 90 };
  }

  // Check Falcon standard indicators
  const falconSignals = ["اسم العميل", "سعر الاوردر", "المحافظه", "العنوان بالتفصيل"];
  const falconMatches = falconSignals.filter((sig) => normHeaders.some((h) => h.includes(sig))).length;

  if (falconMatches >= 2) {
    return { preset: "falcon", name: PLATFORM_PRESETS.falcon.name, confidence: 99 };
  }

  return { preset: "custom", name: "ملف مخصص / غير معروف", confidence: 50 };
}

/**
 * Auto-detect matching column headers from the uploaded sheet using Arabic normalization & fuzzy matching.
 */
export function detectColumnMappings(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const [fieldKey, aliases] of Object.entries(COLUMN_ALIASES)) {
    // 1. Exact normalized match check
    const exactMatch = headers.find((h) => {
      if (usedHeaders.has(h)) return false;
      const normH = normalizeArabic(h).toLowerCase();
      return aliases.some((alias) => normalizeArabic(alias).toLowerCase() === normH);
    });

    if (exactMatch) {
      mapping[fieldKey] = exactMatch;
      usedHeaders.add(exactMatch);
      continue;
    }

    // 2. Contains normalized match check
    const fuzzyMatch = headers.find((h) => {
      if (usedHeaders.has(h)) return false;
      const normH = normalizeArabic(h).toLowerCase();
      return aliases.some((alias) => {
        const normAlias = normalizeArabic(alias).toLowerCase();
        return normH.includes(normAlias) || (normAlias.length > 4 && normAlias.includes(normH));
      });
    });

    if (fuzzyMatch) {
      mapping[fieldKey] = fuzzyMatch;
      usedHeaders.add(fuzzyMatch);
    }
  }

  return mapping;
}

export type DuplicateSeverity =
  | "exact_sheet"
  | "phone_sheet"
  | "exact_db"
  | "same_phone_amount"
  | "returning_customer";

export interface DuplicateDetails {
  severity: DuplicateSeverity;
  badgeText: string;
  badgeVariant: "rose" | "amber" | "blue" | "slate";
  reason: string;
  conflictingRowNumbers?: number[];
  matchedOrderId?: string;
  matchedCustomerName?: string;
  matchedOrderTotal?: number;
  matchedDeliveryStatus?: string;
  matchedOrderDate?: string;
}

export interface ValidatedImportRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  data: OrderInsert | null;
  governorateMatched: boolean;
  governorateRaw: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
  duplicateDetails?: DuplicateDetails;
  matchedOrderSummary?: string;
  skipDuplicate?: boolean;
  isExcluded?: boolean;
  isManuallyEdited?: boolean;
}

/**
 * Validate a single parsed row according to Falcon business rules.
 */
export function validateImportRow(
  rawRow: Record<string, unknown>,
  mapping: Record<string, string>,
  rowNumber: number,
  shippingRates: GovernorateRate[] = DEFAULT_GOVERNORATES
): ValidatedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const getValue = (fieldKey: string) => {
    const colName = mapping[fieldKey];
    if (!colName) return undefined;
    return rawRow[colName];
  };

  const customerName = String(getValue("customer_name") ?? "").trim();
  const rawPhonePrimary = getValue("phone_primary");
  const rawPhoneSecondary = getValue("phone_secondary");

  // Intelligent phone splitting and sanitization
  const phoneSplit = splitAndNormalizePhoneNumbers(rawPhonePrimary);
  const phonePrimary = phoneSplit.primary;
  let phoneSecondary = rawPhoneSecondary ? normalizePhoneNumber(rawPhoneSecondary) : null;

  // Auto-populate secondary phone if cell contained two numbers
  if (!phoneSecondary && phoneSplit.secondary) {
    phoneSecondary = phoneSplit.secondary;
    warnings.push(`تم استخراج رقم إضافي (${phoneSecondary}) من نفس الخلية`);
  }

  if (phoneSplit.wasRepaired && phoneSplit.repairs.length > 0) {
    warnings.push(`تم تصحيح الهاتف: ${phoneSplit.repairs.join("، ")}`);
  }

  const rawGovernorate = String(getValue("governorate") ?? "").trim();
  const address = String(getValue("address") ?? "").trim();
  const landmark = getValue("landmark") ? String(getValue("landmark")).trim() : null;
  const importantNotes = getValue("important_notes")
    ? String(getValue("important_notes")).trim()
    : null;

  // Match governorate using Smart Address & District Auto-Standardizer
  let cleanGovernorate = rawGovernorate;
  let governorateMatched = false;
  let calculatedShippingCost: number | null = null;
  let cleanAddress = address;
  let cleanLandmark = landmark;

  if (address || rawGovernorate) {
    const stdResult = standardizeAddress(address || "", rawGovernorate || "", shippingRates);
    if (stdResult.standardGovernorate) {
      cleanGovernorate = stdResult.standardGovernorate;
      governorateMatched = true;
      calculatedShippingCost = stdResult.shippingRate;
      if (stdResult.wasGovernorateCorrected) {
        warnings.push(
          `تم تصحيح المحافظة تلقائياً من "${rawGovernorate}" إلى "${stdResult.standardGovernorate}" (${stdResult.correctionReason || "بناءً على المركز/المنطقة"}).`
        );
      }
    }
    if (stdResult.cleanedStreetAddress) {
      cleanAddress = stdResult.cleanedStreetAddress;
    }
    if (stdResult.extractedLandmark && !cleanLandmark) {
      cleanLandmark = stdResult.extractedLandmark;
    }
  }

  // Numeric fields
  const rawTotal = getValue("order_total");
  const orderTotal =
    rawTotal !== undefined && rawTotal !== null && rawTotal !== ""
      ? Number(rawTotal)
      : NaN;

  const rawPaid = getValue("paid_amount");
  const paidAmount =
    rawPaid !== undefined && rawPaid !== null && rawPaid !== ""
      ? Number(rawPaid)
      : 0;

  // Auto-assign governorate shipping cost if matched; fallback to sheet shipping column or 0
  const rawShipping = getValue("shipping_cost");
  let shippingCost =
    calculatedShippingCost !== null
      ? calculatedShippingCost
      : rawShipping !== undefined && rawShipping !== null && rawShipping !== ""
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

  if (!cleanGovernorate) {
    errors.push("المحافظة مطلوبة");
  } else if (!governorateMatched) {
    errors.push("المحافظة غير معروفة - يرجى تحديدها يدوياً");
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

  const codAmount = !isNaN(orderTotal) ? calculateCod(orderTotal, paidAmount) : 0;
  const netProfit = !isNaN(orderTotal) ? calculateNetProfit(orderTotal, shippingCost) : 0;
  const paymentStatus = !isNaN(orderTotal) ? derivePaymentStatus(orderTotal, paidAmount) : "unpaid";

  const cleanOrder: OrderInsert = {
    order_date: orderDate,
    customer_name: customerName,
    phone_primary: phonePrimary,
    phone_secondary: phoneSecondary || null,
    governorate: cleanGovernorate,
    address: cleanAddress,
    landmark: cleanLandmark || null,
    important_notes: importantNotes || null,
    order_total: isNaN(orderTotal) ? 0 : orderTotal,
    paid_amount: isNaN(paidAmount) ? 0 : paidAmount,
    cod_amount: codAmount,
    shipping_cost: shippingCost,
    net_profit: netProfit,
    payment_status: paymentStatus,
    print_status: "pending",
    delivery_status: "new",
    settlement_status: "pending",
  };

  return {
    rowNumber,
    raw: rawRow,
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    data: cleanOrder,
    governorateMatched,
    governorateRaw: rawGovernorate,
    isDuplicate: false,
    skipDuplicate: false,
  };
}

/**
 * Detect intra-sheet duplicate orders by grouping on phone numbers
 * and comparing names and totals.
 */
export function detectIntraSheetDuplicates(rows: ValidatedImportRow[]): ValidatedImportRow[] {
  const phoneToRows = new Map<string, ValidatedImportRow[]>();

  rows.forEach((r) => {
    const phone = r.data?.phone_primary || "";
    if (phone && phone.length >= 7) {
      const list = phoneToRows.get(phone) || [];
      list.push(r);
      phoneToRows.set(phone, list);
    }
  });

  return rows.map((r) => {
    const phone = r.data?.phone_primary || "";
    if (!phone) return r;

    const group = phoneToRows.get(phone) || [];
    if (group.length <= 1) return r;

    const otherRows = group.filter((o) => o.rowNumber !== r.rowNumber);
    const conflictingNums = otherRows.map((o) => o.rowNumber);

    const exactMatch = otherRows.find((o) => {
      const sameTotal = Math.abs((o.data?.order_total ?? 0) - (r.data?.order_total ?? 0)) < 0.01;
      const sameName =
        normalizeArabic(o.data?.customer_name ?? "").toLowerCase() ===
        normalizeArabic(r.data?.customer_name ?? "").toLowerCase();
      return sameTotal && sameName;
    });

    if (exactMatch) {
      const details: DuplicateDetails = {
        severity: "exact_sheet",
        badgeText: "تطابق تام بنفس الملف",
        badgeVariant: "rose",
        reason: `مكرر متطابق تماماً بنفس الملف مع الصف #${exactMatch.rowNumber} (نفس الاسم والمبلغ)`,
        conflictingRowNumbers: conflictingNums,
      };
      return {
        ...r,
        isDuplicate: true,
        duplicateReason: details.reason,
        duplicateDetails: details,
        skipDuplicate: false,
      };
    }

    const details: DuplicateDetails = {
      severity: "phone_sheet",
      badgeText: "نفس الهاتف بنفس الملف",
      badgeVariant: "amber",
      reason: `رقم الهاتف (${phone}) مكرر في صفوف أخرى بنفس الملف (#${conflictingNums.join(", #")})`,
      conflictingRowNumbers: conflictingNums,
    };

    return {
      ...r,
      isDuplicate: true,
      duplicateReason: details.reason,
      duplicateDetails: details,
      skipDuplicate: false,
    };
  });
}

/**
 * Classify database duplicates against existing orders in the system.
 */
export function classifyDbDuplicates(
  rows: ValidatedImportRow[],
  dbMatches: Record<string, any[]>
): ValidatedImportRow[] {
  return rows.map((r) => {
    const phone = r.data?.phone_primary || "";
    if (!phone || !dbMatches[phone] || dbMatches[phone].length === 0) {
      return r;
    }

    const matches = dbMatches[phone];
    const exactMatch = matches.find((m: any) => {
      const sameTotal = Math.abs(Number(m.order_total) - (r.data?.order_total ?? 0)) < 0.01;
      const sameName =
        normalizeArabic(String(m.customer_name ?? "")).toLowerCase() ===
        normalizeArabic(r.data?.customer_name ?? "").toLowerCase();
      return sameTotal && sameName;
    });

    const sameTotalMatch = !exactMatch
      ? matches.find((m: any) => Math.abs(Number(m.order_total) - (r.data?.order_total ?? 0)) < 0.01)
      : null;

    const bestMatch = exactMatch || sameTotalMatch || matches[0];
    const shortId = bestMatch.id ? String(bestMatch.id).slice(0, 8).toUpperCase() : "REF";
    const totalFormatted = `${Number(bestMatch.order_total || 0)} ج.م`;

    let details: DuplicateDetails;

    if (exactMatch) {
      details = {
        severity: "exact_db",
        badgeText: "طلب مطابق سابق بالنظام",
        badgeVariant: "rose",
        reason: `يوجد طلب سابق مطابق تماماً #${shortId} (${bestMatch.customer_name} - ${totalFormatted})`,
        matchedOrderId: bestMatch.id,
        matchedCustomerName: bestMatch.customer_name,
        matchedOrderTotal: Number(bestMatch.order_total),
        matchedDeliveryStatus: bestMatch.delivery_status,
        matchedOrderDate: bestMatch.order_date || bestMatch.created_at,
      };
    } else if (sameTotalMatch) {
      details = {
        severity: "same_phone_amount",
        badgeText: "نفس الهاتف والمبلغ سابقاً",
        badgeVariant: "amber",
        reason: `يوجد طلب سابق بنفس الهاتف والمبلغ #${shortId} (${totalFormatted})`,
        matchedOrderId: bestMatch.id,
        matchedCustomerName: bestMatch.customer_name,
        matchedOrderTotal: Number(bestMatch.order_total),
        matchedDeliveryStatus: bestMatch.delivery_status,
        matchedOrderDate: bestMatch.order_date || bestMatch.created_at,
      };
    } else {
      details = {
        severity: "returning_customer",
        badgeText: "عميل سابق",
        badgeVariant: "blue",
        reason: `عميل مسجل سابقاً بالنظام (آخر طلب #${shortId} - الحالة: ${bestMatch.delivery_status})`,
        matchedOrderId: bestMatch.id,
        matchedCustomerName: bestMatch.customer_name,
        matchedOrderTotal: Number(bestMatch.order_total),
        matchedDeliveryStatus: bestMatch.delivery_status,
        matchedOrderDate: bestMatch.order_date || bestMatch.created_at,
      };
    }

    const existingSeverity = r.duplicateDetails?.severity;
    const shouldOverride =
      !existingSeverity || existingSeverity === "phone_sheet" || details.severity === "exact_db";

    return {
      ...r,
      isDuplicate: true,
      duplicateReason: shouldOverride ? details.reason : r.duplicateReason,
      duplicateDetails: shouldOverride ? details : r.duplicateDetails,
      matchedOrderSummary: `طلب #${shortId} | ${bestMatch.customer_name} | ${totalFormatted} | ${bestMatch.delivery_status || "جديد"}`,
    };
  });
}

/**
 * Re-validates a single row after the merchant makes inline modifications in the preview table.
 */
export function revalidateSingleRow(
  row: ValidatedImportRow,
  updatedFields: Partial<OrderInsert>,
  shippingRates: GovernorateRate[] = DEFAULT_GOVERNORATES
): ValidatedImportRow {
  const currentData: OrderInsert = {
    order_date: row.data?.order_date || new Date().toISOString().split("T")[0],
    customer_name: row.data?.customer_name || "",
    phone_primary: row.data?.phone_primary || "",
    phone_secondary: row.data?.phone_secondary || null,
    governorate: row.data?.governorate || "",
    address: row.data?.address || "",
    landmark: row.data?.landmark || null,
    important_notes: row.data?.important_notes || null,
    order_total: row.data?.order_total ?? 0,
    paid_amount: row.data?.paid_amount ?? 0,
    cod_amount: row.data?.cod_amount ?? 0,
    shipping_cost: row.data?.shipping_cost ?? 0,
    net_profit: row.data?.net_profit ?? 0,
    payment_status: row.data?.payment_status || "unpaid",
    print_status: row.data?.print_status || "pending",
    delivery_status: row.data?.delivery_status || "new",
    settlement_status: row.data?.settlement_status || "pending",
    ...updatedFields,
  };

  const errors: string[] = [];
  const customerName = currentData.customer_name.trim();
  const phonePrimary = normalizePhoneNumber(currentData.phone_primary);
  const phoneSecondary = currentData.phone_secondary
    ? normalizePhoneNumber(currentData.phone_secondary)
    : null;
  const address = currentData.address.trim();

  // Re-match governorate
  let cleanGovernorate = currentData.governorate.trim();
  let governorateMatched = false;
  let shippingCost = currentData.shipping_cost;

  if (cleanGovernorate) {
    const match = matchGovernorate(cleanGovernorate, shippingRates);
    if (match.matched && match.standardName && match.rate !== undefined) {
      cleanGovernorate = match.standardName;
      shippingCost = match.rate;
      governorateMatched = true;
    }
  } else if (address) {
    const match = matchGovernorate(address, shippingRates);
    if (match.matched && match.standardName && match.rate !== undefined) {
      cleanGovernorate = match.standardName;
      shippingCost = match.rate;
      governorateMatched = true;
    }
  }

  // Validate fields
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

  if (!cleanGovernorate) {
    errors.push("المحافظة مطلوبة");
  } else if (!governorateMatched) {
    errors.push("المحافظة غير معروفة - يرجى تحديدها يدوياً");
  }

  if (!address) {
    errors.push("العنوان بالتفصيل مطلوب");
  }

  const orderTotal = Number(currentData.order_total ?? 0);
  const paidAmount = Number(currentData.paid_amount ?? 0);
  const shipping = Number(shippingCost ?? 0);

  if (isNaN(orderTotal) || orderTotal < 0) {
    errors.push("سعر الأوردر يجب أن يكون رقماً موجباً");
  }

  if (isNaN(paidAmount) || paidAmount < 0) {
    errors.push("المبلغ المدفوع لا يمكن أن يكون سالباً");
  }

  if (!isNaN(orderTotal) && !isNaN(paidAmount) && paidAmount > orderTotal) {
    errors.push("المبلغ المدفوع مقدمًا لا يمكن أن يتجاوز سعر الأوردر");
  }

  if (isNaN(shipping) || shipping < 0) {
    errors.push("سعر الشحن يجب أن يكون رقماً موجباً أو صفر");
  }

  const codAmount = !isNaN(orderTotal) ? calculateCod(orderTotal, paidAmount) : 0;
  const netProfit = !isNaN(orderTotal) ? calculateNetProfit(orderTotal, shipping) : 0;
  const paymentStatus = !isNaN(orderTotal) ? derivePaymentStatus(orderTotal, paidAmount) : "unpaid";

  const updatedOrderData: OrderInsert = {
    ...currentData,
    customer_name: customerName,
    phone_primary: phonePrimary,
    phone_secondary: phoneSecondary,
    governorate: cleanGovernorate,
    address: address,
    shipping_cost: shipping,
    cod_amount: codAmount,
    net_profit: netProfit,
    payment_status: paymentStatus,
  };

  return {
    ...row,
    isValid: errors.length === 0,
    errors,
    data: updatedOrderData,
    governorateMatched,
    governorateRaw: cleanGovernorate,
    isManuallyEdited: true,
  };
}

/**
 * Apply bulk duplicate resolution strategy across all rows in the preview.
 */
export function applyDuplicateResolutionStrategy(
  rows: ValidatedImportRow[],
  strategy: "skip_all" | "skip_exact_only" | "import_all"
): ValidatedImportRow[] {
  return rows.map((r) => {
    if (!r.isDuplicate) return r;

    if (strategy === "skip_all") {
      return { ...r, skipDuplicate: true };
    }

    if (strategy === "import_all") {
      return { ...r, skipDuplicate: false };
    }

    if (strategy === "skip_exact_only") {
      const sev = r.duplicateDetails?.severity;
      const isExact = sev === "exact_sheet" || sev === "exact_db";
      return { ...r, skipDuplicate: isExact };
    }

    return r;
  });
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
