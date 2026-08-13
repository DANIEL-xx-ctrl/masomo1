// Génération du document Word - Documentation Code Source MASOMO/EduGest
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, TableLayoutType, WidthType,
  BorderStyle, ShadingType, SectionType, TableOfContents,
  LevelFormat, convertInchesToTwip, NumberFormat,
} = require("docx");
const fs = require("fs");

// ============================================================
// PALETTE — Mint Dawn (Education / Green)
// ============================================================
const P = {
  primary: "#1A3A3A",
  body: "#000000",
  secondary: "#507070",
  accent: "#3CB4A0",
  surface: "#F0FFFE",
  bg: "#0F2A2A",
  titleColor: "#FFFFFF",
  subtitleColor: "#A8E6D8",
  metaColor: "#C8E6E0",
  footerColor: "#7AAFA5",
};
const c = (hex) => hex.replace("#", "");

// ============================================================
// HELPERS
// ============================================================
const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};
const noCellBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

// Heading 1
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240, line: 360 },
    children: [new TextRun({
      text, bold: true, size: 36, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180, line: 340 },
    children: [new TextRun({
      text, bold: true, size: 30, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 140, line: 320 },
    children: [new TextRun({
      text, bold: true, size: 26, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 420 },
    spacing: { line: 312, after: 100 },
    children: [new TextRun({
      text, size: 22, color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({
      text, size: 22, color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}
function code(text) {
  return new Paragraph({
    spacing: { line: 280, before: 80, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: "F4F8F8" },
    indent: { left: 200, right: 200 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: c(P.accent), space: 6 },
    },
    children: [new TextRun({
      text, size: 18, color: "1A3A3A",
      font: { ascii: "Consolas", eastAsia: "Consolas" },
    })],
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 240 },
    children: [new TextRun({
      text, size: 18, italics: true, color: c(P.secondary),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

// Table builder
function makeTable(headers, rows, columnWidths) {
  const totalWidth = 9000;
  const widths = columnWidths || headers.map(() => Math.floor(totalWidth / headers.length));

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: c(P.accent) },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 280 },
        children: [new TextRun({
          text: h, bold: true, size: 20, color: "FFFFFF",
          font: { ascii: "Calibri", eastAsia: "SimHei" },
        })],
      })],
    })),
  });

  const dataRows = rows.map((row, idx) => new TableRow({
    cantSplit: true,
    children: row.map((cell, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? "FFFFFF" : c(P.surface) },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        spacing: { line: 280 },
        children: [new TextRun({
          text: String(cell ?? ""), size: 20, color: c(P.body),
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
        })],
      })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent) },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent) },
      left: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent) },
      right: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent) },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "BFE0DA" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "BFE0DA" },
    },
    rows: [headerRow, ...dataRows],
  });
}

// ============================================================
// COVER PAGE (Recipe R1 — Pure Paragraph Left)
// ============================================================
function buildCover() {
  const padL = 1200, padR = 800;
  const children = [];

  // Top whitespace
  children.push(new Paragraph({ spacing: { before: 3200 } }));

  // English label with accent bottom border
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent), space: 8 } },
    children: [new TextRun({
      text: "D O C U M E N T   T E C H N I Q U E",
      size: 18, color: c(P.accent),
      font: { ascii: "Calibri" }, characterSpacing: 40,
    })],
  }));

  // Main title — 2 lines
  const titleLines = ["Documentation", "du Code Source"];
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: {
        after: i < titleLines.length - 1 ? 100 : 300,
        line: 920, lineRule: "atLeast",
      },
      children: [new TextRun({
        text: titleLines[i], size: 80, bold: true,
        color: c(P.titleColor),
        font: { ascii: "Arial", eastAsia: "SimHei" },
      })],
    }));
  }

  // Subtitle
  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 800 },
    children: [new TextRun({
      text: "Application MASOMO / EduGest — Gestion Scolaire",
      size: 28, color: c(P.subtitleColor),
      font: { ascii: "Calibri" },
    })],
  }));

  // Meta info lines with left accent border
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(P.accent), space: 12 };
  const metaLines = [
    "Type : Documentation technique complète",
    "Stack : Next.js 16 • TypeScript • Prisma • Tailwind CSS",
    "Version : 0.2.0",
    "Date : Juin 2026",
  ];
  for (const line of metaLines) {
    children.push(new Paragraph({
      indent: { left: padL + 200 },
      spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line, size: 24, color: c(P.metaColor),
        font: { ascii: "Calibri" },
      })],
    }));
  }

  // Bottom whitespace
  children.push(new Paragraph({ spacing: { before: 2800 } }));

  // Footer with top accent separator
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent), space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({
        text: "EduGest • Système de Gestion Scolaire",
        size: 16, color: c(P.footerColor), font: { ascii: "Calibri" },
      }),
      new TextRun({ text: "                                        " }),
      new TextRun({
        text: "Documentation complète",
        size: 16, color: c(P.footerColor), font: { ascii: "Calibri" },
      }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: c(P.bg) },
        borders: noCellBorders,
        children,
      })],
    })],
  })];
}

// ============================================================
// TABLE OF CONTENTS
// ============================================================
function buildTOC() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360 },
      children: [new TextRun({
        text: "Table des Matières",
        bold: true, size: 40, color: c(P.primary),
        font: { ascii: "Calibri", eastAsia: "SimHei" },
      })],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({
        text: "Note : Cette table des matières est générée via champs. Pour mettre à jour les numéros de page après édition, faites un clic droit sur la table et sélectionnez \"Mettre à jour les champs\".",
        italics: true, size: 18, color: "888888",
        font: { ascii: "Calibri" },
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ============================================================
// CHAPTER 1 — PRÉSENTATION DU PROJET
// ============================================================
function chapter1() {
  return [
    h1("Chapitre 1 — Présentation du Projet"),

    h2("1.1 Vue d'ensemble"),
    body("MASOMO / EduGest est une application web complète de gestion scolaire francophone. Conçue comme une Progressive Web App (PWA) installable sur mobile et desktop, elle couvre l'ensemble des besoins d'un établissement scolaire : gestion des élèves, des enseignants, des parents, du personnel, des classes, des emplois du temps, des notes, des bulletins, des devoirs, des paiements, de la communication interne et du calendrier scolaire."),
    body("L'application supporte le mode multi-institutions : un Super-Administrateur peut gérer plusieurs établissements, chacun avec son propre administrateur, ses enseignants, ses élèves et sa configuration. Une gestion fine des permissions (RBAC) est mise en place avec six rôles distincts : super_admin, admin, teacher, student, parent et staff."),

    h2("1.2 Objectifs fonctionnels"),
    bullet("Centraliser la gestion administrative et pédagogique d'un ou plusieurs établissements scolaires."),
    bullet("Offrir une interface moderne, responsive et installable comme application native (PWA)."),
    bullet("Fournir des exports professionnels (PDF, Excel) pour les bulletins, notes et présences."),
    bullet("Assurer une communication fluide entre tous les acteurs (annonces, messagerie, notifications)."),
    bullet("Permettre une gestion financière transparente (paiements, suivi des revenus)."),
    bullet("Supporter le mode hors-ligne avec détection automatique de la connectivité."),

    h2("1.3 Caractéristiques principales"),
    body("L'application est construite autour de 16 modules fonctionnels accessibles depuis une sidebar moderne. Elle inclut un système de notifications en temps réel avec deep-linking vers les modules concernés, un système de messagerie privée entre utilisateurs, et un calendrier scolaire annuel avec gestion d'événements par classe ou globaux."),
    body("L'authentification repose sur un store Zustand persistant côté client, complété par des headers personnalisés (x-user-id, x-institution-id, x-user-role) injectés automatiquement sur chaque requête API via un intercepteur fetch global. La vérification des permissions est effectuée côté serveur par un middleware dédié."),

    h2("1.4 Chiffres clés du projet"),
    makeTable(
      ["Catégorie", "Nombre", "Lignes de code"],
      [
        ["Fichiers de configuration racine", "9", "~400"],
        ["Schéma Prisma (modèles)", "22", "436"],
        ["Fichiers src/app/ (hors API)", "6", "~425"],
        ["Routes API", "66", "4 213"],
        ["Composants principaux", "9", "2 471"],
        ["Composants modules", "16", "16 724"],
        ["Composants UI shadcn", "48", "~5 300"],
        ["Hooks personnalisés", "3", "250"],
        ["Fichiers src/lib/", "10", "2 223"],
        ["Scripts utilitaires", "2", "269"],
        ["Exemples WebSocket", "2", "335"],
        ["TOTAL CODE SOURCE", "~165 fichiers", "~32 000 lignes"],
      ],
      [3500, 2500, 3000],
    ),
    caption("Tableau 1 — Statistiques quantitatives du code source"),
  ];
}

// ============================================================
// CHAPTER 2 — ARCHITECTURE TECHNIQUE
// ============================================================
function chapter2() {
  return [
    h1("Chapitre 2 — Architecture Technique"),

    h2("2.1 Stack technologique"),
    body("Le projet repose sur une stack moderne entièrement TypeScript, optimisée pour la performance et la maintenabilité :"),
    makeTable(
      ["Catégorie", "Technologie", "Version"],
      [
        ["Framework", "Next.js (App Router)", "16.1.1"],
        ["Langage", "TypeScript", "5.x"],
        ["UI Framework", "React", "19.0.0"],
        ["Styling", "Tailwind CSS", "4.x"],
        ["Composants UI", "shadcn/ui (style new-york)", "—"],
        ["Primitives UI", "Radix UI", "28 packages"],
        ["Base de données", "SQLite via Prisma ORM", "6.11.1"],
        ["State (client)", "Zustand", "5.0.6"],
        ["State (serveur)", "TanStack Query", "5.82.0"],
        ["Tableaux", "TanStack Table", "8.21.3"],
        ["Formulaires", "React Hook Form + Zod", "7.60 / 4.0"],
        ["Graphiques", "Recharts", "2.15.4"],
        ["Animations", "Framer Motion", "12.23.2"],
        ["Thème", "next-themes", "0.4.6"],
        ["Drag & Drop", "@dnd-kit/*", "6.3 / 10.0 / 3.2"],
        ["Documents PDF", "jsPDF + autotable", "4.2 / 5.0"],
        ["Documents Excel", "xlsx (SheetJS)", "0.18.5"],
        ["Éditeur Markdown", "@mdxeditor/editor", "3.39.1"],
        ["Authentification", "NextAuth.js (disponible)", "4.24.11"],
        ["IA (avatars, VLM)", "z-ai-web-dev-sdk", "0.0.18"],
        ["Traitement images", "Sharp", "0.34.3"],
        ["Runtime", "Bun", "—"],
      ],
      [3000, 4000, 2000],
    ),
    caption("Tableau 2 — Stack technologique complète"),

    h2("2.2 Structure des dossiers"),
    body("Le projet suit l'architecture standard de Next.js App Router avec une organisation claire des responsabilités :"),
    code("masomo/\n├── prisma/\n│   └── schema.prisma           # Schéma de base de données (22 modèles)\n├── public/                     # Assets statiques + PWA\n│   ├── avatars/                # Photos élèves/enseignants\n│   ├── announcements/          # Images d'annonces\n│   ├── uploads/                # Fichiers uploadés\n│   ├── manifest.json           # PWA manifest\n│   ├── sw.js                   # Service Worker\n│   └── icons                   # Icônes PWA 72→512px\n├── mini-services/              # Micro-services externes\n├── scripts/                    # Scripts utilitaires\n├── examples/                   # Démos (WebSocket)\n├── src/\n│   ├── app/                    # App Router Next.js\n│   │   ├── api/                # 66 routes API\n│   │   ├── layout.tsx          # Layout racine\n│   │   ├── page.tsx            # Page d'entrée\n│   │   ├── globals.css         # Styles globaux\n│   │   └── error.tsx           # Boundary d'erreur\n│   ├── components/             # Composants React\n│   │   ├── modules/            # 16 modules métier\n│   │   ├── ui/                 # 48 composants shadcn/ui\n│   │   ├── app-shell.tsx       # Shell applicatif\n│   │   └── login.tsx           # Page de connexion\n│   ├── hooks/                  # 3 hooks personnalisés\n│   └── lib/                    # 10 fichiers utilitaires\n├── package.json\n├── tsconfig.json\n├── next.config.ts\n└── tailwind.config.ts"),

    h2("2.3 Configuration Next.js"),
    body("Le fichier next.config.ts configure le mode standalone (pour déploiement Docker/serverless), désactive le React StrictMode pour éviter les doubles effets en développement, et ignore les erreurs de build TypeScript/ESLint pour permettre un déploiement rapide :"),
    code("const nextConfig = {\n  output: 'standalone',\n  reactStrictMode: false,\n  eslint: { ignoreDuringBuilds: true },\n  typescript: { ignoreBuildErrors: true },\n};\nmodule.exports = nextConfig;"),

    h2("2.4 Configuration Tailwind CSS v4"),
    body("Tailwind v4 utilise une approche par variables CSS (oklch) plutôt que par palette figée. Le thème est généré dynamiquement depuis globals.css avec un système de couleurs emerald/teal. Le mode sombre est activé via la stratégie class, et le plugin tailwindcss-animate fournit les animations. La configuration shadcn/ui (components.json) définit le style new-york, le RSC activé, et le alias @/* vers ./src/*."),

    h2("2.5 Flux de données"),
    body("L'application suit un modèle client-serveur classique avec une particularité : l'authentification est gérée côté client via Zustand, et chaque requête API embarque des headers personnalisés qui permettent au serveur d'identifier l'utilisateur et son institution. Voici le flux complet :"),
    bullet("L'utilisateur se connecte via /api/auth/login → le serveur retourne l'objet User (sans mot de passe)."),
    bullet("Le store Zustand persiste l'utilisateur dans localStorage (clé edugest-storage)."),
    bullet("Le composant FetchInterceptor patche globalement window.fetch pour injecter les headers x-user-id, x-institution-id, x-user-role sur chaque appel /api/*."),
    bullet("Les routes API utilisent checkApiAccess() (lib/api-auth.ts) pour vérifier les permissions côté serveur."),
    bullet("Les données sont renvoyées au format JSON typé via les helpers de lib/api.ts côté client."),

    h2("2.6 Gateway et reverse proxy"),
    body("Le fichier Caddyfile configure un reverse proxy Caddy sur le port 81 qui redirige vers localhost:3000 (Next.js). Pour les mini-services externes (comme WebSocket sur port 3003), un mécanisme de transformation de port via le paramètre d'URL XTransformPort permet de router les requêtes sans exposer plusieurs ports. Les WebSocket passent par io('/?XTransformPort=3003') côté client."),
  ];
}

// ============================================================
// CHAPTER 3 — SCHÉMA DE DONNÉES
// ============================================================
function chapter3() {
  return [
    h1("Chapitre 3 — Schéma de Données (Prisma)"),

    h2("3.1 Vue d'ensemble"),
    body("Le fichier prisma/schema.prisma (436 lignes) définit 22 modèles pour le provider SQLite. La base de données est stockée à /home/z/my-project/db/custom.db. Le schéma couvre quatre grands domaines : l'authentification et les institutions, les personnes (élèves, enseignants, parents, personnel), la pédagogie (classes, matières, notes, emplois du temps, présences, bulletins) et la communication/finance (paiements, annonces, messages, notifications, devoirs)."),

    h2("3.2 Modèles d'authentification et d'institution"),

    h3("3.2.1 SuperAdmin"),
    body("Compte super-administrateur global, au-dessus de toutes les institutions. Il peut gérer plusieurs établissements et basculer entre eux. Champs principaux : id (cuid), name, email (unique), password, avatar, phone, address, active (défaut true), createdAt, updatedAt."),

    h3("3.2.2 Institution"),
    body("Établissement scolaire dans le modèle multi-tenant. Chaque institution a son propre mot de passe (unique), ses classes, ses utilisateurs et sa configuration. Champs : id, name, password (unique), address, phone, email, logo, currentYear (défaut 2024-2025), active, createdAt, updatedAt. Relations : users, classes, schoolConfigs."),

    h3("3.2.3 User"),
    body("Compte utilisateur générique avec un rôle (admin, teacher, student, parent, staff). Champs : id, email (unique), password, name, role (défaut student), avatar, phone, userCode (ex : ELE-001), institutionId, active, createdAt, updatedAt. Relations multiples : institution, student, teacher, parent, staff, sentMessages, receivedMessages, sentAnnouncements, sessions, notifications."),

    h3("3.2.4 UserSession"),
    body("Sessions utilisateurs pour suivre l'activité. Champs : id, userId, isActive, createdAt, updatedAt. Relation cascade vers User."),

    h2("3.3 Modèles personnes"),

    h3("3.3.1 Student"),
    body("Élève lié à un User. Champs : id, userId (unique), firstName, lastName, dateOfBirth, gender, address, enrollmentDate, parentContact, classId, parentPhone, image, parentId, createdAt, updatedAt. Relations : user, class, parent, grades, payments, attendances, bulletins, submissions (devoirs)."),

    h3("3.3.2 Teacher"),
    body("Enseignant lié à un User. Champs : id, userId (unique), firstName, lastName, subject, phone, qualification, hireDate, image, createdAt, updatedAt. Relations : user, schedules, classes (ClassTeacher), homeworks."),

    h3("3.3.3 Parent"),
    body("Parent d'élève lié à un User. Champs : id, userId (unique), firstName, lastName, phone, address, createdAt, updatedAt. Relation : children (Student[])."),

    h3("3.3.4 Staff"),
    body("Personnel administratif lié à un User. Champs : id, userId (unique), firstName, lastName, fonction, phone, email, image, createdAt, updatedAt. Relation : user."),

    h2("3.4 Modèles pédagogiques"),

    h3("3.4.1 Class et ClassTeacher"),
    body("Class représente une classe avec : id, name, level (CP, CE1, 6ème, Terminale...), section, capacity (défaut 30), schoolYear, room, institutionId. Relations : students, teachers (via ClassTeacher qui est une table de jointure avec subject), schedules, events, homeworks. ClassTeacher a : classId, teacherId, subject."),

    h3("3.4.2 Subject et Grade"),
    body("Subject : id, name, code (unique), coefficient (défaut 1). Grade : id, studentId, subjectId, classId, teacherId, value, maxValue (défaut 20), type (devoir/examen/controle), trimester (1er/2eme/3eme), schoolYear, comment, date. Les notes sont sur 20 par défaut."),

    h3("3.4.3 Schedule, Attendance, Bulletin"),
    body("Schedule : cours planifié avec classId, teacherId, subject, dayOfWeek (1=Lun..5=Ven), startTime, endTime, room. Attendance : présence d'un élève à une date avec status (present/absent/late/excused), comment. Bulletin : bulletin par élève/trimestre avec average, rank, appreciation, generatedAt."),

    h2("3.5 Modèles financiers et de communication"),

    h3("3.5.1 Payment"),
    body("Paiement avec : id, studentId, amount, type (tuition/registration/exam_fee/other), method (cash/mobile_money/bank_transfer), status (défaut pending), reference, description, schoolYear, paymentDate."),

    h3("3.5.2 Announcement et Message"),
    body("Announcement : id, title, content, type (general par défaut), target (all par défaut), authorId, priority, institutionId, mediaUrl, mediaType (support images et vidéos). Message : messagerie privée avec senderId, receiverId, content, read (boolean)."),

    h3("3.5.3 Notification"),
    body("Notification système avec : id, userId, authorId, title, message, type (info/warning/success/error/homework/event/payment/announcement/attendance), category, link (pour deep-linking), linkParams, icon, read, institutionId. Les notifications sont créées automatiquement lors d'événements (création de devoir, annonce, paiement, etc.)."),

    h2("3.6 Modèles calendrier et médias"),

    h3("3.6.1 SchoolEvent et EventClass"),
    body("SchoolEvent : événement scolaire avec title, description, date, endDate, type (vacances/examens/reunions/celebrations/echeances/autre), schoolYear, isGlobal (défaut true), institutionId. EventClass : table de jointure événement ↔ classe (unique sur [eventId, classId])."),

    h3("3.6.2 Homework et HomeworkSubmission"),
    body("Homework : devoir avec title, description, subjectId, classId, teacherId, dueDate, assignedDate, type (homework par défaut), status (active par défaut), schoolYear, institutionId. HomeworkSubmission : soumission d'élève (unique [homeworkId, studentId]) avec content, status (submitted par défaut), grade, maxGrade, comment, submittedAt."),

    h3("3.6.3 MediaFile et SchoolConfig"),
    body("MediaFile : fichier média stocké en base64 dans la DB (filename, mimeType, data, size, institutionId). Permet de servir les images/vidéos via /api/media/[id] avec support des Range requests pour les vidéos. SchoolConfig : configuration école (schoolName, address, phone, email, logo, currentYear, institutionId, institutionPassword)."),
  ];
}

// ============================================================
// CHAPTER 4 — ROUTES API
// ============================================================
function chapter4() {
  return [
    h1("Chapitre 4 — Routes API"),
    body("Le dossier src/app/api/ contient 66 routes API totalisant environ 4 213 lignes de code. Toutes les routes utilisent le client Prisma (import { db } from '@/lib/db') et respectent le pattern REST. L'authentification est vérifiée via checkApiAccess() qui lit les headers x-user-role et x-institution-id."),

    h2("4.1 Authentification (5 routes)"),
    makeTable(
      ["Route", "Méthodes", "Description"],
      [
        ["/api/auth/login", "POST", "Connexion unifiée : tente SuperAdmin puis User. Vérifie institutionId."],
        ["/api/auth/register", "POST", "Inscription d'un nouvel utilisateur."],
        ["/api/auth/me", "GET", "Retourne l'utilisateur courant."],
        ["/api/auth/profile", "GET, PUT", "Récupère / met à jour le profil utilisateur."],
        ["/api/super-admin/login", "POST", "Connexion dédiée SuperAdmin."],
      ],
      [3000, 1500, 4500],
    ),

    h2("4.2 CRUD Ressources principales"),
    makeTable(
      ["Route", "Méthodes", "Lignes", "Description"],
      [
        ["/api/students", "GET, POST", "185", "Liste paginée / Création élève + User"],
        ["/api/students/[id]", "GET, PUT, DELETE", "162", "Détail / modif / suppression"],
        ["/api/teachers", "GET, POST", "152", "Liste / Création enseignant + ClassTeacher"],
        ["/api/teachers/[id]", "GET, PUT, DELETE", "155", "Détail / modif / suppression"],
        ["/api/parents", "GET, POST, PUT, DELETE", "291", "CRUD complet parents"],
        ["/api/parents/[id]", "GET, PUT, DELETE", "173", "Détail / modif / suppression"],
        ["/api/staff", "GET, POST, PUT, DELETE", "292", "CRUD complet personnel"],
        ["/api/staff/[id]", "GET, PUT, DELETE", "145", "Détail / modif / suppression"],
        ["/api/classes", "GET, POST", "110", "Liste / Création classe"],
        ["/api/classes/[id]", "GET, PUT, DELETE", "167", "Détail / modif / suppression"],
        ["/api/subjects", "GET, POST", "69", "Liste / Création matières"],
        ["/api/grades", "GET, POST", "102", "Liste filtrable / Création note"],
        ["/api/schedules", "GET, POST", "97", "Liste / Création cours"],
        ["/api/schedules/[id]", "PUT, DELETE", "105", "Modif / suppression"],
        ["/api/attendance", "GET, POST", "126", "Liste / Marquage présence"],
        ["/api/bulletins", "GET, POST", "163", "Liste / Génération bulletin"],
        ["/api/payments", "GET, POST", "102", "Liste / Création paiement"],
        ["/api/messages", "GET, POST", "100", "Messagerie privée"],
        ["/api/announcements", "GET, POST", "164", "Annonces avec média"],
        ["/api/homework", "GET, POST", "198", "Devoirs + notifications auto"],
        ["/api/homework/[id]", "GET, PUT, DELETE", "99", "Détail / modif / suppression"],
        ["/api/homework/[id]/submissions", "GET, POST", "64", "Soumissions de devoirs"],
        ["/api/events", "GET, POST, PUT, DELETE", "254", "CRUD événements scolaires"],
        ["/api/notifications", "GET, POST, PUT", "158", "Notifications"],
      ],
      [3000, 1800, 1200, 3000],
    ),

    h2("4.3 Exports (PDF et Excel)"),
    body("L'application génère des exports professionnels via jsPDF (pour le PDF) et xlsx/SheetJS (pour Excel). Les routes dédiées sont :"),
    makeTable(
      ["Route", "Format", "Description"],
      [
        ["/api/attendance/export/excel", "xlsx", "Export Excel des présences"],
        ["/api/attendance/export/pdf", "PDF", "Export PDF des présences (jspdf)"],
        ["/api/bulletins/export/excel", "xlsx", "Export Excel des bulletins"],
        ["/api/bulletins/export/pdf", "PDF", "Export PDF des bulletins"],
        ["/api/bulletins/proclamation", "JSON", "Liste proclamation (résultats classés)"],
        ["/api/grades/export/excel", "xlsx", "Export Excel des notes"],
        ["/api/grades/export/pdf", "PDF", "Export PDF des notes"],
      ],
      [3500, 1500, 4000],
    ),

    h2("4.4 Dashboard et seed"),
    h3("4.4.1 /api/dashboard (GET, 251 lignes)"),
    body("Route centrale qui agrège toutes les statistiques du tableau de bord : totaux (élèves, enseignants, classes, parents, personnel), revenus totaux, taux de présence, activités récentes, distribution des élèves par classe, distribution par genre, méthodes de paiement, revenus mensuels sur 6 mois, inscriptions récentes et événements à venir."),

    h3("4.4.2 /api/seed (POST, 531 lignes)"),
    body("Route d'initialisation qui peuple la base de données avec des données de démonstration complètes : SuperAdmin, Institution, Admin, Parent, Staff, 5 classes, 8 enseignants, 20 élèves, matières, notes, paiements, annonces, événements et devoirs. Cette route est appelée depuis le bouton \"Seed Database\" de la page de connexion ou des paramètres."),

    h2("4.5 Médias et uploads"),
    makeTable(
      ["Route", "Méthodes", "Description"],
      [
        ["/api/upload-media", "POST", "Upload FormData → MediaFile base64. Limite 10 Mo images / 50 Mo vidéos."],
        ["/api/media/[id]", "GET, DELETE", "Sert le fichier (gère Range pour vidéos) / Supprime."],
        ["/api/uploads/[...path]", "GET", "Sert fichiers /public/uploads/* en mode standalone."],
        ["/api/enhance-image", "POST", "Amélioration d'image via IA (z-ai-web-dev-sdk)."],
        ["/api/download", "POST", "Téléchargement générique."],
      ],
      [2800, 1500, 4700],
    ),

    h2("4.6 Configuration et multi-institution"),
    makeTable(
      ["Route", "Méthodes", "Description"],
      [
        ["/api/school-config", "GET, PUT", "Récupère / met à jour SchoolConfig"],
        ["/api/school-config/verify", "POST", "Vérifie le mot de passe institution"],
        ["/api/institutions", "GET, POST, PUT", "Liste institutions (SuperAdmin voit tout, Admin voit la sienne)"],
        ["/api/sessions", "GET, PUT, DELETE", "Gestion UserSession (admin/super_admin)"],
        ["/api/users", "GET", "Liste utilisateurs (admin seulement)"],
        ["/api/users/password", "PUT, DELETE", "Gestion mots de passe : individuel, par rôle (bulk) ou par liste d'IDs"],
      ],
      [3000, 1800, 4200],
    ),

    h2("4.7 Routes Super-Admin (10 routes)"),
    body("Le module Super-Admin expose un ensemble dédié de routes pour la gestion multi-institutions :"),
    makeTable(
      ["Route", "Méthodes", "Description"],
      [
        ["/api/super-admin/profile", "GET, PUT", "Profil SuperAdmin"],
        ["/api/super-admin/password", "POST, PUT", "Changement mot de passe SuperAdmin"],
        ["/api/super-admin/ensure", "GET", "S'assure qu'un SuperAdmin existe (crée si besoin)"],
        ["/api/super-admin/admins", "GET, POST, PUT, DELETE", "CRUD administrateurs d'institution"],
        ["/api/super-admin/admins/[id]", "PUT, DELETE", "Modif / suppression admin"],
        ["/api/super-admin/institutions", "GET", "Liste toutes les institutions avec compteurs"],
        ["/api/super-admin/institutions/[id]", "PUT, DELETE", "Modif / suppression institution"],
        ["/api/super-admin/switch-institution", "POST", "Change l'institution active du SuperAdmin"],
      ],
      [3500, 2000, 3500],
    ),
  ];
}

// ============================================================
// CHAPTER 5 — COMPOSANTS REACT & MODULES
// ============================================================
function chapter5() {
  return [
    h1("Chapitre 5 — Composants React & Modules"),

    h2("5.1 Composants principaux (src/components/)"),
    body("Le dossier src/components/ contient 9 composants transverses qui forment la structure de l'application :"),
    makeTable(
      ["Fichier", "Lignes", "Rôle"],
      [
        ["app-shell.tsx", "497", "Layout principal authentifié. Sidebar desktop (collapsible) + sidebar mobile (Sheet), header avec toggle thème, notifications, dropdown utilisateur. Banner hors-ligne. Switch de modules via renderModule()."],
        ["login.tsx", "615", "Page de connexion dark two-panel : panneau gauche branding EduGest + tabs Institution/Compte + liste institutions/comptes démo (6 rôles). Panneau droit : formulaire + boutons Se connecter / Super Admin / Seed DB."],
        ["notification-dropdown.tsx", "383", "Popover notifications : badge non-lues, liste paginée, marquer comme lu, suppression, deep-link vers module concerné. Icônes par type."],
        ["image-dropzone.tsx", "367", "Composant d'upload d'image avec preview avatar. Redimensionnement canvas (400×400), sharpening (unsharp mask), brightness/contrast."],
        ["pwa-install-prompt.tsx", "163", "Prompt d'installation PWA : écoute beforeinstallprompt, bannière animée, fallback manuel."],
        ["fetch-interceptor.tsx", "55", "Patch global de window.fetch pour injecter automatiquement les headers x-user-id, x-institution-id, x-user-role."],
        ["data-pagination.tsx", "116", "Composant pagination réutilisable (Previous/Next + numéros avec ellipsis)."],
        ["toast-bridge.tsx", "50", "Pont Zustand → Sonner : surveille les toasts du store et les forward à Sonner."],
        ["sw-registrar.tsx", "20", "Enregistre le service worker /sw.js en production."],
      ],
      [2800, 800, 5400],
    ),

    h2("5.2 Les 16 modules fonctionnels"),
    body("Le dossier src/components/modules/ contient 16 modules métier représentant environ 16 724 lignes de code. Chaque module est un composant React autonome qui gère un domaine fonctionnel complet :"),

    h3("5.2.1 dashboard.tsx (898 lignes)"),
    body("Tableau de bord principal avec 6 cartes statistiques (élèves, enseignants, classes, revenus, parents, personnel), une barre de Quick Actions, des graphiques Recharts (BarChart élèves/classe, PieChart distribution par genre, AreaChart revenus sur 6 mois), les activités récentes, les inscriptions récentes et les événements à venir. La devise utilisée est $ (USD)."),

    h3("5.2.2 students.tsx (1247 lignes)"),
    body("CRUD complet des élèves : liste paginée avec recherche et filtre par classe, table avec avatar, dialog créer/éditer avec ImageDropzone, exports Excel/PDF/Print, génération automatique de userCode au format ELE-NNN."),

    h3("5.2.3 teachers.tsx (1102 lignes)"),
    body("CRUD enseignants : liste, dialog créer/éditer avec matière, qualification, classes associées et photo, exports Excel/PDF, génération userCode ENS-NNN."),

    h3("5.2.4 parents.tsx (1185 lignes)"),
    body("CRUD parents avec gestion des enfants associés, dialog créer/éditer, génération userCode PAR-NNN, exports, composant ChildrenList réutilisable."),

    h3("5.2.5 staff.tsx (1002 lignes)"),
    body("CRUD personnel administratif : liste, dialog créer/éditer (fonction, téléphone, email, photo), génération userCode STF-NNN, exports Excel/PDF."),

    h3("5.2.6 classes.tsx (878 lignes)"),
    body("CRUD classes : liste en cartes avec progress bar de capacité, dialog créer/éditer (niveau, section, capacité, salle), tabs Détails / Élèves / Enseignants / Emploi du temps, gestion ClassTeacher."),

    h3("5.2.7 schedule.tsx (752 lignes)"),
    body("Emploi du temps hebdomadaire : grille Lundi-Vendredi × créneaux horaires, drag & drop pour créer des cours (via @dnd-kit), dialog d'édition (classe, enseignant, matière, salle), couleurs par matière, navigation par semaine."),

    h3("5.2.8 grades.tsx (832 lignes)"),
    body("Gestion des notes : filtres (classe, matière, trimestre, type), liste avec avatar élève, dialog de saisie (valeur sur 20, type, commentaire), statistiques (moyenne, taux de réussite)."),

    h3("5.2.9 bulletins.tsx (559 lignes)"),
    body("Bulletins scolaires : génération par élève et trimestre, calcul automatique de la moyenne + rang + appréciation, dialog preview, impression PDF."),

    h3("5.2.10 attendance.tsx (1370 lignes)"),
    body("Gestion des présences : sélection classe + date, grille élèves × statut (présent/absent/retard/excusé), saisie rapide, sauvegarde batch, calendrier mensuel, exports Excel/PDF, statistiques."),

    h3("5.2.11 homework.tsx (1251 lignes)"),
    body("Gestion des devoirs : liste par statut/type, dialog créer/éditer (titre, description, classe, matière, date due), consultation et notation des soumissions élèves, filtres avancés."),

    h3("5.2.12 payments.tsx (778 lignes)"),
    body("Gestion des paiements : liste filtrable (statut, type, méthode), statistiques (total, en attente, complété), dialog créer (montant $, type, méthode, référence), dialog détail avec boutons Imprimer / Modifier / Supprimer."),

    h3("5.2.13 communication.tsx (842 lignes)"),
    body("Communication : tabs Annonces / Messages. Annonces avec upload média (image 10 Mo / vidéo 50 Mo), preview, ciblage (tous/enseignants/élèves/parents), types (général/urgent/académique/événement). Messagerie privée entre utilisateurs."),

    h3("5.2.14 school-calendar.tsx (1373 lignes)"),
    body("Calendrier scolaire annuel : vue mensuelle (Septembre-Juillet), création d'événements (vacances, examens, réunions, célébrations, échéances), événements globaux ou par classe, graphique LineChart des événements par mois, navigation par année."),

    h3("5.2.15 super-admin.tsx (2145 lignes)"),
    body("Module SuperAdmin complet : gestion multi-institutions (CRUD), gestion des administrateurs (CRUD), switch d'institution, profil SuperAdmin, statistiques globales, dashboard multi-établissements. Helpers dynamiques : entityLabel(), getDefaultForm(), prefillForm(), getEntityUrl(), buildEntityBody(), renderEntityForm()."),

    h3("5.2.16 settings.tsx (315 lignes)"),
    body("Paramètres : profil utilisateur, thème (light/dark/system), bouton Seed Database, infos école, navigation vers les sections."),

    h2("5.3 Composants UI shadcn/ui (48 composants)"),
    body("La bibliothèque shadcn/ui est installée en style new-york avec RSC activé. Tous les composants utilisent Tailwind CSS, les primitives Radix UI, et la fonction cn() pour la fusion de classes. Voici les composants principaux utilisés dans l'application :"),
    bullet("button (59 lignes) — 6 variantes : default, destructive, outline, secondary, ghost, link"),
    bullet("card (92 lignes) — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter"),
    bullet("dialog (143 lignes) et alert-dialog (157 lignes) — modales accessibles"),
    bullet("input (21), textarea (18), label (24), checkbox (32), radio-group (45), switch (31), slider (63)"),
    bullet("select (185), dropdown-menu (257), popover (48), tooltip (61) — navigations"),
    bullet("table (116), tabs (66), accordion (66), collapsible (33) — layouts de données"),
    bullet("sheet (139), drawer (135, vaul) — panneaux coulissants"),
    bullet("calendar (213), date-picker via react-day-picker — sélecteurs de dates"),
    bullet("avatar (53), badge (46), progress (31), skeleton (13), separator (28) — affichage"),
    bullet("sidebar (726) — composant sidebar avancé avec collapsing"),
    bullet("carousel (241, embla), chart (353, recharts) — visualisations"),
    bullet("form (167, react-hook-form), command (184, cmdk) — formulaires avancés"),
    bullet("sonner (25) + toast/toaster (128/34) — notifications"),
    bullet("pagination (127), breadcrumb (109), hover-card (44), context-menu (252), menubar (276), navigation-menu (168), input-otp (77), toggle/toggle-group (47/73), resizable (56), aspect-ratio (11)"),
  ];
}

// ============================================================
// CHAPTER 6 — LIBRAIRIES (src/lib/)
// ============================================================
function chapter6() {
  return [
    h1("Chapitre 6 — Librairies Utilitaires (src/lib/)"),
    body("Le dossier src/lib/ contient 10 fichiers utilitaires qui fournissent les fondations de l'application : accès base de données, types TypeScript, constantes, permissions, client API, store global, etc."),

    h2("6.1 db.ts (12 lignes) — Client Prisma"),
    body("Singleton PrismaClient avec cache global (globalForPrisma) pour éviter la recréation d'instances lors du hot reload en développement. Active les logs de requêtes en mode dev :"),
    code("import { PrismaClient } from '@prisma/client';\nconst globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };\nexport const db = globalForPrisma.prisma ?? new PrismaClient({ log: ['query'] });\nif (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;"),

    h2("6.2 types.ts (563 lignes) — Types TypeScript centraux"),
    body("Ce fichier définit tous les types TypeScript utilisés dans l'application, alignés sur le schéma Prisma. Il contient :"),
    bullet("Types utilitaires : UserRole (super_admin | admin | teacher | student | parent | staff), Gender, GradeType, Trimester, PaymentType/Method/Status, AttendanceStatus, AnnouncementType/Target, ModuleKey (16 modules)."),
    bullet("NotificationType (info/warning/success/error/homework/event/payment/announcement/attendance) et ToastType (success/error/info/warning)."),
    bullet("Interfaces de tous les modèles domaine : SuperAdmin, Institution, User, Student, Teacher, Parent, Staff, Class, ClassTeacher, Subject, Grade, Schedule, Payment, Attendance, Bulletin, Announcement, Message, SchoolConfig."),
    bullet("DashboardStats + sous-interfaces : RecentActivity, RevenueByMonth, GradeDistribution, AttendanceByDay."),
    bullet("Types API : ApiResponse<T>, PaginatedResponse<T>, LoginRequest/Response, RegisterRequest, et toutes les CreateXRequest / UpdateXRequest pour chaque entité."),

    h2("6.3 constants.ts (358 lignes) — Constantes francophones"),
    body("Ce fichier centralise toutes les constantes de l'application en français :"),
    bullet("NAV_ITEMS : 16 items avec clé + label + icône Lucide pour la sidebar."),
    bullet("ROLES + ROLE_LABELS : 6 rôles (super_admin, admin, teacher, student, parent, staff)."),
    bullet("GRADE_TYPES, PAYMENT_TYPES/METHODS/STATUSES avec libellés et couleurs Tailwind."),
    bullet("ATTENDANCE_STATUSES avec couleurs (présent=vert, absent=rouge, retard=ambre, excusé=bleu)."),
    bullet("DAYS_OF_WEEK (Lun-Ven, 1-5), DAY_LABELS, DAY_SHORT_LABELS."),
    bullet("TRIMESTERS (1er/2eme/3eme), CLASS_LEVELS (CP, CE1-2, CM1-2, 6ème-3ème, 2nde-Terminale) avec cycles Primaire/Collège/Lycée."),
    bullet("ANNOUNCEMENT_TYPES/TARGETS, TIME_SLOTS (07:00 → 19:30 par demi-heure)."),
    bullet("CURRENT_SCHOOL_YEAR = '2024-2025', DEFAULT_PAGE_SIZE = 20, MAX_GRADE_VALUE = 20."),

    h2("6.4 permissions.ts (275 lignes) — Système RBAC"),
    body("Système de contrôle d'accès basé sur les rôles (RBAC) complet :"),
    bullet("Type Permission : 44 permissions au format module.action (view/create/edit/delete pour 11 modules)."),
    bullet("ROLE_PERMISSIONS : matrice rôle → permissions. L'admin a toutes les permissions, le teacher gère grades/schedule/communication, le student et le parent sont en lecture seule, le staff peut créer payments et communication."),
    bullet("MODULE_VISIBILITY : modules visibles par rôle (chaque rôle voit un sous-spécifique de modules)."),
    bullet("Helpers : hasPermission(), canCreate/Edit/Delete/View(), isModuleVisible(), getVisibleModules(), isStudent(), isAdmin(), isTeacher(), canWriteResource()."),

    h2("6.5 api-auth.ts (147 lignes) — Protection des routes API"),
    body("Ce fichier fournit le middleware de protection des routes API côté serveur :"),
    bullet("WRITE_ACCESS : matrice ressource → rôles autorisés en écriture (ex: students: ['admin'], grades: ['admin', 'teacher'])."),
    bullet("canAccess(role, resource, method) : GET toujours autorisé (lecture), écriture contrôlée par la matrice."),
    bullet("checkApiAccess(request, resource) : middleware renvoyant 403 si refusé."),
    bullet("getInstitutionId(request) : lit le header x-institution-id ou cherche User.institutionId (cache mémoire 5 min)."),
    bullet("getInstitutionIdWithFallback(request) : fallback sur la première institution active."),

    h2("6.6 api.ts (531 lignes) — Client API typé"),
    body("Client API côté client avec typage TypeScript complet :"),
    bullet("ApiError : classe d'erreur avec status."),
    bullet("apiFetch<T>() : helper générique avec gestion d'erreurs."),
    bullet("buildQuery() : construction des query params."),
    bullet("11 namespaces : authApi, studentsApi, teachersApi, classesApi, gradesApi, schedulesApi, paymentsApi, bulletinsApi, announcementsApi, messagesApi, attendanceApi, subjectsApi, dashboardApi, seedApi."),
    bullet("Chaque namespace expose list/get/create/update/delete typés."),

    h2("6.7 store.ts (105 lignes) — Store Zustand"),
    body("Store global persistant via le middleware persist (nom : edugest-storage) :"),
    bullet("activeModule + setActiveModule() — module actuellement affiché."),
    bullet("currentUser + isAuthenticated + login()/logout() — authentification."),
    bullet("sidebarOpen + toggleSidebar()/setSidebarOpen() — état de la sidebar."),
    bullet("schoolYear (défaut '2024-2025') + setSchoolYear()."),
    bullet("toasts + addToast(type, title, description, duration) avec auto-remove (5s), removeToast(), clearToasts()."),
    bullet("partialize : persiste uniquement currentUser, isAuthenticated, activeModule, sidebarOpen, schoolYear."),

    h2("6.8 fetch-utils.ts (33 lignes) — Headers d'authentification"),
    body("Fournit deux helpers pour injecter les headers d'authentification :"),
    bullet("getAuthHeaders() : construit les headers x-user-id, x-institution-id, x-user-role depuis le store Zustand."),
    bullet("authFetch(url, options) : wrapper fetch qui injecte automatiquement les headers auth."),

    h2("6.9 notifications.ts (57 lignes) — Helpers de notifications"),
    body("Fonctions utilitaires pour créer des notifications :"),
    bullet("notifyAdmins(params) : notifie tous les admins actifs d'une institution."),
    bullet("notifyUser(userId, params) : notifie un utilisateur spécifique."),

    h2("6.10 image-processing.ts (235 lignes) — Traitement d'images"),
    body("Utilitaires de traitement d'image côté navigateur (HTML5 Canvas) :"),
    bullet("loadImage(file) : charge un File en HTMLImageElement."),
    bullet("calculateCenterCrop(w, h) : calcule la zone de crop carrée centrée (biaisée vers le haut pour les visages)."),
    bullet("applyUnsharpMask(pixels, amount, threshold) : filtre de sharpening (convolution 3×3)."),
    bullet("Auto brightness/contrast, compression JPEG qualité 0.88, taille cible 400×400."),

    h2("6.11 utils.ts (20 lignes) — Utilitaires divers"),
    bullet("cn(...inputs) : fusion de classes Tailwind (clsx + tailwind-merge)."),
    bullet("getImageUrl(url) : convertit /uploads/* en /api/uploads/* pour le mode standalone."),
  ];
}

// ============================================================
// CHAPTER 7 — AUTHENTIFICATION ET SÉCURITÉ
// ============================================================
function chapter7() {
  return [
    h1("Chapitre 7 — Authentification et Sécurité"),

    h2("7.1 Modèle d'authentification"),
    body("L'application utilise une authentification hybride : le stockage de la session est côté client (Zustand persistant dans localStorage), mais chaque requête API est authentifiée côté serveur via des headers personnalisés. NextAuth.js est disponible dans les dépendances mais n'est pas activé par défaut — l'authentification actuelle repose sur le store Zustand et les headers."),

    h2("7.2 Flux d'authentification"),
    body("Voici le flux complet lorsqu'un utilisateur se connecte :"),
    bullet("L'utilisateur soumet le formulaire de connexion (login.tsx) avec email, password et optionnellement institutionId."),
    bullet("Le frontend appelle POST /api/auth/login avec les identifiants."),
    bullet("Le serveur tente d'abord l'authentification SuperAdmin (table SuperAdmin), puis User."),
    bullet("Si institutionId est fourni, le serveur vérifie que l'utilisateur appartient à cette institution."),
    bullet("Le serveur retourne l'objet User sans le mot de passe."),
    bullet("Le store Zustand persiste l'utilisateur dans localStorage (clé edugest-storage)."),
    bullet("L'utilisateur est redirigé vers le dashboard."),

    h2("7.3 Headers personnalisés"),
    body("Le composant FetchInterceptor (55 lignes) patche globalement window.fetch pour injecter automatiquement trois headers sur chaque appel /api/* :"),
    code("// Headers injectés sur chaque requête API\nx-user-id: <currentUser.id>\nx-institution-id: <currentUser.institutionId>\nx-user-role: <currentUser.role>"),
    body("Côté serveur, le helper getInstitutionId(request) lit le header x-institution-id ou, à défaut, cherche User.institutionId dans la base (avec un cache mémoire de 5 minutes pour éviter les requêtes répétées)."),

    h2("7.4 Système de permissions (RBAC)"),
    body("Le contrôle d'accès est défini dans lib/permissions.ts et lib/api-auth.ts. Il repose sur 6 rôles :"),
    makeTable(
      ["Rôle", "Description", "Permissions clés"],
      [
        ["super_admin", "Super-administrateur global", "Toutes les permissions, gestion multi-institutions"],
        ["admin", "Administrateur d'une institution", "Toutes les permissions sur son institution"],
        ["teacher", "Enseignant", "Création/édition de notes, emplois du temps, devoirs"],
        ["student", "Élève", "Lecture seule de ses notes, bulletins, devoirs"],
        ["parent", "Parent d'élève", "Lecture seule des infos de ses enfants"],
        ["staff", "Personnel administratif", "Création de paiements et communication"],
      ],
      [2000, 3000, 4000],
    ),

    h2("7.5 Vérification côté serveur"),
    body("Le helper checkApiAccess(request, resource) est appelé au début de chaque route API sensible. Il renvoie une réponse 403 si l'utilisateur n'a pas la permission. La règle est simple :"),
    bullet("GET (lecture) : toujours autorisé pour les utilisateurs authentifiés."),
    bullet("POST/PUT/DELETE (écriture) : vérification via la matrice WRITE_ACCESS."),
    body("Exemple de matrice WRITE_ACCESS :"),
    code("const WRITE_ACCESS = {\n  students: ['admin'],\n  teachers: ['admin'],\n  grades: ['admin', 'teacher'],\n  schedules: ['admin', 'teacher'],\n  payments: ['admin', 'staff'],\n  announcements: ['admin', 'teacher', 'staff'],\n  // ...\n};"),

    h2("7.6 Multi-institution"),
    body("Chaque institution a son propre mot de passe unique. Lors de la connexion, l'utilisateur peut sélectionner une institution (via l'onglet Institution) et saisir son mot de passe. Le SuperAdmin peut basculer entre institutions via /api/super-admin/switch-institution. Les administrateurs normaux sont limités à leur propre institution."),

    h2("7.7 Gestion des mots de passe"),
    body("La route /api/users/password (278 lignes) permet une gestion avancée des mots de passe :"),
    bullet("Changement individuel : un utilisateur change son propre mot de passe."),
    bullet("Réinitialisation par rôle (bulk) : l'admin réinitialise tous les mots de passe d'un rôle donné avec DEFAULT_PASSWORDS."),
    bullet("Réinitialisation par liste d'IDs : l'admin sélectionne des utilisateurs spécifiques."),
    bullet("DEFAULT_PASSWORDS : mot de passe par défaut pour chaque rôle (ex: student123 pour student)."),

    h2("7.8 Recommandations de sécurité"),
    body("Pour une mise en production, les points suivants devraient être renforcés :"),
    bullet("Activer NextAuth.js avec une stratégie JWT pour remplacer l'authentification basée sur store Zustand."),
    bullet("Hacher les mots de passe avec bcrypt (actuellement en clair dans la DB de dev)."),
    bullet("Ajouter une validation Zod systématique sur toutes les entrées API."),
    bullet("Mettre en place un rate limiting pour prévenir les attaques par force brute."),
    bullet("Configurer des CORS stricts en production."),
    bullet("Activer HTTPS obligatoire via le Caddyfile (déjà configuré)."),
  ];
}

// ============================================================
// CHAPTER 8 — PWA ET FONCTIONNALITÉS AVANCÉES
// ============================================================
function chapter8() {
  return [
    h1("Chapitre 8 — PWA et Fonctionnalités Avancées"),

    h2("8.1 Progressive Web App (PWA)"),
    body("L'application est une PWA installable sur mobile et desktop. Trois éléments la composent :"),

    h3("8.1.1 manifest.json"),
    body("Le manifeste PWA définit le nom (EduGest), la couleur de thème (#059669 emerald), la langue (fr), le mode d'affichage (standalone), et les icônes de 72 à 512 pixels. Il est référencé dans le layout racine via la métadonnée manifest."),

    h3("8.1.2 Service Worker (sw.js)"),
    body("Le service worker met en cache les ressources pour le fonctionnement hors-ligne :"),
    bullet("Cache edugest-v1 pour les assets statiques."),
    bullet("Stratégie network-first pour la navigation (essaie le réseau, fallback cache)."),
    bullet("Stratégie cache-first pour les assets statiques (images, CSS, JS)."),
    bullet("Enregistrement via sw-registrar.tsx en production uniquement."),

    h3("8.1.3 Prompt d'installation"),
    body("Le composant pwa-install-prompt.tsx (163 lignes) écoute l'événement beforeinstallprompt, affiche une bannière animée proposant l'installation, et gère un fallback manuel avec instructions spécifiques selon le navigateur (Chrome, Safari, Firefox)."),

    h2("8.2 Mode hors-ligne"),
    body("Le hook use-offline.ts (38 lignes) utilise useSyncExternalStore pour surveiller navigator.onLine. Il retourne { isOnline, wasOffline } avec tracking des transitions offline→online. Lorsqu'une reconnexion est détectée, un toast de confirmation s'affiche. Le composant AppShell affiche une bannière rouge en haut cuando isOnline est false."),

    h2("8.3 Mode sombre"),
    body("Le thème est géré par next-themes avec la stratégie class. Trois options sont disponibles : light, dark, system. Le toggle est accessible depuis le header (icône soleil/lune) et la page Paramètres. Toutes les couleurs sont définies en variables CSS oklch dans globals.css avec des variantes .dark pour le mode sombre."),

    h2("8.4 Notifications"),
    body("Le système de notifications est complet et temps réel :"),
    bullet("Création automatique : lors de la création d'un devoir, d'une annonce, d'un paiement, etc., des notifications sont créées via notifyAdmins() ou notifyUser()."),
    bullet("Affichage : le composant notification-dropdown.tsx affiche un popover avec badge du nombre de non-lues, liste paginée, icônes par type (info/warning/payment/homework/event/announcement)."),
    bullet("Actions : marquer comme lu, suppression, deep-linking vers le module concerné via le champ link."),
    bullet("Routes API : 5 routes dédiées (/api/notifications, /api/notifications/[id], /api/notifications/generate, /api/notifications/mark-all-read)."),

    h2("8.5 Upload de médias"),
    body("L'upload de médias utilise un stockage en base64 dans la table MediaFile. La route /api/upload-media (106 lignes) accepte un FormData et stocke le fichier encodé en base64. Les limites sont :"),
    bullet("Images : 10 Mo maximum."),
    bullet("Vidéos : 50 Mo maximum."),
    bullet("Support des Range requests pour la lecture vidéo en streaming via /api/media/[id]."),
    bullet("Suppression via DELETE /api/media/[id]."),

    h2("8.6 Avatars IA"),
    body("Le script scripts/generate-student-avatars.ts (193 lignes) génère des avatars IA pour les élèves via z-ai-web-dev-sdk :"),
    bullet("Identifie les élèves sans avatar (/api/media/...)."),
    bullet("Construit un prompt photoréaliste school ID photo style basé sur prénom + genre (enfant africain)."),
    bullet("Appelle zai.images.generations.create({ prompt, size: '1024x1024' })."),
    bullet("Stocke le PNG base64 dans MediaFile et met à jour Student.image."),
    bullet("Idempotent : skip les élèves déjà traités. Gestion 429 avec retry (5 tentatives, backoff 30s)."),

    h2("8.7 Exports professionnels"),
    body("L'application génère des exports PDF et Excel pour plusieurs types de données :"),
    makeTable(
      ["Type", "PDF (jsPDF)", "Excel (xlsx)"],
      [
        ["Présences", "/api/attendance/export/pdf", "/api/attendance/export/excel"],
        ["Bulletins", "/api/bulletins/export/pdf", "/api/bulletins/export/excel"],
        ["Notes", "/api/grades/export/pdf", "/api/grades/export/excel"],
        ["Élèves", "Print dialog côté client", "Export depuis students.tsx"],
        ["Enseignants", "Print dialog côté client", "Export depuis teachers.tsx"],
      ],
      [2000, 3500, 3500],
    ),

    h2("8.8 Graphiques (Recharts)"),
    body("Le dashboard utilise Recharts pour visualiser les données :"),
    bullet("BarChart : distribution des élèves par classe."),
    bullet("PieChart : répartition par genre (garçons/filles)."),
    bullet("AreaChart : revenus mensuels sur 6 mois."),
    bullet("LineChart (school-calendar) : nombre d'événements par mois."),

    h2("8.9 Drag & Drop"),
    body("La bibliothèque @dnd-kit/core, @dnd-kit/sortable et @dnd-kit/utilities est utilisée dans le module schedule.tsx pour permettre la création de cours par drag & drop sur la grille hebdomadaire. L'utilisateur peut glisser un créneau horaire pour créer un nouveau cours, puis le déplacer sur un autre jour."),

    h2("8.10 Traitement d'images côté client"),
    body("Le fichier lib/image-processing.ts (235 lignes) fournit des utilitaires de traitement d'image entièrement côté navigateur via HTML5 Canvas :"),
    bullet("Redimensionnement à 400×400 pixels (format carré pour les avatars)."),
    bullet("Crop centré biaisé vers le haut (pour mieux cadrer les visages)."),
    bullet("Filtre unsharp mask (convolution 3×3) pour le sharpening."),
    bullet("Auto brightness/contrast."),
    bullet("Compression JPEG qualité 0.88."),

    h2("8.11 Responsive design"),
    body("L'application est entièrement responsive avec une approche mobile-first :"),
    bullet("Sidebar desktop (collapsible) via le composant shadcn/ui sidebar (726 lignes)."),
    bullet("Sidebar mobile via Sheet (panneau coulissant depuis la gauche)."),
    bullet("Hook useIsMobile() qui détecte via matchMedia (breakpoint 768px)."),
    bullet("Breakpoints Tailwind (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)."),
    bullet("Touch-friendly : minimum 44px pour les cibles tactiles."),
  ];
}

// ============================================================
// CHAPTER 9 — INSTALLATION ET DÉPLOIEMENT
// ============================================================
function chapter9() {
  return [
    h1("Chapitre 9 — Installation et Déploiement"),

    h2("9.1 Prérequis"),
    makeTable(
      ["Logiciel", "Version minimale", "Lien"],
      [
        ["Node.js", "18.x ou supérieur", "nodejs.org"],
        ["Bun (recommandé)", "Dernière version", "bun.sh"],
        ["Git", "2.x", "git-scm.com"],
        ["SQLite", "Inclus dans Node.js", "—"],
      ],
      [3000, 3000, 3000],
    ),

    h2("9.2 Installation étape par étape"),

    h3("9.2.1 Récupérer le code source"),
    code("# Option A : extraire l'archive ZIP\nunzip masomo-source.zip -d masomo\ncd masomo\n\n# Option B : cloner depuis Git\ngit clone <url-du-depot>\ncd masomo"),

    h3("9.2.2 Configurer les variables d'environnement"),
    code("# Copier le fichier exemple\ncp .env.example .env\n\n# Éditer .env avec vos valeurs\nDATABASE_URL=\"file:./dev.db\"\nJWT_SECRET=\"votre-cle-secrete-changez-moi\"\nPORT=3000"),

    h3("9.2.3 Installer les dépendances"),
    code("# Avec Bun (recommandé, plus rapide)\nbun install\n\n# Ou avec npm\nnpm install"),
    body("⚠️ Important : ne jamais utiliser sudo avec npm sur Ubuntu/Linux. Cela crée des problèmes de permissions qui empêchent Prisma et Next.js de fonctionner correctement. Si vous avez des problèmes de permissions, utilisez nvm (Node Version Manager) pour installer Node.js sans sudo."),

    h3("9.2.4 Initialiser la base de données"),
    code("# Générer le client Prisma\nnpx prisma generate\n# ou avec bun : bunx prisma generate\n\n# Créer la base de données et les tables\nnpx prisma db push\n\n# (Optionnel) Remplir avec des données de démonstration\n# Soit via l'interface (bouton Seed Database sur la page de connexion)\n# Soit en appelant l'API : curl -X POST http://localhost:3000/api/seed"),

    h3("9.2.5 Lancer le serveur de développement"),
    code("# Avec Bun\nbun run dev\n\n# Ou avec npm\nnpm run dev"),
    body("L'application sera accessible à l'adresse http://localhost:3000"),

    h2("9.3 Comptes de démonstration"),
    body("Après avoir lancé le seed, vous pouvez vous connecter avec les comptes suivants :"),
    makeTable(
      ["Email", "Mot de passe", "Rôle"],
      [
        ["admin@ecole.com", "admin123", "Administrateur"],
        ["teacher@ecole.com", "teacher123", "Enseignant"],
        ["student@ecole.com", "student123", "Élève"],
        ["parent@ecole.com", "parent123", "Parent"],
        ["superadmin@edugest.com", "super123", "Super Admin"],
      ],
      [4000, 2500, 2500],
    ),

    h2("9.4 Scripts disponibles"),
    makeTable(
      ["Commande", "Description"],
      [
        ["bun run dev", "Lance le serveur de développement (port 3000)"],
        ["bun run build", "Compile l'application pour la production"],
        ["bun run start", "Lance le serveur de production"],
        ["bun run lint", "Vérifie la qualité du code avec ESLint"],
        ["bun run db:push", "Pousse le schéma Prisma vers la base"],
        ["bun run db:generate", "Génère le client Prisma"],
        ["bun run db:migrate", "Crée une migration Prisma"],
        ["bun run db:reset", "Réinitialise la base de données"],
      ],
      [3000, 6000],
    ),

    h2("9.5 Build de production"),
    body("Le build de production génère un dossier .next/standalone/ qui contient un serveur Node.js autonome (sans node_modules complet). Le script de build effectue trois opérations :"),
    code("# 1. Compile l'application Next.js\nnext build\n\n# 2. Copie les assets statiques\n cp -r .next/static .next/standalone/.next/\n\n# 3. Copie le dossier public\ncp -r public .next/standalone/"),
    body("Pour lancer en production :"),
    code("NODE_ENV=production node .next/standalone/server.js"),

    h2("9.6 Déploiement avec Caddy"),
    body("Le fichier Caddyfile configure un reverse proxy Caddy sur le port 81 qui redirige vers localhost:3000. Caddy gère automatiquement les certificats HTTPS via Let's Encrypt. Pour un déploiement multi-services (Next.js + WebSocket), le paramètre XTransformPort permet de router les requêtes sans exposer plusieurs ports :"),
    code("# Exemple d'URL pour un mini-service sur port 3003\nfetch('/api/test?XTransformPort=3003')\n\n# WebSocket via Caddy\nio('/?XTransformPort=3003')"),

    h2("9.7 Dépannage"),
    h3("Erreur Module not found"),
    code("rm -rf node_modules\nbun install  # ou npm install"),

    h3("Erreur de base de données"),
    code("npx prisma db push --force-reset\nnpx prisma generate"),

    h3("Port 3000 déjà utilisé"),
    code("# Linux/Mac\nlsof -ti:3000 | xargs kill -9\n\n# Windows\nnetstat -ano | findstr :3000\ntaskkill /PID <PID> /F"),

    h3("Problème de cache Next.js"),
    code("rm -rf .next\nbun run dev"),

    h3("Permissions npm sur Ubuntu"),
    body("⚠️ Règle d'or : ne jamais utiliser sudo avec npm/npx/bun sur Ubuntu. Si vous avez des problèmes de permissions, installez nvm :"),
    code("curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash\nsource ~/.bashrc\nnvm install 20\nnvm use 20"),
  ];
}

// ============================================================
// CHAPTER 10 — SCRIPTS ET EXEMPLES
// ============================================================
function chapter10() {
  return [
    h1("Chapitre 10 — Scripts et Exemples"),

    h2("10.1 Scripts utilitaires (scripts/)"),

    h3("10.1.1 create-test-accounts.ts (76 lignes)"),
    body("Script utilitaire de création de comptes de test (teacher@ecole.com et student@ecole.com) directement via Prisma. Skip les comptes déjà existants. Utilisation :"),
    code("bun run scripts/create-test-accounts.ts"),

    h3("10.1.2 generate-student-avatars.ts (193 lignes)"),
    body("Génère des avatars IA pour tous les élèves via z-ai-web-dev-sdk. Le script :"),
    bullet("Identifie les élèves sans avatar (/api/media/...)."),
    bullet("Construit un prompt photoréaliste school ID photo style basé sur prénom + genre."),
    bullet("Appelle zai.images.generations.create({ prompt, size: '1024x1024' })."),
    bullet("Stocke le PNG base64 dans MediaFile et met à jour Student.image."),
    bullet("Idempotent : skip les élèves déjà traités."),
    bullet("Gestion 429 avec retry (5 tentatives, backoff 30s) + sleep 3s entre élèves."),
    body("Utilisation :"),
    code("timeout 540 bun run scripts/generate-student-avatars.ts"),

    h2("10.2 Exemples WebSocket (examples/websocket/)"),
    body("Le dossier examples/websocket/ contient une démonstration complète de chat temps réel avec Socket.io :"),

    h3("10.2.1 server.ts (138 lignes)"),
    body("Serveur Socket.io sur port 3003. Gère les événements :"),
    bullet("join : un utilisateur rejoint le chat avec son nom."),
    bullet("message : diffusion du message à tous les clients connectés."),
    bullet("disconnect : suppression de l'utilisateur et message système."),
    bullet("Liste des utilisateurs en ligne en temps réel."),

    h3("10.2.2 frontend.tsx (197 lignes)"),
    body("Composant React de démonstration :"),
    bullet("Saisie du nom d'utilisateur au démarrage."),
    bullet("Affichage des messages en temps réel."),
    bullet("Statut de connexion (connecté/déconnecté)."),
    bullet("Liste des utilisateurs en ligne."),
    bullet("Connexion via io('/?XTransformPort=3003') pour passer par le gateway Caddy."),

    h2("10.3 Mini-services"),
    body("Le dossier mini-services/ est réservé pour héberger des micro-services externes (services WebSocket, workers, etc.). Chaque mini-service doit :"),
    bullet("Être un projet Bun indépendant avec son propre package.json et son port."),
    bullet("Définir index.ts ou index.js comme fichier d'entrée."),
    bullet("Définir un port spécifique (pas via variable d'environnement PORT)."),
    bullet("Être lancé via bun run dev en arrière-plan avec auto-restart (bun --hot)."),
    bullet("Être accessible depuis Next.js via le paramètre XTransformPort dans l'URL."),

    h2("10.4 Journal des évolutions (worklog.md)"),
    body("Le fichier worklog.md (24 800+ caractères) documente l'évolution du projet à travers 20 entrées de tâches. Chaque entrée contient :"),
    bullet("Task ID : identifiant unique de la tâche."),
    bullet("Agent : nom de l'agent ou développeur."),
    bullet("Task : description de la tâche."),
    bullet("Work Log : étapes concrètes effectuées."),
    bullet("Stage Summary : résultats clés et décisions importantes."),
    body("Ce journal permet de tracer toutes les modifications et de comprendre l'historique des décisions architecturales."),
  ];
}

// ============================================================
// CHAPTER 11 — CONCLUSION
// ============================================================
function chapter11() {
  return [
    h1("Chapitre 11 — Conclusion et Perspectives"),

    h2("11.1 Bilan technique"),
    body("Le projet MASOMO/EduGest est une application web complète de gestion scolaire qui démontre l'utilisation efficace de la stack moderne Next.js 16 + TypeScript + Prisma + Tailwind CSS. Avec environ 32 000 lignes de code réparties sur 165 fichiers, l'application couvre l'ensemble des besoins d'un établissement scolaire : gestion administrative, pédagogique, financière et communication."),
    body("L'architecture modulaire (16 modules fonctionnels) permet une maintenance et une évolution facilitées. Le système RBAC à 6 rôles offre un contrôle fin des permissions, et le support multi-institutions permet à un Super-Admin de gérer plusieurs établissements."),

    h2("11.2 Points forts"),
    bullet("Stack moderne et performante (Next.js 16, React 19, TypeScript 5)."),
    bullet("PWA installable avec mode hors-ligne."),
    bullet("Interface responsive et accessible (shadcn/ui, Radix UI)."),
    bullet("Exports professionnels PDF et Excel pour bulletins, notes et présences."),
    bullet("Système de notifications temps réel avec deep-linking."),
    bullet("Multi-institution avec SuperAdmin global."),
    bullet("Avatars IA générés via z-ai-web-dev-sdk."),
    bullet("Documentation complète (SETUP.md, worklog.md, ce document)."),

    h2("11.3 Axes d'amélioration"),
    bullet("Sécurité : activer NextAuth.js avec JWT, hacher les mots de passe avec bcrypt, ajouter rate limiting."),
    bullet("Performance : mettre en place du cache Redis pour les requêtes fréquentes."),
    bullet("Tests : ajouter des tests unitaires (Jest) et e2e (Playwright)."),
    bullet("i18n : activer next-intl pour le multilingue (français, anglais, swahili)."),
    bullet("Monitoring : ajouter Sentry pour le tracking d'erreurs en production."),
    bullet("CI/CD : configurer GitHub Actions pour les déploiements automatisés."),
    bullet("Mobile natif : envisager React Native pour une application mobile dédiée."),

    h2("11.4 Licence et utilisation"),
    body("Ce projet est fourni à des fins éducatives. Il est libre d'utilisation et de modification. Pour toute utilisation commerciale ou en production, il est recommandé de renforcer la sécurité et de respecter les réglementations locales sur la protection des données (RGPD, lois nationales sur les données des élèves)."),

    h2("11.5 Remerciements"),
    body("Ce projet a été développé avec l'aide de l'IA GLM Code (Z.ai) et utilise de nombreuses librairies open-source : Next.js, React, Prisma, Tailwind CSS, shadcn/ui, Radix UI, Recharts, Framer Motion, jsPDF, xlsx, et bien d'autres. Merci à toutes les communautés open-source qui rendent ce type de projet possible."),
  ];
}

// ============================================================
// ASSEMBLY
// ============================================================
const bodyChildren = [
  ...buildTOC(),
  ...chapter1(),
  ...chapter2(),
  ...chapter3(),
  ...chapter4(),
  ...chapter5(),
  ...chapter6(),
  ...chapter7(),
  ...chapter8(),
  ...chapter9(),
  ...chapter10(),
  ...chapter11(),
];

const doc = new Document({
  creator: "EduGest Documentation Generator",
  title: "Documentation Code Source - MASOMO/EduGest",
  description: "Documentation technique complète du code source de l'application MASOMO/EduGest",
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 22, color: c(P.body),
        },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 36, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 480, after: 240, line: 360 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 30, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 180, line: 340 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 26, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 280, after: 140, line: 320 } },
      },
    },
  },
  sections: [
    // Cover section
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCover(),
    },
    // Body section
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 4 } },
            children: [new TextRun({
              text: "MASOMO / EduGest — Documentation Technique",
              size: 18, color: c(P.secondary), italics: true,
              font: { ascii: "Calibri" },
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Page ", size: 18, color: c(P.secondary),
                font: { ascii: "Calibri" },
              }),
              new TextRun({
                children: [PageNumber.CURRENT], size: 18, color: c(P.secondary),
                font: { ascii: "Calibri" },
              }),
              new TextRun({
                text: " / ", size: 18, color: c(P.secondary),
                font: { ascii: "Calibri" },
              }),
              new TextRun({
                children: [PageNumber.TOTAL_PAGES], size: 18, color: c(P.secondary),
                font: { ascii: "Calibri" },
              }),
            ],
          })],
        }),
      },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/public/MASOMO_Documentation_Code_Source.docx", buf);
  console.log("✅ Document généré : /home/z/my-project/public/MASOMO_Documentation_Code_Source.docx");
  console.log(`   Taille : ${(buf.length / 1024).toFixed(1)} KB`);
});
