/**
 * Receipt export & print utilities for a single payment.
 *
 * Produces 5 output channels, all client-side (no backend round-trip
 * required beyond the initial GET /api/payments/[id]/receipt that
 * provides the ReceiptData):
 *
 *   1. exportReceiptToPDF   — A4 portrait PDF (download)
 *   2. exportReceiptToWord  — .doc Word document (download)
 *   3. exportReceiptToExcel — .xls Excel spreadsheet (download)
 *   4. printReceiptA4       — opens print dialog in A4 portrait
 *   5. printReceiptTicket   — opens print dialog in 80mm thermal format
 *
 * The receipt payload shape mirrors what
 * GET /api/payments/[id]/receipt returns from the backend.
 */

import { jsPDF } from 'jspdf';
import { barcodeToSvg, drawBarcodeOnJsPDF, generateBarcodeValue } from '@/lib/barcode';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ReceiptData {
  receiptNumber: string;
  generatedAt: string;
  institution: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo: string | null;
    currentYear: string;
  };
  payment: {
    id: string;
    amount: number;
    amountFormatted: string;
    type: string;
    typeLabel: string;
    method: string;
    methodLabel: string;
    status: string;
    statusLabel: string;
    reference: string | null;
    description: string | null;
    schoolYear: string;
    paymentDate: string | null;
    paymentDateFormatted: string;
    createdAt: string;
    createdAtFormatted: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    image: string | null;
    gender: string | null;
    className: string | null;
    email: string | null;
    phone: string | null;
    userCode: string | null;
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const STATUS_BG: Record<string, string> = {
  completed: '#dcfce7',
  pending: '#fef9c3',
  failed: '#fee2e2',
};
const STATUS_FG: Record<string, string> = {
  completed: '#166534',
  pending: '#854d0e',
  failed: '#991b1b',
};

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Inline <script> injected at the end of every print document's <body>.
 *
 * When the document is loaded (either as a popup or inside an iframe), this
 * script focuses the window and calls `window.print()` after a short delay
 * so the browser can finish laying out the narrow 80mm / A4 content.
 *
 * A fallback timer (1500ms) also calls print() in case the `load` event
 * already fired before the listener was attached (this happens with
 * about:blank popups whose readyState is already 'complete' by the time
 * we write into them).
 */
const PRINT_TRIGGER_SCRIPT = `<script>(function(){
  function go(){ try { window.focus(); } catch(e){} setTimeout(function(){ try { window.print(); } catch(e){} }, 350); }
  if (document.readyState === 'complete') { go(); }
  else { window.addEventListener('load', go); }
  // Safety net: if 'load' never fires (e.g. about:blank already complete),
  // force-print after 1.5s no matter what.
  setTimeout(function(){ try { window.print(); } catch(e){} }, 1500);
})();</script>`;

/**
 * Opens a hidden iframe in the current document, writes the receipt HTML
 * into it, waits for it to load, then triggers the print dialog.
 *
 * Why an iframe instead of window.open(''):
 * --------------------------------------------------------------
 * The previous implementation used `window.open('', '_blank')` + document.write.
 * This is fragile for three reasons:
 *   1. Popup blockers (default in Chrome/Firefox for many sites) silently
 *      swallow the call → nothing happens for the user.
 *   2. For about:blank popups, the opener cannot reliably detect when the
 *      popup's DOM is ready (readyState is already 'complete' before we
 *      write into it), so `w.onload`/`w.print()` timing is flaky.
 *   3. Some browsers render the popup before the HTML is fully written,
 *      leaving a brief but visible blank window.
 *
 * A hidden iframe hosted in the current document sidesteps all three issues:
 *   - No popup blocker can intercept it.
 *   - The iframe's `load` event fires reliably after `document.close()`.
 *   - The user never sees a blank intermediate window.
 *
 * After printing, the iframe is removed from the DOM.
 */
function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  // iframe must be in the DOM to be writable/printable, but kept off-screen.
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Impression du reçu');
  document.body.appendChild(iframe);

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch (e) {
      /* already removed */
    }
  };

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      console.error('Impossible d’accéder au document de l’iframe d’impression.');
      cleanup();
      return;
    }
    // Give the browser a tick to lay out the narrow 80mm / A4 content,
    // then trigger the print dialog from the parent context (more reliable
    // than calling print() from inside the iframe in some browsers).
    const win = iframe.contentWindow;
    setTimeout(() => {
      try {
        win?.focus();
        win?.print();
      } catch (e) {
        console.error('Erreur lors de window.print():', e);
      }
      // Remove the iframe shortly after printing is triggered. We use a
      // delay rather than onafterprint because the parent window's
      // onafterprint is not reliably fired for iframe prints across
      // browsers.
      setTimeout(cleanup, 1000);
    }, 350);
  };

  // Write the receipt HTML into the iframe.
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) throw new Error('No iframe document');
    doc.open();
    doc.write(html);
    doc.close();
  } catch (e) {
    console.error("Impossible d'écrire dans l’iframe d’impression:", e);
    cleanup();
  }
}

function escapeCellContent(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function timestampForFilename(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function timestampForDisplay(d: Date): string {
  return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function receiptBaseFilename(r: ReceiptData, ext: string): string {
  const safe = r.receiptNumber.replace(/[^A-Za-z0-9-_]/g, '_');
  return `${safe}_${timestampForFilename(new Date(r.generatedAt))}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* Shared HTML body (used by Word, Excel, A4 print, ticket print)     */
/* ------------------------------------------------------------------ */

function buildReceiptRows(r: ReceiptData): { label: string; value: string }[] {
  return [
    { label: 'Reçu N°', value: r.receiptNumber },
    { label: 'Élève', value: r.student.fullName },
    { label: 'Classe', value: r.student.className || '—' },
    { label: 'Code élève', value: r.student.userCode || '—' },
    { label: 'Date de paiement', value: r.payment.paymentDateFormatted },
    { label: 'Type', value: r.payment.typeLabel },
    { label: 'Méthode', value: r.payment.methodLabel },
    { label: 'Référence', value: r.payment.reference || '—' },
    { label: 'Année scolaire', value: r.payment.schoolYear },
    { label: 'Description', value: r.payment.description || '—' },
  ];
}

function statusBadgeHtml(r: ReceiptData): string {
  const bg = STATUS_BG[r.payment.status] || '#e5e7eb';
  const fg = STATUS_FG[r.payment.status] || '#374151';
  return `<span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;background:${bg};color:${fg};">${escapeHtml(r.payment.statusLabel)}</span>`;
}

function institutionHeaderHtml(r: ReceiptData, opts: { compact?: boolean } = {}): string {
  const compact = opts.compact ?? false;
  const nameSize = compact ? '14px' : '20px';
  const subSize = compact ? '9px' : '11px';
  const parts: string[] = [];
  parts.push(`<div style="font-size:${nameSize};font-weight:800;color:#0d9488;line-height:1.2;">${escapeHtml(r.institution.name)}</div>`);
  const subs: string[] = [];
  if (r.institution.address) subs.push(escapeHtml(r.institution.address));
  if (r.institution.phone) subs.push(`Tél : ${escapeHtml(r.institution.phone)}`);
  if (r.institution.email) subs.push(escapeHtml(r.institution.email));
  if (subs.length) parts.push(`<div style="font-size:${subSize};color:#64748b;margin-top:2px;">${subs.join(' • ')}</div>`);
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* 1. PDF (A4 portrait)                                                */
/* ------------------------------------------------------------------ */

export function exportReceiptToPDF(r: ReceiptData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ---- Top color band ----
  doc.setFillColor(13, 148, 136); // teal-600
  doc.rect(0, 0, pageWidth, 30, 'F');

  // ---- Institution header (white text on teal) ----
  // The institution name may be long (e.g. "Institut Technique de Formation
  // Professionnelle"). jsPDF's text() does NOT wrap automatically — a long
  // name overflows past the right margin and overlaps the receipt number.
  // We use splitTextToSize() to wrap it within the available width (page
  // width minus left margin minus a safe gap for the receipt number column
  // on the right), and auto-shrink the font size for very long names so
  // the full name always fits on one or two lines.
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');

  const receiptNumberWidth = 50; // mm reserved for the receipt number column
  const maxNameWidth = pageWidth - margin * 2 - receiptNumberWidth;
  let nameFontSize = 16;
  let nameLines = doc.splitTextToSize(r.institution.name, maxNameWidth);
  // Auto-shrink: if the name wraps to more than 2 lines, reduce the font
  // size until it fits in 2 lines (keeps the header band compact).
  while (nameLines.length > 2 && nameFontSize > 10) {
    nameFontSize -= 1;
    doc.setFontSize(nameFontSize);
    nameLines = doc.splitTextToSize(r.institution.name, maxNameWidth);
  }
  doc.setFontSize(nameFontSize);
  // Draw each line, stacked downward from y=13
  nameLines.forEach((line: string, idx: number) => {
    doc.text(line, margin, 10 + idx * (nameFontSize * 0.4 + 1));
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const subs: string[] = [];
  if (r.institution.address) subs.push(r.institution.address);
  if (r.institution.phone) subs.push(`Tél: ${r.institution.phone}`);
  if (r.institution.email) subs.push(r.institution.email);
  if (subs.length) {
    const subText = subs.join('   |   ');
    const subLines = doc.splitTextToSize(subText, maxNameWidth);
    subLines.forEach((line: string, idx: number) => {
      doc.text(line, margin, 20 + idx * 4);
    });
  }

  // ---- Right side: receipt number ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(r.receiptNumber, pageWidth - margin, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Émis le ${timestampForDisplay(new Date(r.generatedAt))}`, pageWidth - margin, 20, { align: 'right' });

  // ---- Title ----
  let y = 42;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('REÇU DE PAIEMENT', pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  // ---- Big amount card ----
  y += 8;
  doc.setFillColor(240, 253, 250); // teal-50
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Montant versé', margin + 6, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(13, 148, 136);
  doc.text(r.payment.amountFormatted, margin + 6, y + 19);

  // Status pill on the right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const statusText = r.payment.statusLabel;
  const statusW = doc.getTextWidth(statusText) + 10;
  const statusX = margin + contentWidth - statusW - 6;
  const statusY = y + 7;
  const statusH = 10;
  const statusBg: Record<string, [number, number, number]> = {
    completed: [220, 252, 231],
    pending: [254, 249, 195],
    failed: [254, 226, 226],
  };
  const statusFg: Record<string, [number, number, number]> = {
    completed: [22, 101, 52],
    pending: [133, 77, 14],
    failed: [153, 27, 27],
  };
  const bg = statusBg[r.payment.status] || [229, 231, 235];
  const fg = statusFg[r.payment.status] || [55, 65, 81];
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.roundedRect(statusX, statusY, statusW, statusH, 4, 4, 'F');
  doc.setTextColor(fg[0], fg[1], fg[2]);
  doc.text(statusText, statusX + 5, statusY + 7);

  // ---- Details table ----
  y += 34;
  const rows = buildReceiptRows(r);
  const labelW = 55;
  const valueX = margin + labelW;
  const rowH = 7;

  doc.setFontSize(10);
  rows.forEach((row) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH - 1, pageWidth - margin, y + rowH - 1);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(row.label, margin + 2, y + 5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    // Truncate long descriptions
    const maxValueW = pageWidth - margin - valueX - 4;
    const fullText = row.value;
    let text = fullText;
    if (doc.getTextWidth(text) > maxValueW) {
      while (doc.getTextWidth(text + '…') > maxValueW && text.length > 1) {
        text = text.slice(0, -1);
      }
      text = text + '…';
    }
    doc.text(text, valueX, y + 5);
    y += rowH;
  });

  // ---- Footer: signature + generated ----
  y += 12;
  if (y > pageHeight - 50) {
    doc.addPage();
    y = margin;
  }
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(margin + 90, y, margin + 150, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature & Cachet', margin + 105, y + 5);

  // ---- Unique barcode (centered, below the signature) ----
  y += 14;
  const barcodeValue = generateBarcodeValue(r.receiptNumber);
  const barcodeW = 90;
  const barcodeH = 18;
  const barcodeX = (pageWidth - barcodeW) / 2;
  drawBarcodeOnJsPDF(doc, barcodeValue, barcodeX, y, barcodeW, barcodeH, { showText: true, fontSize: 7 });

  // Bottom strip
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Document généré le ${timestampForDisplay(new Date(r.generatedAt))} • ${r.institution.name}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  doc.save(receiptBaseFilename(r, 'pdf'));
}

/* ------------------------------------------------------------------ */
/* 2. Word (.doc)                                                      */
/* ------------------------------------------------------------------ */

export function exportReceiptToWord(r: ReceiptData): void {
  const rows = buildReceiptRows(r);
  const rowsHtml = rows
    .map(
      (row, i) => `
      <tr>
        <td style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};padding:6px 10px;border:1px solid #e2e8f0;font-size:10pt;color:#64748b;width:35%;">${escapeCellContent(row.label)}</td>
        <td style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};padding:6px 10px;border:1px solid #e2e8f0;font-size:10pt;font-weight:bold;color:#0f172a;">${escapeCellContent(row.value)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Reçu ${escapeHtml(r.receiptNumber)}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>
</xml><![endif]-->
<style>
@page Section1 { size: 21cm 29.7cm portrait; margin: 1.5cm; }
div.Section1 { page: Section1; }
body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: #0f172a; }
.header { background:#0d9488; color:#ffffff; padding:14pt 18pt; }
.header h1 { margin:0; font-size:18pt; color:#ffffff; }
.header .sub { font-size:9pt; color:#e2f5f1; margin-top:2pt; }
.header .right { float:right; text-align:right; }
.title { text-align:center; margin:18pt 0 8pt 0; }
.title h2 { color:#0d9488; font-size:20pt; margin:0; letter-spacing:2pt; }
.amount { background:#f0fdfa; border-left:5pt solid #0d9488; padding:10pt 14pt; margin:8pt 0; }
.amount .lbl { font-size:10pt; color:#64748b; }
.amount .val { font-size:24pt; font-weight:bold; color:#0d9488; }
.amount .pill { float:right; }
table { border-collapse:collapse; width:100%; margin-top:8pt; }
.sign { margin-top:28pt; text-align:right; }
.sign .line { display:inline-block; border-bottom:1pt solid #0f172a; width:160pt; height:14pt; }
.sign .lbl { font-size:9pt; color:#64748b; margin-top:2pt; }
.foot { margin-top:18pt; font-size:8pt; color:#94a3b8; text-align:center; border-top:1pt solid #e2e8f0; padding-top:6pt; }
</style>
</head>
<body>
<div class="Section1">
  <div class="header">
    <div class="right">
      <div style="font-size:11pt;font-weight:bold;">${escapeHtml(r.receiptNumber)}</div>
      <div style="font-size:9pt;">Émis le ${escapeHtml(timestampForDisplay(new Date(r.generatedAt)))}</div>
    </div>
    <h1>${escapeHtml(r.institution.name)}</h1>
    <div class="sub">
      ${escapeHtml(r.institution.address || '')}${r.institution.address && (r.institution.phone || r.institution.email) ? ' • ' : ''}${r.institution.phone ? 'Tél : ' + escapeHtml(r.institution.phone) : ''}${r.institution.phone && r.institution.email ? ' • ' : ''}${r.institution.email ? escapeHtml(r.institution.email) : ''}
    </div>
  </div>

  <div class="title">
    <h2>REÇU DE PAIEMENT</h2>
  </div>

  <div class="amount">
    <div class="pill">${statusBadgeHtml(r)}</div>
    <div class="lbl">Montant versé</div>
    <div class="val">${escapeHtml(r.payment.amountFormatted)}</div>
  </div>

  <table>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="sign">
    <div class="line"></div>
    <div class="lbl">Signature &amp; Cachet</div>
  </div>

  <div style="text-align:center;margin-top:18pt;">
    <div style="display:inline-block;border:1px solid #e2e8f0;padding:8pt 12pt;border-radius:4pt;background:#ffffff;">
      ${barcodeToSvg(generateBarcodeValue(r.receiptNumber), 260, 56, true)}
    </div>
  </div>

  <div class="foot">
    Document généré le ${escapeHtml(timestampForDisplay(new Date(r.generatedAt)))} • ${escapeHtml(r.institution.name)} • ${escapeHtml(r.payment.schoolYear)}
  </div>
</div>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  triggerDownload(blob, receiptBaseFilename(r, 'doc'));
}

/* ------------------------------------------------------------------ */
/* 3. Excel (.xls)                                                     */
/* ------------------------------------------------------------------ */

export function exportReceiptToExcel(r: ReceiptData): void {
  const rows = buildReceiptRows(r);
  const rowsHtml = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      return `<tr>
        <td style="background:${bg};border:1px solid #cbd5e1;padding:6px 10px;font-size:10pt;color:#64748b;mso-number-format:'\\@';">${escapeCellContent(row.label)}</td>
        <td style="background:${bg};border:1px solid #cbd5e1;padding:6px 10px;font-size:10pt;font-weight:bold;color:#0f172a;mso-number-format:'\\@';">${escapeCellContent(row.value)}</td>
      </tr>`;
    })
    .join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook>
  <x:ExcelWorksheets>
    <x:ExcelWorksheet>
      <x:Name>Reçu</x:Name>
      <x:WorksheetOptions>
        <x:DisplayGridlines/>
      </x:WorksheetOptions>
    </x:ExcelWorksheet>
  </x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml><![endif]-->
<style>
td, th { font-family: 'Calibri', Arial, sans-serif; padding: 6px 10px; }
</style>
</head>
<body>
<table border="1">
  <tr>
    <td colspan="2" style="background:#0d9488;color:#ffffff;font-size:18pt;font-weight:bold;padding:14pt 18pt;border:1px solid #0d9488;">${escapeCellContent(r.institution.name)}</td>
  </tr>
  <tr>
    <td colspan="2" style="font-size:9pt;color:#e2f5f1;background:#0d9488;padding:0 18pt 10pt 18pt;border:1px solid #0d9488;">
      ${escapeCellContent(r.institution.address || '')}${r.institution.address && (r.institution.phone || r.institution.email) ? ' • ' : ''}${r.institution.phone ? 'Tél : ' + escapeCellContent(r.institution.phone) : ''}${r.institution.phone && r.institution.email ? ' • ' : ''}${r.institution.email ? escapeCellContent(r.institution.email) : ''}
    </td>
  </tr>
  <tr><td colspan="2" style="font-size:14pt;font-weight:bold;color:#0d9488;text-align:center;padding:10pt;border:1px solid #cbd5e1;">REÇU DE PAIEMENT — ${escapeCellContent(r.receiptNumber)}</td></tr>
  <tr>
    <td colspan="2" style="background:#f0fdfa;border:1px solid #cbd5e1;padding:10pt 14pt;">
      <div style="font-size:10pt;color:#64748b;">Montant versé</div>
      <div style="font-size:22pt;font-weight:bold;color:#0d9488;">${escapeCellContent(r.payment.amountFormatted)}</div>
      <div style="font-size:9pt;color:#64748b;">Statut : ${escapeCellContent(r.payment.statusLabel)}</div>
    </td>
  </tr>
  ${rowsHtml}
  <tr>
    <td colspan="2" style="text-align:center;border:1px solid #cbd5e1;padding:8pt;background:#ffffff;">
      ${barcodeToSvg(generateBarcodeValue(r.receiptNumber), 240, 52, true)}
    </td>
  </tr>
  <tr>
    <td colspan="2" style="font-size:8pt;color:#94a3b8;text-align:center;border:1px solid #cbd5e1;padding:6pt;">
      Document généré le ${escapeCellContent(timestampForDisplay(new Date(r.generatedAt)))} • ${escapeCellContent(r.institution.name)} • ${escapeCellContent(r.payment.schoolYear)}
    </td>
  </tr>
</table>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
  triggerDownload(blob, receiptBaseFilename(r, 'xls'));
}

/* ------------------------------------------------------------------ */
/* 4. Print A4                                                         */
/* ------------------------------------------------------------------ */

function buildA4PrintHtml(r: ReceiptData): string {
  const rows = buildReceiptRows(r);
  const rowsHtml = rows
    .map(
      (row, i) => `
      <tr>
        <td class="lbl">${escapeHtml(row.label)}</td>
        <td class="val">${escapeHtml(row.value)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Reçu ${escapeHtml(r.receiptNumber)}</title>
<style>
@page { size: A4 portrait; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', 'Calibri', Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; }
.header { background: #0d9488; color: #ffffff; padding: 18px 22px; border-radius: 6px; display: flex; justify-content: space-between; align-items: flex-start; }
.header h1 { margin: 0; font-size: 20px; }
.header .sub { font-size: 11px; color: #e2f5f1; margin-top: 4px; }
.header .right { text-align: right; font-size: 12px; }
.header .right .num { font-size: 14px; font-weight: 700; }
.title { text-align: center; margin: 22px 0 10px 0; }
.title h2 { color: #0d9488; font-size: 24px; margin: 0; letter-spacing: 3px; }
.title .rule { height: 2px; background: #0d9488; width: 80px; margin: 8px auto 0; }
.amount { background: #f0fdfa; border-left: 5px solid #0d9488; border-radius: 4px; padding: 14px 18px; margin: 16px 0; display: flex; justify-content: space-between; align-items: center; }
.amount .lbl { font-size: 11px; color: #64748b; }
.amount .val { font-size: 28px; font-weight: 800; color: #0d9488; }
.pill { display: inline-block; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: ${STATUS_BG[r.payment.status] || '#e5e7eb'}; color: ${STATUS_FG[r.payment.status] || '#374151'}; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; }
table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
table td.lbl { color: #64748b; width: 40%; }
table td.val { font-weight: 600; color: #0f172a; }
.sign { margin-top: 38px; text-align: right; }
.sign .line { display: inline-block; border-bottom: 1px solid #0f172a; width: 200px; height: 18px; }
.sign .lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
.foot { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(r.institution.name)}</h1>
      <div class="sub">
        ${escapeHtml(r.institution.address || '')}${r.institution.address && (r.institution.phone || r.institution.email) ? ' • ' : ''}${r.institution.phone ? 'Tél : ' + escapeHtml(r.institution.phone) : ''}${r.institution.phone && r.institution.email ? ' • ' : ''}${r.institution.email ? escapeHtml(r.institution.email) : ''}
      </div>
    </div>
    <div class="right">
      <div class="num">${escapeHtml(r.receiptNumber)}</div>
      <div>Émis le ${escapeHtml(timestampForDisplay(new Date(r.generatedAt)))}</div>
    </div>
  </div>

  <div class="title">
    <h2>REÇU DE PAIEMENT</h2>
    <div class="rule"></div>
  </div>

  <div class="amount">
    <div>
      <div class="lbl">Montant versé</div>
      <div class="val">${escapeHtml(r.payment.amountFormatted)}</div>
    </div>
    <div class="pill">${escapeHtml(r.payment.statusLabel)}</div>
  </div>

  <table>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="sign">
    <div class="line"></div>
    <div class="lbl">Signature &amp; Cachet</div>
  </div>

  <div style="text-align:center;margin-top:24px;">
    <div style="display:inline-block;border:1px solid #e2e8f0;padding:10px 16px;border-radius:6px;background:#fff;">
      ${barcodeToSvg(generateBarcodeValue(r.receiptNumber), 280, 60, true)}
    </div>
  </div>

  <div class="foot">
    Document généré le ${escapeHtml(timestampForDisplay(new Date(r.generatedAt)))} • ${escapeHtml(r.institution.name)} • ${escapeHtml(r.payment.schoolYear)}
  </div>
${PRINT_TRIGGER_SCRIPT}
</body>
</html>`;
}

export function printReceiptA4(r: ReceiptData): void {
  printViaIframe(buildA4PrintHtml(r));
}

/* ------------------------------------------------------------------ */
/* 5. Print thermal ticket (80mm)                                      */
/* ------------------------------------------------------------------ */

function buildTicketPrintHtml(r: ReceiptData): string {
  // Thermal receipt: 80mm wide, narrow margins, monospace-friendly.
  // CENTERED layout (ticket mode) — every block (header, amount, details,
  // barcode, footer) is center-aligned. The barcode is rendered as an inline
  // SVG scaled to fit the 76mm printable width.
  const detailRow = (label: string, value: string) => `
    <tr>
      <td class="lbl">${escapeHtml(label)}</td>
      <td class="val">${escapeHtml(value)}</td>
    </tr>`;

  const rows = buildReceiptRows(r).filter((row) => row.label !== 'Description');
  const rowsHtml = rows.map((row) => detailRow(row.label, row.value)).join('');

  const desc = r.payment.description
    ? `<div class="desc"><span class="lbl">Description :</span><br/>${escapeHtml(r.payment.description)}</div>`
    : '';

  // Barcode SVG sized for the 76mm printable width (~ 220px at 96dpi).
  const barcodeSvg = barcodeToSvg(generateBarcodeValue(r.receiptNumber), 220, 48, true);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Reçu ${escapeHtml(r.receiptNumber)}</title>
<style>
@page { size: 80mm auto; margin: 2mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: 76mm; }
body {
  font-family: 'Courier New', 'Lucida Console', monospace;
  color: #000;
  font-size: 11px;
  line-height: 1.35;
  padding: 2mm;
  text-align: center; /* ticket-mode: everything centered by default */
}
.center { text-align: center; }
.bold { font-weight: 700; }
.big { font-size: 14px; font-weight: 700; }
.huge { font-size: 18px; font-weight: 700; }
.divider { border-top: 1px dashed #000; margin: 6px auto; width: 100%; }
.shop { font-size: 13px; font-weight: 700; }
.sub { font-size: 9px; color: #000; }
table { width: 100%; border-collapse: collapse; margin: 0 auto; }
table td { padding: 1px 0; font-size: 11px; vertical-align: top; }
table td.lbl { color: #000; width: 45%; text-align: left; }
table td.val { font-weight: 700; text-align: right; }
.amount-box { text-align: center; margin: 4px auto; padding: 4px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
.status { display:inline-block; padding:1px 6px; border:1px solid #000; border-radius:3px; font-size:9px; font-weight:700; }
.desc { margin-top: 4px; font-size: 10px; text-align: center; }
.desc .lbl { font-weight: 700; }
.barcode-box { text-align: center; margin: 6px auto; padding: 4px 0; }
.barcode-box svg { display: inline-block; max-width: 100%; height: auto; }
.thanks { margin-top: 6px; text-align: center; font-size: 10px; font-weight: 700; }
.foot { margin-top: 4px; text-align: center; font-size: 8px; color: #333; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { width: 80mm; }
}
</style>
</head>
<body>
  <div class="center shop">${escapeHtml(r.institution.name)}</div>
  <div class="center sub">${escapeHtml(r.institution.address || '')}</div>
  <div class="center sub">
    ${r.institution.phone ? 'Tél: ' + escapeHtml(r.institution.phone) : ''}${r.institution.phone && r.institution.email ? ' • ' : ''}${r.institution.email ? escapeHtml(r.institution.email) : ''}
  </div>

  <div class="divider"></div>

  <div class="center bold big">REÇU DE PAIEMENT</div>
  <div class="center sub">${escapeHtml(r.receiptNumber)}</div>

  <div class="divider"></div>

  <div class="amount-box">
    <div class="sub">MONTANT VERSÉ</div>
    <div class="huge">${escapeHtml(r.payment.amountFormatted)}</div>
    <div class="status">${escapeHtml(r.payment.statusLabel)}</div>
  </div>

  <div class="divider"></div>

  <table>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  ${desc ? `<div class="divider"></div>${desc}` : ''}

  <div class="divider"></div>

  <div class="barcode-box">${barcodeSvg}</div>

  <div class="divider"></div>

  <div class="thanks">Merci de votre confiance !</div>

  <div class="foot">
    Émis le ${escapeHtml(new Date(r.generatedAt).toLocaleString('fr-FR'))}<br/>
    ${escapeHtml(r.institution.name)} • ${escapeHtml(r.payment.schoolYear)}
  </div>
${PRINT_TRIGGER_SCRIPT}
</body>
</html>`;
}

export function printReceiptTicket(r: ReceiptData): void {
  printViaIframe(buildTicketPrintHtml(r));
}
