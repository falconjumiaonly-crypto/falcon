import {
  DEFAULT_GOVERNORATES,
  matchGovernorate,
  normalizeArabic,
  stripDefiniteArticle,
} from "./governorates";
import {
  EGYPT_DISTRICTS_BY_GOVERNORATE,
  COMMON_MISCLASSIFICATION_RULES,
  MisclassificationRule,
} from "./districtData";
import type { GovernorateRate } from "../types/database";

export interface StandardizedAddressResult {
  rawAddress: string;
  standardGovernorate: string;
  standardDistrict: string | null;
  cleanedStreetAddress: string;
  extractedLandmark: string | null;
  wasGovernorateCorrected: boolean;
  correctionReason: string | null;
  shippingRate: number | null;
  confidence: "high" | "medium" | "low";
}

export interface MisclassificationCheckResult {
  isMisclassified: boolean;
  originalGov: string;
  correctGov: string;
  district: string;
  reason: string;
}

/**
 * Common landmark indicator keywords in Egyptian colloquial addresses.
 */
const LANDMARK_TRIGGER_PATTERNS = [
  /بجوار\s+([^،,\n\r]+)/i,
  /جنب\s+([^،,\n\r]+)/i,
  /خلف\s+([^،,\n\r]+)/i,
  /أمام\s+([^،,\n\r]+)/i,
  /امام\s+([^،,\n\r]+)/i,
  /قدام\s+([^،,\n\r]+)/i,
  /مقابل\s+([^،,\n\r]+)/i,
  /على\s+ناصية\s+([^،,\n\r]+)/i,
  /ناصية\s+([^،,\n\r]+)/i,
  /قريب\s+من\s+([^،,\n\r]+)/i,
  /بالقرب\s+من\s+([^،,\n\r]+)/i,
  /عند\s+([^،,\n\r]+)/i,
];

/**
 * Returns list of standard districts for a governorate.
 */
export function getDistrictsForGovernorate(governorate: string): string[] {
  if (!governorate) return [];
  const normGov = normalizeArabic(governorate);

  // Exact or normalized key lookup
  for (const [govKey, list] of Object.entries(EGYPT_DISTRICTS_BY_GOVERNORATE)) {
    if (normalizeArabic(govKey) === normGov) {
      return list;
    }
  }

  // Fallback alias match using matchGovernorate
  const match = matchGovernorate(governorate);
  if (match.matched && match.standardName && EGYPT_DISTRICTS_BY_GOVERNORATE[match.standardName]) {
    return EGYPT_DISTRICTS_BY_GOVERNORATE[match.standardName];
  }

  return [];
}

/**
 * Detects if a specified address and governorate violate known Egyptian shipping routing rules.
 * e.g. Customer selected "القاهرة" but wrote "شبرا الخيمة" (which is strictly القليوبية),
 * or selected "القاهرة" but wrote "6 أكتوبر" (which is strictly الجيزة).
 */
export function detectGovernorateMisclassification(
  addressText: string,
  currentGov: string
): MisclassificationCheckResult | null {
  if (!addressText || !currentGov) return null;

  const normAddress = normalizeArabic(addressText);
  const normGov = normalizeArabic(currentGov);

  for (const rule of COMMON_MISCLASSIFICATION_RULES) {
    const isIncorrectCandidate = rule.incorrectGovernorates.some(
      (ig) => normalizeArabic(ig) === normGov
    );

    if (isIncorrectCandidate) {
      const allAliases = [rule.districtName, ...(rule.aliases || [])];
      for (const alias of allAliases) {
        const normAlias = normalizeArabic(alias);
        // Discrete match in address
        if (
          normAddress.includes(normAlias) ||
          normAddress.includes(stripDefiniteArticle(normAlias))
        ) {
          // Special disambiguation for شبرا مصر vs شبرا الخيمة
          if (rule.districtName === "شبرا الخيمة") {
            if (normAddress.includes("شبرا مصر")) {
              continue; // It really is شبرا مصر in Cairo
            }
          }

          return {
            isMisclassified: true,
            originalGov: currentGov,
            correctGov: rule.correctGovernorate,
            district: rule.districtName,
            reason: rule.explanation,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Searches the address text for any recognized Egyptian district.
 * If preferredGovernorate is provided, prioritizes districts belonging to it.
 */
export function findDistrictInText(
  text: string,
  preferredGovernorate?: string
): { district: string; governorate: string } | null {
  if (!text) return null;

  const normText = normalizeArabic(text);

  // Check misclassification rules first to avoid false positives (e.g. شبرا الخيمة vs شبرا)
  if (preferredGovernorate) {
    const misclass = detectGovernorateMisclassification(text, preferredGovernorate);
    if (misclass) {
      return { district: misclass.district, governorate: misclass.correctGov };
    }
  }

  // If preferred governorate is specified, check its districts first (longest first)
  if (preferredGovernorate) {
    const districts = getDistrictsForGovernorate(preferredGovernorate);
    const sorted = [...districts].sort((a, b) => b.length - a.length);

    for (const dist of sorted) {
      const normDist = normalizeArabic(dist);
      const strippedDist = stripDefiniteArticle(normDist);
      if (normText.includes(normDist) || (strippedDist.length >= 4 && normText.includes(strippedDist))) {
        return { district: dist, governorate: preferredGovernorate };
      }
    }
  }

  // Scan all governorates (longest district name first for greedy matching)
  const allCandidates: { district: string; governorate: string; length: number }[] = [];

  for (const [gov, list] of Object.entries(EGYPT_DISTRICTS_BY_GOVERNORATE)) {
    for (const dist of list) {
      const normDist = normalizeArabic(dist);
      const strippedDist = stripDefiniteArticle(normDist);

      if (normText.includes(normDist) || (strippedDist.length >= 4 && normText.includes(strippedDist))) {
        allCandidates.push({
          district: dist,
          governorate: gov,
          length: dist.length,
        });
      }
    }
  }

  if (allCandidates.length > 0) {
    allCandidates.sort((a, b) => b.length - a.length);
    return {
      district: allCandidates[0].district,
      governorate: allCandidates[0].governorate,
    };
  }

  return null;
}

/**
 * Extracts landmark phrases from address and cleans up repetitive noise.
 */
export function extractLandmarkAndCleanAddress(
  rawAddress: string,
  detectedDistrict?: string | null,
  detectedGov?: string | null
): { cleanedStreetAddress: string; extractedLandmark: string | null } {
  if (!rawAddress) {
    return { cleanedStreetAddress: "", extractedLandmark: null };
  }

  let address = rawAddress.trim();
  let extractedLandmark: string | null = null;

  // Search for landmark pattern
  for (const pattern of LANDMARK_TRIGGER_PATTERNS) {
    const match = address.match(pattern);
    if (match && match[0]) {
      let candidate = match[0].trim();
      // Prevent landmark from consuming district or governorate names at its tail
      if (detectedDistrict) {
        const distRegex = new RegExp(`\\s*[-–—،,:/]?\\s*(?:مدينة|مركز|حي)?\\s*${detectedDistrict}$`, "i");
        candidate = candidate.replace(distRegex, "").trim();
      }
      if (detectedGov) {
        const govRegex = new RegExp(`\\s*[-–—،,:/]?\\s*(?:محافظة|محافظه)?\\s*${detectedGov}$`, "i");
        candidate = candidate.replace(govRegex, "").trim();
      }

      extractedLandmark = candidate;
      // Remove landmark segment from the main street address string
      address = address.replace(match[0], "").trim();
      break;
    }
  }

  // Remove redundant governorate repetitions at beginning or end
  if (detectedGov) {
    const govVariants = [
      `محافظة ${detectedGov}`,
      `محافظه ${detectedGov}`,
      detectedGov,
      `القاهرة`,
      `الجيزة`,
      `الإسكندرية`,
    ];
    for (const gv of govVariants) {
      const regStart = new RegExp(`^${gv}\\s*[-–—،,:/]\\s*`, "i");
      const regEnd = new RegExp(`\\s*[-–—،,:/]?\\s*${gv}$`, "i");
      address = address.replace(regStart, "").replace(regEnd, "").trim();
    }
  }

  // Remove redundant district repetition if at very start or very end
  if (detectedDistrict) {
    const distVariants = [`مدينة ${detectedDistrict}`, `مركز ${detectedDistrict}`, detectedDistrict];
    for (const dv of distVariants) {
      const regStart = new RegExp(`^${dv}\\s*[-–—،,:/]\\s*`, "i");
      const regEnd = new RegExp(`\\s*[-–—،,:/]?\\s*${dv}$`, "i");
      address = address.replace(regStart, "").replace(regEnd, "").trim();
    }
  }

  // Clean trailing and leading punctuation / commas / dashes
  address = address
    .replace(/^[\s,،\-–—/:]+/, "")
    .replace(/[\s,،\-–—/:]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If the address was reduced to empty (e.g. user literally just wrote the district/landmark), keep the original
  if (!address && rawAddress) {
    address = rawAddress.trim();
  }

  return {
    cleanedStreetAddress: address,
    extractedLandmark: extractedLandmark || null,
  };
}

/**
 * High-level address standardizer:
 * 1. Discovers or verifies Governorate.
 * 2. Checks for known courier misclassifications (e.g. شبرا الخيمة -> القليوبية).
 * 3. Extracts District.
 * 4. Extracts Landmark and normalizes street address text.
 * 5. Matches correct shipping rate.
 */
export function standardizeAddress(
  rawAddress: string,
  initialGov?: string,
  shippingRates: GovernorateRate[] = DEFAULT_GOVERNORATES
): StandardizedAddressResult {
  const rawClean = (rawAddress || "").trim();
  let govToUse = (initialGov || "").trim();
  let wasCorrected = false;
  let correctionReason: string | null = null;
  let standardDistrict: string | null = null;
  let confidence: "high" | "medium" | "low" = "low";

  // Step 1: Check misclassification if an initial governorate was given
  if (govToUse) {
    const misclass = detectGovernorateMisclassification(rawClean, govToUse);
    if (misclass) {
      govToUse = misclass.correctGov;
      standardDistrict = misclass.district;
      wasCorrected = true;
      correctionReason = misclass.reason;
      confidence = "high";
    }
  }

  // Step 2: If no governorate or not yet matched, try matching from input
  if (!govToUse) {
    const govMatch = matchGovernorate(rawClean, shippingRates);
    if (govMatch.matched && govMatch.standardName) {
      govToUse = govMatch.standardName;
      confidence = "medium";
    }
  }

  // Step 3: Find district if not already found in Step 1
  if (!standardDistrict) {
    const districtMatch = findDistrictInText(rawClean, govToUse);
    if (districtMatch) {
      standardDistrict = districtMatch.district;
      if (!govToUse) {
        govToUse = districtMatch.governorate;
      }
      confidence = "high";
    }
  }

  // Step 4: Resolve standard governorate name via matchGovernorate
  let standardGov = govToUse;
  let rate: number | null = null;
  if (govToUse) {
    const finalGovMatch = matchGovernorate(govToUse, shippingRates);
    if (finalGovMatch.matched && finalGovMatch.standardName) {
      standardGov = finalGovMatch.standardName;
      rate = finalGovMatch.rate ?? null;
      if (confidence === "low") confidence = "medium";
    }
  }

  // Step 5: Clean address and extract landmark
  const { cleanedStreetAddress, extractedLandmark } = extractLandmarkAndCleanAddress(
    rawClean,
    standardDistrict,
    standardGov
  );

  return {
    rawAddress: rawClean,
    standardGovernorate: standardGov,
    standardDistrict,
    cleanedStreetAddress: cleanedStreetAddress || rawClean,
    extractedLandmark,
    wasGovernorateCorrected: wasCorrected,
    correctionReason,
    shippingRate: rate,
    confidence,
  };
}
