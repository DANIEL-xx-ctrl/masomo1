/**
 * jsPDF Unicode Font Utility
 *
 * Registers NotoSans (Regular + Bold) with jsPDF so that French accented
 * characters (É, é, è, ê, à, ç, etc.) render correctly in exported PDFs.
 *
 * Usage:
 *   import { setupJspdfFonts } from '@/lib/jspdf-fonts';
 *   const doc = new jsPDF();
 *   await setupJspdfFonts(doc);
 *   doc.setFont('NotoSans');
 *   doc.text('Élève – Méthode', 14, 20);   // now renders properly
 */

import jsPDF from 'jspdf';

const FONT_REGULAR_URL = '/fonts/NotoSans-Regular.ttf';
const FONT_BOLD_URL = '/fonts/NotoSans-Bold.ttf';

let _regularB64: string | null = null;
let _boldB64: string | null = null;

async function fetchFontAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font: ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URI prefix ("data:font/ttf;base64,")
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Register NotoSans fonts with a jsPDF document instance.
 * Fonts are fetched once and cached for subsequent calls.
 */
export async function setupJspdfFonts(doc: jsPDF): Promise<void> {
  // Fetch & cache
  if (!_regularB64) {
    _regularB64 = await fetchFontAsBase64(FONT_REGULAR_URL);
  }
  if (!_boldB64) {
    _boldB64 = await fetchFontAsBase64(FONT_BOLD_URL);
  }

  // Register in jsPDF virtual file system
  doc.addFileToVFS('NotoSans-Regular.ttf', _regularB64);
  doc.addFileToVFS('NotoSans-Bold.ttf', _boldB64);

  // Add font families
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');

  // Set as default font
  doc.setFont('NotoSans');
}

/**
 * Convenience: create a jsPDF document that already has NotoSans registered.
 */
export async function createPdfWithFonts(
  options: Record<string, unknown> = {},
): Promise<jsPDF> {
  const doc = new jsPDF(options as jsPDFOptions);
  await setupJspdfFonts(doc);
  return doc;
}
