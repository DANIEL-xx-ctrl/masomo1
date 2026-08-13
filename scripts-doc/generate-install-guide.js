/**
 * MASOMO - Guide d'Installation Detaille (Word .docx)
 * Generation script using the `docx` library.
 *
 * Output: /home/z/my-project/public/MASOMO_Guide_Installation.docx
 *
 * IMPORTANT: All French apostrophes (') and guillemets (« ») are written
 * with Unicode escapes (\u2019, \u00AB, \u00BB) to keep JS syntax safe.
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

// Bullet item with leading bullet character (uses real bullet via SymbolRun-like TextRun)
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

// Inline code paragraph with optional caption-style prefix
function codeLineWithPrefix(prefix, text) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 276 },
    indent: { left: 200, right: 200 },
    shading: { type: ShadingType.CLEAR, fill: P.surface, color: "auto" },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: P.accent, space: 6 },
    },
    children: [
      new TextRun({ text: prefix + " ", size: 20, font: MONO, color: P.accent, bold: true }),
      new TextRun({ text: safeText(text), size: 20, font: MONO, color: P.primary }),
    ],
  });
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
// headers: ["h1","h2"]
// rows: [["a","b"], ...]
// widths: [40, 60] (must sum to 100)
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
  // Full-page wrapper table with no borders, used purely for layout.
  const noBorders = {
    top:    { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right:  { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  // Build the inner content of the cover
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
          size: 22, // 11pt
          bold: true,
          font: FONT,
          color: P.accent,
          characterSpacing: 60,
        }),
      ],
    }),
    // Subtle accent line below label (paragraph border bottom)
    new Paragraph({
      spacing: { before: 0, after: 600 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 4 } },
      children: [new TextRun({ text: "", size: 2 })],
    }),
    // Main title (40pt = size 80, bold)
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 200, line: 920, lineRule: "atLeast" },
      children: [
        new TextRun({
          text: "MASOMO",
          size: 80, // 40pt
          bold: true,
          font: FONT,
          color: P.primary,
        }),
      ],
    }),
    // Subtitle line 1
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 120, line: 360 },
      children: [
        new TextRun({
          text: "Guide d\u2019Installation D\u00E9taill\u00E9",
          size: 44, // 22pt
          bold: true,
          font: FONT,
          color: P.primary,
        }),
      ],
    }),
    // Subtitle line 2
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 360, line: 320 },
      children: [
        new TextRun({
          text: "Application de Gestion Scolaire (EduGest) \u2014 Next.js 16 + TypeScript + Prisma",
          size: 26, // 13pt
          font: FONT,
          color: P.secondary,
        }),
      ],
    }),
    // Horizontal accent rule (paragraph bottom border, teal, sz 12)
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
        new TextRun({ text: "Ubuntu (Linux) \u2014 Node.js v24+ / Bun 1.3+", size: 22, font: FONT, color: P.body }),
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
  // with no borders to act as a layout container.
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
  // TOC title - DO NOT use HeadingLevel (would self-index)
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240, line: 312 },
    children: [
      new TextRun({ text: "Table des mati\u00E8res", bold: true, size: 36, font: FONT, color: P.primary }),
    ],
  }));

  // The TableOfContents element
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

  // Page break after TOC is achieved by adding pageBreakBefore to the
  // Chapter 1 heading paragraph (handled below in h1Chapter1). This avoids
  // any standalone empty PageBreak paragraph that would trigger postcheck
  // "empty paragraph + PageBreak" warnings.

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
    "Le projet suit une architecture monolithique moderne : un seul d\u00E9p\u00F4t contient \u00E0 la fois le frontend React (App Router), les routes API serverless de Next.js, et la couche d\u2019acc\u00E8s aux donn\u00E9es via Prisma. La persistance est assur\u00E9e par une base SQLite locale, ce qui rend l\u2019installation particuli\u00E8rement simple sur un poste de travail Ubuntu."
  ));
  children.push(p(
    "MASOMO est con\u00E7u pour \u00EAtre install\u00E9 localement puis d\u00E9ploy\u00E9 sur un serveur gr\u00E2ce \u00E0 la sortie standalone de Next.js. Cette documentation d\u00E9crit pas \u00E0 pas toutes les \u00E9tapes n\u00E9cessaires, depuis la pr\u00E9paration de la machine jusqu\u2019au premier d\u00E9marrage du serveur de d\u00E9veloppement."
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
      ["TypeScript", "5.x", "Langage principal, typage statique strict"],
      ["React", "19.x", "Biblioth\u00E8que UI (rendu c\u00F4t\u00E9 client et serveur)"],
      ["Prisma", "6.11.x", "ORM TypeScript, g\u00E9n\u00E8re le client type-safe"],
      ["SQLite", "int\u00E9gr\u00E9", "Base de donn\u00E9es locale (fichier dev.db)"],
      ["Tailwind CSS", "4.x", "Framework CSS utilitaire"],
      ["shadcn/ui", "New York", "Composants Radix UI pr\u00E9-style\u0301s et personnalisables"],
      ["Radix UI", "varies", "Primitives accessibles (Dialog, Select, Popover, etc.)"],
      ["Zustand", "5.x", "Gestion d\u2019\u00E9tat l\u00E8re c\u00F4t\u00E9 client"],
      ["TanStack Query", "5.x", "Cache et synchronisation des donn\u00E9es serveur"],
      ["Recharts", "2.15.x", "Graphiques (barres, lignes, aires, secteurs)"],
      ["Framer Motion", "12.x", "Animations d\u00E9claratives React"],
      ["NextAuth.js", "4.x", "Authentification (sessions, JWT)"],
      ["Bun", "1.3.x", "Runtime et gestionnaire de paquets rapide"],
    ],
    [22, 18, 60]
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
    "Notifications en temps r\u00E9el via une WebSocket",
    "Module Super Admin pour la gestion multi-\u00E9tablissements",
    "Application web progressive (PWA) installable sur mobile",
  ];
  features.forEach(f => children.push(bullet(f)));

  // =======================================================================
  // CHAPITRE 2 - Pr\u00E9requis syst\u00E8me (Ubuntu)
  // =======================================================================
  children.push(h1("Chapitre 2 \u2014 Pr\u00E9requis syst\u00E8me (Ubuntu)"));
  children.push(p(
    "Avant d\u2019installer MASOMO, vous devez pr\u00E9parer votre machine Ubuntu en installant Node.js, Bun, Git et un \u00E9diteur de code. Les commandes ci-dessous sont valables pour Ubuntu 22.04 LTS et 24.04 LTS. Toutes les commandes doivent \u00EAtre ex\u00E9cut\u00E9es dans un terminal."
  ));

  children.push(h2("2.1 Mise \u00E0 jour du syst\u00E8me"));
  children.push(p("Commencez par mettre \u00E0 jour la liste des paquets :"));
  children.push(...codeBlock([
    "sudo apt update && sudo apt upgrade -y",
  ]));

  children.push(h2("2.2 Installation de Node.js v24 (via NodeSource)"));
  children.push(p(
    "MASOMO n\u00E9cessite Node.js version 24 ou sup\u00E9rieure. La m\u00E9thode recommand\u00E9e sous Ubuntu consiste \u00E0 utiliser le d\u00E9p\u00F4t NodeSource, qui fournit des versions r\u00E9centes et stables :"
  ));
  children.push(...codeBlock([
    "curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -",
    "sudo apt install -y nodejs",
    "node --version   # doit afficher v24.x.x",
    "npm --version    # doit afficher 10.x ou 11.x",
  ]));

  children.push(h2("2.3 Installation de Bun 1.3"));
  children.push(p(
    "Bun est le gestionnaire de paquets principal du projet. Il est beaucoup plus rapide que npm et \u00E9vite les probl\u00E8mes de permissions li\u00E9s \u00E0 sudo (cf. chapitre 13). Installez-le avec la commande officielle :"
  ));
  children.push(...codeBlock([
    "curl -fsSL https://bun.sh/install | bash",
  ]));
  children.push(p(
    "Apr\u00E8s l\u2019installation, rechargez votre shell puis v\u00E9rifiez la version :"
  ));
  children.push(...codeBlock([
    "source ~/.bashrc",
    "bun --version   # doit afficher 1.3.x ou sup\u00E9rieur",
  ]));

  children.push(h2("2.4 Installation de Git"));
  children.push(p(
    "Git est n\u00E9cessaire si vous r\u00E9cup\u00E9rez le projet par clonage. Sous Ubuntu, il s\u2019installe depuis les d\u00E9p\u00F4ts officiels :"
  ));
  children.push(...codeBlock([
    "sudo apt install -y git",
    "git --version   # doit afficher git version 2.34 ou sup\u00E9rieur",
  ]));

  children.push(h2("2.5 Installation de Visual Studio Code"));
  children.push(p(
    "VS Code est l\u2019\u00E9diteur recommand\u00E9 pour d\u00E9velopper sur MASOMO. Sous Ubuntu, la m\u00E9thode la plus simple consiste \u00E0 utiliser le gestionnaire de paquets snap :"
  ));
  children.push(...codeBlock([
    "sudo snap install code --classic",
    "code --version   # doit afficher la version de VS Code",
  ]));

  children.push(h2("2.6 R\u00E9capitulatif des versions minimales"));
  children.push(caption("Tableau 2 \u2014 Versions minimales requises"));
  children.push(buildTable(
    ["Outil", "Version minimale", "Commande de v\u00E9rification"],
    [
      ["Node.js", "v24.0.0", "node --version"],
      ["Bun", "1.3.0", "bun --version"],
      ["Git", "2.34", "git --version"],
      ["VS Code", "1.85", "code --version"],
      ["Ubuntu", "22.04 LTS", "lsb_release -a"],
    ],
    [25, 30, 45]
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

  children.push(h2("3.1 Installation en une seule commande"));
  children.push(p(
    "Vous pouvez installer toutes ces extensions en une seule ligne gr\u00E2ce \u00E0 l\u2019option --install-extension de VS Code :"
  ));
  children.push(...codeBlock([
    "code --install-extension dbaeumer.vscode-eslint \\",
    "  --install-extension esbenp.prettier-vscode \\",
    "  --install-extension bradlc.vscode-tailwindcss \\",
    "  --install-extension Prisma.prisma \\",
    "  --install-extension christian-kohler.path-intellisense \\",
    "  --install-extension formulahendry.auto-rename-tag \\",
    "  --install-extension dsznajder.es7-react-js-snippets \\",
    "  --install-extension usernamehw.errorlens",
  ]));

  // =======================================================================
  // CHAPITRE 4 - R\u00E9cup\u00E9ration du projet
  // =======================================================================
  children.push(h1("Chapitre 4 \u2014 R\u00E9cup\u00E9ration du projet"));
  children.push(p(
    "Deux options sont possibles pour r\u00E9cup\u00E9rer le code source de MASOMO : \u00E0 partir d\u2019une archive zip, ou par clonage d\u2019un d\u00E9p\u00F4t Git. Choisissez l\u2019option qui correspond \u00E0 votre situation."
  ));

  children.push(h2("4.1 Option A \u2014 D\u00E9compression d\u2019une archive zip"));
  children.push(p(
    "Si vous disposez du fichier masomo-source.zip, d\u00E9compressez-le dans le dossier o\u00F9 vous souhaitez travailler :"
  ));
  children.push(...codeBlock([
    "mkdir -p ~/projets",
    "cd ~/projets",
    "unzip ~/T\u00E9l\u00E9chargements/masomo-source.zip -d masomo",
    "cd masomo",
    "code .",
  ]));

  children.push(h2("4.2 Option B \u2014 Clonage depuis Git"));
  children.push(p(
    "Si vous avez acc\u00E8s au d\u00E9p\u00F4t Git du projet, clonez-le puis ouvrez-le dans VS Code :"
  ));
  children.push(...codeBlock([
    "cd ~/projets",
    "git clone https://exemple.com/masomo.git",
    "cd masomo",
    "code .",
  ]));

  children.push(p(
    "Dans les deux cas, \u00E0 l\u2019issue de ces commandes, VS Code s\u2019ouvre directement \u00E0 la racine du projet. Vous \u00EAtes pr\u00EAt \u00E0 configurer votre environnement de d\u00E9veloppement."
  ));

  // =======================================================================
  // CHAPITRE 5 - Configuration VSCode du projet
  // =======================================================================
  children.push(h1("Chapitre 5 \u2014 Configuration VSCode du projet"));
  children.push(p(
    "Pour garantir un formatage et une qualit\u00E9 de code uniformes entre tous les d\u00E9veloppeurs, cr\u00E9ez deux fichiers de configuration VS Code \u00E0 la racine du projet, dans le dossier .vscode/."
  ));

  children.push(h2("5.1 Fichier .vscode/settings.json"));
  children.push(p(
    "Ce fichier active le formatage \u00E0 la sauvegarde, d\u00E9finit Prettier comme formateur par d\u00E9faut, configure ESLint pour qu\u2019il corrige automatiquement les erreurs, active la d\u00E9tection des classes Tailwind et associe les fichiers .prisma au bon mode de coloration :"
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
    "  \"typescript.enablePromptUseWorkspaceTsdk\": true",
    "}"
  ]));

  children.push(h2("5.2 Fichier .vscode/launch.json"));
  children.push(p(
    "Ce fichier permet de lancer le debug de Next.js directement depuis VS Code. Il attache le d\u00E9bogueur Node.js au serveur de d\u00E9veloppement :"
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
    "Apr\u00E8s avoir cr\u00E9\u00E9 ces deux fichiers, rechargez VS Code (Ctrl+Shift+P puis \u00AB\u00A0Reload Window\u00A0\u00BB) pour que les param\u00E8tres soient pris en compte."
  ));

  // =======================================================================
  // CHAPITRE 6 - Installation des d\u00E9pendances
  // =======================================================================
  children.push(h1("Chapitre 6 \u2014 Installation des d\u00E9pendances"));
  children.push(p(
    "L\u2019installation des d\u00E9pendances se fait avec Bun, qui est beaucoup plus rapide que npm ou yarn. La commande lit le fichier package.json et t\u00E9l\u00E9charge tous les paquets n\u00E9cessaires dans le dossier node_modules/."
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

  children.push(h2("6.2 V\u00E9rification de l\u2019installation"));
  children.push(p(
    "Pour v\u00E9rifier que tout s\u2019est bien pass\u00E9, contr\u00F4lez que le dossier node_modules/ existe et qu\u2019il contient le sous-dossier .bin/next :"
  ));
  children.push(...codeBlock([
    "ls node_modules/.bin/next",
    "# doit afficher: node_modules/.bin/next",
  ]));

  // =======================================================================
  // CHAPITRE 7 - Configuration de l'environnement (.env)
  // =======================================================================
  children.push(h1("Chapitre 7 \u2014 Configuration de l\u2019environnement (.env)"));
  children.push(p(
    "MASOMO utilise un fichier .env pour stocker ses variables d\u2019environnement. Un fichier mod\u00E8le .env.example est fourni \u00E0 la racine du projet. La premi\u00E8re \u00E9tape consiste \u00E0 le copier sous le nom .env :"
  ));
  children.push(...codeBlock([
    "cp .env.example .env",
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

  children.push(h2("7.3 Avertissement sur le chemin DATABASE_URL"));
  children.push(p(
    "Attention : la valeur par d\u00E9faut de DATABASE_URL pointe vers ./dev.db, ce qui cr\u00E9e le fichier de base de donn\u00E9es dans le dossier prisma/. Si vous pr\u00E9f\u00E9rez stocker la base ailleurs (par exemple dans un sous-dossier db/), adaptez le chemin, par exemple :"
  ));
  children.push(...codeBlock([
    "DATABASE_URL=\"file:../db/custom.db\"",
  ]));
  children.push(p(
    "Dans ce cas, assurez-vous que le dossier db/ existe avant de lancer la commande db:push. Ne mettez jamais le fichier .env dans un d\u00E9p\u00F4t Git public : il contient des informations sensibles."
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
    "Cette commande est idempotente : vous pouvez la relancer sans risque. Elle compare le sch\u00E9ma actuel avec celui de la base et applique les diff\u00E9rences. \u00C0 l\u2019issue, le fichier dev.db (ou custom.db) contient les 22 tables d\u00E9crites dans le sch\u00E9ma."
  ));

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
    "Ouvrez votre navigateur \u00E0 l\u2019adresse http://localhost:3000. Vous arrivez sur la page de connexion. Vous pouvez utiliser l\u2019un des comptes de d\u00E9monstration pour vous connecter :"
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
    "Pour arr\u00EAter le serveur, appuyez sur Ctrl+C dans le terminal o\u00F9 il tourne."
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

  children.push(h2("10.2 V\u00E9rification TypeScript"));
  children.push(p(
    "Pour v\u00E9rifier le typage, deux m\u00E9thodes sont possibles :"
  ));
  children.push(bullet("Dans VS Code, appuyez sur Ctrl+Shift+P puis tapez \u00AB\u00A0TypeScript: Restart TS Server\u00A0\u00BB pour relancer le serveur de langage TypeScript."));
  children.push(bullet("Pour une v\u00E9rification globale, ex\u00E9cutez :"));
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
    "MASOMO suit l\u2019organisation standard d\u2019un projet Next.js 16 avec App Router. Voici l\u2019arborescence des dossiers et fichiers principaux :"
  ));
  children.push(caption("Tableau 6 \u2014 Arborescence du projet"));
  children.push(buildTable(
    ["Chemin", "Description"],
    [
      ["src/app/",                  "Racine de l\u2019App Router : pages, layouts, API routes"],
      ["src/app/api/",              "Routes API serverless (auth, students, teachers, ...)"],
      ["src/app/layout.tsx",        "Layout racine de l\u2019application"],
      ["src/app/page.tsx",          "Page d\u2019accueil (redirige vers /login)"],
      ["src/app/globals.css",       "Styles globaux Tailwind"],
      ["src/components/ui/",        "Composants shadcn/ui (Button, Card, Dialog, etc.)"],
      ["src/components/modules/",   "Modules m\u00E9tier (dashboard, students, payments, ...)"],
      ["src/components/app-shell.tsx", "Coquille de l\u2019application (sidebar + topbar)"],
      ["src/components/login.tsx",  "Page de connexion"],
      ["src/lib/",                  "Utilitaires : db, api, auth, store, types, constants"],
      ["src/lib/db.ts",             "Client Prisma singleton"],
      ["src/lib/store.ts",          "Store Zustand (session, r\u00F4le, \u00E9tablissement)"],
      ["src/lib/types.ts",          "Types TypeScript partag\u00E9s"],
      ["src/lib/constants.ts",      "Constantes (modules de navigation, libell\u00E9s)"],
      ["src/hooks/",                "Hooks React personnalis\u00E9s (use-mobile, use-toast)"],
      ["prisma/",                   "Sch\u00E9ma Prisma et migrations"],
      ["prisma/schema.prisma",      "D\u00E9finition des 22 mod\u00E8les de la base"],
      ["public/",                   "Fichiers statiques (favicon, manifest, avatars, ic\u00F4nes PWA)"],
      [".env",                       "Variables d\u2019environnement (NON versionn\u00E9)"],
      [".env.example",               "Mod\u00E8le de fichier .env (versionn\u00E9)"],
      ["package.json",               "D\u00E9pendances et scripts npm/bun"],
      ["next.config.ts",             "Configuration Next.js (output standalone, images)"],
      ["tsconfig.json",              "Configuration TypeScript (paths @/*)"],
      ["tailwind.config.ts",         "Configuration Tailwind CSS"],
      ["postcss.config.mjs",         "Configuration PostCSS"],
      ["components.json",            "Configuration shadcn/ui (style New York)"],
      ["eslint.config.mjs",          "Configuration ESLint 9 (flat config)"],
    ],
    [32, 68]
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
    "Pour ex\u00E9cuter un script, tapez simplement bun run <script> dans le terminal. Par exemple : bun run lint ou bun run db:push."
  ));

  // =======================================================================
  // CHAPITRE 13 - Probl\u00E8mes courants et solutions
  // =======================================================================
  children.push(h1("Chapitre 13 \u2014 Probl\u00E8mes courants et solutions"));
  children.push(p(
    "Cette section regroupe les six probl\u00E8mes les plus fr\u00E9quemment rencontr\u00E9s lors de l\u2019installation de MASOMO sous Ubuntu, avec leur cause et leur solution."
  ));

  // Problem 1
  children.push(h2("13.1 EACCES permission denied avec npm et sudo"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "L\u2019installation de paquets npm avec sudo place les fichiers dans /usr/lib/node_modules qui n\u2019est accessible qu\u2019en root. Les commandes suivantes \u00E9chouent avec \u00AB\u00A0EACCES: permission denied\u00A0\u00BB." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "N\u2019utilisez plus npm avec sudo. Installez Bun (cf. chapitre 2) qui stocke les paquets dans votre dossier utilisateur, sans n\u00E9cessiter de droits root. Ensuite, remplacez toutes vos commandes npm par bun. Si vous avez d\u00E9j\u00E0 un node_modules corrompu, supprimez-le puis relancez bun install :" },
  ]));
  children.push(...codeBlock([
    "sudo rm -rf node_modules",
    "bun install",
  ]));

  // Problem 2
  children.push(h2("13.2 Module not found @swc/helpers"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Next.js 16 utilise SWC pour la compilation. Une installation incompl\u00E8te ou un cache corrompu peut provoquer l\u2019erreur \u00AB\u00A0Cannot find module @swc/helpers\u00A0\u00BB au d\u00E9marrage." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "R\u00E9installez proprement les d\u00E9pendances et videz le cache Next.js :" },
  ]));
  children.push(...codeBlock([
    "rm -rf node_modules .next",
    "bun install",
    "bun run dev",
  ]));

  // Problem 3
  children.push(h2("13.3 Port 3000 d\u00E9j\u00E0 utilis\u00E9"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Un autre processus occupe d\u00E9j\u00E0 le port 3000 (souvent une ancienne instance de Next.js ou un autre serveur de d\u00E9veloppement)." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Identifiez le processus et tuez-le, ou changez de port :" },
  ]));
  children.push(...codeBlock([
    "lsof -i :3000      # liste les processus sur le port 3000",
    "kill -9 <PID>      # remplacez <PID> par l\u2019identifiant trouv\u00E9",
    "# alternative : changer de port",
    "PORT=3001 bun run dev",
  ]));

  // Problem 4
  children.push(h2("13.4 Erreur Prisma \u00AB\u00A0DATABASE_URL introuvable\u00A0\u00BB"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Le fichier .env n\u2019existe pas \u00E0 la racine du projet, ou la variable DATABASE_URL n\u2019est pas d\u00E9finie. Prisma ne peut pas se connecter \u00E0 la base." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Cr\u00E9ez le fichier .env \u00E0 partir du mod\u00E8le (cf. chapitre 7) :" },
  ]));
  children.push(...codeBlock([
    "cp .env.example .env",
    "# v\u00E9rifiez le contenu :",
    "cat .env",
  ]));

  // Problem 5
  children.push(h2("13.5 Page blanche / chargement bloqu\u00E9"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Plusieurs causes possibles : (a) la base n\u2019est pas initialis\u00E9e, (b) une erreur JavaScript non g\u00E9r\u00E9e se produit au d\u00E9marrage, (c) un module requis n\u2019est pas install\u00E9." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Ouvrez la console du navigateur (F12) pour lire le message d\u2019erreur. V\u00E9rifiez \u00E9galement le terminal o\u00F9 tourne le serveur de d\u00E9veloppement. Le plus souvent, il faut r\u00E9initialiser la base :" },
  ]));
  children.push(...codeBlock([
    "bun run db:generate",
    "bun run db:push",
    "bun run dev",
  ]));

  // Problem 6
  children.push(h2("13.6 Erreur prisma generate sous Ubuntu"));
  children.push(pruns([
    { text: "Cause : ", bold: true, color: P.accent },
    { text: "Le binaire du moteur Prisma (query engine) ne parvient pas \u00E0 s\u2019ex\u00E9cuter. Cela arrive lorsque les biblioth\u00E8ques syst\u00E8me OpenSSL ne sont pas \u00E0 jour, ou si le cache Prisma est corrompu." },
  ]));
  children.push(pruns([
    { text: "Solution : ", bold: true, color: P.accent },
    { text: "Installez ou mettez \u00E0 jour libssl, puis videz le cache Prisma et relancez la g\u00E9n\u00E9ration :" },
  ]));
  children.push(...codeBlock([
    "sudo apt install -y libssl-dev",
    "rm -rf ~/.cache/prisma",
    "rm -rf node_modules/.prisma",
    "bun run db:generate",
  ]));

  // =======================================================================
  // CHAPITRE 14 - Checklist finale
  // =======================================================================
  children.push(h1("Chapitre 14 \u2014 Checklist finale de v\u00E9rification"));
  children.push(p(
    "Avant de consid\u00E9rer l\u2019installation comme termin\u00E9e, parcourez la checklist ci-dessous. Chaque case doit \u00EAtre valid\u00E9e."
  ));
  children.push(caption("Tableau 8 \u2014 Checklist finale d\u2019installation"));
  const checklistRows = [
    ["Node.js v24+ est install\u00E9 (node --version OK)"],
    ["Bun 1.3+ est install\u00E9 (bun --version OK)"],
    ["VS Code et ses extensions recommand\u00E9es sont install\u00E9s"],
    ["Le projet a \u00E9t\u00E9 r\u00E9cup\u00E9r\u00E9 (zip ou git clone) et ouvert dans VS Code"],
    ["Le fichier .vscode/settings.json est pr\u00E9sent"],
    ["bun install a \u00E9t\u00E9 ex\u00E9cut\u00E9 sans erreur"],
    ["Le fichier .env a \u00E9t\u00E9 cr\u00E9\u00E9 \u00E0 partir de .env.example"],
    ["DATABASE_URL pointe bien vers un chemin SQLite accessible"],
    ["JWT_SECRET a \u00E9t\u00E9 modifi\u00E9 (en pr\u00E9vision de la production)"],
    ["bun run db:generate a g\u00E9n\u00E9r\u00E9 le client Prisma"],
    ["bun run db:push a cr\u00E9\u00E9 les 22 tables dans SQLite"],
    ["bun run dev d\u00E9marre le serveur sur http://localhost:3000"],
    ["La page de connexion s\u2019affiche sans erreur dans le navigateur"],
    ["bun run lint ne retourne aucune erreur bloquante"],
    ["Le fichier prisma/schema.prisma est bien color\u00E9 dans VS Code"],
  ];
  children.push(buildTable(
    ["\u2610", "\u00C9l\u00E9ment \u00E0 v\u00E9rifier"],
    checklistRows.map(item => ["\u2610", item[0]]),
    [8, 92]
  ));

  // =======================================================================
  // CHAPITRE 15 - R\u00E9sum\u00E9 express
  // =======================================================================
  children.push(h1("Chapitre 15 \u2014 R\u00E9sum\u00E9 express (6 commandes)"));
  children.push(p(
    "Si vous \u00EAtes \u00E0 l\u2019aise avec la stack et que vous voulez d\u00E9marrer rapidement, voici les 6 commandes essentielles pour installer et lancer MASOMO \u00E0 partir d\u2019une machine Ubuntu neuve :"
  ));
  children.push(...codeBlock([
    "# 1. Installer Bun (gestionnaire de paquets)",
    "curl -fsSL https://bun.sh/install | bash && source ~/.bashrc",
    "",
    "# 2. Se placer dans le dossier du projet",
    "cd ~/projets/masomo",
    "",
    "# 3. Installer les d\u00E9pendances",
    "bun install",
    "",
    "# 4. Cr\u00E9er le fichier .env",
    "cp .env.example .env",
    "",
    "# 5. G\u00E9n\u00E9rer le client Prisma et cr\u00E9er la base",
    "bun run db:generate && bun run db:push",
    "",
    "# 6. D\u00E9marrer le serveur de d\u00E9veloppement",
    "bun run dev",
  ]));

  children.push(p(
    "Une fois la derni\u00E8re commande ex\u00E9cut\u00E9e, ouvrez votre navigateur \u00E0 l\u2019adresse http://localhost:3000 et connectez-vous avec l\u2019un des comptes de d\u00E9monstration list\u00E9s au chapitre 9. Bon d\u00E9veloppement avec MASOMO !"
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
    title: "MASOMO - Guide d'Installation Detaille",
    description: "Guide d'installation detaille du projet MASOMO (Next.js 16 + Prisma)",
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
  const outputPath = "/home/z/my-project/public/MASOMO_Guide_Installation.docx";
  console.log("[generate-install-guide] Building document...");
  const doc = buildDocument();
  console.log("[generate-install-guide] Packing to buffer...");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  const stat = fs.statSync(outputPath);
  console.log("[generate-install-guide] Wrote: " + outputPath);
  console.log("[generate-install-guide] Size: " + stat.size + " bytes (" + (stat.size / 1024).toFixed(1) + " KB)");
}

main().catch(err => {
  console.error("[generate-install-guide] ERROR:", err);
  process.exit(1);
});
