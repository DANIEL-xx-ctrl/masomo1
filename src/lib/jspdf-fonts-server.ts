/**
 * Server-side jsPDF Unicode Font Utility
 *
 * Reads NotoSans font files from the filesystem and registers them
 * with jsPDF so that French accented characters render correctly
 * in server-generated PDFs.
 *
 * Usage:
 *   import { setupJspdfFontsServer } from '@/lib/jspdf-fonts-server';
 *   const doc = new jsPDF();
 *   await setupJspdfFontsServer(doc);
 *   doc.setFont('NotoSans');
 *   doc.text('Élève – Méthode', 14, 20);
 */

import jsPDF from 'jspdf';
import { readFileSync } from 'fs';
import { join } from 'path';

let _regularB64: string | null = null;
let _boldB64: string | null = null;

function loadFontAsBase64(filename: string): string {
  const filePath = join(process.cwd(), 'public', 'fonts', filename);
  const buffer = readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Register NotoSans fonts with a jsPDF document instance (server-side).
 * Fonts are loaded once and cached for subsequent calls.
 */
export function setupJspdfFontsServer(doc: jsPDF): void {
  // Load & cache
  if (!_regularB64) {
    _regularB64 = loadFontAsBase64('NotoSans-Regular.ttf');
  }
  if (!_boldB64) {
    _boldB64 = loadFontAsBase64('NotoSans-Bold.ttf');
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
