/**
 * Lightweight CODE128 barcode encoder (no external dependency).
 *
 * Generates the bar/space pattern for a CODE128-B barcode (printable ASCII),
 * suitable for rendering as either:
 *   - an inline SVG string (for HTML outputs: Word, Excel, A4 print, ticket print)
 *   - a list of {x, width, black} bars (for jsPDF rectangles)
 *
 * Why CODE128-B?
 *   - Encodes all 128 ASCII characters (receipt numbers like "REC-2024-001"
 *     and even alphanumeric codes work).
 *   - Compact: each character = 11 modules, plus start/stop.
 *   - Self-checking with a modulo-103 checksum.
 *
 * The encoder is intentionally minimal — it only produces the bar pattern.
 * The caller decides how to render it (SVG <rect> for HTML, doc.rect for jsPDF).
 */

/* ------------------------------------------------------------------ */
/* CODE128-B tables                                                    */
/* ------------------------------------------------------------------ */

// CODE128-B character patterns (11 modules each: bar/space alternating,
// starting with a bar). Each value is an 11-bit number where 1 = bar (black)
// and 0 = space (white). The patterns are taken from the CODE128 spec.
const CODE128_B_PATTERNS: number[] = [
  0b11011001100, 0b11001101100, 0b11001100110, 0b10010011000, 0b10010001100,
  0b10001001100, 0b10011001000, 0b10011000100, 0b10001100100, 0b11001001000,
  0b11001000100, 0b11000100100, 0b10110011100, 0b10011011100, 0b10011001110,
  0b10111001100, 0b10011101100, 0b10011100110, 0b11001110010, 0b11001011100,
  0b11001001110, 0b11011100100, 0b11001110100, 0b11101101110, 0b11101001100,
  0b11100101100, 0b11100100110, 0b11101100100, 0b11100110100, 0b11100110010,
  0b11011011000, 0b11011000110, 0b11000110110, 0b10100011000, 0b10001011000,
  0b10001000110, 0b10110001000, 0b10001101000, 0b10001100010, 0b11010001000,
  0b11000101000, 0b11000100010, 0b10110111000, 0b10110001110, 0b10001101110,
  0b10111011000, 0b10111000110, 0b10001110110, 0b11101110110, 0b11010001100,
  0b11000110010, 0b11000110010, 0b11000010100, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
  0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010, 0b11000010010,
];

// Start code for CODE128-B (value 104)
const START_B = 104;
// Stop pattern (value 106, but it's 13 modules: 11000111010 + final bar 1)
const STOP_PATTERN = 0b11000111010;

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Encode `data` as CODE128-B and return the list of bars.
 *
 * Each bar is `{ offset, width }` where both are in module units (1 module =
 * 1 unit of width). Only the BLACK bars are returned; spaces are implied by
 * the gaps between consecutive bars.
 *
 * The total width (in modules) = (start:11) + (data:11*len) + (checksum:11) + (stop:13).
 */
export interface BarcodeBar {
  /** Start offset of this bar, in module units from the left edge. */
  offset: number;
  /** Width of this bar, in module units. */
  width: number;
}

export function encodeCode128B(data: string): { bars: BarcodeBar[]; totalModules: number } {
  // Build the list of CODE128-B values for the data characters.
  const values: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const ch = data.charCodeAt(i);
    // CODE128-B maps ASCII 32..126 to values 0..94. Any character outside
    // this range is replaced with a space (value 0) to keep the encoder
    // from crashing — receipt numbers should always be printable ASCII.
    if (ch >= 32 && ch <= 126) {
      values.push(ch - 32);
    } else {
      values.push(0);
    }
  }

  // Compute the modulo-103 checksum.
  // checksum = (START_B + sum(value_i * position_i)) mod 103
  // where position_i is 1-based (first data char = position 1).
  let checksum = START_B;
  values.forEach((v, idx) => {
    checksum += v * (idx + 1);
  });
  checksum = checksum % 103;

  // Build the full module bit-string: start + data + checksum + stop + final bar.
  const modules: number[] = [];

  // Start code B (value 104 → pattern index 104, which is the start pattern).
  // The patterns array above only covers 0..95 (printable ASCII), so we need
  // the explicit start/stop codes here.
  const START_B_PATTERN = 0b11010010000; // CODE128 Start B
  pushPattern(modules, START_B_PATTERN);

  // Data characters.
  values.forEach((v) => {
    pushPattern(modules, CODE128_B_PATTERNS[v] ?? 0);
  });

  // Checksum character.
  pushPattern(modules, CODE128_B_PATTERNS[checksum] ?? 0);

  // Stop pattern (13 modules: the 11-bit STOP_PATTERN + a final 2-module bar).
  pushPattern(modules, STOP_PATTERN);
  modules.push(1); // final bar (1 module)

  // Convert the module bit-string into a list of black bars.
  const bars: BarcodeBar[] = [];
  let offset = 0;
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === 1) {
      // Start of a black bar — consume consecutive 1s.
      let width = 0;
      while (i < modules.length && modules[i] === 1) {
        width++;
        i++;
      }
      bars.push({ offset, width });
      offset += width;
    } else {
      // White space — consume consecutive 0s.
      let width = 0;
      while (i < modules.length && modules[i] === 0) {
        width++;
        i++;
      }
      offset += width;
    }
  }

  return { bars, totalModules: modules.length };
}

function pushPattern(modules: number[], pattern: number): void {
  // pattern is an 11-bit number; push MSB first.
  for (let bit = 10; bit >= 0; bit--) {
    modules.push((pattern >> bit) & 1);
  }
}

/* ------------------------------------------------------------------ */
/* Renderers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Render the barcode as an inline SVG string.
 *
 * @param data       The string to encode.
 * @param width      Total SVG width in px.
 * @param height     Bar height in px.
 * @param showText   If true, render the data as text below the bars.
 */
export function barcodeToSvg(data: string, width = 280, height = 60, showText = true): string {
  const { bars, totalModules } = encodeCode128B(data);
  const moduleWidth = width / totalModules;
  const barHeight = showText ? height - 16 : height;

  const rects = bars
    .map(
      (b) =>
        `<rect x="${(b.offset * moduleWidth).toFixed(2)}" y="0" width="${(b.width * moduleWidth).toFixed(2)}" height="${barHeight}" fill="#000"/>`
    )
    .join('');

  const text = showText
    ? `<text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-family="monospace" font-size="11" fill="#000">${escapeXml(data)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Code-barres ${escapeXml(data)}">${rects}${text}</svg>`;
}

/**
 * Render the barcode bars onto a jsPDF document.
 *
 * @param doc    The jsPDF document instance.
 * @param data   The string to encode.
 * @param x      Top-left X position in PDF units (mm).
 * @param y      Top-left Y position in PDF units (mm).
 * @param w      Total barcode width in mm.
 * @param h      Bar height in mm.
 * @param opts   Optional: { showText?: boolean, fontSize?: number }
 */
export function drawBarcodeOnJsPDF(
  doc: { rect: (x: number, y: number, w: number, h: number, style: string) => void; setFillColor: (r: number, g: number, b: number) => void; setFontSize: (n: number) => void; setTextColor: (r: number, g: number, b: number) => void; setFont: (f: string, s: string) => void; text: (t: string, x: number, y: number, opts?: { align?: string }) => void },
  data: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { showText?: boolean; fontSize?: number } = {}
): void {
  const { bars, totalModules } = encodeCode128B(data);
  const moduleWidth = w / totalModules;
  const barHeight = opts.showText ? h - 4 : h;

  doc.setFillColor(0, 0, 0);
  bars.forEach((b) => {
    doc.rect(x + b.offset * moduleWidth, y, b.width * moduleWidth, barHeight, 'F');
  });

  if (opts.showText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(opts.fontSize ?? 8);
    doc.setTextColor(15, 23, 42);
    doc.text(data, x + w / 2, y + h - 0.5, { align: 'center' });
  }
}

/**
 * Generate a unique barcode value for a receipt.
 *
 * The barcode encodes the receipt number plus a short random suffix, so even
 * two receipts with the same number (shouldn't happen, but defensive) get
 * distinct barcodes. The format is: `<receiptNumber>#<6-hex>`.
 */
export function generateBarcodeValue(receiptNumber: string): string {
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${receiptNumber}#${suffix}`;
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
