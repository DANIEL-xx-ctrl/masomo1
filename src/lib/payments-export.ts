/**
 * Export utilities for the payments module.
 *
 * Exports the *current filtered/searched* payment list to:
 *   - PDF  (.pdf)  — via jspdf + jspdf-autotable (real PDF, paginated table)
 *   - Word (.doc)  — via an HTML document with the Word XML namespace
 *   - Excel (.xls) — via an HTML table with the Excel SpreadsheetML MIME
 *
 * All three formats are generated entirely on the client side, so no extra
 * backend route is required. The exports include:
 *   - Institution name + school year (header)
 *   - Applied filters summary (status / method / type / search query)
 *   - Generated-at timestamp + author
 *   - A summary row with the total amount + record count
 *   - The full filtered payment list (NOT just the current page)
 */

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { Payment } from '@/lib/types';
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/constants';

export interface ExportFilters {
  searchQuery?: string;
  status?: string; // 'all' | 'pending' | 'completed' | 'failed'
  method?: string; // 'all' | 'cash' | 'mobile_money' | 'bank_transfer'
  type?: string; // 'all' | 'tuition' | 'registration' | 'exam_fee' | 'other'
}

export interface ExportMeta {
  institutionName: string | null;
  institutionAddress?: string | null;
  institutionPhone?: string | null;
  institutionEmail?: string | null;
  schoolYear: string;
  authorName: string | null;
  filters: ExportFilters;
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Tous les statuts',
  pending: 'En attente',
  completed: 'Complété',
  failed: 'Échoué',
};

const METHOD_LABELS: Record<string, string> = {
  all: 'Toutes les méthodes',
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
};

const TYPE_LABELS: Record<string, string> = {
  all: 'Tous les types',
  tuition: 'Frais de scolarité',
  registration: "Frais d'inscription",
  exam_fee: "Frais d'examen",
  other: 'Autres',
};

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Already a YYYY-MM-DD string?
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR');
}

function studentFullName(p: Payment): string {
  if (!p.student) return '—';
  return `${p.student.firstName} ${p.student.lastName}`.trim();
}

/** Build the normalized row array (French labels + formatted amounts/dates). */
function buildRows(payments: Payment[]): string[][] {
  return payments.map((p, i) => [
    String(i + 1),
    studentFullName(p),
    formatCurrency(p.amount),
    PAYMENT_TYPE_LABELS[p.type] || p.type,
    PAYMENT_METHOD_LABELS[p.method] || p.method,
    PAYMENT_STATUS_LABELS[p.status] || p.status,
    formatDate(p.paymentDate || p.createdAt),
    p.reference || '—',
    p.description || '—',
    p.schoolYear,
  ]);
}

const COLUMN_HEADERS = [
  'N°',
  'Élève',
  'Montant',
  'Type',
  'Méthode',
  'Statut',
  'Date',
  'Référence',
  'Description',
  'Année scolaire',
];

/** Build a human-readable summary of the active filters. */
function buildFiltersSummary(filters: ExportFilters): string[] {
  const parts: string[] = [];
  parts.push(`Statut : ${STATUS_LABELS[filters.status || 'all'] || 'Tous les statuts'}`);
  parts.push(`Méthode : ${METHOD_LABELS[filters.method || 'all'] || 'Toutes les méthodes'}`);
  parts.push(`Type : ${TYPE_LABELS[filters.type || 'all'] || 'Tous les types'}`);
  if (filters.searchQuery && filters.searchQuery.trim()) {
    parts.push(`Recherche : « ${filters.searchQuery.trim()} »`);
  }
  return parts;
}

function buildExportTitle(meta: ExportMeta): string {
  return `Liste des paiements — ${meta.schoolYear}`;
}

function totalAmount(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + (p.status === 'completed' ? p.amount : 0), 0);
}

/** Trigger a browser download for a Blob. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function timestampForFilename(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function timestampForDisplay(d: Date): string {
  return d.toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

export function exportPaymentsToPDF(payments: Payment[], meta: ExportMeta): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const generatedAt = new Date();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- Header band ----
  doc.setFillColor(13, 148, 136); // teal-600
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(buildExportTitle(meta), 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const subtitleParts: string[] = [];
  if (meta.institutionName) subtitleParts.push(meta.institutionName);
  subtitleParts.push(`Généré le ${timestampForDisplay(generatedAt)}`);
  doc.text(subtitleParts.join('  •  '), 14, 17);

  if (meta.authorName) {
    doc.text(`Auteur : ${meta.authorName}`, pageWidth - 14, 10, { align: 'right' });
  }

  // ---- Filters summary + count ----
  let y = 30;
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${payments.length} paiement(s) — Total : ${formatCurrency(totalAmount(payments))}`, 14, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  buildFiltersSummary(meta.filters).forEach((line) => {
    doc.text(`• ${line}`, 14, y);
    y += 4.5;
  });

  // ---- Table ----
  const body = buildRows(payments);

  autoTable(doc, {
    head: [COLUMN_HEADERS],
    body,
    startY: y + 2,
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [240, 253, 250], // teal-50
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Footer with page number
      const page = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${page} — ${meta.institutionName || 'MASOMO'} • ${meta.schoolYear}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
    },
  });

  // ---- Foot (totals) ----
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (finalY < pageHeight - 20) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(13, 148, 136);
    doc.text(
      `Total général : ${formatCurrency(totalAmount(payments))}  (${payments.length} paiement(s))`,
      14,
      finalY + 10
    );
  }

  const filename = `paiements_${meta.schoolYear.replace('-', '_')}_${timestampForFilename(generatedAt)}.pdf`;
  doc.save(filename);
}

/* ------------------------------------------------------------------ */
/* Word (.doc)                                                         */
/* ------------------------------------------------------------------ */

/**
 * Full HTML escaping — escapes & < > " '.
 * Used for ATTRIBUTE VALUES and contexts where strict HTML compliance is required.
 */
function escapeHtml(s: string): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Light escaping for HTML table cell CONTENT (not attribute values).
 *
 * Only escapes < and > to prevent HTML structure injection.
 * Does NOT escape & because:
 *   1. Excel's HTML parser sometimes displays &amp; literally instead of
 *      decoding it back to &.
 *   2. The & character is extremely common in payment data (e.g. "Frais
 *      d'inscription & scolarité", "Tom & Jerry").
 *
 * This is safe because payment data (names, descriptions, references, dates,
 * amounts) never contains entity-like strings such as &lt; or &amp;.
 */
function escapeCellContent(s: string): string {
  if (s == null) return '';
  return String(s)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function exportPaymentsToWord(payments: Payment[], meta: ExportMeta): void {
  const generatedAt = new Date();
  const rows = buildRows(payments);
  const total = totalAmount(payments);
  const filtersLines = buildFiltersSummary(meta.filters);

  const headHtml = COLUMN_HEADERS.map(
    (h) =>
      `<th style="background:#0d9488;color:#fff;padding:8px 10px;border:1px solid #cbd5e1;font-size:11px;text-align:left;">${escapeCellContent(
        h
      )}</th>`
  ).join('');

  const bodyHtml = rows
    .map((row, idx) => {
      const cells = row
        .map(
          (cell, ci) =>
            `<td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:10px;${
              ci === 2 ? 'text-align:right;font-weight:bold;' : ''
            }${ci === 0 ? 'text-align:center;' : ''}${ci === 5 ? 'text-align:center;' : ''}">${escapeCellContent(
              cell
            )}</td>`
        )
        .join('');
      const bg = idx % 2 === 0 ? '#f0fdfa' : '#ffffff';
      return `<tr style="background:${bg};">${cells}</tr>`;
    })
    .join('');

  const filtersHtml = filtersLines
    .map((line) => `<div style="font-size:11px;color:#475569;margin:2px 0;">• ${escapeCellContent(line)}</div>`)
    .join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeCellContent(buildExportTitle(meta))}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>
</xml><![endif]-->
<style>
@page Section1 { size: 29.7cm 21cm landscape; margin: 1.5cm; }
div.Section1 { page: Section1; }
body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: #0f172a; }
h1 { color: #0d9488; font-size: 22pt; margin: 0 0 4pt 0; }
h2 { color: #475569; font-size: 11pt; font-weight: normal; margin: 0 0 12pt 0; }
table { border-collapse: collapse; width: 100%; margin-top: 8pt; }
.meta { margin: 4pt 0; font-size: 10pt; color: #334155; }
.summary { margin-top: 14pt; padding: 8pt 10pt; background: #f0fdfa; border-left: 4pt solid #0d9488; font-size: 11pt; }
.total { margin-top: 12pt; font-size: 12pt; font-weight: bold; color: #0d9488; }
</style>
</head>
<body>
<div class="Section1">
<h1>${escapeCellContent(buildExportTitle(meta))}</h1>
<h2>${escapeCellContent(meta.institutionName || 'MASOMO')} • Document généré le ${escapeCellContent(
    timestampForDisplay(generatedAt)
  )}${meta.authorName ? ` par ${escapeCellContent(meta.authorName)}` : ''}</h2>

<div class="meta"><strong>Filtres appliqués :</strong></div>
${filtersHtml}

<div class="summary">
  <strong>${payments.length}</strong> paiement(s) &nbsp;•&nbsp;
  <strong>Total (complétés) :</strong> ${escapeCellContent(formatCurrency(total))}
</div>

<table>
  <thead><tr>${headHtml}</tr></thead>
  <tbody>${bodyHtml || '<tr><td colspan="' + COLUMN_HEADERS.length + '" style="padding:10px;text-align:center;color:#94a3b8;">Aucun paiement à exporter.</td></tr>'}</tbody>
</table>

<div class="total">Total général : ${escapeCellContent(formatCurrency(total))} (${payments.length} paiement(s))</div>
</div>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const filename = `paiements_${meta.schoolYear.replace('-', '_')}_${timestampForFilename(generatedAt)}.doc`;
  triggerDownload(blob, filename);
}

/* ------------------------------------------------------------------ */
/* Excel (.xls)                                                        */
/* ------------------------------------------------------------------ */

export function exportPaymentsToExcel(payments: Payment[], meta: ExportMeta): void {
  const generatedAt = new Date();
  const rows = buildRows(payments);
  const total = totalAmount(payments);
  const filtersLines = buildFiltersSummary(meta.filters);

  const headHtml = COLUMN_HEADERS.map(
    (h) =>
      `<th style="background:#0d9488;color:#ffffff;font-weight:bold;border:1px solid #cbd5e1;text-align:center;">${escapeCellContent(
        h
      )}</th>`
  ).join('');

  const bodyHtml = rows
    .map((row, idx) => {
      const cells = row
        .map((cell, ci) => {
          // IMPORTANT: use single quotes around the mso-number-format value
          // to avoid nested double quotes inside style="..." which breaks
          // HTML parsing and prevents & from being decoded.
          let style = "border:1px solid #cbd5e1;mso-number-format:'\\@';";
          if (ci === 2) style += 'text-align:right;font-weight:bold;';
          if (ci === 0 || ci === 5) style += 'text-align:center;';
          return `<td style="${style}">${escapeCellContent(cell)}</td>`;
        })
        .join('');
      const bg = idx % 2 === 0 ? '#f0fdfa' : '#ffffff';
      return `<tr style="background:${bg};">${cells}</tr>`;
    })
    .join('');

  const filtersHtml = filtersLines
    .map((line) => `<tr><td colspan="${COLUMN_HEADERS.length}" style="font-size:10pt;color:#475569;border:1px solid #cbd5e1;">• ${escapeCellContent(line)}</td></tr>`)
    .join('');

  // SpreadsheetML XML so Excel opens it natively with proper formatting.
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook>
  <x:ExcelWorksheets>
    <x:ExcelWorksheet>
      <x:Name>Paiements</x:Name>
      <x:WorksheetOptions>
        <x:DisplayGridlines/>
        <x:FreezePanes/>
        <x:FrozenNoSplit/>
        <x:SplitHorizontal>1</x:SplitHorizontal>
        <x:TopRowBottomPane>1</x:TopRowBottomPane>
        <x:ActivePane>2</x:ActivePane>
      </x:WorksheetOptions>
    </x:ExcelWorksheet>
  </x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml><![endif]-->
<style>
td, th { font-family: 'Calibri', Arial, sans-serif; font-size: 10pt; padding: 4px 8px; }
th { font-size: 11pt; }
</style>
</head>
<body>
<table border="1">
  <tr>
    <td colspan="${COLUMN_HEADERS.length}" style="font-size:16pt;font-weight:bold;color:#0d9486;border:1px solid #cbd5e1;">${escapeCellContent(
    buildExportTitle(meta)
  )}</td>
  </tr>
  <tr>
    <td colspan="${COLUMN_HEADERS.length}" style="font-size:11pt;color:#334155;border:1px solid #cbd5e1;">${escapeCellContent(
    meta.institutionName || 'MASOMO'
  )} — Généré le ${escapeCellContent(timestampForDisplay(generatedAt))}${
    meta.authorName ? ` par ${escapeCellContent(meta.authorName)}` : ''
  }</td>
  </tr>
  <tr>
    <td colspan="${COLUMN_HEADERS.length}" style="font-weight:bold;background:#f0fdfa;color:#0d9486;border:1px solid #cbd5e1;">${payments.length} paiement(s) • Total (complétés) : ${escapeCellContent(
    formatCurrency(total)
  )}</td>
  </tr>
  ${filtersHtml}
  <tr></tr>
  <tr>${headHtml}</tr>
  ${bodyHtml}
  <tr>
    <td colspan="2" style="font-weight:bold;text-align:right;border:1px solid #cbd5e1;background:#f0fdfa;">Total général</td>
    <td style="font-weight:bold;text-align:right;border:1px solid #cbd5e1;background:#f0fdfa;color:#0d9486;">${escapeCellContent(
      formatCurrency(total)
    )}</td>
    <td colspan="${COLUMN_HEADERS.length - 3}" style="font-style:italic;color:#64748b;border:1px solid #cbd5e1;background:#f0fdfa;">${
      payments.length
    } paiement(s)</td>
  </tr>
</table>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
  const filename = `paiements_${meta.schoolYear.replace('-', '_')}_${timestampForFilename(generatedAt)}.xls`;
  triggerDownload(blob, filename);
}
