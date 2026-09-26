import type { GovernorateRate } from "../types/database";

export const DEFAULT_GOVERNORATES: GovernorateRate[] = [
  { name: "القاهرة", rate: 65, aliases: ["القاهره", "قاهرة", "قاهره", "مصر", "cairo"] },
  { name: "الجيزة", rate: 65, aliases: ["جيزة", "جيزه", "الجيزه", "giza", "الهرم", "فيصل", "أكتوبر", "اكتوبر", "الشيخ زايد", "زايد"] },
  { name: "الإسكندرية", rate: 75, aliases: ["اسكندرية", "اسكندريه", "الاسكندرية", "الاسكندريه", "alex", "alexandria"] },
  { name: "الدقهلية", rate: 75, aliases: ["دقهلية", "دقهليه", "المنصورة", "المنصوره", "منصورة", "منصوره", "dakahlia"] },
  { name: "القليوبية", rate: 65, aliases: ["قليوبية", "قليوبيه", "بنها", "شبرا الخيمة", "شبرا الخيمه", "العبور", "قليوب", "طوخ"] },
  { name: "الشرقية", rate: 75, aliases: ["شرقية", "شرقيه", "الزقازيق", "زقازيق", "العاشر من رمضان", "العاشر", "بلبيس", "فاقوس"] },
  { name: "الغربية", rate: 75, aliases: ["غربية", "غربيه", "طنطا", "المحلة", "المحله", "المحلة الكبرى", "كفر الزيات", "زفتى"] },
  { name: "المنوفية", rate: 75, aliases: ["منوفية", "منوفيه", "شبين الكوم", "شبين", "منوف", "السادات", "اشمون", "أشمون"] },
  { name: "البحيرة", rate: 75, aliases: ["بحيرة", "بحيره", "دمنهور", "كفر الدوار", "إيتاي البارود", "ايتاي البارود", "رشيد"] },
  { name: "كفر الشيخ", rate: 75, aliases: ["كفرالشيخ", "كفر_الشيخ", "دسوق", "بيلا", "سيدي سالم"] },
  { name: "دمياط", rate: 75, aliases: ["دمياط الجديدة", "دمياط الجديده", "رأس البر", "راس البر", "فارسكور"] },
  { name: "بورسعيد", rate: 75, aliases: ["بور سعيد", "بورفؤاد", "بور فؤاد", "port said"] },
  { name: "الإسماعيلية", rate: 75, aliases: ["اسماعيلية", "اسماعيليه", "الاسماعيلية", "الاسماعيليه", "ismailia", "فايد", "القنطرة"] },
  { name: "السويس", rate: 75, aliases: ["سويس", "العين السخنة", "العين السخنه", "السخنة", "السخنه", "suez"] },
  { name: "الفيوم", rate: 85, aliases: ["فيوم", "ابشواي", "إبشواي", "طامية", "سنورس"] },
  { name: "بني سويف", rate: 85, aliases: ["بنى سويف", "بني_سويف", "الواسطى", "ناصر", "ببا"] },
  { name: "المنيا", rate: 90, aliases: ["منيا", "ملوي", "مغاغة", "بني مزار", "سمالوط", "أبو قرقاص"] },
  { name: "أسيوط", rate: 95, aliases: ["اسيوط", "ديروط", "منفلوط", "القوصية", "أبنوب", "ابنوب"] },
  { name: "سوهاج", rate: 100, aliases: ["طهطا", "جرجا", "أخميم", "اخميم", "المراغة", "البلينا"] },
  { name: "قنا", rate: 100, aliases: ["نجع حمادي", "قوص", "دشنا", "فرشوط", "قفط"] },
  { name: "الأقصر", rate: 105, aliases: ["اقصر", "الاقصر", "اسنا", "إسنا", "أرمنت", "ارمنت", "luxor"] },
  { name: "أسوان", rate: 110, aliases: ["اسوان", "كوم امبو", "كوم أمبو", "إدفو", "ادفو", "دراو", "نصر النوبة", "aswan"] },
  { name: "البحر الأحمر", rate: 110, aliases: ["الغردقة", "الغردقه", "غردقة", "غردقه", "الجونة", "الجونه", "سفاجا", "القصير", "مرسى علم", "راس غارب", "رأس غارب"] },
  { name: "الوادي الجديد", rate: 120, aliases: ["الوادى الجديد", "الخارجة", "الخارجه", "الداخلة", "الداخله", "الفرافرة", "فرافرة"] },
  { name: "مطروح", rate: 100, aliases: ["مرسى مطروح", "مرسي مطروح", "الساحل الشمالي", "الساحل", "مارينا", "العلمين", "سيوة"] },
  { name: "شمال سيناء", rate: 110, aliases: ["العريش", "بئر العبد", "الشيخ زويد", "رفح"] },
  { name: "جنوب سيناء", rate: 110, aliases: ["شرم الشيخ", "دهب", "نويبع", "طابا", "طور سيناء", "سانت كاترين", "رأس سدر", "راس سدر"] },
];

/**
 * Normalize Arabic text for resilient fuzzy matching:
 * - strips diacritics (tashkeel)
 * - unifies alefs (أ, إ, آ, ٱ -> ا)
 * - unifies taa marbuta & haa (ة -> ه)
 * - unifies yaa & alef maksura (ى -> ي)
 * - strips non-letter punctuation and extra spaces
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  let str = text.trim().toLowerCase();

  // Remove Arabic diacritics / tashkeel
  str = str.replace(/[\u064B-\u065F\u0670]/g, "");

  // Unify Alefs
  str = str.replace(/[أإآٱ]/g, "ا");

  // Unify Taa Marbuta & Haa
  str = str.replace(/ة/g, "ه");

  // Unify Yaa & Alef Maksura
  str = str.replace(/ى/g, "ي");

  // Remove Persian/Urdu variants if any
  str = str.replace(/ك/g, "ك").replace(/ي/g, "ي");

  // Remove non-word characters except spaces (e.g. dashes, underscores)
  str = str.replace(/[-_./\\,]/g, " ");

  // Collapse spaces
  str = str.replace(/\s+/g, " ").trim();

  return str;
}

/**
 * Remove definite article (ال) if present at the beginning of a word
 */
export function stripDefiniteArticle(normalized: string): string {
  if (normalized.startsWith("ال") && normalized.length > 3) {
    return normalized.slice(2);
  }
  return normalized;
}

export interface MatchResult {
  matched: boolean;
  standardName?: string;
  rate?: number;
}

/**
 * Match raw governorate or address text against system governorate rates.
 * Strict but resilient: matches exact, normalized, stripped-al, and discrete aliases.
 * If confidence is low or input is unknown, returns matched: false without guessing.
 */
export function matchGovernorate(
  rawInput: string,
  ratesList: GovernorateRate[] = DEFAULT_GOVERNORATES
): MatchResult {
  if (!rawInput || typeof rawInput !== "string") {
    return { matched: false };
  }

  const rawClean = rawInput.trim();
  if (!rawClean) return { matched: false };

  const normInput = normalizeArabic(rawClean);
  const strippedInput = stripDefiniteArticle(normInput);

  // 1. Direct or normalized match against primary governorate name
  for (const gov of ratesList) {
    const normGov = normalizeArabic(gov.name);
    const strippedGov = stripDefiniteArticle(normGov);

    if (
      normInput === normGov ||
      strippedInput === strippedGov ||
      normInput === strippedGov ||
      strippedInput === normGov
    ) {
      return { matched: true, standardName: gov.name, rate: gov.rate };
    }
  }

  // 2. Match against aliases
  for (const gov of ratesList) {
    const aliases = gov.aliases || [];
    for (const alias of aliases) {
      const normAlias = normalizeArabic(alias);
      const strippedAlias = stripDefiniteArticle(normAlias);

      if (
        normInput === normAlias ||
        strippedInput === strippedAlias ||
        normInput === strippedAlias ||
        strippedInput === normAlias
      ) {
        return { matched: true, standardName: gov.name, rate: gov.rate };
      }
    }
  }

  // 3. Word-boundary / discrete token match
  // e.g. "محافظة الجيزة", "القاهرة - مدينة نصر", "عمارة 15 الجيزة"
  // Split input into words and check if any whole word or 2-word phrase matches a governorate
  const words = normInput.split(" ").filter(Boolean);

  // Check 2-word governorates first (e.g. "كفر الشيخ", "بني سويف", "البحر الاحمر", "الوادي الجديد", "جنوب سيناء", "شمال سيناء", "بور سعيد")
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    const strippedTwoWord = `${stripDefiniteArticle(words[i])} ${stripDefiniteArticle(words[i + 1])}`;

    for (const gov of ratesList) {
      const normGov = normalizeArabic(gov.name);
      const strippedGov = stripDefiniteArticle(normGov);

      if (twoWord === normGov || strippedTwoWord === strippedGov) {
        return { matched: true, standardName: gov.name, rate: gov.rate };
      }

      for (const alias of gov.aliases || []) {
        const normAlias = normalizeArabic(alias);
        const strippedAlias = stripDefiniteArticle(normAlias);
        if (twoWord === normAlias || strippedTwoWord === strippedAlias) {
          return { matched: true, standardName: gov.name, rate: gov.rate };
        }
      }
    }
  }

  // Check single-word tokens
  for (const word of words) {
    if (["محافظه", "محافظة", "مدينه", "مدينة", "مركز", "قريه", "قرية", "شارع", "ش"].includes(word)) {
      continue;
    }
    const strippedWord = stripDefiniteArticle(word);

    for (const gov of ratesList) {
      const normGov = normalizeArabic(gov.name);
      // Skip multi-word governorates here as they were checked above
      if (normGov.includes(" ")) continue;

      const strippedGov = stripDefiniteArticle(normGov);
      if (word === normGov || strippedWord === strippedGov) {
        return { matched: true, standardName: gov.name, rate: gov.rate };
      }

      for (const alias of gov.aliases || []) {
        if (alias.includes(" ")) continue;
        const normAlias = normalizeArabic(alias);
        const strippedAlias = stripDefiniteArticle(normAlias);
        if (word === normAlias || strippedWord === strippedAlias) {
          return { matched: true, standardName: gov.name, rate: gov.rate };
        }
      }
    }
  }

  // If not identified with high confidence, do NOT guess or assign random rates
  return { matched: false };
}
