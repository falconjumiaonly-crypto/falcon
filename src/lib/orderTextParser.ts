import { DEFAULT_GOVERNORATES, matchGovernorate, normalizeArabic } from "./governorates";
import { standardizeAddress } from "./addressStandardizer";
import type { GovernorateRate } from "../types/database";

export interface ParsedOrderResult {
  customer_name: string;
  phone_primary: string;
  phone_secondary: string;
  governorate: string;
  district?: string;
  address: string;
  landmark: string;
  order_total: number;
  paid_amount: number;
  important_notes: string;
  items_summary: string;
  raw_text: string;
  was_governorate_corrected?: boolean;
  correction_reason?: string;
  confidence: {
    name: boolean;
    phone: boolean;
    governorate: boolean;
    address: boolean;
    total: boolean;
  };
}

/**
 * Egyptian Phone Number Regex
 * Supports: 01012345678, +201012345678, 201012345678, 010-1234-5678
 */
const EG_PHONE_REGEX = /(?:(?:\+?20\s*)|(?:\b0))?1[0125][\s-]?\d{4}[\s-]?\d{4}\b/g;

/**
 * Clean & standardize Egyptian phone numbers to 11 digits format (01xxxxxxxxx)
 */
export function sanitizeEgyptianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) {
    return "0" + digits.slice(2);
  }
  if (digits.length === 10 && digits.startsWith("1")) {
    return "0" + digits;
  }
  if (digits.length === 11 && digits.startsWith("01")) {
    return digits;
  }
  return digits;
}

/**
 * Convert Eastern Arabic / Hindi digits (٠-٩) and Persian digits (۰-۹) to standard Western digits (0-9)
 */
export function convertArabicDigitsToEnglish(text: string): string {
  if (!text) return "";
  return text
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/**
 * Smart Order Text Parser
 * Intelligently extracts structured order fields from messy messages (WhatsApp, Facebook, DMs, SMS)
 */
export function parseOrderText(
  rawText: string,
  ratesList: GovernorateRate[] = DEFAULT_GOVERNORATES
): ParsedOrderResult {
  if (!rawText || typeof rawText !== "string") {
    return {
      customer_name: "",
      phone_primary: "",
      phone_secondary: "",
      governorate: "",
      address: "",
      landmark: "",
      order_total: 0,
      paid_amount: 0,
      important_notes: "",
      items_summary: "",
      raw_text: "",
      confidence: {
        name: false,
        phone: false,
        governorate: false,
        address: false,
        total: false,
      },
    };
  }

  // Normalize Eastern Arabic numerals to standard 0-9 digits upfront
  const cleanRaw = convertArabicDigitsToEnglish(rawText).trim();
  const lines = cleanRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let customer_name = "";
  let phone_primary = "";
  let phone_secondary = "";
  let governorate = "";
  let address = "";
  let landmark = "";
  let order_total = 0;
  let paid_amount = 0;
  let important_notes = "";
  let items_summary = "";

  let explicit_total = 0;
  let deposit_amount = 0;
  let remaining_amount = 0;
  let saw_deposit_line = false;
  let explicit_notes_candidate = "";

  // 1. Extract All Phones in the Text
  const phoneMatches = cleanRaw.match(EG_PHONE_REGEX);
  if (phoneMatches && phoneMatches.length > 0) {
    phone_primary = sanitizeEgyptianPhone(phoneMatches[0]);
    if (phoneMatches.length > 1) {
      const second = sanitizeEgyptianPhone(phoneMatches[1]);
      if (second !== phone_primary) {
        phone_secondary = second;
      }
    }
  }

  // 2. Identify Lines with Labels & Process
  const unhandledLines: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Phone Label Line (consume without leaking to unhandled or notes)
    if (
      /^(?:رقم\s*)?(?:الموبايل|الموبيل|الهاتف|التليفون|التلفون|تلفون|تليفون|موبايل|فون)\s*(?:اضافي|اضافى|اخر|تانى|ثاني)?\s*[:=-]?/i.test(
        line
      ) ||
      /^(?:رقم\s*(?:اضافي|اضافى|اخر|تانى|ثاني))\s*[:=-]?/i.test(line)
    ) {
      saw_deposit_line = false;
      continue;
    }

    // Standalone Phone Line (consume directly)
    const cleanDigits = line.replace(/[\s-]/g, "");
    if (/^(?:\+?20|0)?1[0125]\d{8}$/.test(cleanDigits)) {
      saw_deposit_line = false;
      continue;
    }

    // Intro / Preamble Line (e.g. "ال 4 جرابات دول للعميلة دي", "ال 4 جرابات دول للعميل ده")
    const isIntroLine =
      /^(?:ال|دول)?\s*\d*\s*(?:جرابات|جراب|اوردر|أوردر|طلب|طرد|شحنة|شحنه|كفر|كفرات|ساعة|ساعات|ساعه|سماعة|سماعه|منتجات|صنف|قطعة|قطع)/i.test(
        line
      ) || /(?:للعميل|للعميلة|للزبون|للكستمر)/i.test(line);

    if (isIntroLine) {
      saw_deposit_line = false;
      if (!items_summary) {
        const cleanedItem = line
          .replace(/^(?:ال|دول)\s*/i, "")
          .replace(/(?:دول\s*)?(?:للعميل|للعميلة|للزبون|للكستمر).*$/i, "")
          .trim();
        items_summary = cleanedItem || line;
      }
      continue;
    }

    // Customer Name Label
    if (/^(?:الاسم|اسم العميل|العميل|اسم المستلم|المستلم)\s*[:=-]\s*(.*)$/i.test(line)) {
      saw_deposit_line = false;
      const match = line.match(/^(?:الاسم|اسم العميل|العميل|اسم المستلم|المستلم)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        customer_name = cleanCustomerName(match[1]);
        continue;
      }
    }

    // Explicit Governorate Label
    if (/^(?:المحافظه|المحافظة)\s*[:=-]\s*(.*)$/i.test(line)) {
      saw_deposit_line = false;
      const match = line.match(/^(?:المحافظه|المحافظة)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        const govResult = matchGovernorate(match[1], ratesList);
        if (govResult.matched && govResult.standardName) {
          governorate = govResult.standardName;
          continue;
        }
      }
    }

    // Standalone Governorate Line (e.g. "الدقهليه", "الشرقية", "محافظة القاهرة")
    const strippedGovCandidate = line.replace(/^(?:محافظة|محافظه)\s*/i, "").trim();
    const isNotStreetOrBuilding = !/(?:شارع|ش\b|عمارة|عماره|شقة|شقه|دور|برج|ميدان|طريق|بجوار|امام|أمام|خلف|قرية|قريه|مركز)/i.test(
      line
    );
    if (strippedGovCandidate && isNotStreetOrBuilding) {
      const words = strippedGovCandidate.split(/\s+/).filter(Boolean);
      if (words.length <= 3) {
        const govCheck = matchGovernorate(strippedGovCandidate, ratesList);
        if (govCheck.matched && govCheck.standardName) {
          saw_deposit_line = false;
          governorate = govCheck.standardName;
          continue;
        }
      }
    }

    // Explicit Address Label
    if (/^(?:العنوان|عنوان العميل|مكان التوصيل|المنطقة)\s*[:=-]\s*(.*)$/i.test(line)) {
      saw_deposit_line = false;
      const match = line.match(/^(?:العنوان|عنوان العميل|مكان التوصيل|المنطقة)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        address = match[1].trim();
        continue;
      }
    }

    // Landmark Label / Additional Landmark Line
    if (/^(?:و?علامه مميزه|و?علامة مميزة|و?بجوار|و?امام|و?أمام|و?خلف|و?جنب|و?عند|و?اقرب معلم)\s*[:=-]?\s*(.*)$/i.test(line)) {
      saw_deposit_line = false;
      const match = line.match(
        /^(?:و?علامه مميزه|و?علامة مميزة|و?بجوار|و?امام|و?أمام|و?خلف|و?جنب|و?عند|و?اقرب معلم)\s*[:=-]?\s*(.*)$/i
      );
      const landmarkText = match && match[1] && match[1].length > 1 ? match[1].trim() : line.trim();
      if (landmarkText) {
        landmark = landmark ? `${landmark} - ${landmarkText}` : landmarkText;
        continue;
      }
    }

    // Check for remaining amount and deposit amount (supports compound lines like "بعت 300 باقي 400")
    const remainingInLineMatch = line.match(
      /(?:باقي|الباقي|متبقي|المتبقي|الحساب|حساب|الخساب|المطلوب تحصيله|المطلوب|تحصيل|المبلغ المطلوب|سعر الاوردر|قيمة الاوردر|قيمه الاوردر)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i
    );
    const depositInLineMatch = line.match(
      /(?:بعتت|بعت|حولت|حول|تم تحويل|مدفوع|عربون|مقدم|فودافون كاش|انستاباي|كاش|دفع)\s*[:=-]?\s*(\d+(?:\.\d+)?)/i
    );

    if (remainingInLineMatch || depositInLineMatch) {
      if (remainingInLineMatch && remainingInLineMatch[1]) {
        remaining_amount = parseFloat(remainingInLineMatch[1]) || 0;
        saw_deposit_line = false;
      }
      if (depositInLineMatch && depositInLineMatch[1]) {
        deposit_amount = parseFloat(depositInLineMatch[1]) || 0;
        saw_deposit_line = true;
      }
      continue;
    }

    // Standalone number on the line immediately following a deposit line (e.g. Line: "بعت 200", Next: "410")
    if (saw_deposit_line && /^\s*(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp|le)?\s*$/i.test(line)) {
      const match = line.match(/^\s*(\d+(?:\.\d+)?)/);
      if (match && match[1]) {
        remaining_amount = parseFloat(match[1]) || 0;
        saw_deposit_line = false;
        continue;
      }
    }
    saw_deposit_line = false;

    // Explicit Total Label
    if (
      /^(?:المبلغ|السعر|المجموع|الاجمالي|الإجمالي)\s*[:=-]\s*(\d+(?:\.\d+)?)/i.test(
        line
      )
    ) {
      const match = line.match(
        /^(?:المبلغ|السعر|المجموع|الاجمالي|الإجمالي)\s*[:=-]\s*(\d+(?:\.\d+)?)/i
      );
      if (match && match[1]) {
        explicit_total = parseFloat(match[1]) || 0;
        continue;
      }
    }

    // Products / Order Details Label
    if (/^(?:الطلب|المنتجات|الاوردر|الأوردر|المطلوب|الصنف)\s*[:=-]\s*(.*)$/i.test(line)) {
      const match = line.match(/^(?:الطلب|المنتجات|الاوردر|الأوردر|المطلوب|الصنف)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        items_summary = match[1].trim();
        continue;
      }
    }

    // Notes Label (e.g. "ملاحظات: ...", "تنبيه للمندوب: ...")
    if (/^(?:ملاحظات|ملاحظه|ملحوظة|تنبيه|تنبيه للمندوب|تعليمات للمندوب)\s*[:=-]\s*(.*)$/i.test(line)) {
      saw_deposit_line = false;
      const match = line.match(/^(?:ملاحظات|ملاحظه|ملحوظة|تنبيه|تنبيه للمندوب|تعليمات للمندوب)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        explicit_notes_candidate = match[1].trim();
        continue;
      }
    }

    // Fragile Line (consume directly so it doesn't leak into address or items)
    if (isFragileItem(line) && line.trim().length <= 35) {
      continue;
    }

    // Courier Alert / Delivery Timing Line (consume directly so it doesn't leak into address or items)
    if ((isDeliveryTiming(line) || isCourierAlert(line)) && line.trim().length <= 80) {
      continue;
    }

    // Line didn't have an explicit key-value label
    unhandledLines.push(line);
  }

  // 3. Resolve Financial Figures (COD, Deposit, Remaining)
  // Per business rule: When remaining (باقي) is present, it represents the exact COD account to collect.
  // The deposit (بعتت / عربون) is already deducted and considered not part of courier collection.
  // Prices and deposits are strictly excluded from important_notes.
  if (remaining_amount > 0) {
    order_total = remaining_amount;
    paid_amount = 0;
  } else if (explicit_total > 0 && deposit_amount > 0) {
    order_total = explicit_total;
    paid_amount = deposit_amount;
  } else if (explicit_total > 0) {
    order_total = explicit_total;
    paid_amount = 0;
  } else if (deposit_amount > 0) {
    order_total = deposit_amount;
    paid_amount = 0;
  } else {
    // Fallback: check for inline money in the whole text like "750 ج" or "600 جنيه"
    const moneyMatch = cleanRaw.match(/(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp|le)(?:[\s,،.-]|$)/i);
    if (moneyMatch) {
      order_total = parseFloat(moneyMatch[1]) || 0;
    }
  }

  // 4. Single-line Name extraction before Phone anchor
  if (!customer_name && phone_primary) {
    for (let i = 0; i < unhandledLines.length; i++) {
      const line = unhandledLines[i];
      const phoneIndex = line.search(EG_PHONE_REGEX);
      if (phoneIndex > 0) {
        const textBeforePhone = line.slice(0, phoneIndex).trim();
        const candidateWords = textBeforePhone.split(/\s+/).filter(Boolean);
        const isNotAddress = !/(?:شارع|ش\b|عمارة|عماره|شقة|شقه|دور|برج|ميدان|طريق|بجوار|امام|أمام|خلف|قرية|قريه|مركز)/i.test(
          textBeforePhone
        );
        if (candidateWords.length >= 2 && candidateWords.length <= 5 && isNotAddress) {
          customer_name = cleanCustomerName(textBeforePhone);
          const textAfterPhone = line.slice(phoneIndex).replace(EG_PHONE_REGEX, "").trim();
          if (textAfterPhone) {
            unhandledLines[i] = textAfterPhone;
          } else {
            unhandledLines.splice(i, 1);
          }
          break;
        }
      }
    }
  }

  // 5. Fallback extract customer name from unhandled lines
  if (!customer_name) {
    for (let i = 0; i < unhandledLines.length; i++) {
      const candidate = unhandledLines[i].replace(EG_PHONE_REGEX, "").trim();
      const words = candidate.split(/\s+/).filter(Boolean);
      const isAddressLike = /(?:شارع|ش\b|عمارة|عماره|شقة|شقه|دور|برج|ميدان|طريق|بجوار|امام|أمام|خلف|قرية|قريه|مركز|حي|منطقة|بلوك|بيت|مسجد)/i.test(
        candidate
      );
      const isIntroOrItem = /(?:جراب|جرابات|اوردر|أوردر|طلب|طرد|شحنة|شحنه|كفر|كفرات|دول|للعميل|للعميلة|زبون|عميل|شحن|توصيل)/i.test(
        candidate
      );
      const isProductModel = /^(?:redmi|iphone|samsung|oppo|realme|xiaomi|nokia|huawei|honor|vivo|infinix)\b/i.test(
        candidate
      );
      const hasLotsOfDigits = /\d{2,}/.test(candidate);

      if (words.length >= 2 && words.length <= 5 && !isAddressLike && !isIntroOrItem && !isProductModel && !hasLotsOfDigits) {
        customer_name = cleanCustomerName(candidate);
        unhandledLines.splice(i, 1);
        break;
      }
    }
  }

  // 6. Fallback extract governorate from remaining lines
  if (!governorate && address) {
    const directMatch = matchGovernorate(address, ratesList);
    if (directMatch.matched && directMatch.standardName) {
      governorate = directMatch.standardName;
    } else {
      const words = address.split(/[\s,،-]+/);
      for (const word of words) {
        if (word.length >= 3) {
          const wordMatch = matchGovernorate(word, ratesList);
          if (wordMatch.matched && wordMatch.standardName) {
            governorate = wordMatch.standardName;
            break;
          }
        }
      }
    }
  }

  if (!governorate) {
    for (let i = 0; i < unhandledLines.length; i++) {
      const candidate = unhandledLines[i];
      const directMatch = matchGovernorate(candidate, ratesList);
      if (directMatch.matched && directMatch.standardName) {
        governorate = directMatch.standardName;
        unhandledLines.splice(i, 1);
        break;
      }

      const words = candidate.split(/[\s,،-]+/);
      for (const word of words) {
        if (word.length >= 3) {
          const wordMatch = matchGovernorate(word, ratesList);
          if (wordMatch.matched && wordMatch.standardName) {
            governorate = wordMatch.standardName;
            break;
          }
        }
      }
      if (governorate) {
        break;
      }
    }
  }

  // 7. Extract address from remaining lines
  if (!address) {
    const addressCandidates: string[] = [];
    for (let i = unhandledLines.length - 1; i >= 0; i--) {
      const candidate = unhandledLines[i];
      const isAddressLike = /(?:شارع|ش\b|عمارة|عماره|شقة|شقه|دور|برج|ميدان|طريق|بجوار|امام|أمام|خلف|قرية|قريه|مركز|حي|منطقة|بلوك|بيت|مسجد|جمعية|كنيسة|عزبة|كفر)/i.test(
        candidate
      );
      if (isAddressLike) {
        addressCandidates.unshift(candidate);
        unhandledLines.splice(i, 1);
      }
    }
    if (addressCandidates.length > 0) {
      address = addressCandidates.join(" - ");
    }
  }

  if (!address && unhandledLines.length > 0) {
    unhandledLines.sort((a, b) => b.length - a.length);
    address = unhandledLines.shift() || "";
  }

  if (address) {
    address = address.replace(EG_PHONE_REGEX, "").replace(/(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp|le)\b/gi, "").trim();
  }

  // 8. Remaining lines become items summary if not already set (excluding prices and courier notes)
  if (unhandledLines.length > 0) {
    const candidateItemLines = unhandledLines.filter(
      (l) => !isPriceOrProductOnly(l) && !isDeliveryTiming(l) && !isCourierAlert(l)
    );
    if (!items_summary && candidateItemLines.length > 0) {
      items_summary = candidateItemLines.join(" | ").replace(EG_PHONE_REGEX, "").trim();
    }
  }

  // 9. Build Strictly Filtered Courier Notes (Important Notes)
  // Per business rule: ONLY delivery timing (معاد), courier alerts/instructions (تنبيه للمندوب), or fragile (ضد الكسر).
  // Strictly EXCLUDE prices, deposits, totals, and product items.
  const courierNotesList: string[] = [];

  // A) Fragile Check ("ضد الكسر")
  if (isFragileItem(cleanRaw)) {
    courierNotesList.push("ضد الكسر");
  }

  // B) Explicit Notes Label (e.g. "ملاحظات: التسليم بعد 5")
  if (explicit_notes_candidate) {
    const cleaned = explicit_notes_candidate
      .replace(/^(?:ملاحظات|ملاحظه|ملحوظة|تنبيه|تنبيه للمندوب|تعليمات للمندوب)\s*[:=-]?\s*/i, "")
      .trim();
    if (cleaned && !isPriceOrProductOnly(cleaned)) {
      if (isDeliveryTiming(cleaned) || isCourierAlert(cleaned) || isFragileItem(cleaned)) {
        if (!courierNotesList.some((n) => n.includes(cleaned) || cleaned.includes(n))) {
          courierNotesList.push(cleaned);
        }
      }
    }
  }

  // C) Scan all raw lines for delivery timing or courier instructions
  for (const line of lines) {
    const t = line.trim();
    if (!t || isPriceOrProductOnly(t)) continue;

    if (isDeliveryTiming(t) || isCourierAlert(t)) {
      if (!courierNotesList.some((n) => n.includes(t) || t.includes(n))) {
        courierNotesList.push(t);
      }
    }
  }

  important_notes = courierNotesList.join(" | ");

  // Smart Address & District Auto-Standardizer
  let detectedDistrict = "";
  let wasGovCorrected = false;
  let correctionReason = "";

  if (address || governorate) {
    const stdResult = standardizeAddress(address, governorate, ratesList);
    if (stdResult.standardGovernorate) {
      if (governorate && stdResult.wasGovernorateCorrected) {
        wasGovCorrected = true;
        correctionReason = stdResult.correctionReason || "";
      }
      governorate = stdResult.standardGovernorate;
    }
    if (stdResult.standardDistrict) {
      detectedDistrict = stdResult.standardDistrict;
    }
    if (stdResult.cleanedStreetAddress) {
      address = stdResult.cleanedStreetAddress;
    }
    if (stdResult.extractedLandmark && !landmark) {
      landmark = stdResult.extractedLandmark;
    }
  }

  // Fallback extract landmark if address has explicit phrases
  if (!landmark && address) {
    const landmarkMatch = address.match(/(?:بجوار|امام|أمام|خلف|اقرب معلم)\s+([^,،-]+)/i);
    if (landmarkMatch && landmarkMatch[0]) {
      landmark = landmarkMatch[0].trim();
    }
  }

  return {
    customer_name: customer_name.trim(),
    phone_primary: phone_primary.trim(),
    phone_secondary: phone_secondary.trim(),
    governorate: governorate.trim(),
    district: detectedDistrict,
    address: address.trim(),
    landmark: landmark.trim(),
    order_total,
    paid_amount,
    important_notes: important_notes.trim(),
    items_summary: items_summary.trim(),
    raw_text: cleanRaw,
    was_governorate_corrected: wasGovCorrected,
    correction_reason: correctionReason,
    confidence: {
      name: Boolean(customer_name && customer_name.length >= 3),
      phone: Boolean(phone_primary && phone_primary.length === 11),
      governorate: Boolean(governorate),
      address: Boolean(address && address.length >= 5),
      total: Boolean(order_total > 0),
    },
  };
}

/**
 * Check if text contains delivery timing / appointment keywords ("معاد")
 */
function isDeliveryTiming(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  return (
    /(?:معاد|ميعاد|توقيت|وقت|الساعة|الساعه|صباحا|صباحاً|مساء|مساءً|ظهرا|ظهراً|عصرا|عصراً|التسليم|الاستلام|التوصيل|يوصل|توصل)\s*(?:بعد|قبل|الساعة|الساعه|يوم|السبت|الاحد|الأحد|الاثنين|الإثنين|الثلاثاء|الاربعاء|الأربعاء|الخميس|الجمعة|الجمعه|\d+)/i.test(
      t
    ) ||
    /(?:بعد|قبل)\s+(?:الساعة|الساعه|\d+)/i.test(t) ||
    /(?:التسليم|الاستلام|التوصيل)\s+(?:صباحاً|صباحا|مساءً|مساء|بعد الظهر|قبل الظهر|يوم)/i.test(t) ||
    /(?:التسليم|الاستلام)\s*(?:من|بين)\s*\d+\s*(?:لـ?|الى|إلى)\s*\d+/i.test(t)
  );
}

/**
 * Check if text contains courier instructions or alerts ("تنبيه للمندوب")
 */
function isCourierAlert(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  return (
    /(?:تنبيه|ملحوظة|ملاحظة|ملاحظه|هام|تعليمات)\s*(?:للمندوب|للشحن|للكابتن|للموزع)?/i.test(t) ||
    /(?:رن|اتصل|الاتصال|تواصل|كلم|كلمه)\s*(?:قبل|مع|علي|على|بالمستلم|بالعميل|قبل الوصول|قبل ما تروح|قبل التحرك|بـ?\d+)/i.test(
      t
    ) ||
    /(?:ممنوع|عدم)\s*(?:فتح|الفتح|المعاينة|المعاينه|التسليم)/i.test(t) ||
    /(?:معاينة|معاينه|مسموح الفتح|مسموح بالمعاينة|مسموح بالمعاينه|فتح الشحنة|فتح الشحنه|السماح بالفتح)/i.test(
      t
    ) ||
    /(?:تسليم شخصي|شخصياً|لا تسلم للحارس|عدم تركها مع الحارس|تسليم يد بيد|برجاء الاتصال)/i.test(
      t
    )
  );
}

/**
 * Check if text mentions Fragile ("ضد الكسر")
 */
function isFragileItem(text: string): boolean {
  if (!text) return false;
  return /(?:ضد\s*الكسر|قابل\s*للكسر|قابلة\s*للكسر|حساس\s*للكسر|احذر\s*الكسر|محتوى\s*زجاج)/i.test(
    text
  );
}

/**
 * Check if text is only price, deposit, currency, or product description (excluded from courier notes)
 */
function isPriceOrProductOnly(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  // Price / Currency / Deposit
  if (
    /^(?:بعتت?|حولت?|عربون|مدفوع|مقدم|باقي|الباقي|متبقي|المتبقي|الحساب|المبلغ|السعر|الإجمالي|الاجمالي|المطلوب)\b/i.test(
      t
    ) ||
    /^\d+\s*(?:ج|جنيه|ج\.م|egp|le)?$/i.test(t) ||
    /^(?:عربون مدفوع|باقي \d+|الحساب \d+)/i.test(t)
  ) {
    return true;
  }
  // Product / Items / Quantities
  if (
    /^(?:ال|دول)?\s*\d*\s*(?:جراب|جرابات|كفر|كفرات|ساعة|ساعات|ساعه|سماعة|سماعه|منتج|منتجات|صنف|قطعة|قطع|اوردر|طلب|طرد|شحنة|شحنه)\b/i.test(
      t
    ) ||
    /^(?:redmi|iphone|samsung|oppo|realme|xiaomi|nokia|huawei|honor|vivo|infinix)\b/i.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Remove noise, emojis, and unwanted symbols from extracted customer names
 */
function cleanCustomerName(raw: string): string {
  return raw
    .replace(/[^\u0600-\u06FFa-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Smart Bulk Order Text Parser
 * Splits and extracts multiple orders from combined text (separated by dashes, empty lines, or numbered headers)
 */
export function parseBulkOrderText(
  rawText: string,
  ratesList: GovernorateRate[] = DEFAULT_GOVERNORATES
): ParsedOrderResult[] {
  if (!rawText || typeof rawText !== "string") return [];

  const text = convertArabicDigitsToEnglish(rawText).trim();
  if (!text) return [];

  // Delimiters: ---, ===, ***, ___, ###, or numbered headers like "1-", "2-", "أوردر 1", "طلب 1"
  const explicitDelimiter = /(?:\r?\n\s*)*(?:-{3,}|={3,}|\*{3,}|_{3,}|#{3,}|\/{3,}|\bأوردر\s*\d+[:=-]?|\bطلب\s*\d+[:=-]?|\b\d+\s*[-.)]\s*)(?:\r?\n\s*)*/gi;

  let chunks: string[] = [];

  if (explicitDelimiter.test(text)) {
    chunks = text.split(explicitDelimiter).map((c) => c.trim()).filter((c) => c.length > 5);
  } else if (/\r?\n\s*\r?\n\s*\r?\n/.test(text)) {
    // 3 or more line breaks
    chunks = text.split(/\r?\n\s*\r?\n\s*\r?\n/).map((c) => c.trim()).filter((c) => c.length > 5);
  } else if (/\r?\n\s*\r?\n/.test(text)) {
    // Double line breaks
    chunks = text.split(/\r?\n\s*\r?\n/).map((c) => c.trim()).filter((c) => c.length > 5);
  } else {
    // Fallback: single chunk
    chunks = [text];
  }

  // Parse each chunk
  const results: ParsedOrderResult[] = [];
  for (const chunk of chunks) {
    const parsed = parseOrderText(chunk, ratesList);
    // Keep chunk if it has at least customer_name or phone_primary
    if (parsed.customer_name || parsed.phone_primary) {
      results.push(parsed);
    }
  }

  return results;
}

