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

  const cleanRaw = rawText.trim();
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

  // Check for inline money pattern like: "750 ج" or "600 جنيه" or "EGP 500" or "750ج"
  const moneyMatch = cleanRaw.match(/(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp|le)(?:[\s,،.-]|$)/i);
  if (moneyMatch) {
    order_total = parseFloat(moneyMatch[1]) || 0;
  }

  // 2. Identify Lines with Labels & Process
  const unhandledLines: string[] = [];

  for (const line of lines) {
    // Phone Label Line (consume without leaking to unhandled or notes)
    if (/^(?:الموبايل|الموبيل|الهاتف|التليفون|فون|رقم الهاتف|رقم الموبايل|تليفون)\s*[:=-]/i.test(line)) {
      continue;
    }

    // Customer Name Label
    if (/^(?:الاسم|اسم العميل|العميل|اسم المستلم|المستلم)\s*[:=-]\s*(.*)$/i.test(line)) {
      const match = line.match(/^(?:الاسم|اسم العميل|العميل|اسم المستلم|المستلم)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        customer_name = cleanCustomerName(match[1]);
        continue;
      }
    }

    // Explicit Governorate Label
    if (/^(?:المحافظه|المحافظة)\s*[:=-]\s*(.*)$/i.test(line)) {
      const match = line.match(/^(?:المحافظه|المحافظة)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        const govResult = matchGovernorate(match[1], ratesList);
        if (govResult.matched && govResult.standardName) {
          governorate = govResult.standardName;
          continue;
        }
      }
    }

    // Explicit Address Label
    if (/^(?:العنوان|عنوان العميل|مكان التوصيل|المنطقة)\s*[:=-]\s*(.*)$/i.test(line)) {
      const match = line.match(/^(?:العنوان|عنوان العميل|مكان التوصيل|المنطقة)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        address = match[1].trim();
        continue;
      }
    }

    // Landmark Label
    if (/^(?:علامه مميزه|علامة مميزة|بجوار|امام|أمام|اقرب معلم)\s*[:=-]\s*(.*)$/i.test(line)) {
      const match = line.match(/^(?:علامه مميزه|علامة مميزة|بجوار|امام|أمام|اقرب معلم)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        landmark = match[1].trim();
        continue;
      }
    }

    // Order Total / Price Label
    if (
      /^(?:المبلغ|السعر|الحساب|المجموع|الاجمالي|الإجمالي|المطلوب|قيمة الاوردر|قيمه الاوردر)\s*[:=-]\s*(\d+(?:\.\d+)?)/i.test(
        line
      )
    ) {
      const match = line.match(
        /^(?:المبلغ|السعر|الحساب|المجموع|الاجمالي|الإجمالي|المطلوب|قيمة الاوردر|قيمه الاوردر)\s*[:=-]\s*(\d+(?:\.\d+)?)/i
      );
      if (match && match[1]) {
        order_total = parseFloat(match[1]) || 0;
        continue;
      }
    }

    // Paid / Deposit Label
    if (/^(?:مدفوع|عربون|مقدم|تم تحويل|فودافون كاش)\s*[:=-]\s*(\d+(?:\.\d+)?)/i.test(line)) {
      const match = line.match(/^(?:مدفوع|عربون|مقدم|تم تحويل|فودافون كاش)\s*[:=-]\s*(\d+(?:\.\d+)?)/i);
      if (match && match[1]) {
        paid_amount = parseFloat(match[1]) || 0;
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

    // Notes Label
    if (/^(?:ملاحظات|ملاحظه|ملحوظة|تنبيه)\s*[:=-]\s*(.*)$/i.test(line)) {
      const match = line.match(/^(?:ملاحظات|ملاحظه|ملحوظة|تنبيه)\s*[:=-]\s*(.*)$/i);
      if (match && match[1]) {
        important_notes = match[1].trim();
        continue;
      }
    }

    // Line didn't have an explicit key-value label
    unhandledLines.push(line);
  }

  // 3. Single-line or Unlabeled Compound Parser (When no labels were used)
  // Check if first line or any line contains Name preceding the Phone Number anchor
  if (!customer_name && phone_primary) {
    for (let i = 0; i < unhandledLines.length; i++) {
      const line = unhandledLines[i];
      const phoneIndex = line.search(EG_PHONE_REGEX);
      if (phoneIndex > 0) {
        const textBeforePhone = line.slice(0, phoneIndex).trim();
        const candidateWords = textBeforePhone.split(/\s+/).filter(Boolean);
        const isNotAddress = !/(?:شارع|ش\b|عمارة|عماره|شقة|شقه|دور|برج|ميدان|طريق|بجوار|امام|خلف|قرية|قريه|مركز)/i.test(
          textBeforePhone
        );
        if (candidateWords.length >= 2 && candidateWords.length <= 5 && isNotAddress) {
          customer_name = cleanCustomerName(textBeforePhone);
          // Replace what came before and including the phone from that line
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

  // 4. Fallback Heuristics for Unhandled Lines
  // If governorate not yet found, check if address already contains a governorate/city alias
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

  // If governorate not yet found, search unhandled lines
  if (!governorate) {
    for (let i = 0; i < unhandledLines.length; i++) {
      const candidate = unhandledLines[i];
      // Check whole line
      const directMatch = matchGovernorate(candidate, ratesList);
      if (directMatch.matched && directMatch.standardName) {
        governorate = directMatch.standardName;
        unhandledLines.splice(i, 1);
        break;
      }

      // Check tokens inside line
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

  // If customer_name still not found, check first remaining line
  if (!customer_name) {
    for (let i = 0; i < unhandledLines.length; i++) {
      const candidate = unhandledLines[i].replace(EG_PHONE_REGEX, "").trim();
      const words = candidate.split(/\s+/).filter(Boolean);
      const isAddressLike = /(?:شارع|ش\b|عمارة|عماره|شقة|شقه|دور|برج|ميدان|طريق|بجوار|امام|خلف|قرية|قريه|مركز)/i.test(candidate);
      const hasLotsOfDigits = /\d{2,}/.test(candidate);

      if (words.length >= 2 && words.length <= 5 && !isAddressLike && !hasLotsOfDigits) {
        customer_name = cleanCustomerName(candidate);
        unhandledLines.splice(i, 1);
        break;
      }
    }
  }

  // If address not found, check remaining lines for street/location keywords
  if (!address) {
    const addressCandidates: string[] = [];
    for (let i = unhandledLines.length - 1; i >= 0; i--) {
      const candidate = unhandledLines[i];
      const isAddressLike = /(?:شارع|ش\b|عمارة|عماره|شقة|شقه|دور|برج|ميدان|طريق|بجوار|امام|خلف|قرية|قريه|مركز|حي|منطقة|بلوك)/i.test(
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

  // If address is still empty and there are unhandled lines left, use the first/longest
  if (!address && unhandledLines.length > 0) {
    unhandledLines.sort((a, b) => b.length - a.length);
    address = unhandledLines.shift() || "";
  }

  // Clean address from extracted phone numbers or raw price strings
  if (address) {
    address = address.replace(EG_PHONE_REGEX, "").replace(/(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp|le)\b/gi, "").trim();
  }

  // Clean remaining lines into items or notes
  if (unhandledLines.length > 0) {
    const remainingText = unhandledLines.join(" | ").replace(EG_PHONE_REGEX, "").trim();
    if (!items_summary) {
      items_summary = remainingText;
    } else if (!important_notes) {
      important_notes = remainingText;
    } else {
      important_notes += " | " + remainingText;
    }
  }

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

  const text = rawText.trim();
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

