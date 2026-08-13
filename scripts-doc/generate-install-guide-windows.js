/**
 * MASOMO - Guide d'Installation Detaille pour Windows 10 (Word .docx)
 * Generation script using the `docx` library.
 *
 * Output: /home/z/my-project/public/MASOMO_Guide_Installation_Windows.docx
 *
 * IMPORTANT: All French apostrophes (') and guillemets (<< >>) are written
 * with Unicode escapes (\u2019, \u00AB, \u00BB) to keep JS syntax safe.
 * PowerShell double-quotes are escaped with \" or embedded in single-quoted
 * JS strings. Windows backslashes are written \\ in double-quoted JS strings.
 */

const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  TableOfContents, NumberFormat, SectionType, LevelFormat,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const P = {
  primary:   "0F172A", // slate-900 (headings)
  body:      "1E293B", // slate-800 (body)
  secondary: "64748B", // slate-500 (captions)
  accent:    "0D9488", // teal-600  (accents/lines)
  surface:   "F1F5F9", // slate-100 (table zebra / code background)
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function safeText(v, fallback) {
  if (v === null || v === undefined) return fallback || "";
  return String(v);
}

const FONT = { ascii: "Calibri", eastAsia: "Microsoft YaHei" };
const MONO = { ascii: "Consolas", eastAsia: "Microsoft YaHei" };

// Standard body paragraph
function p(text, opts) {
  opts = opts || {};
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { before: opts.before != null ? opts.before : 0, after: opts.after != null ? opts.after : 120, line: 312 },
    indent: opts.noIndent ? undefined : { firstLine: 480 },
    children: [
      new TextRun({
        text: safeText(text),
        size: 24,
        font: FONT,
        color: P.body,
        bold: !!opts.bold,
        italics: !!opts.italics,
      }),
    ],
  });
}

// Paragraph composed of multiple TextRuns (rich)
function pruns(runs, opts) {
  opts = opts || {};
  return new Paragraph({
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { before: opts.before != null ? opts.before : 0, after: opts.after != null ? opts.after : 120, line: 312 },
    indent: opts.noIndent ? undefined : { firstLine: 480 },
    children: runs.map(r => new TextRun({
      text: safeText(r.text),
      size: r.size || 24,
      font: r.font || FONT,
      color: r.color || P.body,
      bold: !!r.bold,
      italics: !!r.italics,
    })),
  });
}

// Heading 1 - chapter
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180, line: 312 },
    children: [
      new TextRun({
        text: safeText(text),
        size: 32,
        bold: true,
        font: FONT,
        color: P.primary,
      }),
    ],
  });
}

// Heading 2
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [
      new TextRun({
        text: safeText(text),
        size: 28,
        bold: true,
        font: FONT,
        color: P.primary,
      }),
    ],
  });
}

// Heading 3
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [
      new TextRun({
        text: safeText(text),
        size: 24,
        bold: true,
        font: FONT,
        color: P.primary,
      }),
    ],
  });
}

// Bullet item with leading bullet character
function bullet(text, opts) {
  opts = opts || {};
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 312 },
    indent: { left: 360, hanging: 200 },
    children: [
      new TextRun({ text: "\u2022  ", size: 24, font: FONT, color: P.accent, bold: true }),
      new TextRun({
        text: safeText(text),
        size: 24,
        font: FONT,
        color: P.body,
      }),
    ],
  });
}

// Bullet item with rich content
function bulletRuns(runs) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 312 },
    indent: { left: 360, hanging: 200 },
    children: [
      new TextRun({ text: "\u2022  ", size: 24, font: FONT, color: P.accent, bold: true }),
      ...runs.map(r => new TextRun({
        text: safeText(r.text),
        size: r.size || 24,
        font: r.font || FONT,
        color: r.color || P.body,
        bold: !!r.bold,
        italics: !!r.italics,
      })),
    ],
  });
}

// Code paragraph (single line) - shaded, consolas, left border
function codeLine(text, opts) {
  opts = opts || {};
  return new Paragraph({
    spacing: { before: opts.first ? 80 : 40, after: opts.last ? 120 : 40, line: 276 },
    indent: { left: 200, right: 200 },
    shading: { type: ShadingType.CLEAR, fill: P.surface, color: "auto" },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: P.accent, space: 6 },
    },
    children: [
      new TextRun({
        text: safeText(text) === "" ? " " : safeText(text),
        size: 20,
        font: MONO,
        color: P.primary,
      }),
    ],
  });
}

// Multi-line code block (each line becomes a code paragraph)
function codeBlock(lines) {
  const out = [];
  lines.forEach((line, i) => {
    out.push(codeLine(line, { first: i === 0, last: i === lines.length - 1 }));
  });
  return out;
}

// Dash-bullet item used in Chapter 16 (tiret par tiret).
// Returns an array of TWO paragraphs:
//   1) bullet "•  " (accent bold) + label (body) — spacing.before 120, after 0
//   2) shaded Consolas code paragraph (size 22, slate-100 fill, left teal border,
//      indent left 400) — spacing.before 0, after 60
function dashItem(label, command) {
  const labelPara = new Paragraph({
    spacing: { before: 120, after: 0, line: 312 },
    indent: { left: 400, hanging: 200 },
    children: [
      new TextRun({ text: "\u2022  ", size: 24, font: FONT, color: P.accent, bold: true }),
      new TextRun({ text: safeText(label), size: 24, font: FONT, color: P.body }),
    ],
  });
  const codePara = new Paragraph({
    spacing: { before: 0, after: 60, line: 276 },
    indent: { left: 400 },
    shading: { type: ShadingType.CLEAR, fill: P.surface, color: "auto" },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: P.accent, space: 6 },
    },
    children: [
      new TextRun({
        text: safeText(command) === "" ? " " : safeText(command),
        size: 22,
        font: MONO,
        color: P.primary,
      }),
    ],
  });
  return [labelPara, codePara];
}

// Convenience: push every paragraph returned by dashItem into the children array.
function pushDashItem(arr, label, command) {
  dashItem(label, command).forEach(x => arr.push(x));
}

// Table helpers -------------------------------------------------------------
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };

function tableHeaderCell(text, widthPct) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 276 },
        children: [
          new TextRun({ text: safeText(text), bold: true, size: 22, font: FONT, color: "FFFFFF" }),
        ],
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: P.accent, color: "auto" },
    margins: CELL_MARGINS,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  });
}

function tableBodyCell(text, widthPct, opts) {
  opts = opts || {};
  const runs = Array.isArray(text)
    ? text.map(t => new TextRun({
        text: safeText(t.text != null ? t.text : t),
        size: t.size || 22,
        font: t.font || (t.mono ? MONO : FONT),
        color: t.color || P.body,
        bold: !!t.bold,
        italics: !!t.italics,
      }))
    : [new TextRun({ text: safeText(text), size: 22, font: opts.mono ? MONO : FONT, color: P.body, bold: !!opts.bold })];
  return new TableCell({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 276 },
        children: runs,
      }),
    ],
    shading: opts.shaded ? { type: ShadingType.CLEAR, fill: P.surface, color: "auto" } : undefined,
    margins: CELL_MARGINS,
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  });
}

// Build a simple data table.
function buildTable(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => tableHeaderCell(h, widths[i])),
  });
  const bodyRows = rows.map((row, ri) => new TableRow({
    cantSplit: true,
    children: row.map((cell, ci) => tableBodyCell(cell, widths[ci], { shaded: ri % 2 === 1 })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent },
      left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
      insideVertical:   { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    },
    rows: [headerRow, ...bodyRows],
  });
}

// "Keep with next" caption paragraph (placed before a table)
function caption(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 80, line: 276 },
    children: [
      new TextRun({ text: safeText(text), bold: true, size: 22, font: FONT, color: P.primary }),
    ],
  });
}

// Spacer paragraph
function spacer() {
  return new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun({ text: "" })] });
}

// Footer with centered page number
function pageNumFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: P.secondary }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// COVER PAGE (Section 1)
// ---------------------------------------------------------------------------
function buildCover() {
  const noBorders = {
    top:    { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  const coverContent = [
    // Top accent label - "GUIDE TECHNIQUE"
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 1800, after: 240 },
      children: [
        new TextRun({
          text: "GUIDE TECHNIQUE",
          size: 22,
          bold: true,
          font: FONT,
          color: P.accent,
          characterSpacing: 60,
        }),
      ],
    }),
    // Subtle accent line below label
    new Paragraph({
      spacing: { before: 0, after: 600 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 4 } },
      children: [new TextRun({ text: "", size: 2 })],
    }),
    // Main title - "MASOMO - Guide d'Installation Windows 10" (36pt = size 72)
    // Title is longer than Ubuntu version, so use 36pt instead of 40pt to fit 2-3 lines.
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 240, line: 828, lineRule: "atLeast" },
      children: [
        new TextRun({
          text: "MASOMO \u2014 Guide d\u2019Installation Windows 10",
          size: 72, // 36pt
          bold: true,
          font: FONT,
          color: P.primary,
        }),
      ],
    }),
    // Subtitle line
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 360, line: 320 },
      children: [
        new TextRun({
          text: "Application de Gestion Scolaire (EduGest) \u2014 Next.js 16 + TypeScript + Prisma \u2014 Installation sous Windows 10 avec VSCode",
          size: 26, // 13pt
          font: FONT,
          color: P.secondary,
        }),
      ],
    }),
    // Horizontal accent rule
    new Paragraph({
      spacing: { before: 200, after: 600 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 4 } },
      children: [new TextRun({ text: "", size: 2 })],
    }),
    // Meta info - version
    new Paragraph({
      spacing: { before: 0, after: 100, line: 320 },
      children: [
        new TextRun({ text: "Version du document : ", size: 22, font: FONT, color: P.secondary, bold: true }),
        new TextRun({ text: "1.0", size: 22, font: FONT, color: P.body }),
      ],
    }),
    // Meta info - project version
    new Paragraph({
      spacing: { before: 0, after: 100, line: 320 },
      children: [
        new TextRun({ text: "Version du projet : ", size: 22, font: FONT, color: P.secondary, bold: true }),
        new TextRun({ text: "MASOMO v0.2.0", size: 22, font: FONT, color: P.body }),
      ],
    }),
    // Meta info - date
    new Paragraph({
      spacing: { before: 0, after: 100, line: 320 },
      children: [
        new TextRun({ text: "Date : ", size: 22, font: FONT, color: P.secondary, bold: true }),
        new TextRun({ text: dateStr, size: 22, font: FONT, color: P.body }),
      ],
    }),
    // Meta info - OS
    new Paragraph({
      spacing: { before: 0, after: 100, line: 320 },
      children: [
        new TextRun({ text: "Syst\u00E8me cible : ", size: 22, font: FONT, color: P.secondary, bold: true }),
        new TextRun({ text: "Windows 10 (build 1809+) \u2014 Node.js v24+ / Bun 1.3+ / PowerShell", size: 22, font: FONT, color: P.body }),
      ],
    }),
    // Meta info - author
    new Paragraph({
      spacing: { before: 0, after: 100, line: 320 },
      children: [
        new TextRun({ text: "Auteur : ", size: 22, font: FONT, color: P.secondary, bold: true }),
        new TextRun({ text: "\u00C9quipe MASOMO \u2014 Documentation technique", size: 22, font: FONT, color: P.body }),
      ],
    }),
  ];

  // Wrap cover content in a single-cell table (full A4 width = 11906 twips)
  const wrapperTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        cantSplit: false,
        height: { value: 16838, rule: "exact" },
        children: [
          new TableCell({
            children: coverContent,
            margins: { top: 0, bottom: 0, left: 1701, right: 1417 },
            width: { size: 100, type: WidthType.PERCENTAGE },
            verticalAlign: "top",
          }),
        ],
      }),
    ],
  });

  return [wrapperTable];
}

// ---------------------------------------------------------------------------
// BODY CONTENT (Section 2)
// ---------------------------------------------------------------------------
function buildBody() {
  const children = [];

  // -- TOC ----------------------------------------------------------------
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240, line: 312 },
    children: [
      new TextRun({ text: "Table des mati\u00E8res", bold: true, size: 36, font: FONT, color: P.primary }),
    ],
  }));

  children.push(new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }));

  // Refresh hint
  children.push(new Paragraph({
    spacing: { before: 200, after: 200, line: 276 },
    children: [
      new TextRun({
        text: "Astuce : Cliquez droit sur la table des mati\u00E8res \u2192 \u00AB\u00A0Mettre \u00E0 jour les champs\u00A0\u00BB pour rafra\u00EEchir les num\u00E9ros de page.",
        italics: true, size: 18, font: FONT, color: P.secondary,
      }),
    ],
  }));

  // =======================================================================
  // CHAPITRE 1 - Pr\u00E9sentation du projet
  // =======================================================================
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 360, after: 180, line: 312 },
    children: [
      new TextRun({
        text: "Chapitre 1 \u2014 Pr\u00E9sentation du projet",
        size: 32,
        bold: true,
        font: FONT,
        color: P.primary,
      }),
    ],
  }));
  children.push(p(
    "MASOMO (aussi commercialis\u00E9 sous le nom EduGest) est une application web compl\u00E8te de gestion scolaire d\u00E9velopp\u00E9e avec Next.js 16 et TypeScript. Elle s\u2019adresse aux \u00E9coles primaires, coll\u00E8ges et lyc\u00E9es qui souhaitent num\u00E9riser la gestion de leurs \u00E9l\u00E8ves, enseignants, classes, emplois du temps, notes, bulletins, paiements et communications interne."
  ));
  children.push(p(
    "Le projet suit une architecture monolithique moderne : un seul d\u00E9p\u00F4t contient \u00E0 la fois le frontend React (App Router), les routes API serverless de Next.js, et la couche d\u2019acc\u00E8s aux donn\u00E9es via Prisma. La persistance est assur\u00E9e par une base SQLite locale, ce qui rend l\u2019installation particuli\u00E8rement simple sur un poste de travail Windows 10."
  ));
  children.push(p(
    "MASOMO est con\u00E7u pour \u00EAtre install\u00E9 localement puis d\u00E9ploy\u00E9 sur un serveur gr\u00E2ce \u00E0 la sortie standalone de Next.js. Cette documentation d\u00E9crit pas \u00E0 pas toutes les \u00E9tapes n\u00E9cessaires sous Windows 10, depuis la pr\u00E9paration de la machine (installation de Node.js, Bun, Git, VS Code et des Build Tools C++) jusqu\u2019au premier d\u00E9marrage du serveur de d\u00E9veloppement."
  ));

  children.push(h2("1.1 Stack technique"));
  children.push(p(
    "Le tableau ci-dessous r\u00E9sume les principales technologies utilis\u00E9es dans le projet et leur r\u00F4le :"
  ));
  children.push(caption("Tableau 1 \u2014 Stack technique de MASOMO"));
  children.push(buildTable(
    ["Technologie", "Version", "R\u00F4le dans le projet"],
    [
      ["Next.js", "16.1.1", "Framework React full-stack avec App Router (frontend + API)"],
      ["React", "19.x", "Biblioth\u00E8que UI (rendu c\u00F4t\u00E9 client et serveur)"],
      ["TypeScript", "5.x", "Langage principal, typage statique strict"],
      ["Bun", "1.3.x", "Runtime et gestionnaire de paquets rapide"],
      ["Node.js", "v24+", "Runtime JavaScript requis par Next.js et Prisma"],
      ["Prisma", "6.11.x", "ORM TypeScript, g\u00E9n\u00E8re le client type-safe"],
      ["SQLite", "int\u00E9gr\u00E9", "Base de donn\u00E9es locale (fichier dev.db)"],
      ["Tailwind CSS", "4.x", "Framework CSS utilitaire"],
      ["shadcn/ui", "New York", "Composants Radix UI pr\u00E9-style\u0301s et personnalisables"],
      ["Radix UI", "varies", "Primitives accessibles (Dialog, Select, Popover, etc.)"],
      ["Zustand", "5.x", "Gestion d\u2019\u00E9tat l\u00E9g\u00E8re c\u00F4t\u00E9 client"],
      ["TanStack Query", "5.x", "Cache et synchronisation des donn\u00E9es serveur"],
      ["Recharts", "2.15.x", "Graphiques (barres, lignes, aires, secteurs)"],
      ["Framer Motion", "12.x", "Animations d\u00E9claratives React"],
      ["NextAuth.js", "4.x", "Authentification (sessions, JWT)"],
    ],
    [22, 16, 62]
  ));

  children.push(h2("1.2 Fonctionnalit\u00E9s principales"));
  children.push(p(
    "MASOMO couvre l\u2019ensemble du cycle de vie d\u2019un \u00E9tablissement scolaire. Les modules suivants sont disponibles d\u00E8s l\u2019installation :"
  ));
  const features = [
    "Tableau de bord avec statistiques globales et graphiques de revenus",
    "Gestion des \u00E9l\u00E8ves (cr\u00E9ation, \u00E9dition, photos, parent\u00E9s)",
    "Gestion des enseignants et du personnel administratif",
    "Gestion des classes et des inscriptions",
    "Emploi du temps hebdomadaire (planning par classe et par enseignant)",
    "Saisie des notes et calcul automatique des moyennes",
    "G\u00E9n\u00E9ration de bulletins en PDF et export Excel",
    "Gestion des paiements (frais de scolarit\u00E9) et re\u00E7us",
    "Module de communication interne (annonces, messages)",
    "Calendrier scolaire et \u00E9v\u00E9nements",
    "Pr\u00E9sence des \u00E9l\u00E8ves et export des absences",
    "Gestion des devoirs et des soumissions \u00E9l\u00E8ves",
    "Notifications en temps r\u00E9el via une WebSocket",
    "Contr\u00F4le d\u2019acc\u00E8s bas\u00E9 sur les r\u00F4les (RBAC) avec 6 profils",
    "Module Super Admin pour la gestion multi-\u00E9tablissements",
    "Application web progressive (PWA) installable sur mobile",
    "Mode sombre et interface multilingue",
  ];
  features.forEach(f => children.push(bullet(f)));

  // =======================================================================
  // CHAPITRE 2 - Pr\u00E9requis syst\u00E8me (Windows 10)
  // =======================================================================
  children.push(h1("Chapitre 2 \u2014 Pr\u00E9requis syst\u00E8me (Windows 10)"));
  children.push(p(
    "Avant d\u2019installer MASOMO, vous devez pr\u00E9parer votre poste Windows 10 en installant Node.js, Bun, Git, Visual Studio Code et les Build Tools C++. Toutes les commandes ci-dessous sont \u00E0 ex\u00E9cuter dans PowerShell. Pour ouvrir PowerShell, appuyez sur la touche Windows, tapez \u00AB\u00A0powershell\u00A0\u00BB et s\u00E9lectionnez \u00AB\u00A0Windows PowerShell\u00A0\u00BB."
  ));

  children.push(h2("2.1 V\u00E9rifier la version de Windows 10"));
  children.push(p(
    "MASOMO s\u2019installe sur Windows 10 version 1809 (Octobre 2018) ou sup\u00E9rieure, car l\u2019outil Winget (gestionnaire de paquets officiel Microsoft) n\u2019est disponible qu\u2019\u00E0 partir de cette version. Pour conna\u00EEtre votre version, appuyez sur Windows+R, tapez \u00AB\u00A0winver\u00A0\u00BB et validez : une bo\u00EEte de dialogue affiche le num\u00E9ro de build (par exemple \u00AB\u00A0Version 22H2 (Build 19045)\u00A0\u00BB)."
  ));
  children.push(...codeBlock([
    "winver   # \u00E0 taper dans la bo\u00EEte Ex\u00E9cuter (Windows+R), pas dans PowerShell",
  ]));
  children.push(p(
    "Si votre version est ant\u00E9rieure \u00E0 1809, mettez \u00E0 jour Windows via \u00AB\u00A0Param\u00E8tres \u2192 Mise \u00E0 jour et s\u00E9curit\u00E9 \u2192 Windows Update\u00A0\u00BB avant de continuer."
  ));

  children.push(h2("2.2 Installer Winget (App Installer)"));
  children.push(p(
    "Winget est le gestionnaire de paquets en ligne de commande de Microsoft. Sur les versions r\u00E9centes de Windows 10, il est pr\u00E9-install\u00E9 via le paquet \u00AB\u00A0App Installer\u00A0\u00BB. V\u00E9rifiez sa pr\u00E9sence avec :"
  ));
  children.push(...codeBlock([
    "winget --version",
  ]));
  children.push(p(
    "Si la commande n\u2019est pas reconnue, ouvrez le Microsoft Store, recherchez \u00AB\u00A0App Installer\u00A0\u00BB et cliquez sur \u00AB\u00A0Installer\u00A0\u00BB ou \u00AB\u00A0Mettre \u00E0 jour\u00A0\u00BB. Red\u00E9marrez ensuite PowerShell pour que la commande winget soit disponible."
  ));

  children.push(h2("2.3 Installer Node.js v24"));
  children.push(p(
    "MASOMO n\u00E9cessite Node.js version 24 ou sup\u00E9rieure. La m\u00E9thode recommand\u00E9e sous Windows 10 consiste \u00E0 utiliser Winget, qui t\u00E9l\u00E9charge et installe le paquet MSI officiel :"
  ));
  children.push(...codeBlock([
    "winget install OpenJS.NodeJS.LTS",
  ]));
  children.push(p(
    "Acceptez les termes de la licence si demand\u00E9. \u00C0 l\u2019issue, fermez puis rouvrez PowerShell pour que le PATH soit recharg\u00E9, puis v\u00E9rifiez la version :"
  ));
  children.push(...codeBlock([
    "node --version    # doit afficher v24.x.x",
    "npm --version     # doit afficher 10.x ou 11.x",
  ]));
  children.push(p(
    "Alternative : si Winget n\u2019est pas disponible, t\u00E9l\u00E9chargez l\u2019installateur MSI \u00E0 l\u2019adresse https://nodejs.org/ (version LTS) et ex\u00E9cutez-le avec les options par d\u00E9faut."
  ));

  children.push(h2("2.4 Installer Bun 1.3"));
  children.push(p(
    "Bun est le gestionnaire de paquets principal du projet. Il est beaucoup plus rapide que npm et \u00E9vite les probl\u00E8mes de permissions fr\u00E9quents sous Windows avec npm. L\u2019installation officielle se fait via un script PowerShell :"
  ));
  children.push(...codeBlock([
    'powershell -c "irm bun.sh/install.ps1 | iex"',
  ]));
  children.push(p(
    "Apr\u00E8s l\u2019installation, fermez puis rouvrez PowerShell (ou red\u00E9marrez VS Code) pour que la commande bun soit disponible dans le PATH. V\u00E9rifiez la version :"
  ));
  children.push(...codeBlock([
    "bun --version   # doit afficher 1.3.x ou sup\u00E9rieur",
  ]));

  children.push(h2("2.5 Installer Git"));
  children.push(p(
    "Git est n\u00E9cessaire si vous r\u00E9cup\u00E9rez le projet par clonage. Sous Windows 10, installez-le via Winget :"
  ));
  children.push(...codeBlock([
    "winget install Git.Git",
    "git --version    # doit afficher git version 2.40 ou sup\u00E9rieur",
  ]));
  children.push(p(
    "L\u2019installateur Git pour Windows inclut \u00E9galement Git Bash, un terminal Bash l\u00E9ger utile pour ex\u00E9cuter certains scripts Unix (cf. chapitre 12, remarque sur le script de build)."
  ));

  children.push(h2("2.6 Installer Visual Studio Code"));
  children.push(p(
    "VS Code est l\u2019\u00E9diteur recommand\u00E9 pour d\u00E9velopper sur MASOMO. Installez-le via Winget :"
  ));
  children.push(...codeBlock([
    "winget install Microsoft.VisualStudioCode",
    "code --version   # doit afficher la version de VS Code",
  ]));

  children.push(h2("2.7 Installer les Build Tools C++ (pour les modules natifs)"));
  children.push(p(
    "Certaines d\u00E9pendances de MASOMO (notamment sharp pour le traitement des images et le moteur Prisma) n\u00E9cessitent une compilation C++ native via node-gyp. Sous Windows, cela requiert les Build Tools Visual Studio 2022 avec la charge de travail \u00AB\u00A0D\u00E9veloppement Desktop C++\u00A0\u00BB. Installez-les via Winget :"
  ));
  children.push(...codeBlock([
    "winget install Microsoft.VisualStudio.2022.BuildTools",
  ]));
  children.push(p(
    "Pendant l\u2019installation, dans le programme d\u2019installation de Visual Studio, cochez imp\u00E9rativement la charge de travail \u00AB\u00A0D\u00E9veloppement Desktop C++\u00A0\u00BB (Desktop development with C++) avant de cliquer sur \u00AB\u00A0Installer\u00A0\u00BB. Sans cela, la compilation de node-gyp \u00E9chouera avec des erreurs \u00AB\u00A0MSBuild\u00A0\u00BB ou \u00AB\u00A0windows-build-tools\u00A0\u00BB."
  ));
  children.push(p(
    "Cette \u00E9tape est facultative si vous n\u2019utilisez pas sharp ni de modules natifs, mais elle est fortement recommand\u00E9e pour \u00E9viter les erreurs ult\u00E9rieures lors du bun install."
  ));

  children.push(h2("2.8 R\u00E9capitulatif des versions minimales"));
  children.push(caption("Tableau 2 \u2014 Versions minimales requises sous Windows 10"));
  children.push(buildTable(
    ["Outil", "Version minimale", "Commande de v\u00E9rification"],
    [
      ["Windows 10", "1809 (build 17763)", "winver"],
      ["Node.js", "v24.0.0", "node --version"],
      ["Bun", "1.3.0", "bun --version"],
      ["Git", "2.40", "git --version"],
      ["VS Code", "1.85", "code --version"],
      ["PowerShell", "5.1", "$PSVersionTable.PSVersion"],
      ["Build Tools C++", "2022", "(pr\u00E9sent dans le programme d\u2019installation VS)"],
    ],
    [25, 30, 45]
  ));

  children.push(h2("2.9 Note sur PowerShell"));
  children.push(p(
    "Windows 10 est livr\u00E9 avec PowerShell 5.1 (commande powershell). Vous pouvez \u00E9galement installer PowerShell 7, plus r\u00E9cent et multiplateforme, via la commande winget install Microsoft.PowerShell. Les deux versions sont compatibles avec toutes les commandes de ce guide. Dans VS Code, le terminal int\u00E9gr\u00E9 utilisera PowerShell par d\u00E9faut apr\u00E8s la configuration d\u00E9crite au chapitre 5."
  ));

  // =======================================================================
  // CHAPITRE 3 - Extensions VSCode recommand\u00E9es
  // =======================================================================
  children.push(h1("Chapitre 3 \u2014 Extensions VSCode recommand\u00E9es"));
  children.push(p(
    "Pour tirer le meilleur parti du projet MASOMO dans VS Code, installez les extensions list\u00E9es ci-dessous. Elles am\u00E9liorent l\u2019auto-compl\u00E9tion, la coloration syntaxique, le formatage et la d\u00E9tection d\u2019erreurs."
  ));
  children.push(caption("Tableau 3 \u2014 Extensions VS Code recommand\u00E9es"));
  children.push(buildTable(
    ["Extension", "Identifiant", "R\u00F4le"],
    [
      ["ESLint", "dbaeumer.vscode-eslint", "Analyse statique du code JavaScript/TypeScript"],
      ["Prettier", "esbenp.prettier-vscode", "Formatage automatique du code"],
      ["Tailwind CSS IntelliSense", "bradlc.vscode-tailwindcss", "Auto-compl\u00E9tion des classes Tailwind"],
      ["Prisma", "Prisma.prisma", "Coloration syntaxique et formatage des fichiers .prisma"],
      ["Path Intellisense", "christian-kohler.path-intellisense", "Auto-compl\u00E9tion des chemins de fichiers"],
      ["Auto Rename Tag", "formulahendry.auto-rename-tag", "Renomme automatiquement la balise fermante HTML/JSX"],
      ["ES7+ React/Redux snippets", "dsznajder.es7-react-js-snippets", "Snippets rapides pour React"],
      ["Error Lens", "usernamehw.errorlens", "Affiche les erreurs ESLint/TS en ligne directement"],
    ],
    [22, 30, 48]
  ));

  children.push(h2("3.1 Installation en une seule commande (PowerShell)"));
  children.push(p(
    "Vous pouvez installer toutes ces extensions en une seule commande gr\u00E2ce \u00E0 l\u2019option --install-extension de VS Code. Sous PowerShell, la continuation de ligne s\u2019\u00E9crit avec un accent grave (backtick) en fin de ligne, et non avec un anti-slash comme sous Bash :"
  ));
  children.push(...codeBlock([
    "code --install-extension dbaeumer.vscode-eslint `",
    "  --install-extension esbenp.prettier-vscode `",
    "  --install-extension bradlc.vscode-tailwindcss `",
    "  --install-extension Prisma.prisma `",
    "  --install-extension christian-kohler.path-intellisense `",
    "  --install-extension formulahendry.auto-rename-tag `",
    "  --install-extension dsznajder.es7-react-js-snippets `",
    "  --install-extension usernamehw.errorlens",
  ]));
  children.push(p(
    "Important : sous PowerShell, l\u2019accent grave (backtick) doit \u00EAtre le dernier caract\u00E8re de la ligne, sans espace apr\u00E8s. Si la commande est copi\u00E9e-coll\u00E9e depuis un document, v\u00E9rifiez qu\u2019aucun espace ne s\u2019est gliss\u00E9 apr\u00E8s le backtick, sinon la continuation de ligne ne fonctionnera pas."
  ));

  // =======================================================================
  // CHAPITRE 4 - R\u00E9cup\u00E9ration du projet
  // =======================================================================
  children.push(h1("Chapitre 4 \u2014 R\u00E9cup\u00E9ration du projet"));
  children.push(p(
    "Deux options sont possibles pour r\u00E9cup\u00E9rer le code source de MASOMO : \u00E0 partir d\u2019une archive zip, ou par clonage d\u2019un d\u00E9p\u00F4t Git. Dans les deux cas, il est fortement recommand\u00E9 de placer le projet dans un dossier utilisateur comme C:\\Projets\\masomo ou C:\\Users\\<votre-nom>\\Projets\\masomo. \u00C9vitez absolument C:\\Program Files\\ : ce dossier est prot\u00E9g\u00E9 par Windows et les commandes bun install ou db:push \u00E9choueront avec des erreurs EACCES ou EPERM."
  ));

  children.push(h2("4.1 Option A \u2014 D\u00E9compression d\u2019une archive zip"));
  children.push(p(
    "Si vous disposez du fichier masomo-source.zip : localisez-le dans l\u2019Explorateur de fichiers (g\u00E9n\u00E9ralement dans le dossier T\u00E9l\u00E9chargements), faites un clic droit dessus puis s\u00E9lectionnez \u00AB\u00A0Extraire tout...\u00A0\u00BB. Dans la bo\u00EEte de dialogue, choisissez comme destination C:\\Projets\\masomo puis validez. Ensuite, dans PowerShell :"
  ));
  children.push(...codeBlock([
    "cd C:\\Projets\\masomo",
    "code .",
  ]));

  children.push(h2("4.2 Option B \u2014 Clonage depuis Git"));
  children.push(p(
    "Si vous avez acc\u00E8s au d\u00E9p\u00F4t Git du projet, clonez-le puis ouvrez-le dans VS Code :"
  ));
  children.push(...codeBlock([
    "cd C:\\Projets",
    "git clone https://exemple.com/masomo.git masomo",
    "cd masomo",
    "code .",
  ]));
  children.push(p(
    "Dans les deux cas, \u00E0 l\u2019issue de ces commandes, VS Code s\u2019ouvre directement \u00E0 la racine du projet. Vous \u00EAtes pr\u00EAt \u00E0 configurer votre environnement de d\u00E9veloppement."
  ));

  children.push(h2("4.3 Probl\u00E8me des fins de ligne (CRLF vs LF)"));
  children.push(p(
    "Sous Windows, Git convertit par d\u00E9faut les fins de ligne Unix (LF) en fins de ligne Windows (CRLF) lors du checkout. Cela peut provoquer des warnings ou des erreurs avec certains outils (ESLint, Prettier, scripts shell du package.json). Pour \u00E9viter ce probl\u00E8me, deux actions sont recommand\u00E9es :"
  ));
  children.push(bullet("Cr\u00E9ez ou modifiez le fichier .gitattributes \u00E0 la racine du projet pour forcer les fins de ligne LF :"));
  children.push(...codeBlock([
    "# .gitattributes",
    "* text=auto eol=lf",
  ]));
  children.push(bullet("Dans VS Code, cliquez sur l\u2019indicateur \u00AB\u00A0CRLF\u00A0\u00BB ou \u00AB\u00A0LF\u00A0\u00BB en bas \u00E0 droite de la fen\u00EAtre et s\u00E9lectionnez \u00AB\u00A0LF\u00A0\u00BB. Cette option s\u2019applique au fichier courant ; pour la rendre globale, ajoutez \u00AB\u00A0\"files.eol\": \"\\u000A\"\u00A0\u00BB dans vos param\u00E8tres VS Code."));

  // =======================================================================
  // CHAPITRE 5 - Configuration VSCode du projet
  // =======================================================================
  children.push(h1("Chapitre 5 \u2014 Configuration VSCode du projet"));
  children.push(p(
    "Pour garantir un formatage et une qualit\u00E9 de code uniformes entre tous les d\u00E9veloppeurs, cr\u00E9ez deux fichiers de configuration VS Code \u00E0 la racine du projet, dans le dossier .vscode/."
  ));

  children.push(h2("5.1 Fichier .vscode/settings.json"));
  children.push(p(
    "Ce fichier active le formatage \u00E0 la sauvegarde, d\u00E9finit Prettier comme formateur par d\u00E9faut, configure ESLint pour qu\u2019il corrige automatiquement les erreurs, active la d\u00E9tection des classes Tailwind, associe les fichiers .prisma au bon mode de coloration, et force PowerShell comme terminal par d\u00E9faut sous Windows :"
  ));
  children.push(...codeBlock([
    "{",
    "  \"editor.formatOnSave\": true,",
    "  \"editor.defaultFormatter\": \"esbenp.prettier-vscode\",",
    "  \"editor.codeActionsOnSave\": {",
    "    \"source.fixAll.eslint\": \"explicit\"",
    "  },",
    "  \"tailwindCSS.experimental.classRegex\": [",
    "    \"cva\\\\(([^)]*)\\\\)\",",
    "    \"[\\\"'`]([^\\\"'`]*).*?[\\\"'`]\"",
    "  ],",
    "  \"files.associations\": {",
    "    \"*.prisma\": \"prisma\"",
    "  },",
    "  \"typescript.tsdk\": \"node_modules/typescript/lib\",",
    "  \"typescript.enablePromptUseWorkspaceTsdk\": true,",
    "  \"terminal.integrated.defaultProfile.windows\": \"PowerShell\",",
    "  \"files.eol\": \"\\u000A\"",
    "}"
  ]));

  children.push(h2("5.2 Fichier .vscode/launch.json"));
  children.push(p(
    "Ce fichier permet de lancer le debug de Next.js directement depuis VS Code. Il attache le d\u00E9bogueur Node.js au serveur de d\u00E9veloppement lanc\u00E9 via Bun :"
  ));
  children.push(...codeBlock([
    "{",
    "  \"version\": \"0.2.0\",",
    "  \"configurations\": [",
    "    {",
    "      \"name\": \"Next.js: debug server-side\",",
    "      \"type\": \"node-terminal\",",
    "      \"request\": \"launch\",",
    "      \"command\": \"bun run dev\"",
    "    }",
    "  ]",
    "}"
  ]));

  children.push(p(
    "Apr\u00E8s avoir cr\u00E9\u00E9 ces deux fichiers, rechargez VS Code (Ctrl+Shift+P puis \u00AB\u00A0Reload Window\u00A0\u00BB) pour que les param\u00E8tres soient pris en compte. Le terminal int\u00E9gr\u00E9 (Ctrl+\\u0060) ouvrira d\u00E9sormais une session PowerShell pr\u00EAte \u00E0 ex\u00E9cuter les commandes bun."
  ));

  // =======================================================================
  // CHAPITRE 6 - Installation des d\u00E9pendances
  // =======================================================================
  children.push(h1("Chapitre 6 \u2014 Installation des d\u00E9pendances"));
  children.push(p(
    "L\u2019installation des d\u00E9pendances se fait avec Bun, qui est beaucoup plus rapide que npm ou yarn sous Windows. La commande lit le fichier package.json et t\u00E9l\u00E9charge tous les paquets n\u00E9cessaires dans le dossier node_modules/."
  ));
  children.push(...codeBlock([
    "bun install",
  ]));
  children.push(p(
    "Cette op\u00E9ration t\u00E9l\u00E9charge environ 600 Mo de paquets et dure g\u00E9n\u00E9ralement entre 1 et 3 minutes selon votre connexion internet. \u00C0 l\u2019issue, vous devriez voir un r\u00E9capitulatif du type \u00AB\u00A0Resolved, downloaded and extracted X packages\u00A0\u00BB."
  ));

  children.push(h2("6.1 Ce qui est install\u00E9"));
  children.push(p(
    "Les principales d\u00E9pendances install\u00E9es sont :"
  ));
  [
    "Next.js 16.1.1 et React 19 pour le framework applicatif",
    "Prisma 6.11 et @prisma/client pour la base de donn\u00E9es",
    "Tailwind CSS 4 et shadcn/ui (composants New York) pour l\u2019interface",
    "Radix UI pour les primitives accessibles (Dialog, Select, Popover, etc.)",
    "Zustand pour la gestion d\u2019\u00E9tat c\u00F4t\u00E9 client",
    "TanStack Query pour la synchronisation des donn\u00E9es serveur",
    "Recharts pour les graphiques du tableau de bord",
    "Framer Motion pour les animations",
    "NextAuth.js v4 pour l\u2019authentification",
    "ESLint 9 et TypeScript 5 pour la qualit\u00E9 du code",
  ].forEach(f => children.push(bullet(f)));

  children.push(h2("6.2 Erreurs node-gyp et modules natifs"));
  children.push(p(
    "Si vous obtenez des erreurs du type \u00AB\u00A0MSBuild is not recognized\u00A0\u00BB, \u00AB\u00A0node-gyp build error\u00A0\u00BB ou \u00AB\u00A0gyp ERR! find VS\u00A0\u00BB, cela signifie que les Build Tools C++ ne sont pas install\u00E9s. R\u00E9f\u00E9rez-vous au chapitre 2.7 pour installer Microsoft.VisualStudio.2022.BuildTools avec la charge de travail \u00AB\u00A0D\u00E9veloppement Desktop C++\u00A0\u00BB, puis relancez bun install."
  ));

  children.push(h2("6.3 Lenteur due \u00E0 Windows Defender"));
  children.push(p(
    "Sous Windows 10, l\u2019antivirus int\u00E9gr\u00E9 (Windows Defender) analyse en temps r\u00E9el chaque fichier \u00E9crit dans node_modules/, ce qui peut ralentir consid\u00E9rablement l\u2019installation (parfois 5 \u00E0 10 fois plus lent que sous Linux). Pour gagner du temps, excluez le dossier du projet de l\u2019analyse antivirus (voir chapitre 13 pour la proc\u00E9dure d\u00E9taill\u00E9e)."
  ));

  children.push(h2("6.4 V\u00E9rification de l\u2019installation"));
  children.push(p(
    "Pour v\u00E9rifier que tout s\u2019est bien pass\u00E9, contr\u00F4lez que le dossier node_modules/ existe et qu\u2019il contient le sous-dossier .bin/next :"
  ));
  children.push(...codeBlock([
    "Test-Path node_modules\\.bin\\next",
    "# doit renvoyer True",
  ]));

  // =======================================================================
  // CHAPITRE 7 - Configuration de l'environnement (.env)
  // =======================================================================
  children.push(h1("Chapitre 7 \u2014 Configuration de l\u2019environnement (.env)"));
  children.push(p(
    "MASOMO utilise un fichier .env pour stocker ses variables d\u2019environnement. Un fichier mod\u00E8le .env.example est fourni \u00E0 la racine du projet. La premi\u00E8re \u00E9tape consiste \u00E0 le copier sous le nom .env. Sous PowerShell, la commande \u00E9quivalente \u00E0 cp Unix est Copy-Item :"
  ));
  children.push(...codeBlock([
    "Copy-Item .env.example .env",
  ]));

  children.push(h2("7.1 Contenu du fichier .env"));
  children.push(p(
    "Le fichier .env.example contient les variables suivantes :"
  ));
  children.push(...codeBlock([
    "DATABASE_URL=\"file:./dev.db\"",
    "JWT_SECRET=\"votre-cle-secrete-changez-moi-en-production\"",
    "PORT=3000",
  ]));

  children.push(h2("7.2 Explication des variables"));
  children.push(caption("Tableau 4 \u2014 Variables d\u2019environnement"));
  children.push(buildTable(
    ["Variable", "Valeur par d\u00E9faut", "Description"],
    [
      ["DATABASE_URL", "file:./dev.db", "URL de connexion \u00E0 la base SQLite. Le chemin est relatif au dossier prisma/."],
      ["JWT_SECRET", "votre-cle-secrete-...", "Cl\u00E9 secr\u00E8te utilis\u00E9e pour signer les jetons JWT. \u00C0 changer absolument en production."],
      ["PORT", "3000", "Port d\u2019\u00E9coute du serveur de d\u00E9veloppement."],
    ],
    [22, 28, 50]
  ));

  children.push(h2("7.3 Avertissement CRITIQUE sur le chemin DATABASE_URL sous Windows"));
  children.push(p(
    "Attention : sous Windows, l\u2019antislash (\\) est interpr\u00E9t\u00E9 comme un caract\u00E8re d\u2019\u00E9chappement par de nombreux parseurs, y compris Prisma et Node.js. Si vous \u00E9crivez un chemin Windows absolu avec des antislashs simples, le chemin sera incorrectement interpr\u00E9t\u00E9 et la base ne sera pas trouv\u00E9e."
  ));
  children.push(p(
    "Trois solutions sont possibles, par ordre de pr\u00E9f\u00E9rence :"
  ));
  children.push(bulletRuns([
    { text: "Solution 1 (recommand\u00E9e) : chemin relatif avec slashs simples", bold: true, color: P.accent },
  ]));
  children.push(...codeBlock([
    "DATABASE_URL=\"file:./dev.db\"",
  ]));
  children.push(bulletRuns([
    { text: "Solution 2 : chemin absolu avec antislashs doubles (double backslash)", bold: true, color: P.accent },
  ]));
  children.push(...codeBlock([
    "DATABASE_URL=\"file:C:\\\\Projets\\\\masomo\\\\dev.db\"",
  ]));
  children.push(bulletRuns([
    { text: "Solution 3 : chemin absolu avec slashs simples (forward slash)", bold: true, color: P.accent },
  ]));
  children.push(...codeBlock([
    "DATABASE_URL=\"file:C:/Projets/masomo/dev.db\"",
  ]));
  children.push(p(
    "Ne JAMAIS utiliser un antislash simple (par exemple \u00AB\u00A0file:C:\\Projets\\masomo\\dev.db\u00A0\u00BB) : les s\u00E9quences \\P, \\m et \\d seraient interpr\u00E9t\u00E9es comme des \u00E9chappements et le chemin serait corrompu. La solution 1 est la plus portable et fonctionne identiquement sous Windows, macOS et Linux."
  ));

  // =======================================================================
  // CHAPITRE 8 - Initialisation de la base de donn\u00E9es
  // =======================================================================
  children.push(h1("Chapitre 8 \u2014 Initialisation de la base de donn\u00E9es"));
  children.push(p(
    "MASOMO utilise Prisma 6.11 comme ORM avec une base SQLite. Le sch\u00E9ma de la base est d\u00E9crit dans le fichier prisma/schema.prisma, qui contient 22 mod\u00E8les : SuperAdmin, Institution, User, Student, Teacher, Class, Payment, Subject, Grade, Bulletin, Schedule, Attendance, Homework, Notification, SchoolEvent, MediaFile, etc."
  ));

  children.push(h2("8.1 G\u00E9n\u00E9ration du client Prisma"));
  children.push(p(
    "La premi\u00E8re commande \u00E0 ex\u00E9cuter g\u00E9n\u00E8re le client Prisma TypeScript \u00E0 partir du sch\u00E9ma. Ce client est ensuite import\u00E9 dans le code applicatif pour interroger la base de donn\u00E9es :"
  ));
  children.push(...codeBlock([
    "bun run db:generate",
  ]));
  children.push(p(
    "Cette commande lit prisma/schema.prisma, g\u00E9n\u00E8re les types TypeScript correspondants et les place dans node_modules/@prisma/client/. Elle doit \u00EAtre relanc\u00E9e \u00E0 chaque modification du sch\u00E9ma."
  ));

  children.push(h2("8.2 Cr\u00E9ation du sch\u00E9ma dans SQLite"));
  children.push(p(
    "La deuxi\u00E8me commande cr\u00E9e physiquement les tables dans le fichier SQLite d\u00E9sign\u00E9 par DATABASE_URL :"
  ));
  children.push(...codeBlock([
    "bun run db:push",
  ]));
  children.push(p(
    "Cette commande est idempotente : vous pouvez la relancer sans risque. Elle compare le sch\u00E9ma actuel avec celui de la base et applique les diff\u00E9rences. \u00C0 l\u2019issue, le fichier dev.db est cr\u00E9\u00E9 \u00E0 la racine du dossier prisma/ (ou \u00E0 l\u2019emplacement d\u00E9fini par DATABASE_URL) et contient les 22 tables d\u00E9crites dans le sch\u00E9ma."
  ));
  children.push(p(
    "V\u00E9rifiez que le fichier dev.db a bien \u00E9t\u00E9 cr\u00E9\u00E9 :"
  ));
  children.push(...codeBlock([
    "Test-Path prisma\\dev.db",
    "# doit renvoyer True",
  ]));

  children.push(h2("8.3 Commandes optionnelles"));
  children.push(p(
    "Le projet d\u00E9finit \u00E9galement deux commandes utiles en d\u00E9veloppement :"
  ));
  children.push(bulletRuns([
    { text: "bun run db:reset", bold: true, mono: true },
    { text: " \u2014 r\u00E9initialise totalement la base (efface toutes les donn\u00E9es et recr\u00E9e le sch\u00E9ma). \u00C0 utiliser avec pr\u00E9caution." },
  ]));
  children.push(bulletRuns([
    { text: "bun run db:migrate", bold: true, mono: true },
    { text: " \u2014 cr\u00E9e et applique une migration versionn\u00E9e (utile lorsque le projet passe en production)." },
  ]));
  children.push(p(
    "Pour le d\u00E9veloppement local, db:push est suffisant. Les migrations sont recommand\u00E9es uniquement lorsque vous souhaitez suivre l\u2019\u00E9volution du sch\u00E9ma dans le temps."
  ));

  // =======================================================================
  // CHAPITRE 9 - D\u00E9marrage du serveur de d\u00E9veloppement
  // =======================================================================
  children.push(h1("Chapitre 9 \u2014 D\u00E9marrage du serveur de d\u00E9veloppement"));
  children.push(p(
    "Une fois les d\u00E9pendances install\u00E9es et la base de donn\u00E9es initialis\u00E9e, vous pouvez lancer le serveur de d\u00E9veloppement :"
  ));
  children.push(...codeBlock([
    "bun run dev",
  ]));
  children.push(p(
    "Le script dev d\u00E9fini dans package.json ex\u00E9cute en r\u00E9alit\u00E9 la commande node correction2.js, qui d\u00E9marre Next.js en mode d\u00E9veloppement avec rechargement \u00E0 chaud. Au bout de quelques secondes, vous devriez voir dans le terminal une sortie de ce type :"
  ));
  children.push(...codeBlock([
    "$ bun run dev",
    "$ node correction2.js",
    "   \u25B2 Next.js 16.1.1",
    "   - Local:        http://localhost:3000",
    "   - Network:      http://192.168.1.10:3000",
    "",
    " \u2713 Ready in 1200ms",
    " \u2713 Compiled / in 2.4s",
  ]));

  children.push(h2("9.1 Acc\u00E8s \u00E0 l\u2019application"));
  children.push(p(
    "Ouvrez votre navigateur (Microsoft Edge, Google Chrome ou Mozilla Firefox) \u00E0 l\u2019adresse http://localhost:3000. Vous arrivez sur la page de connexion. Vous pouvez utiliser l\u2019un des comptes de d\u00E9monstration pour vous connecter :"
  ));
  children.push(caption("Tableau 5 \u2014 Comptes de d\u00E9monstration"));
  children.push(buildTable(
    ["R\u00F4le", "Email", "Mot de passe"],
    [
      ["Super Admin",    "superadmin@edugest.com", "super123"],
      ["Administrateur", "admin@ecole.com",        "admin123"],
      ["Enseignant",     "amadou.diallo@ecole.com", "teacher123"],
      ["\u00C9l\u00E8ve",          "moussa.keita@ecole.com", "student123"],
      ["Parent",         "parent@ecole.com",       "parent123"],
      ["Personnel",      "staff@ecole.com",        "staff123"],
    ],
    [25, 45, 30]
  ));

  children.push(p(
    "Pour arr\u00EAter le serveur, appuyez sur Ctrl+C dans le terminal PowerShell o\u00F9 il tourne."
  ));

  // =======================================================================
  // CHAPITRE 10 - V\u00E9rification et qualit\u00E9 du code
  // =======================================================================
  children.push(h1("Chapitre 10 \u2014 V\u00E9rification et qualit\u00E9 du code"));
  children.push(p(
    "MASOMO est configur\u00E9 avec ESLint 9 et TypeScript 5 en mode strict. Avant de consid\u00E9rer l\u2019installation comme termin\u00E9e, il est recommand\u00E9 de v\u00E9rifier la qualit\u00E9 du code."
  ));

  children.push(h2("10.1 Lancement du linter"));
  children.push(p(
    "Ex\u00E9cutez la commande suivante pour v\u00E9rifier l\u2019ensemble du projet :"
  ));
  children.push(...codeBlock([
    "bun run lint",
  ]));
  children.push(p(
    "Si aucune erreur n\u2019est d\u00E9tect\u00E9e, la commande se termine sans afficher de warning. Dans le cas contraire, ESLint liste chaque probl\u00E8me avec le fichier et la ligne concern\u00E9s."
  ));

  children.push(h2("10.2 V\u00E9rification TypeScript dans VS Code"));
  children.push(p(
    "Apr\u00E8s un bun install, le serveur de langage TypeScript de VS Code peut ne pas voir imm\u00E9diatement les nouvelles d\u00E9finitions de types. Pour forcer sa r\u00E9initialisation :"
  ));
  children.push(bullet("Appuyez sur Ctrl+Shift+P dans VS Code, puis tapez \u00AB\u00A0TypeScript: Restart TS Server\u00A0\u00BB et validez."));
  children.push(p(
    "Pour une v\u00E9rification globale du typage en ligne de commande, vous pouvez \u00E9galement ex\u00E9cuter :"
  ));
  children.push(...codeBlock([
    "bunx tsc --noEmit",
  ]));

  children.push(h2("10.3 V\u00E9rification de la coloration Prisma"));
  children.push(p(
    "Ouvrez le fichier prisma/schema.prisma dans VS Code. Les mots-cl\u00E9s (model, field, type) doivent \u00EAtre color\u00E9s. Si ce n\u2019est pas le cas, v\u00E9rifiez que l\u2019extension Prisma.prisma est bien install\u00E9e et que l\u2019association de fichiers *.prisma \u2192 prisma est d\u00E9clar\u00E9e dans .vscode/settings.json (voir chapitre 5)."
  ));

  // =======================================================================
  // CHAPITRE 11 - Structure du projet
  // =======================================================================
  children.push(h1("Chapitre 11 \u2014 Structure du projet"));
  children.push(p(
    "MASOMO suit l\u2019organisation standard d\u2019un projet Next.js 16 avec App Router. Voici l\u2019arborescence des dossiers et fichiers principaux (chemins Windows) :"
  ));
  children.push(caption("Tableau 6 \u2014 Arborescence du projet sous Windows"));
  children.push(buildTable(
    ["Chemin", "Description"],
    [
      ["C:\\Projets\\masomo\\src\\app\\",            "Racine de l\u2019App Router : pages, layouts, API routes"],
      ["C:\\Projets\\masomo\\src\\app\\api\\",       "Routes API serverless (auth, students, teachers, ...)"],
      ["C:\\Projets\\masomo\\src\\app\\layout.tsx",  "Layout racine de l\u2019application"],
      ["C:\\Projets\\masomo\\src\\app\\page.tsx",    "Page d\u2019accueil (redirige vers /login)"],
      ["C:\\Projets\\masomo\\src\\app\\globals.css", "Styles globaux Tailwind"],
      ["C:\\Projets\\masomo\\src\\components\\ui\\",      "Composants shadcn/ui (Button, Card, Dialog, etc.)"],
      ["C:\\Projets\\masomo\\src\\components\\modules\\", "Modules m\u00E9tier (dashboard, students, payments, ...)"],
      ["C:\\Projets\\masomo\\src\\components\\app-shell.tsx", "Coquille de l\u2019application (sidebar + topbar)"],
      ["C:\\Projets\\masomo\\src\\components\\login.tsx",     "Page de connexion"],
      ["C:\\Projets\\masomo\\src\\lib\\",            "Utilitaires : db, api, auth, store, types, constants"],
      ["C:\\Projets\\masomo\\src\\lib\\db.ts",       "Client Prisma singleton"],
      ["C:\\Projets\\masomo\\src\\lib\\store.ts",    "Store Zustand (session, r\u00F4le, \u00E9tablissement)"],
      ["C:\\Projets\\masomo\\src\\lib\\types.ts",    "Types TypeScript partag\u00E9s"],
      ["C:\\Projets\\masomo\\src\\lib\\constants.ts","Constantes (modules de navigation, libell\u00E9s)"],
      ["C:\\Projets\\masomo\\src\\hooks\\",          "Hooks React personnalis\u00E9s (use-mobile, use-toast)"],
      ["C:\\Projets\\masomo\\prisma\\",             "Sch\u00E9ma Prisma et migrations"],
      ["C:\\Projets\\masomo\\prisma\\schema.prisma","D\u00E9finition des 22 mod\u00E8les de la base"],
      ["C:\\Projets\\masomo\\public\\",             "Fichiers statiques (favicon, manifest, avatars, ic\u00F4nes PWA)"],
      ["C:\\Projets\\masomo\\.env",                 "Variables d\u2019environnement (NON versionn\u00E9)"],
      ["C:\\Projets\\masomo\\.env.example",         "Mod\u00E8le de fichier .env (versionn\u00E9)"],
      ["C:\\Projets\\masomo\\package.json",         "D\u00E9pendances et scripts bun/npm"],
      ["C:\\Projets\\masomo\\next.config.ts",       "Configuration Next.js (output standalone, images)"],
      ["C:\\Projets\\masomo\\tsconfig.json",        "Configuration TypeScript (paths @/*)"],
      ["C:\\Projets\\masomo\\tailwind.config.ts",   "Configuration Tailwind CSS"],
      ["C:\\Projets\\masomo\\postcss.config.mjs",   "Configuration PostCSS"],
      ["C:\\Projets\\masomo\\components.json",      "Configuration shadcn/ui (style New York)"],
      ["C:\\Projets\\masomo\\eslint.config.mjs",    "Configuration ESLint 9 (flat config)"],
    ],
    [42, 58]
  ));

  children.push(h2("11.1 Alias TypeScript"));
  children.push(p(
    "Le fichier tsconfig.json d\u00E9finit l\u2019alias suivant :"
  ));
  children.push(...codeBlock([
    "\"paths\": {",
    "  \"@/*\": [\"./src/*\"]",
    "}",
  ]));
  children.push(p(
    "Cela permet d\u2019importer un module situ\u00E9 dans src/lib/db.ts avec la syntaxe import { prisma } from \"@/lib/db\" plut\u00F4t qu\u2019un chemin relatif. Privil\u00E9giez toujours cet alias pour la lisibilit\u00E9 du code."
  ));

  // =======================================================================
  // CHAPITRE 12 - Scripts disponibles
  // =======================================================================
  children.push(h1("Chapitre 12 \u2014 Scripts disponibles"));
  children.push(p(
    "Le fichier package.json d\u00E9finit huit scripts utilisables avec bun run <nom>. Le tableau ci-dessous les d\u00E9crit tous :"
  ));
  children.push(caption("Tableau 7 \u2014 Scripts du projet"));
  children.push(buildTable(
    ["Script", "Commande ex\u00E9cut\u00E9e", "Description"],
    [
      ["dev",         "node correction2.js",                                                    "D\u00E9marre le serveur de d\u00E9veloppement Next.js (rechargement \u00E0 chaud)."],
      ["build",       "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/", "Compile le projet en mode production et pr\u00E9pare le dossier standalone d\u00E9ployable."],
      ["start",       "NODE_ENV=production node .next/standalone/server.js",                     "D\u00E9marre le serveur de production \u00E0 partir du build standalone."],
      ["lint",        "eslint .",                                                                "Analyse le code avec ESLint 9 et affiche les avertissements/erreurs."],
      ["db:push",     "prisma db push",                                                          "Synchronise le sch\u00E9ma Prisma avec la base SQLite (sans migration)."],
      ["db:generate", "prisma generate",                                                         "G\u00E9n\u00E8re le client Prisma TypeScript \u00E0 partir de schema.prisma."],
      ["db:migrate",  "prisma migrate dev",                                                      "Cr\u00E9e et applique une migration versionn\u00E9e (mode d\u00E9veloppement)."],
      ["db:reset",    "prisma migrate reset",                                                    "R\u00E9initialise totalement la base (efface toutes les donn\u00E9es)."],
    ],
    [15, 35, 50]
  ));

  children.push(p(
    "Pour ex\u00E9cuter un script, tapez simplement bun run <script> dans le terminal PowerShell. Par exemple : bun run lint ou bun run db:push."
  ));

  children.push(h2("12.1 Remarque importante sur le script \u00AB\u00A0build\u00A0\u00BB sous Windows"));
  children.push(p(
    "Le script build utilise la commande Unix cp (copy) pour copier les dossiers .next/static et public vers .next/standalone/. Cette commande n\u2019existe pas en PowerShell natif. Trois solutions sont possibles pour ex\u00E9cuter ce script sous Windows :"
  ));
  children.push(bulletRuns([
    { text: "Option 1 \u2014 Utiliser Git Bash : ", bold: true, color: P.accent },
    { text: "Git pour Windows inclut un terminal Bash (Git Bash). Ouvrez Git Bash \u00E0 la racine du projet et ex\u00E9cutez bun run build depuis ce terminal. La commande cp y est disponible nativement." },
  ]));
  children.push(bulletRuns([
    { text: "Option 2 \u2014 Utiliser WSL (Windows Subsystem for Linux) : ", bold: true, color: P.accent },
    { text: "Installez WSL (wsl --install) puis un distribution Ubuntu, et ex\u00E9cutez le build depuis l\u2019int\u00E9rieur de WSL. C\u2019est la solution la plus proche de l\u2019environnement de production Linux." },
  ]));
  children.push(bulletRuns([
    { text: "Option 3 \u2014 Adapter le script \u00E0 PowerShell : ", bold: true, color: P.accent },
    { text: "Remplacez la ligne build dans package.json par une version PowerShell utilisant Copy-Item. Exemple :" },
  ]));
  children.push(...codeBlock([
    "\"build\": \"next build && Copy-Item -Recurse -Force .next\\\\static .next\\\\standalone\\\\.next\\\\ && Copy-Item -Recurse -Force public .next\\\\standalone\\\\\"",
  ]));
  children.push(p(
    "Pour le d\u00E9veloppement local (bun run dev), aucun de ces probl\u00E8mes ne se pose : le script dev utilise node correction2.js qui fonctionne parfaitement sous PowerShell."
  ));

  // =======================================================================
  // CHAPITRE 13 - Configuration anti-lenteur Windows (NEW)
  // =======================================================================
  children.push(h1("Chapitre 13 \u2014 Configuration anti-lenteur Windows (recommand\u00E9e)"));
  children.push(p(
    "Sous Windows 10, plusieurs m\u00E9canismes de s\u00E9curit\u00E9 ralentissent consid\u00E9rablement les op\u00E9rations de lecture/\u00E9criture sur le dossier node_modules/. Ce chapitre d\u00E9crit les ajustements recommand\u00E9s pour gagner un facteur 3 \u00E0 10 sur les performances de d\u00E9veloppement."
  ));

  children.push(h2("13.1 Exclure le dossier du projet de Windows Defender"));
  children.push(p(
    "Windows Defender analyse en temps r\u00E9el chaque fichier cr\u00E9\u00E9 ou modifi\u00E9 sur le disque. Lors d\u2019un bun install, plusieurs dizaines de milliers de petits fichiers sont \u00E9crits dans node_modules/, ce qui peut multiplier le temps d\u2019installation par 5 \u00E0 10. Proc\u00E9dure d\u2019exclusion :"
  ));
  children.push(bullet("Ouvrez \u00AB\u00A0Param\u00E8tres\u00A0\u00BB (Windows+I) puis \u00AB\u00A0Mise \u00E0 jour et s\u00E9curit\u00E9\u00A0\u00BB \u2192 \u00AB\u00A0S\u00E9curit\u00E9 Windows\u00A0\u00BB."));
  children.push(bullet("Cliquez sur \u00AB\u00A0Protection contre les virus et menaces\u00A0\u00BB."));
  children.push(bullet("Sous \u00AB\u00A0Param\u00E8tres de protection contre les virus et menaces\u00A0\u00BB, cliquez sur \u00AB\u00A0G\u00E9rer les param\u00E8tres\u00A0\u00BB."));
  children.push(bullet("Faites d\u00E9filer jusqu\u2019\u00E0 \u00AB\u00A0Exclusions\u00A0\u00BB puis cliquez sur \u00AB\u00A0Ajouter ou supprimer des exclusions\u00A0\u00BB."));
  children.push(bullet("Cliquez sur \u00AB\u00A0Ajouter une exclusion\u00A0\u00BB \u2192 \u00AB\u00A0Dossier\u00A0\u00BB et ajoutez les dossiers suivants :"));

  children.push(caption("Tableau 8 \u2014 Dossiers \u00E0 exclure de Windows Defender"));
  children.push(buildTable(
    ["Dossier", "Motif"],
    [
      ["C:\\Projets\\masomo",                            "Dossier du projet (node_modules, .next, dev.db)"],
      ["C:\\Users\\<votre-nom>\\.bun",                   "Cache global de Bun"],
      ["C:\\Users\\<votre-nom>\\AppData\\Local\\npm-cache", "Cache npm (utilis\u00E9 par certains outils)"],
      ["C:\\Users\\<votre-nom>\\AppData\\Local\\Temp",   "Dossier temporaire Windows (fichiers de build)"],
    ],
    [50, 50]
  ));
  children.push(p(
    "Remplacez <votre-nom> par votre nom d\u2019utilisateur Windows (par exemple \u00AB\u00A0Jean\u00A0\u00BB). Pour conna\u00EEtre votre nom d\u2019utilisateur, tapez $env:USERNAME dans PowerShell."
  ));

  children.push(h2("13.2 Autoriser l\u2019ex\u00E9cution des scripts PowerShell"));
  children.push(p(
    "Par d\u00E9faut, Windows 10 bloque l\u2019ex\u00E9cution des scripts PowerShell t\u00E9l\u00E9charg\u00E9s depuis Internet (strat\u00E9gie \u00AB\u00A0Restricted\u00A0\u00BB). Cela peut emp\u00EAcher l\u2019installation de Bun ou d\u2019autres outils. Pour autoriser les scripts locaux sign\u00E9s (sans risque pour la s\u00E9curit\u00E9 globale), ex\u00E9cutez une fois en tant qu\u2019utilisateur :"
  ));
  children.push(...codeBlock([
    "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned",
  ]));
  children.push(p(
    "R\u00E9pondez \u00AB\u00A0O\u00A0\u00BB (Oui) \u00E0 la question de confirmation. La strat\u00E9gie \u00AB\u00A0RemoteSigned\u00A0\u00BB autorise les scripts locaux non sign\u00E9s (comme le script d\u2019installation de Bun) tout en exigeant une signature pour les scripts t\u00E9l\u00E9charg\u00E9s."
  ));

  children.push(h2("13.3 D\u00E9sactiver l\u2019indexation Windows Search (optionnel)"));
  children.push(p(
    "Si vous le souhaitez, vous pouvez \u00E9galement exclure le dossier node_modules de l\u2019indexation Windows Search pour \u00E9conomiser de l\u2019espace et du CPU : clic droit sur le dossier node_modules \u2192 Propri\u00E9t\u00E9s \u2192 onglet \u00AB\u00A0G\u00E9n\u00E9ral\u00A0\u00BB \u2192 bouton \u00AB\u00A0Avanc\u00E9\u00A0\u00BB \u2192 d\u00E9cocher \u00AB\u00A0Autoriser l\u2019indexation du contenu des fichiers de ce dossier en plus des propri\u00E9t\u00E9s du fichier\u00A0\u00BB. Cette \u00E9tape est facultative mais recommand\u00E9e sur les machines avec disque m\u00E9canique (HDD)."
  ));

  // =======================================================================
  // CHAPITRE 14 - Probl\u00E8mes courants et solutions (Windows)
  // =======================================================================
  children.push(h1("Chapitre 14 \u2014 Probl\u00E8mes courants et solutions (Windows)"));
  children.push(p(
    "Cette section regroupe les neuf probl\u00E8mes les plus fr\u00E9quemment rencontr\u00E9s lors de l\u2019installation de MASOMO sous Windows 10, avec leur cause et leur solution."
  ));

  // Problem 1
  children.push(h2("14.1 \u00AB\u00A0bun\u2019 n\u2019est pas reconnu comme commande interne\u00A0\u00BB"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Apr\u00E8s l\u2019installation de Bun (ou Node.js, Git), le PATH de la session PowerShell courante n\u2019a pas \u00E9t\u00E9 recharg\u00E9. Les variables d\u2019environnement ne sont rafra\u00EEchies qu\u2019\u00E0 l\u2019ouverture d\u2019un nouveau shell." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Fermez puis rouvrez PowerShell. Si vous utilisez VS Code, fermez compl\u00E8tement l\u2019application (pas seulement la fen\u00EAtre du terminal) et relancez-la. Si la commande est toujours absente, v\u00E9rifiez la pr\u00E9sence du chemin vers Bun dans vos variables d\u2019environnement :" },
  ]));
  children.push(...codeBlock([
    "$env:PATH -split \";\" | Select-String \"bun\"",
    "# doit afficher une ligne contenant .bun\\bin",
  ]));
  children.push(p(
    "Si rien ne s\u2019affiche, ajoutez manuellement le dossier C:\\Users\\<votre-nom>\\.bun\\bin \u00E0 votre PATH via \u00AB\u00A0Param\u00E8tres \u2192 Syst\u00E8me \u2192 \u00C0 propos \u2192 Variables d\u2019environnement\u00A0\u00BB."
  ));

  // Problem 2
  children.push(h2("14.2 Erreur node-gyp ou compilation C++ \u00E9chou\u00E9e"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Certaines d\u00E9pendances (sharp, @prisma/client sur certaines architectures, better-sqlite3) n\u00E9cessitent une compilation native via node-gyp, qui requiert les Build Tools Visual Studio C++." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Installez les Build Tools C++ (cf. chapitre 2.7) en veillant \u00E0 cocher la charge de travail \u00AB\u00A0D\u00E9veloppement Desktop C++\u00A0\u00BB :" },
  ]));
  children.push(...codeBlock([
    "winget install Microsoft.VisualStudio.2022.BuildTools",
    "# Dans le programme d'installation, cocher :",
    "#   D\u00E9veloppement Desktop C++ (Desktop development with C++)",
    "",
    "# Puis relancer :",
    "bun install",
  ]));

  // Problem 3
  children.push(h2("14.3 Erreurs EACCES ou EPERM sur C:\\Program Files\\"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Vous avez plac\u00E9 le projet dans un dossier prot\u00E9g\u00E9 par Windows (par exemple C:\\Program Files\\ ou C:\\Windows\\). Bun et Prisma ne peuvent pas y \u00E9crire sans \u00E9l\u00E9vation de privil\u00E8ges, d\u2019o\u00F9 les erreurs \u00AB\u00A0EACCES\u00A0\u00BB ou \u00AB\u00A0EPERM: operation not permitted\u00A0\u00BB." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "D\u00E9placez le projet dans un dossier utilisateur comme C:\\Projets\\masomo ou C:\\Users\\<votre-nom>\\Projets\\masomo, puis relancez bun install :" },
  ]));
  children.push(...codeBlock([
    "Move-Item C:\\Program Files\\masomo C:\\Projets\\masomo",
    "cd C:\\Projets\\masomo",
    "bun install",
  ]));

  // Problem 4
  children.push(h2("14.4 Port 3000 d\u00E9j\u00E0 utilis\u00E9"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Un autre processus occupe d\u00E9j\u00E0 le port 3000 (souvent une ancienne instance de Next.js, IIS, ou un autre serveur de d\u00E9veloppement)." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Identifiez le processus via netstat puis tuez-le avec taskkill :" },
  ]));
  children.push(...codeBlock([
    "netstat -ano | findstr :3000",
    "# affiche une ligne du type :",
    "#   TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345",
    "",
    "taskkill /PID 12345 /F",
    "",
    "# Alternative : changer de port",
    '$env:PORT=3001; bun run dev',
  ]));

  // Problem 5
  children.push(h2("14.5 Page blanche / chargement bloqu\u00E9"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Plusieurs causes possibles : (a) la base n\u2019est pas initialis\u00E9e, (b) une erreur JavaScript non g\u00E9r\u00E9e se produit au d\u00E9marrage, (c) le cache Next.js (.next/) est corrompu." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Ouvrez la console du navigateur (F12) pour lire le message d\u2019erreur. V\u00E9rifiez \u00E9galement le terminal o\u00F9 tourne le serveur de d\u00E9veloppement. Le plus souvent, il faut vider le cache Next.js et r\u00E9initialiser la base :" },
  ]));
  children.push(...codeBlock([
    "Remove-Item -Recurse -Force .next",
    "bun run db:generate",
    "bun run db:push",
    "bun run dev",
  ]));

  // Problem 6
  children.push(h2("14.6 Erreur Prisma \u00AB\u00A0DATABASE_URL introuvable\u00A0\u00BB"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Le fichier .env n\u2019existe pas \u00E0 la racine du projet, ou la variable DATABASE_URL contient un chemin Windows avec un antislash simple (interpr\u00E9t\u00E9 comme un \u00E9chappement)." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Cr\u00E9ez le fichier .env \u00E0 partir du mod\u00E8le (cf. chapitre 7) et utilisez imp\u00E9rativement un chemin relatif ou des antislashs doubles :" },
  ]));
  children.push(...codeBlock([
    "Copy-Item .env.example .env",
    "# V\u00E9rifiez le contenu :",
    "Get-Content .env",
    "",
    "# DATABASE_URL doit valoir :",
    '#   DATABASE_URL="file:./dev.db"   (chemin relatif, RECOMMANDE)',
    '#   DATABASE_URL="file:C:\\\\Projets\\\\masomo\\\\dev.db"  (slashs doubles)',
  ]));

  // Problem 7
  children.push(h2("14.7 Fins de ligne CRLF vs LF"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Sous Windows, Git convertit par d\u00E9faut les fins de ligne Unix (LF) en fins de ligne Windows (CRLF) au checkout. ESLint, Prettier et certains scripts shell du package.json attendent des LF, ce qui g\u00E9n\u00E8re des warnings du type \u00AB\u00A0Delete CR\u00A0\u00BB." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Configurez un fichier .gitattributes \u00E0 la racine du projet pour forcer LF, puis basculez VS Code en mode LF :" },
  ]));
  children.push(...codeBlock([
    "# .gitattributes",
    "* text=auto eol=lf",
    "",
    "# Dans VS Code :",
    "# - Ouvrez un fichier quelconque",
    "# - Cliquez sur l'indicateur CRLF/LF en bas \u00E0 droite",
    "# - Choisissez LF",
  ]));
  children.push(p(
    "Pour appliquer r\u00E9troactivement LF \u00E0 tous les fichiers d\u00E9j\u00E0 checkout\u00E9s en CRLF, ex\u00E9cutez :"
  ));
  children.push(...codeBlock([
    "git add --renormalize .",
    "git commit -m \"Normalize line endings to LF\"",
  ]));

  // Problem 8
  children.push(h2("14.8 PowerShell bloque les scripts (\u00AB\u00A0Execution Policy\u00A0\u00BB)"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Par d\u00E9faut, Windows 10 applique la strat\u00E9gie \u00AB\u00A0Restricted\u00A0\u00BB qui emp\u00EAche l\u2019ex\u00E9cution de tout script PowerShell (.ps1). Vous obtenez l\u2019erreur \u00AB\u00A0File cannot be loaded because running scripts is disabled on this system\u00A0\u00BB." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Autorisez les scripts locaux sign\u00E9s pour votre utilisateur (cf. chapitre 13.2) :" },
  ]));
  children.push(...codeBlock([
    "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned",
    "# R\u00E9pondre O (Oui) \u00E0 la confirmation",
  ]));

  // Problem 9
  children.push(h2("14.9 Lenteur excessive de \u00AB\u00A0bun install\u00A0\u00BB"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Windows Defender analyse en temps r\u00E9el chaque fichier \u00E9crit dans node_modules/, ce qui peut multiplier le temps d\u2019installation par 5 \u00E0 10 par rapport \u00E0 Linux." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Excluez le dossier du projet et les caches de Bun/npm de l\u2019analyse antivirus (cf. chapitre 13.1 pour la proc\u00E9dure d\u00E9taill\u00E9e). Apr\u00E8s exclusion, un bun install passe typiquement de 8-10 minutes \u00E0 1-2 minutes." },
  ]));

  // =======================================================================
  // CHAPITRE 15 - Checklist finale (Windows)
  // =======================================================================
  children.push(h1("Chapitre 15 \u2014 Checklist finale de v\u00E9rification (Windows)"));
  children.push(p(
    "Avant de consid\u00E9rer l\u2019installation comme termin\u00E9e, parcourez la checklist ci-dessous. Chaque case doit \u00EAtre valid\u00E9e."
  ));
  children.push(caption("Tableau 9 \u2014 Checklist finale d\u2019installation Windows"));
  const checklistRows = [
    ["Windows 10 version 1809+ v\u00E9rifi\u00E9e (winver)"],
    ["Node.js v24+ install\u00E9 (node --version OK)"],
    ["Bun 1.3+ install\u00E9 (bun --version OK)"],
    ["Git install\u00E9 (git --version OK)"],
    ["VS Code install\u00E9 et 8 extensions VS Code install\u00E9es"],
    ["Build Tools C++ 2022 install\u00E9s avec \u00AB\u00A0D\u00E9veloppement Desktop C++\u00A0\u00BB"],
    ["Projet extrait dans C:\\Projets\\masomo (pas dans Program Files)"],
    ["bun install ex\u00E9cut\u00E9 sans erreur fatale"],
    ["Fichier .env cr\u00E9\u00E9 avec DATABASE_URL=\"file:./dev.db\""],
    ["bun run db:generate a g\u00E9n\u00E9r\u00E9 le client Prisma"],
    ["bun run db:push a cr\u00E9\u00E9 le fichier prisma\\dev.db"],
    ["bun run dev d\u00E9marre le serveur sur http://localhost:3000"],
    ["Windows Defender : dossier C:\\Projets\\masomo exclu"],
    ["Fins de ligne configur\u00E9es en LF (.gitattributes pr\u00E9sent)"],
    ["Set-ExecutionPolicy ex\u00E9cut\u00E9 (RemoteSigned pour CurrentUser)"],
  ];
  children.push(buildTable(
    ["\u2610", "\u00C9l\u00E9ment \u00E0 v\u00E9rifier"],
    checklistRows.map(item => ["\u2610", item[0]]),
    [8, 92]
  ));

  // =======================================================================
  // CHAPITRE 16 - Liste compl\u00E8te des commandes (tiret par tiret)
  // =======================================================================
  children.push(h1("Chapitre 16 \u2014 Liste compl\u00E8te des commandes (tiret par tiret)"));
  children.push(p(
    "Voici la liste exhaustive, dans l\u2019ordre exact, de toutes les commandes \u00E0 ex\u00E9cuter dans le terminal PowerShell de VSCode pour installer compl\u00E8tement le projet MASOMO sous Windows 10. Suivez ces commandes tiret par tiret, dans l\u2019ordre."
  ));

  // --- 16.1 Pr\u00E9requis syst\u00E8me -------------------------------------------------
  children.push(h3("Section 16.1 \u2014 Installation des pr\u00E9requis syst\u00E8me (PowerShell administrateur)"));
  [
    ["V\u00E9rifier la version Windows : ", "winver"],
    ["Installer Node.js v24 : ", "winget install OpenJS.NodeJS.LTS"],
    ["Installer Bun : ", 'powershell -c "irm bun.sh/install.ps1 | iex"'],
    ["Installer Git : ", "winget install Git.Git"],
    ["Installer VSCode : ", "winget install Microsoft.VisualStudioCode"],
    ["Installer les Build Tools C++ : ", "winget install Microsoft.VisualStudio.2022.BuildTools"],
    ["V\u00E9rifier Node.js : ", "node --version"],
    ["V\u00E9rifier Bun : ", "bun --version"],
    ["V\u00E9rifier Git : ", "git --version"],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // --- 16.2 Extensions VSCode --------------------------------------------------
  children.push(h3("Section 16.2 \u2014 Extensions VSCode (terminal VSCode)"));
  [
    ["Installer ESLint : ", "code --install-extension dbaeumer.vscode-eslint"],
    ["Installer Prettier : ", "code --install-extension esbenp.prettier-vscode"],
    ["Installer Tailwind CSS IntelliSense : ", "code --install-extension bradlc.vscode-tailwindcss"],
    ["Installer Prisma : ", "code --install-extension Prisma.prisma"],
    ["Installer Path Intellisense : ", "code --install-extension christian-kohler.path-intellisense"],
    ["Installer Auto Rename Tag : ", "code --install-extension formulahendry.auto-rename-tag"],
    ["Installer ES7+ React snippets : ", "code --install-extension dsznajder.es7-react-js-snippets"],
    ["Installer Error Lens : ", "code --install-extension usernamehw.errorlens"],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // --- 16.3 R\u00E9cup\u00E9ration et ouverture du projet -------------------------------
  children.push(h3("Section 16.3 \u2014 R\u00E9cup\u00E9ration et ouverture du projet"));
  [
    ["Cr\u00E9er le dossier projets : ", "mkdir C:\\Projets"],
    ["Aller dans le dossier : ", "cd C:\\Projets"],
    ["Cloner le projet : ", "git clone <url-du-depot> masomo"],
    ["Aller dans le projet : ", "cd masomo"],
    ["Ouvrir dans VSCode : ", "code ."],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // --- 16.4 Installation des d\u00E9pendances ---------------------------------------
  children.push(h3("Section 16.4 \u2014 Installation des d\u00E9pendances"));
  [
    ["Installer toutes les d\u00E9pendances : ", "bun install"],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // --- 16.5 Configuration de l\u2019environnement ------------------------------------
  children.push(h3("Section 16.5 \u2014 Configuration de l\u2019environnement"));
  [
    ["Copier le fichier .env.example : ", "Copy-Item .env.example .env"],
    ["V\u00E9rifier le contenu du .env : ", "Get-Content .env"],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // --- 16.6 Initialisation de la base de donn\u00E9es --------------------------------
  children.push(h3("Section 16.6 \u2014 Initialisation de la base de donn\u00E9es"));
  [
    ["G\u00E9n\u00E9rer le client Prisma : ", "bun run db:generate"],
    ["Cr\u00E9er la base SQLite et les tables : ", "bun run db:push"],
    ["V\u00E9rifier que dev.db existe : ", "Test-Path dev.db"],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // --- 16.7 D\u00E9marrage et v\u00E9rification ------------------------------------------
  children.push(h3("Section 16.7 \u2014 D\u00E9marrage et v\u00E9rification"));
  [
    ["D\u00E9marrer le serveur de d\u00E9veloppement : ", "bun run dev"],
    ["V\u00E9rifier la qualit\u00E9 du code (nouveau terminal) : ", "bun run lint"],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // --- 16.8 D\u00E9pannage ---------------------------------------------------------
  children.push(h3("Section 16.8 \u2014 En cas de probl\u00E8me (commandes de d\u00E9pannage)"));
  [
    ["Vider le cache Next.js : ", "Remove-Item -Recurse -Force .next"],
    ["Autoriser les scripts PowerShell : ", "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned"],
    ["Identifier un processus sur le port 3000 : ", "netstat -ano | findstr :3000"],
    ["Tuer un processus par PID : ", "taskkill /PID <PID> /F"],
    ["R\u00E9installer les d\u00E9pendances : ", "Remove-Item -Recurse -Force node_modules; bun install"],
  ].forEach(function (pair) { pushDashItem(children, pair[0], pair[1]); });

  // =======================================================================
  // CHAPITRE 17 - R\u00E9sum\u00E9 express (PowerShell)
  // =======================================================================
  children.push(h1("Chapitre 17 \u2014 R\u00E9sum\u00E9 express (commandes PowerShell)"));
  children.push(p(
    "Si vous \u00EAtes \u00E0 l\u2019aise avec la stack et que vous voulez d\u00E9marrer rapidement sur un poste Windows 10 propre, voici les six commandes essentielles pour installer et lancer MASOMO. Toutes les commandes sont \u00E0 ex\u00E9cuter dans PowerShell :"
  ));
  children.push(...codeBlock([
    "# 1. Installer Bun (PowerShell)",
    'powershell -c "irm bun.sh/install.ps1 | iex"',
    "",
    "# 2. Aller dans le projet",
    "cd C:\\Projets\\masomo",
    "",
    "# 3. Installer les d\u00E9pendances",
    "bun install",
    "",
    "# 4. Configurer l'environnement",
    "Copy-Item .env.example .env",
    "",
    "# 5. Initialiser la base de donn\u00E9es",
    "bun run db:generate; bun run db:push",
    "",
    "# 6. D\u00E9marrer !",
    "bun run dev",
  ]));

  children.push(p(
    "Une fois la derni\u00E8re commande ex\u00E9cut\u00E9e, ouvrez votre navigateur (Microsoft Edge, Google Chrome ou Mozilla Firefox) \u00E0 l\u2019adresse http://localhost:3000 et connectez-vous avec l\u2019un des comptes de d\u00E9monstration list\u00E9s au chapitre 9. Bon d\u00E9veloppement avec MASOMO sous Windows 10 !"
  ));

  return children;
}

// ---------------------------------------------------------------------------
// DOCUMENT ASSEMBLY
// ---------------------------------------------------------------------------
function buildDocument() {
  const pgSize = { width: 11906, height: 16838 }; // A4

  // Section 1: COVER - margin 0, no footer, no page numbers
  const coverSection = {
    properties: {
      page: {
        size: pgSize,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    },
    children: buildCover(),
  };

  // Section 2: BODY - standard margins, footer with page number, starts at 1
  const bodySection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: pgSize,
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
      },
    },
    footers: { default: pageNumFooter() },
    children: buildBody(),
  };

  return new Document({
    creator: "MASOMO Documentation Generator",
    title: "MASOMO - Guide d'Installation Windows 10",
    description: "Guide d'installation detaille du projet MASOMO sous Windows 10 (Next.js 16 + Prisma)",
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: 24,
            color: P.body,
          },
          paragraph: {
            spacing: { line: 312 },
          },
        },
        heading1: {
          run: { font: FONT, size: 32, bold: true, color: P.primary },
          paragraph: { spacing: { before: 360, after: 180, line: 312 }, outlineLevel: 0 },
        },
        heading2: {
          run: { font: FONT, size: 28, bold: true, color: P.primary },
          paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
        },
        heading3: {
          run: { font: FONT, size: 24, bold: true, color: P.primary },
          paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
        },
      },
    },
    sections: [coverSection, bodySection],
  });
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const outputPath = "/home/z/my-project/public/MASOMO_Guide_Installation_Windows.docx";
  console.log("[generate-install-guide-windows] Building document...");
  const doc = buildDocument();
  console.log("[generate-install-guide-windows] Packing to buffer...");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  const stat = fs.statSync(outputPath);
  console.log("[generate-install-guide-windows] Wrote: " + outputPath);
  console.log("[generate-install-guide-windows] Size: " + stat.size + " bytes (" + (stat.size / 1024).toFixed(1) + " KB)");
}

main().catch(err => {
  console.error("[generate-install-guide-windows] ERROR:", err);
  process.exit(1);
});
