const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel, PageBreak,
  TableOfContents, BorderStyle, WidthType, ShadingType, NumberFormat,
  Tab, TabStopPosition, TabStopType
} = require("docx");

// ── Palette: Warm Teal (Education) ──
const P = {
  primary: "15857A",
  body: "182030",
  secondary: "506070",
  accent: "15857A",
  surface: "F0EDE5",
  cover: {
    titleColor: "15857A",
    subtitleColor: "606060",
    metaColor: "707070",
    footerColor: "A0A0A0",
  },
  table: {
    headerBg: "15857A",
    headerText: "FFFFFF",
    accentLine: "15857A",
    innerLine: "D5D0C8",
    surface: "F0EDE5",
  },
  bg: "F4F1E9",
};

const c = (hex) => hex.replace("#", "");

// ── Helper functions ──

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: c(P.secondary), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
  });
}

function bodyBold(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: c(P.body), bold: true, font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { line: 276, after: 80 },
    indent: { left: 400 },
    children: [new TextRun({ text, size: 20, color: "2A5A4A", font: { ascii: "Courier New", eastAsia: "Courier New" } })],
  });
}

function bulletItem(text, level = 0) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    indent: { left: 600 + level * 400 },
    children: [
      new TextRun({ text: "\u2022  ", size: 24, color: c(P.accent) }),
      new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

// ── Table builder ──

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        width: { size: Math.round((colWidths[i] / totalWidth) * 100), type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: c(P.table.headerBg) },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: h, bold: true, size: 21, color: c(P.table.headerText), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
        })],
      })
    ),
  });

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        new TableCell({
          width: { size: Math.round((colWidths[ci] / totalWidth) * 100), type: WidthType.PERCENTAGE },
          shading: ri % 2 === 0 ? { type: ShadingType.CLEAR, fill: "FFFFFF" } : { type: ShadingType.CLEAR, fill: c(P.table.surface) },
          margins: { top: 50, bottom: 50, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({ text: String(cell), size: 20, color: c(P.body), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(P.table.accentLine) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.table.accentLine) },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.table.innerLine) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}

// ════════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ════════════════════════════════════════════════════════

const coverChildren = [];

// ── Cover Page (R1 style) ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

coverChildren.push(
  new Table({
    borders: allNoBorders,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        verticalAlign: "top",
        borders: allNoBorders,
        children: [
          new Paragraph({ spacing: { before: 3200 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: "MASOMO", size: 72, bold: true, color: c(P.cover.titleColor), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [new TextRun({ text: "\u2014  Documentation du Code Source  \u2014", size: 28, color: c(P.cover.subtitleColor), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
          // Accent line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            indent: { left: 2500, right: 2500 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent), space: 10 } },
            spacing: { after: 600 },
            children: [],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: "Syst\u00e8me de Gestion Scolaire", size: 26, color: c(P.cover.metaColor), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: "Next.js 16  \u00b7  TypeScript  \u00b7  Prisma ORM  \u00b7  SQLite", size: 22, color: c(P.cover.metaColor), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: "Tailwind CSS 4  \u00b7  Shadcn/UI  \u00b7  Zustand", size: 22, color: c(P.cover.metaColor), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
          new Paragraph({ spacing: { before: 2000 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Version 1.0  \u2014  Mars 2025", size: 20, color: c(P.cover.footerColor), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
        ],
      })],
    })],
  })
);

// ── TOC Section ──
const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 400 },
    children: [new TextRun({ text: "Table des mati\u00e8res", size: 32, bold: true, color: c(P.primary), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  }),
  new TableOfContents("Table des mati\u00e8res", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: "(Cliquez avec le bouton droit sur la table des mati\u00e8res et s\u00e9lectionnez \u00ab Mettre \u00e0 jour les champs \u00bb pour actualiser les num\u00e9ros de page)", size: 18, italics: true, color: "808080" })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ════════════════════════════════════════════════════════
// BODY CONTENT
// ════════════════════════════════════════════════════════

const bodyChildren = [];

// ── Chapter 1: Introduction ──
bodyChildren.push(
  heading1("1. Introduction"),
  body("MASOMO est une application web compl\u00e8te de gestion scolaire con\u00e7ue pour les \u00e9tablissements francophones. D\u00e9velopp\u00e9e avec les technologies web modernes, elle offre une plateforme int\u00e9gr\u00e9e pour la gestion des \u00e9l\u00e8ves, enseignants, classes, notes, pr\u00e9sences, paiements, communications et \u00e9v\u00e9nements scolaires."),
  body("Ce document fournit une description d\u00e9taill\u00e9e de l\u2019architecture, de la structure du code source et des fonctionnalit\u00e9s de chaque composant du syst\u00e8me."),

  heading2("1.1 Stack Technologique"),
  makeTable(
    ["Technologie", "Version", "R\u00f4le"],
    [
      ["Next.js", "16.1.1", "Framework React avec App Router et rendu c\u00f4t\u00e9 serveur"],
      ["TypeScript", "5.x", "Langage de programmation typ\u00e9 statiquement"],
      ["Prisma ORM", "6.x", "ORM pour la base de donn\u00e9es SQLite"],
      ["SQLite", "\u2014", "Base de donn\u00e9es l\u00e9g\u00e8re embarqu\u00e9e"],
      ["Tailwind CSS", "4.x", "Framework CSS utilitaire"],
      ["Shadcn/UI", "New York", "Biblioth\u00e8que de composants React bas\u00e9e sur Radix UI"],
      ["Zustand", "5.x", "Gestion d\u2019\u00e9tat c\u00f4t\u00e9 client avec persistance"],
      ["Framer Motion", "12.x", "Animations et transitions d\u2019interface"],
      ["Recharts", "2.x", "Biblioth\u00e8que de graphiques React"],
      ["jsPDF", "4.x", "G\u00e9n\u00e9ration de documents PDF c\u00f4t\u00e9 client"],
      ["xlsx", "0.18.x", "G\u00e9n\u00e9ration de fichiers Excel (.xlsx)"],
    ],
    [30, 15, 55]
  ),

  heading2("1.2 Architecture G\u00e9n\u00e9rale"),
  body("L\u2019application suit une architecture monolithique bas\u00e9e sur Next.js avec l\u2019App Router. Le frontend et le backend sont dans le m\u00eame projet, les routes API servant de couche backend. L\u2019authentification est g\u00e9r\u00e9e c\u00f4t\u00e9 client via Zustand avec persistance dans le localStorage. La s\u00e9curit\u00e9 des routes API repose sur la lecture du r\u00f4le utilisateur transmis via l\u2019en-t\u00eate HTTP x-user-role."),
  body("L\u2019architecture peut \u00eatre d\u00e9compos\u00e9e en trois couches principales :"),
  bulletItem("Couche Pr\u00e9sentation (Frontend) : Composants React avec Shadcn/UI, animations Framer Motion, gestion d\u2019\u00e9tat Zustand"),
  bulletItem("Couche API (Backend) : Routes API Next.js (App Router) avec protection RBAC par en-t\u00eate HTTP"),
  bulletItem("Couche Donn\u00e9es : Prisma ORM + SQLite avec sch\u00e9ma relationnel complet"),

  heading2("1.3 Structure du Projet"),
  makeTable(
    ["Dossier/Fichier", "Description"],
    [
      ["src/app/page.tsx", "Point d\u2019entr\u00e9e principal \u2014 authentifie ou affiche le shell"],
      ["src/app/layout.tsx", "Layout racine avec polices, th\u00e8me et Toaster"],
      ["src/app/api/", "Routes API (backend) organis\u00e9es par ressource"],
      ["src/app/api/auth/", "Authentification (login, register, me)"],
      ["src/app/api/students/", "CRUD \u00e9l\u00e8ves"],
      ["src/app/api/teachers/", "CRUD enseignants"],
      ["src/app/api/classes/", "CRUD classes"],
      ["src/app/api/grades/", "CRUD notes + export Excel/PDF"],
      ["src/app/api/payments/", "CRUD paiements"],
      ["src/app/api/attendance/", "CRUD pr\u00e9sences + export Excel/PDF"],
      ["src/app/api/schedules/", "CRUD emploi du temps"],
      ["src/app/api/announcements/", "CRUD annonces"],
      ["src/app/api/events/", "CRUD \u00e9v\u00e9nements scolaires"],
      ["src/app/api/bulletins/", "Bulletins scolaires"],
      ["src/app/api/messages/", "Messagerie interne"],
      ["src/app/api/subjects/", "Mati\u00e8res"],
      ["src/app/api/users/", "Gestion des utilisateurs (admin)"],
      ["src/app/api/dashboard/", "Statistiques du tableau de bord"],
      ["src/app/api/seed/", "Initialisation des donn\u00e9es de d\u00e9monstration"],
      ["src/app/api/school-config/", "Configuration de l\u2019\u00e9tablissement"],
      ["src/app/api/uploads/", "Service de fichiers upload\u00e9s"],
      ["src/app/api/download/", "T\u00e9l\u00e9chargement du projet"],
      ["src/components/modules/", "Composants de chaque module fonctionnel"],
      ["src/components/ui/", "Composants Shadcn/UI (40+ composants)"],
      ["src/components/login.tsx", "Page de connexion en deux \u00e9tapes"],
      ["src/components/app-shell.tsx", "Shell principal avec sidebar et header"],
      ["src/lib/", "Utilitaires, types, store, API client, permissions"],
      ["prisma/schema.prisma", "Sch\u00e9ma de la base de donn\u00e9es"],
    ],
    [40, 60]
  ),
);

// ── Chapter 2: Sch\u00e9ma de Base de Donn\u00e9es ──
bodyChildren.push(
  heading1("2. Sch\u00e9ma de Base de Donn\u00e9es"),
  body("La base de donn\u00e9es utilise SQLite via Prisma ORM. Le sch\u00e9ma comporte 13 mod\u00e8les relationnels couvrant l\u2019ensemble des besoins de gestion scolaire. Chaque mod\u00e8le dispose d\u2019un identifiant unique g\u00e9n\u00e9r\u00e9 automatiquement (cuid()), de timestamps de cr\u00e9ation et de mise \u00e0 jour, et de relations d\u00e9finies avec les autres mod\u00e8les."),

  heading2("2.1 Mod\u00e8le User"),
  body("Le mod\u00e8le User est au c\u0153ur du syst\u00e8me d\u2019authentification. Il stocke les informations de connexion et le r\u00f4le de chaque utilisateur. Les r\u00f4les possibles sont : admin, teacher, student et parent. Un utilisateur peut \u00eatre li\u00e9 \u00e0 un \u00e9l\u00e8ve, un enseignant ou un parent via des relations optionnelles. Il peut aussi \u00eatre l\u2019auteur de messages et d\u2019annonces."),
  makeTable(
    ["Champ", "Type", "Description"],
    [
      ["id", "String (cuid)", "Identifiant unique auto-g\u00e9n\u00e9r\u00e9"],
      ["email", "String (unique)", "Adresse email de connexion"],
      ["password", "String", "Mot de passe (stock\u00e9 en clair)"],
      ["name", "String", "Nom complet de l\u2019utilisateur"],
      ["role", "String", "R\u00f4le : admin, teacher, student, parent"],
      ["avatar", "String?", "URL de l\u2019avatar"],
      ["phone", "String?", "Num\u00e9ro de t\u00e9l\u00e9phone"],
      ["active", "Boolean", "Compte actif (d\u00e9faut : true)"],
    ],
    [25, 25, 50]
  ),

  heading2("2.2 Mod\u00e8le Student"),
  body("Le mod\u00e8le Student repr\u00e9sente un \u00e9l\u00e8ve inscrit dans l\u2019\u00e9tablissement. Il est li\u00e9 \u00e0 un User (relation 1:1), optionnellement \u00e0 une Class, et poss\u00e8de des relations vers Grade, Payment, Attendance, Bulletin et StudentEnrollment. Le champ image stocke le chemin vers la photo de l\u2019\u00e9l\u00e8ve."),

  heading2("2.3 Mod\u00e8le Teacher"),
  body("Le mod\u00e8le Teacher repr\u00e9sente un enseignant. Il est li\u00e9 \u00e0 un User (1:1), poss\u00e8de un champ subject pour la mati\u00e8re principale, et des relations vers Schedule et ClassTeacher pour les affectations de classes et l\u2019emploi du temps."),

  heading2("2.4 Mod\u00e8le Class"),
  body("Le mod\u00e8le Class repr\u00e9sente une classe avec un niveau (6\u00e8me, 5\u00e8me, Terminale, etc.), une section optionnelle (A, B, C), une capacit\u00e9 maximale, une ann\u00e9e scolaire et une salle. Il est li\u00e9 aux \u00e9l\u00e8ves, aux enseignants (via ClassTeacher) et aux emplois du temps."),

  heading2("2.5 Autres Mod\u00e8les"),
  makeTable(
    ["Mod\u00e8le", "Description", "Relations cl\u00e9s"],
    [
      ["Grade", "Notes des \u00e9l\u00e8ves", "Student, Subject"],
      ["Payment", "Paiements", "Student"],
      ["Attendance", "Pr\u00e9sences/absences", "Student"],
      ["Bulletin", "Bulletins scolaires", "Student"],
      ["Schedule", "Cr\u00e9neaux horaires", "Class, Teacher"],
      ["Announcement", "Annonces/communications", "User (auteur)"],
      ["SchoolEvent", "\u00c9v\u00e9nements scolaires", "Aucune relation FK"],
      ["Message", "Messages internes", "User (\u00e9metteur, r\u00e9cepteur)"],
      ["Subject", "Mati\u00e8res", "Grade"],
      ["StudentEnrollment", "Inscriptions par ann\u00e9e", "Student, Class"],
      ["ClassTeacher", "Affectation enseignant-classe", "Class, Teacher"],
      ["SchoolConfig", "Configuration \u00e9tablissement", "Aucune relation FK"],
      ["Parent", "Parents d\u2019\u00e9l\u00e8ves", "User"],
    ],
    [25, 40, 35]
  ),

  heading2("2.6 Diagramme Relationnel"),
  body("Les relations principales du sch\u00e9ma sont les suivantes :"),
  bulletItem("User \u2192 Student (1:1) : Un utilisateur de r\u00f4le \u00ab student \u00bb est li\u00e9 \u00e0 un profil \u00e9l\u00e8ve"),
  bulletItem("User \u2192 Teacher (1:1) : Un utilisateur de r\u00f4le \u00ab teacher \u00bb est li\u00e9 \u00e0 un profil enseignant"),
  bulletItem("Student \u2192 Class (N:1) : Un \u00e9l\u00e8ve appartient optionnellement \u00e0 une classe"),
  bulletItem("Student \u2192 Grade (1:N) : Un \u00e9l\u00e8ve a plusieurs notes"),
  bulletItem("Student \u2192 Payment (1:N) : Un \u00e9l\u00e8ve a plusieurs paiements"),
  bulletItem("Student \u2192 Attendance (1:N) : Un \u00e9l\u00e8ve a plusieurs enregistrements de pr\u00e9sence"),
  bulletItem("Class \u2192 ClassTeacher (1:N) \u2192 Teacher : Relation N:N entre classes et enseignants"),
  bulletItem("Class \u2192 Schedule (1:N) : Une classe a plusieurs cr\u00e9neaux d\u2019emploi du temps"),
  bulletItem("User \u2192 Announcement (1:N) : Un utilisateur peut cr\u00e9er plusieurs annonces"),
  bulletItem("User \u2192 Message (1:N envoy\u00e9s + 1:N re\u00e7us) : Syst\u00e8me de messagerie bidirectionnel"),
);

// ── Chapter 3: Couche API (Backend) ──
bodyChildren.push(
  heading1("3. Couche API (Backend)"),
  body("Les routes API constituent le backend de l\u2019application. Elles suivent le mod\u00e8le REST et sont organis\u00e9es dans le dossier src/app/api/ selon la convention de routage de l\u2019App Router de Next.js. Chaque route g\u00e8re les m\u00e9thodes HTTP GET, POST, PUT et DELETE selon les op\u00e9rations CRUD n\u00e9cessaires."),

  heading2("3.1 Authentification"),
  body("Le syst\u00e8me d\u2019authentification fonctionne en deux \u00e9tapes :"),
  bulletItem("\u00c9tape 1 \u2014 V\u00e9rification du mot de passe d\u2019institution : L\u2019utilisateur doit d\u2019abord saisir un mot de passe d\u2019institution (par d\u00e9faut \u00ab masomo2024 \u00bb) qui est v\u00e9rifi\u00e9 contre le mod\u00e8le SchoolConfig. Si aucune configuration n\u2019existe, une configuration par d\u00e9faut est automatiquement cr\u00e9\u00e9e."),
  bulletItem("\u00c9tape 2 \u2014 Connexion utilisateur : L\u2019utilisateur saisit son email et mot de passe. La v\u00e9rification se fait par comparaison directe (les mots de passe sont stock\u00e9s en clair). Si le compte est actif, les informations utilisateur sont retourn\u00e9es sans le mot de passe."),

  heading3("3.1.1 Routes d\u2019authentification"),
  makeTable(
    ["Route", "M\u00e9thode", "Description", "Protection"],
    [
      ["/api/auth/login", "POST", "Connexion avec email + mot de passe + mot de passe institution", "Publique"],
      ["/api/auth/register", "POST", "Inscription d\u2019un nouvel utilisateur", "Publique"],
      ["/api/auth/me", "GET", "R\u00e9cup\u00e9ration du profil utilisateur courant", "Param\u00eatre userId"],
      ["/api/school-config/verify", "POST", "V\u00e9rification du mot de passe d\u2019institution", "Publique"],
    ],
    [30, 12, 40, 18]
  ),

  heading2("3.2 Contr\u00f4le d\u2019Acc\u00e8s (RBAC)"),
  body("La protection des routes API repose sur deux m\u00e9canismes compl\u00e9mentaires :"),
  bulletItem("api-auth.ts : Fournit la fonction checkApiAccess(request, resource) qui lit le r\u00f4le depuis l\u2019en-t\u00eate x-user-role et v\u00e9rifie les permissions d\u2019\u00e9criture selon une matrice pr\u00e9d\u00e9finie. Les requ\u00eates GET sont toujours autoris\u00e9es, les op\u00e9rations d\u2019\u00e9criture n\u00e9cessitent un r\u00f4le autoris\u00e9."),
  bulletItem("permissions.ts : D\u00e9finit un syst\u00e8me de permissions granulaire (students.view, students.create, etc.) avec des fonctions utilitaires hasPermission(), canCreate(), canEdit(), canDelete() et des matrices de visibilit\u00e9 des modules par r\u00f4le."),
  body("Matrice d\u2019acc\u00e8s en \u00e9criture :"),
  makeTable(
    ["Ressource", "Admin", "Enseignant", "\u00c9l\u00e8ve", "Parent"],
    [
      ["\u00c9l\u00e8ves", "\u2713", "\u2717", "\u2717", "\u2717"],
      ["Enseignants", "\u2713", "\u2717", "\u2717", "\u2717"],
      ["Classes", "\u2713", "\u2717", "\u2717", "\u2717"],
      ["Emploi du temps", "\u2713", "\u2713", "\u2717", "\u2717"],
      ["Notes", "\u2713", "\u2713", "\u2717", "\u2717"],
      ["Paiements", "\u2713", "\u2717", "\u2717", "\u2717"],
      ["Annonces", "\u2713", "\u2713", "\u2717", "\u2717"],
      ["Pr\u00e9sences", "\u2713", "\u2713", "\u2717", "\u2717"],
      ["\u00c9v\u00e9nements", "\u2713", "\u2717", "\u2717", "\u2717"],
      ["Mati\u00e8res", "\u2713", "\u2717", "\u2717", "\u2717"],
      ["Seed", "\u2713", "\u2717", "\u2717", "\u2717"],
    ],
    [25, 15, 20, 15, 15]
  ),

  heading2("3.3 Routes API \u2014 D\u00e9tail par Module"),
  heading3("3.3.1 \u00c9l\u00e8ves (/api/students)"),
  body("Le module \u00e9l\u00e8ves offre des op\u00e9rations CRUD compl\u00e8tes avec recherche avanc\u00e9e et pagination. La recherche intelligente permet de filtrer par genre (Masculin/M/F/gar\u00e7on/fille mapp\u00e9s automatiquement), par classe, par ann\u00e9e scolaire. Les enseignants ne voient que les \u00e9l\u00e8ves de leurs classes affect\u00e9es. Les \u00e9l\u00e8ves ne voient que leur propre profil. La cr\u00e9ation g\u00e9n\u00e8re automatiquement un email et mot de passe si non fournis, et cr\u00e9e une inscription (StudentEnrollment) si un classId est sp\u00e9cifi\u00e9."),
  makeTable(
    ["M\u00e9thode", "Route", "Acc\u00e8s", "Fonctionnalit\u00e9s"],
    [
      ["GET", "/api/students", "Tous", "Liste pagin\u00e9e avec recherche, filtre classe/genre/ann\u00e9e"],
      ["POST", "/api/students", "Admin", "Cr\u00e9ation avec User + Student + Enrollment auto"],
      ["GET", "/api/students/[id]", "Tous", "D\u00e9tail avec notes, pr\u00e9sences, classe"],
      ["PUT", "/api/students/[id]", "Admin", "Mise \u00e0 jour avec upsert Enrollment"],
      ["DELETE", "/api/students/[id]", "Admin", "Suppression en cascade (notes, paiements, etc.)"],
    ],
    [12, 25, 15, 48]
  ),

  heading3("3.3.2 Enseignants (/api/teachers)"),
  body("CRUD complet pour les enseignants. La recherche s\u2019effectue sur le nom, pr\u00e9nom, mati\u00e8re, t\u00e9l\u00e9phone, qualification et email. La cr\u00e9ation g\u00e9n\u00e8re automatiquement les identifiants de connexion. La suppression nettoie les affectations ClassTeacher et nullifie les r\u00e9f\u00e9rences dans les Schedule."),

  heading3("3.3.3 Classes (/api/classes)"),
  body("Gestion des classes avec affectation multiple d\u2019enseignants. Chaque classe a un niveau, une section optionnelle, une capacit\u00e9 et une salle. La cr\u00e9ation supporte un tableau de teacherIds avec mati\u00e8res pour affecter plusieurs enseignants d\u2019un coup. La mise \u00e0 jour remplace toutes les affectations enseignants. La suppression en cascade retire les Schedule, les ClassTeacher, et d\u00e9lie les \u00e9l\u00e8ves."),

  heading3("3.3.4 Notes (/api/grades)"),
  body("Gestion des notes avec filtrage multi-crit\u00e8res (classe, mati\u00e8re, trimestre, type, ann\u00e9e scolaire). Le syst\u00e8me de notes est sur 20 (maxValue par d\u00e9faut). Les types de notes sont : devoir, examen, controle. L\u2019export Excel et PDF est disponible via des routes d\u00e9di\u00e9es qui calculent la moyenne g\u00e9n\u00e9rale et le taux de r\u00e9ussite. Le filtrage par r\u00f4le est appliqu\u00e9 : les enseignants ne voient que les notes de leurs classes, les \u00e9l\u00e8ves ne voient que leurs propres notes."),

  heading3("3.3.5 Paiements (/api/payments)"),
  body("CRUD complet pour les paiements. Chaque paiement est li\u00e9 \u00e0 un \u00e9l\u00e8ve et poss\u00e8de un montant, un type (tuition, registration, exam_fee, other), une m\u00e9thode de paiement (cash, mobile_money, bank_transfer), un statut (pending, completed, failed), une r\u00e9f\u00e9rence optionnelle, une description et une date. La modification et la suppression sont r\u00e9serv\u00e9es \u00e0 l\u2019admin. La validation des valeurs de method, status et type est effectu\u00e9e c\u00f4t\u00e9 serveur."),

  heading3("3.3.6 Pr\u00e9sences (/api/attendance)"),
  body("Gestion des pr\u00e9sences avec support de cr\u00e9ation par lot (batch). Le syst\u00e8me impl\u00e9mente un comportement upsert : si un enregistrement existe d\u00e9j\u00e0 pour un \u00e9l\u00e8ve \u00e0 une date donn\u00e9e, il est mis \u00e0 jour. La suppression supporte trois modes : par id, par date + liste d\u2019\u00e9l\u00e8ves, ou par date seule. L\u2019export Excel g\u00e9n\u00e8re deux feuilles (donn\u00e9es + r\u00e9sum\u00e9) et l\u2019export PDF regroupe les enregistrements par date avec couleurs par statut."),

  heading3("3.3.7 Emploi du Temps (/api/schedules)"),
  body("Gestion des cr\u00e9neaux d\u2019emploi du temps. Chaque cr\u00e9neau est li\u00e9 \u00e0 une classe, optionnellement \u00e0 un enseignant, avec un jour de la semaine (1=Lundi \u00e0 5=Vendredi), une heure de d\u00e9but et de fin, et une salle optionnelle. Les cr\u00e9neaux sont retourn\u00e9s tri\u00e9s par jour puis par heure. L\u2019acc\u00e8s en \u00e9criture est r\u00e9serv\u00e9 \u00e0 l\u2019admin."),

  heading3("3.3.8 Annonces (/api/announcements)"),
  body("CRUD pour les annonces/communications. Chaque annonce a un titre, un contenu, un type (general, urgent, academic, event), une cible (all, teachers, students, parents), une priorit\u00e9 num\u00e9rique, et une date pour l\u2019affichage dans le calendrier. La modification et la suppression sont r\u00e9serv\u00e9es \u00e0 l\u2019admin. Les annonces sont automatiquement int\u00e9gr\u00e9es dans le calendrier des \u00e9v\u00e9nements."),

  heading3("3.3.9 \u00c9v\u00e9nements (/api/events)"),
  body("CRUD pour les \u00e9v\u00e9nements scolaires. Les types support\u00e9s sont : holiday, exam, meeting, celebration, deadline, other. Les \u00e9v\u00e9nements peuvent s\u2019\u00e9tendre sur plusieurs jours via le champ endDate. Toutes les op\u00e9rations d\u2019\u00e9criture sont r\u00e9serv\u00e9es \u00e0 l\u2019admin."),

  heading3("3.3.10 Bulletins (/api/bulletins)"),
  body("G\u00e9n\u00e9ration de bulletins scolaires. Le serveur calcule la moyenne pond\u00e9r\u00e9e (note/20 * coefficient, somme divis\u00e9e par le total des coefficients), le rang parmi les camarades de classe, et une appr\u00e9ciation automatique (Tr\u00e8s bien \u226516, Bien \u226514, Assez bien \u226512, Passable \u226510, Insuffisant <10)."),

  heading3("3.3.11 Autres Routes"),
  makeTable(
    ["Route", "M\u00e9thodes", "Description"],
    [
      ["/api/messages", "GET, POST", "Messagerie interne entre utilisateurs"],
      ["/api/subjects", "GET, POST", "Gestion des mati\u00e8res avec coefficient"],
      ["/api/users", "GET", "Liste des utilisateurs (admin uniquement)"],
      ["/api/dashboard", "GET", "Statistiques agr\u00e9g\u00e9es du tableau de bord"],
      ["/api/seed", "POST", "Initialisation des donn\u00e9es de d\u00e9monstration"],
      ["/api/school-config", "GET, PUT", "Configuration de l\u2019\u00e9tablissement (admin pour PUT)"],
      ["/api/uploads/[...path]", "GET", "Service de fichiers statiques avec protection travers\u00e9e"],
      ["/api/download", "GET", "T\u00e9l\u00e9chargement de l\u2019archive du projet"],
    ],
    [30, 18, 52]
  ),
);

// ── Chapter 4: Couche Frontend ──
bodyChildren.push(
  heading1("4. Couche Frontend (Composants)"),
  body("L\u2019interface utilisateur est construite avec React 19, Shadcn/UI et Tailwind CSS 4. Chaque module fonctionnel est un composant React autonome dans src/components/modules/. L\u2019ensemble est orchestr\u00e9 par le composant AppShell qui g\u00e8re la navigation par sidebar, le header et le rendu conditionnel des modules."),

  heading2("4.1 Page Principale (page.tsx)"),
  body("Le fichier page.tsx est le point d\u2019entr\u00e9e unique de l\u2019application. Il utilise le store Zustand pour d\u00e9terminer si l\u2019utilisateur est authentifi\u00e9 : si oui, il affiche le composant AppShell (shell principal), sinon le composant Login. Les composants sont charg\u00e9s dynamiquement via import() pour optimiser le chargement initial. Un \u00e9cran de chargement anim\u00e9 avec le logo MASOMO est affich\u00e9 pendant le chargement asynchrone des composants."),

  heading2("4.2 Authentification (login.tsx)"),
  body("Le composant Login impl\u00e9mente un processus d\u2019authentification en deux \u00e9tapes avec une interface anim\u00e9e par Framer Motion :"),
  bulletItem("\u00c9tape 1 \u2014 Mot de passe d\u2019institution : V\u00e9rification du mot de passe de l\u2019\u00e9tablissement via l\u2019API /api/school-config/verify. Un indicateur visuel montre la progression."),
  bulletItem("\u00c9tape 2 \u2014 Identifiants utilisateur : Saisie de l\u2019email et du mot de passe avec bouton de visibilit\u00e9 du mot de passe. Retour possible \u00e0 l\u2019\u00e9tape 1."),
  body("Le composant d\u00e9tecte automatiquement si la base de donn\u00e9es est vide et propose un bouton d\u2019initialisation des donn\u00e9es de d\u00e9monstration. Les identifiants de d\u00e9monstration sont affich\u00e9s en bas du formulaire avec des boutons de remplissage automatique."),

  heading2("4.3 Shell Principal (app-shell.tsx)"),
  body("AppShell est le composant racine de l\u2019application connect\u00e9e. Il fournit :"),
  bulletItem("Sidebar de navigation desktop : Rétractable (collapsed/expanded) avec 12 items de navigation, ic\u00f4nes Lucide, tooltips, et indicateur de module actif"),
  bulletItem("Sidebar mobile : Via Sheet (tiroir) avec les m\u00eames items de navigation"),
  bulletItem("Header sticky : Titre du module actif, s\u00e9lecteur d\u2019ann\u00e9e scolaire, bascule th\u00e8me clair/sombre, notifications, menu utilisateur d\u00e9roulant"),
  bulletItem("Banni\u00e8re hors-ligne : D\u00e9tection du statut r\u00e9seau avec animation d\u2019entr\u00e9e/sortie"),
  bulletItem("Pied de page : Copyright MASOMO"),
  bulletItem("Animations de transition : Framer Motion AnimatePresence sur les changements de module"),
  body("Le rendu du module actif se fait via un switch sur activeModule qui charge le composant correspondant de mani\u00e8re conditionnelle."),

  heading2("4.4 Module Tableau de Bord (dashboard.tsx)"),
  body("Le tableau de bord affiche une vue d\u2019ensemble de l\u2019\u00e9tablissement avec :"),
  bulletItem("4 cartes KPI : Total \u00e9l\u00e8ves, enseignants, classes, revenus"),
  bulletItem("Pr\u00e9sence du jour : Nombre de pr\u00e9sents, absents, en retard"),
  bulletItem("Graphique \u00e0 barres : \u00c9l\u00e8ves par classe avec jauge de capacit\u00e9"),
  bulletItem("Graphique camembert : R\u00e9partition par genre"),
  bulletItem("Graphique horizontal : Tendances d\u2019inscription par ann\u00e9e scolaire"),
  bulletItem("R\u00e9partition des m\u00e9thodes de paiement"),
  bulletItem("Activit\u00e9s r\u00e9centes : Derniers paiements, annonces et notes"),
  bulletItem("Inscriptions r\u00e9centes : Tableau pagin\u00e9 des 20 derni\u00e8res inscriptions"),

  heading2("4.5 Module \u00c9l\u00e8ves (students.tsx)"),
  body("Module CRUD complet avec : recherche pagin\u00e9e, filtre par classe/genre, dialogue d\u2019ajout/\u00e9dition avec upload de photo (ImageDropZone), dialogue de d\u00e9tail, confirmation de suppression, export Excel/PDF/Impression. L\u2019acc\u00e8s en \u00e9criture est r\u00e9serv\u00e9 \u00e0 l\u2019admin. L\u2019affichage s\u2019adapte en table (desktop) ou cartes (mobile)."),

  heading2("4.6 Module Enseignants (teachers.tsx)"),
  body("CRUD complet similaire au module \u00e9l\u00e8ves. Le dialogue de d\u00e9tail affiche les classes affect\u00e9es sous forme de badges et l\u2019emploi du temps group\u00e9 par jour. Export Excel/PDF/Impression disponible."),

  heading2("4.7 Module Classes (classes.tsx)"),
  body("Affichage en grille de cartes avec jauge de capacit\u00e9 (barre de progression). Le formulaire d\u2019ajout/\u00e9dition inclut l\u2019affectation d\u2019enseignants avec mati\u00e8re. Le dialogue de d\u00e9tail utilise des onglets : \u00c9l\u00e8ves, Enseignants, Emploi du temps."),

  heading2("4.8 Module Emploi du Temps (schedule.tsx)"),
  body("Grille hebdomadaire CSS Grid avec cr\u00e9neaux de 07h00 \u00e0 19h00 sur 5 jours. La vue mobile utilise des onglets par jour. Les cr\u00e9neaux occupent automatiquement plusieurs lignes selon la dur\u00e9e. L\u2019admin peut ajouter/\u00e9diter/supprimer des cr\u00e9neaux en cliquant sur les cellules."),

  heading2("4.9 Module Notes (grades.tsx)"),
  body("Gestion des notes avec 5 filtres (classe, mati\u00e8re, trimestre, type, recherche), statistiques (moyenne, taux de r\u00e9ussite, distribution), tableau pagin\u00e9, dialogue d\u2019ajout/\u00e9dition avec recherche d\u2019\u00e9l\u00e8ve et affichage automatique de la classe. Export PDF/Excel via routes d\u00e9di\u00e9es. L\u2019admin et les enseignants peuvent g\u00e9rer les notes."),

  heading2("4.10 Module Bulletins (bulletins.tsx)"),
  body("G\u00e9n\u00e9ration et visualisation de bulletins scolaires par \u00e9l\u00e8ve et trimestre. Le dialogue de d\u00e9tail affiche les notes group\u00e9es par mati\u00e8re avec moyennes, le rang, l\u2019appr\u00e9ciation, et des zones de signature. Fonctionnalit\u00e9 d\u2019impression avec CSS d\u00e9di\u00e9."),

  heading2("4.11 Module Pr\u00e9sences (attendance.tsx)"),
  body("Deux vues : Liste (group\u00e9e par date+classe avec badges de statistiques cliquables) et Cr\u00e9ation/\u00c9dition (formulaire par classe/date avec marquage en lot). Recherche dans la liste avec filtrage par statut cliquable. Bouton de r\u00e9initialisation des filtres. Export PDF/Excel/Impression."),

  heading2("4.12 Module Paiements (payments.tsx)"),
  body("Gestion des paiements avec statistiques, filtres, pagination, ajout/\u00e9dition/suppression, impression de re\u00e7u sur imprimante thermique (58mm/80mm), export re\u00e7u Excel/PDF, simulation Mobile Money. L\u2019admin peut modifier et supprimer les paiements. Les paiements en esp\u00e8ces sont automatiquement compl\u00e9t\u00e9s ; les Mobile Money restent en attente."),

  heading2("4.13 Module Calendrier (school-calendar.tsx)"),
  body("Calendrier interactif avec vue mois (grille) et vue agenda annuelle. Les \u00e9v\u00e9nements et annonces sont combin\u00e9s en une seule vue. L\u00e9gende des types, r\u00e9sum\u00e9 mensuel, graphique par type, \u00e9v\u00e9nements \u00e0 venir. Les annonces ne peuvent pas \u00eatre \u00e9dit\u00e9es depuis le calendrier. L\u2019admin peut ajouter/\u00e9diter/supprimer des \u00e9v\u00e9nements."),

  heading2("4.14 Module Communication (communication.tsx)"),
  body("Deux onglets : Annonces (CRUD avec type, cible, date) et Messages (chat avec liste de conversations, compteur de non-lus, r\u00e9ponse rapide via touche Entr\u00e9e, nouveau message). L\u2019admin peut cr\u00e9er/\u00e9diter/supprimer les annonces. La messagerie est disponible pour tous les utilisateurs connect\u00e9s."),

  heading2("4.15 Module Param\u00e8tres (settings.tsx)"),
  body("Sections : Profil (admin), Configuration \u00e9tablissement (admin), Th\u00e8me (tous), Gestion des donn\u00e9es (admin : initialisation BD, t\u00e9l\u00e9chargement projet), Utilisateurs enregistr\u00e9s (admin), \u00c0 propos (admin). Le th\u00e8me utilise next-themes avec trois modes : clair, sombre, syst\u00e8me."),
);

// ── Chapter 5: Biblioth\u00e8ques et Utilitaires ──
bodyChildren.push(
  heading1("5. Biblioth\u00e8ques et Utilitaires"),

  heading2("5.1 Gestion d\u2019\u00c9tat (store.ts)"),
  body("Le store Zustand avec middleware persist g\u00e8re l\u2019\u00e9tat global de l\u2019application. La cl\u00e9 de persistance est \u00ab masomo-storage \u00bb. Seuls l\u2019authentification, le module actif, l\u2019\u00e9tat de la sidebar et l\u2019ann\u00e9e scolaire sont persist\u00e9s. Les toasts sont g\u00e9r\u00e9s en m\u00e9moire avec suppression automatique apr\u00e8s 5 secondes."),
  makeTable(
    ["Propri\u00e9t\u00e9", "Type", "Description"],
    [
      ["activeModule", "ModuleKey", "Module actuellement affich\u00e9 (dashboard, students, etc.)"],
      ["currentUser", "User | null", "Utilisateur connect\u00e9 (persist\u00e9)"],
      ["isAuthenticated", "boolean", "\u00c9tat de connexion (persist\u00e9)"],
      ["schoolYear", "string", "Ann\u00e9e scolaire s\u00e9lectionn\u00e9e (persist\u00e9)"],
      ["sidebarOpen", "boolean", "\u00c9tat d\u2019ouverture de la sidebar (persist\u00e9)"],
      ["toasts", "ToastMessage[]", "Notifications temporaires (non persist\u00e9es)"],
    ],
    [25, 25, 50]
  ),

  heading2("5.2 Client API (api.ts)"),
  body("Le client API typ\u00e9 fournit des m\u00e9thodes pour chaque ressource de l\u2019application. Il utilise fetch avec URLs relatives pour la compatibilit\u00e9 avec la passerelle Caddy. La fonction apiFetch centralise la gestion des erreurs (ApiError avec status HTTP). La fonction buildQuery construit les param\u00e8tres de requ\u00eate en excluant les valeurs undefined/null/vide."),
  body("APIs disponibles : authApi, studentsApi, teachersApi, classesApi, gradesApi, schedulesApi, paymentsApi, bulletinsApi, announcementsApi, messagesApi, attendanceApi, subjectsApi, dashboardApi, seedApi."),

  heading2("5.3 Syst\u00e8me de Permissions (permissions.ts)"),
  body("D\u00e9finit 40+ permissions granulaires organis\u00e9es par module et action (view, create, edit, delete). La matrice ROLE_PERMISSIONS d\u00e9finit les permissions de chaque r\u00f4le. Le syst\u00e8me MODULE_VISIBILITY contr\u00f4le quels modules sont visibles par r\u00f4le. Les fonctions utilitaires canCreate(), canEdit(), canDelete() et canView() simplifient les v\u00e9rifications dans les composants."),

  heading2("5.4 Types TypeScript (types.ts)"),
  body("D\u00e9finit plus de 50 interfaces et types couvrant tous les mod\u00e8les de donn\u00e9es, les requ\u00eates/r\u00e9ponses API, les statistiques du dashboard et les types d\u2019utilitaires. Les types principaux incluent : UserRole, PaymentType, PaymentMethod, PaymentStatus, AttendanceStatus, GradeType, Trimester, AnnouncementType, AnnouncementTarget, ModuleKey. Chaque interface de mod\u00e8le inclut les relations optionnelles (User?, Class?, Grade[], etc.)."),

  heading2("5.5 Constantes (constants.ts)"),
  body("Centralise toutes les constantes de l\u2019application en fran\u00e7ais : navigation (NAV_ITEMS avec 12 items), r\u00f4les (ROLES), types de notes (GRADE_TYPES), types/m\u00e9thodes/statuts de paiement (PAYMENT_TYPES/METHODS/STATUSES), statuts de pr\u00e9sence (ATTENDANCE_STATUSES), jours de la semaine (DAYS_OF_WEEK), trimestres (TRIMESTERS), niveaux de classe (CLASS_LEVELS du CP \u00e0 Terminale), types/cibles d\u2019annonces (ANNOUNCEMENT_TYPES/TARGETS), cr\u00e9neaux horaires (TIME_SLOTS de 07h00 \u00e0 19h30), ann\u00e9es scolaires, et options de genre."),

  heading2("5.6 Traitement d\u2019Images (image-processing.ts)"),
  body("Module de traitement d\u2019images c\u00f4t\u00e9 client pour les photos d\u2019\u00e9l\u00e8ves et d\u2019enseignants. Il impl\u00e9mente : recadrage automatique au carr\u00e9 centr\u00e9 (biais vers le haut pour les visages), redimensionnement \u00e0 400x400, filtre de netteté (masque flou/unsharp mask avec noyau de convolution 3x3), ajustement automatique de la luminosit\u00e9 et du contraste (analyse de l\u2019histogramme et \u00e9tirement), compression JPEG \u00e0 88% de qualit\u00e9, et analyse de qualit\u00e9 (score 0-100 bas\u00e9 sur le contraste, la luminosit\u00e9 et la taille)."),

  heading2("5.7 Zone de D\u00e9p\u00f4t d\u2019Images (image-dropzone.tsx)"),
  body("Composant r\u00e9utilisable pour l\u2019upload de photos avec drag-and-drop, aper\u00e7u en temps r\u00e9el, traitement automatique (redimensionnement + netteté + contraste), upload vers le serveur, et suppression. Supporte JPG, PNG, WebP, GIF avec une taille maximale de 5 Mo. Indicateur visuel de l\u2019am\u00e9lioration automatique des images floues."),

  heading2("5.8 Pagination (data-pagination.tsx)"),
  body("Composant de pagination r\u00e9utilisable qui affiche \u00ab Affichage X \u00e0 Y sur Z \u00bb et des contr\u00f4les de page avec ellipsis. Se masque automatiquement si tous les \u00e9l\u00e9ments tiennent sur une seule page. Affiche un maximum de 5 num\u00e9ros de page visibles avec ellipsis pour les grandes paginations."),

  heading2("5.9 Hooks Personnalis\u00e9s"),
  bulletItem("use-mobile.ts : D\u00e9tecte si la fen\u00eatre est de taille mobile (< 768px) via window.matchMedia avec \u00e9couteur d\u2019\u00e9v\u00e9nements."),
  bulletItem("use-offline.ts : Suit le statut en ligne/hors ligne via useSyncExternalStore. D\u00e9tecte les transitions offline\u2192online avec un indicateur wasOffline qui s\u2019efface apr\u00e8s 5 secondes."),
  bulletItem("use-toast.ts : Syst\u00e8me de toasts avec \u00e9tat en m\u00e9moire (pas de contexte React). Limite d\u2019un toast \u00e0 la fois, suppression automatique apr\u00e8s 1 000 000 ms."),
);

// ── Chapter 6: Configuration et D\u00e9ploiement ──
bodyChildren.push(
  heading1("6. Configuration et D\u00e9ploiement"),

  heading2("6.1 Configuration Next.js (next.config.ts)"),
  body("La configuration Next.js est minimale avec trois options : ignoreBuildErrors pour TypeScript (permet la compilation m\u00eame avec des erreurs de type), reactStrictMode d\u00e9sactiv\u00e9, et output en mode \u00ab standalone \u00bb pour le d\u00e9ploiement en production autonome (g\u00e9n\u00e8re un serveur Node.js ind\u00e9pendant dans .next/standalone/)."),

  heading2("6.2 Sch\u00e9ma Prisma (prisma/schema.prisma)"),
  body("Le sch\u00e9ma Prisma d\u00e9finit 13 mod\u00e8les avec le provider SQLite. Les relations utilisent onDelete: Cascade pour les suppressions en cascade. Le client Prisma est instanci\u00e9 en singleton via le pattern globalForPrisma pour \u00e9viter les connexions multiples en d\u00e9veloppement. Les commandes disponibles : db:push (appliquer le sch\u00e9ma), db:generate (g\u00e9n\u00e9rer le client), db:migrate (migrations), db:reset (r\u00e9initialiser)."),

  heading2("6.3 Styles Globaux (globals.css)"),
  body("Utilise Tailwind CSS 4 avec la syntaxe @import et @theme inline. Le syst\u00e8me de th\u00e8me d\u00e9finit des variables CSS personnalis\u00e9es en oklch pour les modes clair et sombre. La palette principale est \u00e9meraude/teal. Les barres de d\u00e9filement personnalis\u00e9es sont stylis\u00e9es avec la classe scrollbar-thin. Les variables couvrent : background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart, et sidebar."),

  heading2("6.4 Donn\u00e9es de D\u00e9monstration (seed)"),
  body("Le script de seed cr\u00e9e un jeu de donn\u00e9es complet : 1 admin, 5 enseignants, 6 mati\u00e8res, 4 classes, 20 \u00e9l\u00e8ves, des notes (2-3 par \u00e9l\u00e8ve par mati\u00e8re), des emplois du temps, des paiements, des pr\u00e9sences, 6 annonces et 4 messages. Le processus supprime d\u2019abord toutes les donn\u00e9es existantes dans l\u2019ordre correct des cl\u00e9s \u00e9trang\u00e8res. Identifiants : admin@ecole.com/admin123, enseignants : prenom.nom@ecole.com/teacher123, \u00e9l\u00e8ves : prenom.nom@ecole.com/student123."),

  heading2("6.5 D\u00e9ploiement Production"),
  body("Le d\u00e9ploiement suit le pattern standalone de Next.js :"),
  bulletItem("\u00c9tape 1 : next build \u2014 Compilation de l\u2019application"),
  bulletItem("\u00c9tape 2 : cp -r .next/static .next/standalone/.next/static \u2014 Copie des fichiers statiques"),
  bulletItem("\u00c9tape 3 : cp -r public .next/standalone/public \u2014 Copie des assets publics"),
  bulletItem("\u00c9tape 4 : NODE_ENV=production node .next/standalone/server.js \u2014 D\u00e9marrage du serveur"),
  body("L\u2019application est servie sur le port 3000. Une passerelle Caddy (port 81) g\u00e8re le routage externe avec support pour les requ\u00eates multi-ports via le param\u00e8tre XTransformPort."),
);

// ── Chapter 7: Composants Shadcn/UI ──
bodyChildren.push(
  heading1("7. Composants Shadcn/UI"),
  body("L\u2019application utilise plus de 40 composants de la biblioth\u00e8que Shadcn/UI (style New York) bas\u00e9s sur Radix UI. Ces composants fournissent une interface coh\u00e9rente, accessible et personnalisable."),
  makeTable(
    ["Composant", "Utilisation principale"],
    [
      ["Button", "Actions principales, secondaires, ic\u00f4nes"],
      ["Dialog", "Formulaires modaux (ajout, \u00e9dition, d\u00e9tail)"],
      ["AlertDialog", "Confirmations de suppression"],
      ["Table", "Affichage de donn\u00e9es tabulaires"],
      ["Card", "Conteneurs d\u2019information, statistiques"],
      ["Input / Textarea", "Saisie de texte"],
      ["Select", "Menus d\u00e9roulants (filtres, formulaires)"],
      ["Badge", "\u00c9tiquettes de statut, types, r\u00f4les"],
      ["Tabs", "Onglets de navigation dans les d\u00e9tails"],
      ["Sheet", "Sidebar mobile (tiroir)"],
      ["Avatar", "Photos de profil, initiales"],
      ["Calendar + Popover", "S\u00e9lecteurs de date"],
      ["ScrollArea", "Zones de d\u00e9filement personnalis\u00e9es"],
      ["Separator", "Lignes de s\u00e9paration"],
      ["Skeleton", "\u00c9tats de chargement"],
      ["Progress", "Jauges de capacit\u00e9"],
      ["DropdownMenu", "Menus contextuels, export, actions utilisateur"],
      ["Tooltip", "Info-bulles sur la sidebar r\u00e9tract\u00e9e"],
      ["Pagination", "Navigation entre les pages de donn\u00e9es"],
      ["Sonner/Toast", "Notifications de succ\u00e8s/erreur"],
    ],
    [30, 70]
  ),
);

// ── Chapter 8: Consid\u00e9rations de S\u00e9curit\u00e9 ──
bodyChildren.push(
  heading1("8. Consid\u00e9rations de S\u00e9curit\u00e9"),
  body("Cette section documente les points de s\u00e9curit\u00e9 identifi\u00e9s dans le code source, class\u00e9s par niveau de criticit\u00e9."),

  heading2("8.1 Points Critiques"),
  bulletItem("Mots de passe en clair : Les mots de passe sont stock\u00e9s et compar\u00e9s sans hachage (pas de bcrypt/argon2). Un acc\u00e8s \u00e0 la base de donn\u00e9es expose tous les mots de passe."),
  bulletItem("Pas de session/JWT : L\u2019authentification repose sur le store client Zustand. Le r\u00f4le utilisateur est transmis via l\u2019en-t\u00eate x-user-role, facilement falsifiable."),
  bulletItem("Endpoint seed non prot\u00e9g\u00e9 : N\u2019importe qui peut appeler POST /api/seed pour effacer et r\u00e9initialiser toute la base de donn\u00e9es."),
  bulletItem("Endpoint download non prot\u00e9g\u00e9 : Le code source du projet est t\u00e9l\u00e9chargeable sans authentification."),

  heading2("8.2 Points Importants"),
  bulletItem("Plusieurs routes POST sans RBAC : Les cr\u00e9ations de notes, pr\u00e9sences, mati\u00e8res, bulletins et messages ne v\u00e9rifient pas le r\u00f4le de l\u2019appelant."),
  bulletItem("Module pr\u00e9sences sans aucun contr\u00f4le d\u2019acc\u00e8s : Toutes les op\u00e9rations CRUD sont accessibles sans v\u00e9rification de r\u00f4le."),
  bulletItem("Statistiques du dashboard publiques : L\u2019endpoint /api/dashboard ne n\u00e9cessite pas d\u2019authentification."),
  bulletItem("Mot de passe d\u2019institution par d\u00e9faut : \u00ab masomo2024 \u00bb est cod\u00e9 en dur et cr\u00e9\u00e9 automatiquement si absent."),

  heading2("8.3 Recommandations"),
  bulletItem("Impl\u00e9menter le hachage des mots de passe avec bcrypt ou argon2"),
  bulletItem("Ajouter un syst\u00e8me de session JWT avec tokens d\u2019acc\u00e8s et de rafra\u00eechissement"),
  bulletItem("Prot\u00e9ger toutes les routes d\u2019\u00e9criture avec v\u00e9rification de r\u00f4le c\u00f4t\u00e9 serveur"),
  bulletItem("Prot\u00e9ger l\u2019endpoint seed et download avec une authentification admin"),
  bulletItem("Ajouter un rate limiting sur les endpoints sensibles"),
  bulletItem("Forcer le changement du mot de passe d\u2019institution lors de la premi\u00e8re configuration"),
);

// ════════════════════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ════════════════════════════════════════════════════════

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
          size: 24,
          color: c(P.body),
        },
        paragraph: {
          spacing: { line: 312 },
        },
      },
      heading1: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 32,
          bold: true,
          color: c(P.primary),
        },
      },
      heading2: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 28,
          bold: true,
          color: c(P.primary),
        },
      },
      heading3: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
          size: 26,
          bold: true,
          color: c(P.secondary),
        },
      },
    },
  },
  sections: [
    // Section 1: Cover (no page numbers)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: coverChildren,
    },
    // Section 2: TOC (Roman numerals)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })],
            }),
          ],
        }),
      },
      children: tocChildren,
    },
    // Section 3: Body (Arabic numerals)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: "MASOMO \u2014 Documentation du Code Source", size: 16, italics: true, color: c(P.secondary) })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "\u00a9 2025 MASOMO  \u2014  ", size: 16, color: c(P.secondary) }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) }),
              ],
            }),
          ],
        }),
      },
      children: bodyChildren,
    },
  ],
});

// ── Generate ──
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/MASOMO_Documentation_Code_Source.docx", buf);
  console.log("Document generated: MASOMO_Documentation_Code_Source.docx");
});
