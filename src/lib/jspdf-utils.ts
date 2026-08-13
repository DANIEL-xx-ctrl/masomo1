/**
 * jsPDF French Text Normalization Utility
 *
 * jsPDF's default Helvetica font only supports WinAnsiEncoding (Windows-1252),
 * which cannot render French accented characters (É, é, è, ê, à, ç, etc.).
 * They appear as garbled text (e.g., "&T").
 *
 * This utility normalizes French text by replacing accented characters
 * with their unaccented equivalents before passing to jsPDF.
 *
 * Usage:
 *   import { normalizeForPdf } from '@/lib/jspdf-utils';
 *   doc.text(normalizeForPdf('Élève – Méthode'), 14, 20);
 */

/**
 * Map of accented characters to their unaccented equivalents.
 * Covers French, Spanish, Portuguese, German and other Latin-based languages.
 */
const ACCENT_MAP: Record<string, string> = {
  // Uppercase
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
  'Æ': 'AE',
  'Ç': 'C',
  'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
  'Ð': 'D',
  'Ñ': 'N',
  'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
  'Ý': 'Y',
  'Þ': 'Th',
  'Ÿ': 'Y',

  // Lowercase
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
  'æ': 'ae',
  'ç': 'c',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ð': 'd',
  'ñ': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y',
  'þ': 'th',
  'ÿ': 'y',

  // Special characters
  'Œ': 'OE', 'œ': 'oe',
  'ß': 'ss',
  'Ð': 'Dj',
  '\u2013': '-',   // en dash
  '\u2014': '-',   // em dash
  '\u2018': "'",   // left single quote
  '\u2019': "'",   // right single quote
  '\u201C': '"',   // left double quote
  '\u201D': '"',   // right double quote
  '\u2026': '...',  // ellipsis
  '\u00AB': '<<',  // left guillemet
  '\u00BB': '>>',  // right guillemet
};

const ACCENT_REGEX = new RegExp(
  Object.keys(ACCENT_MAP).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

/**
 * Normalize text for jsPDF by replacing accented/special characters
 * with their ASCII equivalents.
 */
export function normalizeForPdf(text: string): string {
  if (!text) return text;
  return text.replace(ACCENT_REGEX, (match) => ACCENT_MAP[match] || match);
}
