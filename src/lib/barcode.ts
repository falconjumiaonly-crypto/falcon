/**
 * Zero-dependency pure TypeScript Code 128 (Subset B) Vector SVG Barcode Generator.
 * Produces ultra-sharp, high-contrast, scannable vector barcodes for thermal and laser printers.
 */

// Code 128 patterns: each string contains 6 digits representing widths of alternating bars and spaces (sum = 11)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "233111", // 100-106 (104=Start B, 105=Start C, 106=Stop part 1)
];

const STOP_PATTERN = "2331112"; // 13 modules for stop code

/**
 * Encodes text into Code 128 (Subset B) modules string of '1's and '0's.
 */
export function encodeCode128B(text: string): string {
  if (!text) return "";

  // Start Code B index is 104
  const startCode = 104;
  const codes: number[] = [startCode];
  let checksum = startCode;

  // Code B: ASCII values from 32 to 127 correspond to index (ascii - 32)
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Support ASCII characters 32 to 126
    const codeIndex = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(codeIndex);
    checksum += codeIndex * (i + 1);
  }

  // Calculate modulo 103 checksum
  const checkDigit = checksum % 103;
  codes.push(checkDigit);

  // Convert codes to 1s and 0s
  let binary = "";

  // Append start and data codes
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    let isBar = true;
    for (const widthStr of pattern) {
      const width = parseInt(widthStr, 10);
      binary += (isBar ? "1" : "0").repeat(width);
      isBar = !isBar;
    }
  }

  // Append STOP pattern (106)
  let isBar = true;
  for (const widthStr of STOP_PATTERN) {
    const width = parseInt(widthStr, 10);
    binary += (isBar ? "1" : "0").repeat(width);
    isBar = !isBar;
  }

  return binary;
}

export interface BarcodeSvgOptions {
  height?: number; // Height in px or mm
  moduleWidth?: number; // Width of 1 module (default 1.8)
  showText?: boolean;
  quietZone?: boolean | number;
  fill?: string;
}

/**
 * Generates an optimized, crisp SVG string for a Code 128 barcode.
 */
export function generateBarcodeSvg(
  text: string,
  options: BarcodeSvgOptions = {}
): string {
  const {
    height = 50,
    moduleWidth = 1.8,
    showText = true,
    quietZone = true,
    fill = "black",
  } = options;

  const binary = encodeCode128B(text);
  if (!binary) return "";

  const quietModules = typeof quietZone === "number" ? quietZone : quietZone ? 10 : 0;
  const totalModules = binary.length + quietModules * 2;
  const totalWidth = totalModules * moduleWidth;
  const barHeight = showText ? height - 14 : height;

  let rects = "";
  let currentRun = 0;
  let currentStart = 0;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === "1") {
      if (currentRun === 0) {
        currentStart = i;
      }
      currentRun++;
    } else {
      if (currentRun > 0) {
        const x = (quietModules + currentStart) * moduleWidth;
        const w = currentRun * moduleWidth;
        rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="${fill}" />`;
        currentRun = 0;
      }
    }
  }

  if (currentRun > 0) {
    const x = (quietModules + currentStart) * moduleWidth;
    const w = currentRun * moduleWidth;
    rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="${fill}" />`;
  }

  const textElement = showText
    ? `<text x="${(totalWidth / 2).toFixed(2)}" y="${height - 2}" font-family="monospace, Courier, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="${fill}">${text}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet" style="display:block;max-width:100%;">${rects}${textElement}</svg>`;
}

export const generateCode128Svg = generateBarcodeSvg;

