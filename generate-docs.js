const { Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, TableOfContents,
  Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, PageBreak, SectionType, NumberFormat } = require("docx");
const fs = require("fs");

// ===== Palette =====
const P = {
  primary: "#162032",
  body: "#1C2A3D",
  secondary: "#5B6B7D",
  accent: "#2E8B57",
  surface: "#F0F7F4"
};
const c = (hex) => hex.replace("#", "");

// ===== Helpers =====
function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32 })]
  });
}
function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28 })]
  });
}
function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 26 })]
  });
}
function bodyText(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "SimSun" } })]
  });
}
function bodyBold(text) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 22, color: c(P.body), bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" } })]
  });
}
function codeBlock(text) {
  return new Paragraph({
    spacing: { line: 276, after: 40 },
    indent: { left: 400 },
    children: [new TextRun({ text, size: 18, color: "333333", font: { ascii: "Consolas", eastAsia: "Consolas" } })]
  });
}
function bulletItem(text) {
  return new Paragraph({
    spacing: { line: 312, after: 40 },
    indent: { left: 600 },
    children: [new TextRun({ text: `\u2022  ${text}`, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "SimSun" } })]
  });
}

// ===== Table helpers =====
const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
};
function headerCell(text, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    shading: { type: ShadingType.CLEAR, fill: c(P.accent) },
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20, font: { ascii: "Calibri", eastAsia: "SimHei" } })] })]
  });
}
function dataCell(text, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    children: [new Paragraph({
      children: [new TextRun({ text: text || "", size: 20, color: c(P.body), font: { ascii: "Calibri", eastAsia: "SimSun" } })] })]
  });
}
function dataCellCode(text, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    children: [new Paragraph({
      children: [new TextRun({ text: text || "", size: 18, color: "555555", font: { ascii: "Consolas" } })] })]
  });
}

// ===== Cover Page (R1 style) =====
function buildCover() {
  const totalHeight = 16838;
  const topSpace = 3200;
  const titleLines = ["MASOMO", "Documentation du Code Source"];
  const subtitle = "Syst\u00e8me de Gestion Scolaire";
  const metaLines = [
    "Version 0.2.0",
    "Next.js 16 \u2022 React 19 \u2022 TypeScript 5",
    "Prisma ORM \u2022 SQLite \u2022 Tailwind CSS 4 \u2022 shadcn/ui",
    new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })
  ];

  return [
    new Paragraph({ spacing: { before: topSpace }, children: [] }),
    ...titleLines.map((line, i) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100, line: 828, lineRule: "atLeast" },
        children: [new TextRun({
          text: line,
          bold: true,
          size: i === 0 ? 72 : 40,
          color: c(P.accent),
          font: { ascii: "Calibri", eastAsia: "SimHei" }
        })]
      })
    ),
    new Paragraph({ spacing: { before: 300 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: subtitle, size: 28, color: c(P.secondary), font: { ascii: "Calibri" } })] }),
    new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "\u2500".repeat(40), size: 20, color: "CCCCCC" })] }),
    ...metaLines.map(line =>
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: line, size: 22, color: c(P.secondary), font: { ascii: "Calibri" } })] })
    ),
  ];
}

// ===== Build sections =====

// --- Section 1: Introduction & Architecture ---
function buildIntroSection() {
  return [
    heading1("1. Introduction"),
    bodyText("MASOMO est un syst\u00e8me de gestion scolaire complet d\u00e9velopp\u00e9 en fran\u00e7ais, con\u00e7u pour les \u00e9tablissements francophones d'Afrique et d'ailleurs. L'application offre une plateforme centralis\u00e9e pour la gestion des \u00e9l\u00e8ves, enseignants, classes, notes, pr\u00e9sences, paiements, emplois du temps, bulletins scolaires, devoirs, communications et \u00e9v\u00e9nements."),
    bodyText("Le projet est construit comme une application monopage (SPA) utilisant Next.js 16 avec l'App Router, o\u00f9 toute la navigation se fait c\u00f4t\u00e9 client via un store Zustand, sans routage c\u00f4t\u00e9 serveur au-del\u00e0 de la page racine."),

    heading2("1.1 Stack Technique"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [
          headerCell("Technologie", 30), headerCell("Version", 20), headerCell("R\u00f4le", 50)
        ]}),
        ...([
          ["Next.js", "^16.1.1", "Framework principal avec App Router"],
          ["React", "^19.0.0", "Biblioth\u00e8que UI"],
          ["TypeScript", "^5", "Langage typ\u00e9"],
          ["Prisma ORM", "^6.11.1", "ORM pour base de donn\u00e9es SQLite"],
          ["Zustand", "^5.0.6", "Gestion d'\u00e9tat client avec persistance localStorage"],
          ["Tailwind CSS", "^4", "Framework CSS utilitaire"],
          ["shadcn/ui", "New York", "Biblioth\u00e8que de composants UI"],
          ["Recharts", "^2.15.4", "Graphiques et visualisations"],
          ["Framer Motion", "^12.23.2", "Animations et transitions"],
          ["jsPDF", "^4.2.1", "Export PDF c\u00f4t\u00e9 client"],
          ["xlsx", "^0.18.5", "Export Excel c\u00f4t\u00e9 client"],
          ["Lucide React", "^0.525.0", "Ic\u00f4nes SVG"],
          ["next-themes", "^0.4.6", "Mode clair/sombre"],
          ["date-fns", "^4.1.0", "Manipulation de dates"],
          ["zod", "^4.0.2", "Validation de sch\u00e9mas"],
          ["react-hook-form", "^7.60.0", "Gestion de formulaires"],
        ].map(([tech, ver, role]) =>
          new TableRow({ children: [dataCellCode(tech, 30), dataCell(ver, 20), dataCell(role, 50)] })
        ))
      ]
    }),

    heading2("1.2 Architecture G\u00e9n\u00e9rale"),
    bodyText("L'application suit une architecture monolithique avec s\u00e9paration claire entre le frontend (composants React) et le backend (API routes Next.js). La base de donn\u00e9es SQLite est acc\u00e9d\u00e9e via Prisma ORM."),
    bodyText("Sch\u00e9ma d'architecture :"),
    codeBlock("Navigateur (SPA)"),
    codeBlock("  \u2194 Login.tsx \u2192 AppShell \u2192 Module (1 des 15 onglets)"),
    codeBlock("  \u2194 Zustand Store (auth, nav, institution)"),
    codeBlock("  \u2194 api.ts (client fetch typ\u00e9)"),
    codeBlock("     \u2195 HTTP (x-user-role, x-institution-id)"),
    codeBlock("API Routes Next.js (37 endpoints)"),
    codeBlock("  \u2192 api-auth.ts (v\u00e9rification RBAC)"),
    codeBlock("  \u2192 Prisma Client \u2192 SQLite"),

    heading2("1.3 Authentification et Multi-Institution"),
    bodyText("L'authentification se fait en deux \u00e9tapes : (1) v\u00e9rification du mot de passe de l'institution via /api/school-config/verify, puis (2) connexion utilisateur via /api/auth/login. Le r\u00f4le utilisateur est stock\u00e9 c\u00f4t\u00e9 client dans le store Zustand et envoy\u00e9 via l'en-t\u00eate x-user-role dans chaque requ\u00eate API. Les API routes v\u00e9rifient ce r\u00f4le pour autoriser ou refuser les op\u00e9rations d'\u00e9criture."),
    bodyText("Le syst\u00e8me supporte plusieurs institutions (multi-tenant), chaque institution ayant son propre mot de passe et ses propres donn\u00e9es. L'institutionId est envoy\u00e9 via l'en-t\u00eate x-institution-id et utilis\u00e9 pour filtrer toutes les requ\u00eates Prisma."),

    heading2("1.4 Contr\u00f4le d'Acc\u00e8s RBAC"),
    bodyText("Cinq r\u00f4les sont d\u00e9finis : Administrateur (acc\u00e8s complet), Enseignant (gestion des notes et emplois du temps), \u00c9l\u00e8ve (consultation seule), Parent (suivi de la scolarit\u00e9 des enfants), Personnel (gestion limit\u00e9e). Le fichier permissions.ts d\u00e9finit une matrice de permissions d\u00e9taill\u00e9e pour chaque r\u00f4le et module, avec des fonctions utilitaires comme hasPermission(), canCreate(), canEdit(), canDelete()."),
  ];
}

// --- Section 2: Database Schema ---
function buildDatabaseSection() {
  return [
    heading1("2. Sch\u00e9ma de Base de Donn\u00e9es"),
    bodyText("La base de donn\u00e9es utilise SQLite via Prisma ORM. Le sch\u00e9ma comprend 22 mod\u00e8les couvrant tous les aspects de la gestion scolaire."),

    heading2("2.1 Liste des Mod\u00e8les"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [
          headerCell("Mod\u00e8le", 20), headerCell("Champs cl\u00e9s", 40), headerCell("Relations", 40)
        ]}),
        ...([
          ["Institution", "name, password, currentYear, active", "users, classes, announcements, events, subjects"],
          ["User", "email, password, role, userCode, institutionId", "student, teacher, parent, staff, sessions"],
          ["Student", "firstName, lastName, classId, parentId, image", "user, class, parent, grades, payments, attendances"],
          ["StudentEnrollment", "studentId, classId, schoolYear", "student, class (@@unique [studentId, schoolYear])"],
          ["Teacher", "firstName, lastName, subject, qualification, image", "user, schedules, classes, homeworks"],
          ["Parent", "firstName, lastName, phone, address, image", "user, students"],
          ["Staff", "firstName, lastName, fonction, image", "user"],
          ["Class", "name, level, section, capacity, room, schoolYear", "institution, students, teachers, schedules"],
          ["ClassTeacher", "classId, teacherId, subject", "class, teacher"],
          ["Subject", "name, code, coefficient, institutionId", "institution, grades, homeworks"],
          ["Grade", "value, maxValue(20), type, trimester, schoolYear", "student, subject"],
          ["Schedule", "classId, teacherId, dayOfWeek, startTime, endTime", "class, teacher"],
          ["Payment", "amount, type, method, status, schoolYear", "student (avec class)"],
          ["Attendance", "date, status (present/absent/late/excused)", "student"],
          ["Bulletin", "trimester, average, rank, appreciation", "student"],
          ["Announcement", "title, content, type, target, mediaUrls", "author, institution, reads"],
          ["AnnouncementRead", "announcementId, userId", "announcement (@@unique [announcementId, userId])"],
          ["Message", "senderId, receiverId, content, read", "sender, receiver, institution"],
          ["SchoolConfig", "schoolName, institutionPassword, currentYear", "institution"],
          ["SchoolEvent", "title, date, endDate, type, isGlobal", "institution, classes"],
          ["EventClass", "eventId, classId", "event, class (@@unique [eventId, classId])"],
          ["Notification", "userId, title, message, type, category, read, link", "institution"],
          ["MediaFile", "filename, mimeType, data(base64), size", "institution"],
          ["UserSession", "userId, userAgent, lastHeartbeat, isActive", "user"],
          ["Homework", "title, classId, teacherId, dueDate, type, status", "class, teacher, subject, institution, submissions"],
          ["HomeworkSubmission", "homeworkId, studentId, content, grade, status", "homework, student (@@unique [homeworkId, studentId])"],
        ].map(([model, fields, rels]) =>
          new TableRow({ children: [dataCellCode(model, 20), dataCell(fields, 40), dataCell(rels, 40)] })
        ))
      ]
    }),

    heading2("2.2 Convention de Nommage"),
    bodyText("Les codes utilisateur (userCode) suivent le format PR\u00c9FIXE-NNN : ADM-001 (administrateur), ENS-001 (enseignant), ELV-001 (\u00e9l\u00e8ve), PAR-001 (parent), STF-001 (personnel). Ces codes sont g\u00e9n\u00e9r\u00e9s automatiquement lors de la cr\u00e9ation d'un utilisateur via la fonction generateUserCode()."),
    bodyText("Le syst\u00e8me de notes utilise le syst\u00e8me fran\u00e7ais sur 20, avec trois trimestres (1er, 2eme, 3eme) et trois types de notes : devoir, examen et contr\u00f4le. L'ann\u00e9e scolaire est auto-d\u00e9tect\u00e9e : septembre-d\u00e9cembre d\u00e9marre l'ann\u00e9e en cours, janvier-ao\u00fbt utilise l'ann\u00e9e pr\u00e9c\u00e9dente."),
  ];
}

// --- Section 3: API Routes ---
function buildAPISection() {
  return [
    heading1("3. Routes API"),
    bodyText("L'application expose 37 endpoints API via les route handlers de Next.js App Router. Toutes les routes utilisent Prisma ORM pour acc\u00e9der \u00e0 la base SQLite et v\u00e9rifient les permissions via les en-t\u00eates x-user-role et x-institution-id."),

    heading2("3.1 Authentification"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [
          headerCell("Route", 25), headerCell("M\u00e9thode", 10), headerCell("Description", 35), headerCell("Acc\u00e8s", 30)
        ]}),
        ...([
          ["/api/auth/login", "POST", "Connexion avec email/code/nom + mot de passe + mot de passe institution", "Public"],
          ["/api/auth/register", "POST", "Inscription d'un nouvel utilisateur", "Public"],
          ["/api/auth/me", "GET", "R\u00e9cup\u00e9rer le profil utilisateur (param userId)", "Authentifi\u00e9"],
          ["/api/auth/profile", "GET/PUT", "Lire/modifier le profil (nom, email, t\u00e9l\u00e9phone, avatar, mot de passe)", "Authentifi\u00e9"],
        ].map(([route, method, desc, access]) =>
          new TableRow({ children: [dataCellCode(route, 25), dataCell(method, 10), dataCell(desc, 35), dataCell(access, 30)] })
        ))
      ]
    }),
    bodyText("La route de connexion supporte l'identification par email, code utilisateur (userCode), nom complet ou nom partiel. Elle v\u00e9rifie l'appartenance de l'utilisateur \u00e0 l'institution et cr\u00e9e une session (UserSession) avec heartbeat."),

    heading2("3.2 Gestion des \u00c9l\u00e8ves"),
    bodyText("Routes : GET/POST /api/students, GET/PUT/DELETE /api/students/[id]"),
    bulletItem("GET : Liste pagin\u00e9e avec filtres (search, classId, schoolYear, forSelection)"),
    bulletItem("Support de la recherche par genre (Masculin/F\u00e9minin/M/F) via mapGenderSearch()"),
    bulletItem("Les enseignants ne voient que les \u00e9l\u00e8ves de leurs classes assign\u00e9es"),
    bulletItem("Les \u00e9l\u00e8ves ne voient que leurs propres donn\u00e9es"),
    bulletItem("POST : Cr\u00e9ation automatique du compte User (email auto-g\u00e9n\u00e9r\u00e9, mot de passe par d\u00e9faut 'eleve123')"),
    bulletItem("Cr\u00e9ation automatique de l'inscription (StudentEnrollment) pour l'ann\u00e9e scolaire"),

    heading2("3.3 Gestion des Enseignants"),
    bodyText("Routes : GET/POST /api/teachers, GET/PUT/DELETE /api/teachers/[id]"),
    bulletItem("GET : Liste pagin\u00e9e avec recherche multi-champs (pr\u00e9nom, nom, mati\u00e8re, t\u00e9l\u00e9phone, qualification, email)"),
    bulletItem("POST : Cr\u00e9ation du compte User (mot de passe par d\u00e9faut 'enseignant123') + profil Teacher"),
    bulletItem("Inclusion des classes assign\u00e9es via ClassTeacher"),

    heading2("3.4 Gestion des Classes"),
    bodyText("Routes : GET/POST /api/classes, GET/PUT/DELETE /api/classes/[id]"),
    bulletItem("Filtrage par ann\u00e9e scolaire et institution"),
    bulletItem("Les enseignants ne voient que leurs classes, les \u00e9l\u00e8ves ne voient que leur classe"),
    bulletItem("POST : Cr\u00e9ation avec assignation optionnelle d'enseignants (ClassTeacher)"),

    heading2("3.5 Notes et Bulletins"),
    bodyText("Routes : GET/POST /api/grades, GET/PUT/DELETE /api/grades/[id]"),
    bulletItem("Filtres : studentId, classId, subjectId, trimester, schoolYear"),
    bulletItem("Notification automatique aux administrateurs pour les notes < 10/20"),
    bulletItem("Export PDF et Excel disponibles via /api/grades/export/pdf et /api/grades/export/excel"),
    bodyText("Routes bulletins : GET/POST /api/bulletins"),
    bulletItem("G\u00e9n\u00e9ration automatique : moyenne pond\u00e9r\u00e9e par coefficient, calcul du rang dans la classe"),
    bulletItem("Appr\u00e9ciation auto : Tr\u00e8s bien (16+), Bien (14+), Assez bien (12+), Passable (10+), Insuffisant (<10)"),

    heading2("3.6 Pr\u00e9sences"),
    bodyText("Routes : GET/POST/PUT/DELETE /api/attendance"),
    bulletItem("Support de cr\u00e9ation par lot (batch) pour marquer plusieurs \u00e9l\u00e8ves d'un coup"),
    bulletItem("Upsert automatique : mise \u00e0 jour si un enregistrement existe d\u00e9j\u00e0 pour le m\u00eame \u00e9l\u00e8ve/date"),
    bulletItem("Notification automatique aux administrateurs si 3+ absences signal\u00e9es"),
    bulletItem("Export PDF et Excel disponibles"),

    heading2("3.7 Paiements"),
    bodyText("Routes : GET/POST/PUT/DELETE /api/payments"),
    bulletItem("Types : frais de scolarit\u00e9, inscription, examen, autres"),
    bulletItem("M\u00e9thodes : esp\u00e8ces, Mobile Money, virement bancaire"),
    bulletItem("Notification automatique aux administrateurs pour chaque nouveau paiement"),
    bulletItem("Seul l'administrateur peut modifier ou supprimer un paiement"),

    heading2("3.8 Emplois du Temps"),
    bodyText("Routes : GET/POST /api/schedules, GET/PUT/DELETE /api/schedules/[id]"),
    bulletItem("dayOfWeek : 1=Lundi \u00e0 5=Vendredi"),
    bulletItem("Cr\u00e9ation r\u00e9serv\u00e9e aux administrateurs"),

    heading2("3.9 Devoirs"),
    bodyText("Routes : GET/POST /api/homework, GET/PUT/DELETE /api/homework/[id], GET/POST /api/homework/[id]/submissions"),
    bulletItem("Types : homework, project, reading, exercise"),
    bulletItem("Notifications automatiques aux administrateurs, \u00e9l\u00e8ves et parents lors de la cr\u00e9ation"),
    bulletItem("Soumissions avec notation (grade/maxGrade) et commentaires"),

    heading2("3.10 Annonces et Messages"),
    bodyText("Routes annonces : GET/POST/PUT/DELETE /api/announcements"),
    bulletItem("Support de m\u00e9dias (images/vid\u00e9os) stock\u00e9s en base64 dans MediaFile"),
    bulletItem("Types : g\u00e9n\u00e9ral, urgent, acad\u00e9mique, \u00e9v\u00e9nement"),
    bulletItem("Cibles : tout le monde, enseignants, \u00e9l\u00e8ves, parents"),
    bulletItem("Ann\u00e9e scolaire auto-d\u00e9duite de la date de l'annonce"),
    bulletItem("Notifications automatiques aux utilisateurs cibl\u00e9s"),
    bodyText("Routes messages : GET/POST /api/messages"),
    bulletItem("Messagerie interne entre utilisateurs de la m\u00eame institution"),

    heading2("3.11 \u00c9v\u00e9nements"),
    bodyText("Routes : GET/POST/PUT/DELETE /api/events"),
    bulletItem("Types : holiday, exam, meeting, celebration, deadline, other"),
    bulletItem("\u00c9v\u00e9nements globaux (tout l'\u00e9tablissement) ou sp\u00e9cifiques \u00e0 des classes"),
    bulletItem("Notification automatique aux administrateurs"),

    heading2("3.12 Notifications"),
    bodyText("Routes : GET/POST/PUT/DELETE /api/notifications, PUT /api/notifications/mark-all-read, POST /api/notifications/generate"),
    bulletItem("Notifications dynamiques incluant : enregistrements DB, annonces non notifi\u00e9es, devoirs \u00e0 venir"),
    bulletItem("9 types : info, warning, success, error, payment, attendance, announcement, event, homework"),
    bulletItem("8 cat\u00e9gories : payment, attendance, announcement, event, homework, academic, system, general"),
    bulletItem("G\u00e9n\u00e9ration automatique de notifications initiales pour les administrateurs"),

    heading2("3.13 Autres Routes"),
    bulletItem("/api/institutions (GET/POST) : Gestion multi-institution"),
    bulletItem("/api/subjects (GET/POST) : Gestion des mati\u00e8res"),
    bulletItem("/api/parents (GET/POST) : Gestion des parents"),
    bulletItem("/api/staff (GET/POST) : Gestion du personnel"),
    bulletItem("/api/school-config (GET/PUT) : Configuration de l'\u00e9tablissement"),
    bulletItem("/api/school-config/verify (POST) : V\u00e9rification du mot de passe institution"),
    bulletItem("/api/sessions (GET/PUT/DELETE) : Gestion des sessions utilisateur (heartbeat)"),
    bulletItem("/api/dashboard (GET) : Statistiques du tableau de bord"),
    bulletItem("/api/seed (GET/POST) : Initialisation/r\u00e9initialisation de la base de donn\u00e9es"),
    bulletItem("/api/upload-media (POST) : Upload de fichiers m\u00e9dia"),
    bulletItem("/api/media/[id] (GET) : R\u00e9cup\u00e9ration de fichiers m\u00e9dia"),
    bulletItem("/api/users (GET) : Liste des utilisateurs"),
    bulletItem("/api/users/password (PUT) : Gestion des mots de passe"),
    bulletItem("/api/enhance-image (POST) : Am\u00e9lioration d'image c\u00f4t\u00e9 serveur"),
    bulletItem("/api/download (GET) : T\u00e9l\u00e9chargement de fichiers"),
  ];
}

// --- Section 4: Frontend Components ---
function buildFrontendSection() {
  return [
    heading1("4. Composants Frontend"),
    bodyText("L'interface est construite avec React 19, shadcn/ui et Tailwind CSS 4. Tous les composants sont des composants client ('use client') utilisant le store Zustand pour l'\u00e9tat global et l'API fetch pour les donn\u00e9es."),

    heading2("4.1 Structure de l'Application"),
    heading3("4.1.1 page.tsx (67 lignes)"),
    bodyText("Point d'entr\u00e9e unique de l'application. Charge dynamiquement les composants Login et AppShell via import() dynamique. Affiche un \u00e9cran de chargement anim\u00e9 pendant le chargement, puis affiche Login ou AppShell selon l'\u00e9tat d'authentification du store Zustand."),
    heading3("4.1.2 layout.tsx (49 lignes)"),
    bodyText("Layout racine avec les polices Geist (sans et mono), ThemeProvider (next-themes) pour le mode clair/sombre, et le composant Toaster (sonner) pour les notifications toast. M\u00e9tadonn\u00e9es : titre 'MASOMO - Syst\u00e8me de Gestion Scolaire', manifest PWA, ic\u00f4ne SVG."),
    heading3("4.1.3 globals.css (164 lignes)"),
    bodyText("Th\u00e8me Tailwind CSS 4 avec tokens oklch pour le syst\u00e8me de couleurs emerald/teal. D\u00e9finition compl\u00e8te des variables CSS pour le mode clair et sombre, incluant : background, foreground, primary, secondary, muted, accent, destructive, card, popover, sidebar, chart colors. Styles de scrollbar personnalis\u00e9s."),

    heading2("4.2 Composants Principaux"),
    heading3("4.2.1 app-shell.tsx (875 lignes)"),
    bodyText("Composant principal de l'application apr\u00e8s connexion. Contient :"),
    bulletItem("Barre lat\u00e9rale (SidebarNav) avec navigation par module, \u00e9tat repliable, tooltips"),
    bulletItem("En-t\u00eate avec titre de page, badge institution, informations utilisateur, utilisateurs en ligne, s\u00e9lecteur d'ann\u00e9e scolaire, toggle th\u00e8me, dropdown notifications, menu utilisateur"),
    bulletItem("Session heartbeat (PUT /api/sessions toutes les 30 secondes)"),
    bulletItem("Suivi des utilisateurs en ligne (GET /api/sessions toutes les 15 secondes)"),
    bulletItem("D\u00e9connexion propre (DELETE /api/sessions + navigator.sendBeacon on tab close)"),
    bulletItem("R\u00e9solution d'avatar en cascade : user.avatar \u2192 student.image \u2192 teacher.image \u2192 parent.image \u2192 staff.image"),
    bulletItem("ModuleErrorBoundary : error boundary par module avec bouton de retry"),
    bulletItem("Rendu du module actif via switch sur activeModule avec AnimatePresence"),

    heading3("4.2.2 login.tsx (755 lignes)"),
    bodyText("Composant de connexion en deux \u00e9tapes :"),
    bulletItem("\u00c9tape 1 : V\u00e9rification du mot de passe institution (/api/school-config/verify)"),
    bulletItem("\u00c9tape 2 : Connexion utilisateur via email, code ou nom (/api/auth/login)"),
    bulletItem("Passage automatique \u00e0 l'\u00e9tape 2 si les identifiants institution sont d\u00e9j\u00e0 enregistr\u00e9s"),
    bulletItem("V\u00e9rification de l'\u00e9tat de la base de donn\u00e9es au montage (GET /api/seed \u2192 GET /api/dashboard)"),
    bulletItem("Bouton d'initialisation de la base (POST /api/seed, mode 'init')"),
    bulletItem("Boutons de d\u00e9monstration rapide pour chaque r\u00f4le (Admin, Enseignant, \u00c9l\u00e8ve, Parent, Personnel)"),
    bulletItem("R\u00e9f\u00e9rence compl\u00e8te des comptes pr\u00e9-remplis (2 institutions, 2 admins, 5 enseignants, 20 \u00e9l\u00e8ves, 5 parents, 5 personnels)"),

    heading3("4.2.3 notification-dropdown.tsx (384 lignes)"),
    bodyText("Dropdown de notifications avec ic\u00f4ne cloche et badge non-lus. Fonctionnalit\u00e9s : fetch toutes les 30 secondes, marquer comme lu, tout marquer comme lu, supprimer, navigation vers le module li\u00e9, affichage du temps relatif en fran\u00e7ais."),

    heading3("4.2.4 data-pagination.tsx (117 lignes)"),
    bodyText("Composant de pagination r\u00e9utilisable avec affichage 'Affichage X \u00e0 Y sur Z enregistrements', num\u00e9ros de page avec ellipsis, et navigation pr\u00e9c\u00e9dent/suivant."),

    heading3("4.2.5 image-dropzone.tsx (416 lignes)"),
    bodyText("Zone de d\u00e9p\u00f4t d'image avec drag-and-drop et s\u00e9lection de fichier. Pipeline de traitement : redimensionnement (max 400x400), filtre de nettet\u00e9 (convolution 3x3), ajustement luminosit\u00e9/contraste, compression JPEG. Upload vers /api/upload-media avec am\u00e9lioration IA optionnelle via /api/enhance-image."),

    heading2("4.3 Modules Fonctionnels"),
    heading3("4.3.1 dashboard.tsx (1041 lignes)"),
    bodyText("Tableau de bord avec statistiques cl\u00e9s : total \u00e9l\u00e8ves/enseignants/classes/parents/personnel, revenus, paiements en attente. Visualisations : taux de pr\u00e9sence, graphique en barres (\u00e9l\u00e8ves par classe), camembert (r\u00e9partition par genre), m\u00e9thodes de paiement, histogramme par ann\u00e9e. Activit\u00e9s r\u00e9centes, inscriptions r\u00e9centes, annonces, utilisateurs en ligne."),

    heading3("4.3.2 students.tsx (1337 lignes)"),
    bodyText("Module CRUD complet pour les \u00e9l\u00e8ves. Fonctionnalit\u00e9s : recherche, filtres (classe, genre), pagination, ajout/modification/suppression, vue d\u00e9tail, export Excel/PDF/impression, gestion de photo avec ImageDropZone, vue mobile en cartes."),

    heading3("4.3.3 teachers.tsx (1103 lignes)"),
    bodyText("Module CRUD pour les enseignants. M\u00eames fonctionnalit\u00e9s que students avec en plus : vue d\u00e9tail avec classes assign\u00e9es et emploi du temps."),

    heading3("4.3.4 parents.tsx (1186 lignes)"),
    bodyText("Module CRUD pour les parents. Sp\u00e9cificit\u00e9s : affichage des enfants associ\u00e9s, mot de passe par d\u00e9faut 'parent123', vue d\u00e9tail avec liste des enfants."),

    heading3("4.3.5 staff.tsx (1003 lignes)"),
    bodyText("Module CRUD pour le personnel administratif. 16 fonctions pr\u00e9d\u00e9finies (Secr\u00e9taire, Comptable, Surveillant, etc.). Mot de passe par d\u00e9faut 'personnel123'."),

    heading3("4.3.6 classes.tsx (879 lignes)"),
    bodyText("Module CRUD pour les classes. Vue en grille de cartes, dialogue de d\u00e9tail avec 3 onglets (\u00c9l\u00e8ves, Enseignants, Emploi du temps), assignation d'enseignants par mati\u00e8re."),

    heading3("4.3.7 schedule.tsx (757 lignes)"),
    bodyText("Module d'emploi du temps hebdomadaire. Grille horaire du lundi au vendredi (07:00-19:00), s\u00e9lecteur de classe, vue mobile par jour, couleurs par mati\u00e8re, CRUD de cr\u00e9neaux."),

    heading3("4.3.8 grades.tsx (1122 lignes)"),
    bodyText("Module de gestion des notes. Statistiques (moyenne, taux de r\u00e9ussite), distribution des notes, filtres (classe, mati\u00e8re, trimestre, type), CRUD, export PDF/Excel."),

    heading3("4.3.9 homework.tsx (1251 lignes)"),
    bodyText("Module de devoirs. Types (devoir, projet, lecture, exercice), soumissions avec notation, vue parent (enfants uniquement), d\u00e9tection des retards, CRUD complet."),

    heading3("4.3.10 bulletins.tsx (561 lignes)"),
    bodyText("Module de bulletins scolaires. G\u00e9n\u00e9ration automatique (moyenne pond\u00e9r\u00e9e, rang, appr\u00e9ciation), vue d\u00e9tail avec tableau de notes, impression."),

    heading3("4.3.11 attendance.tsx (1370 lignes)"),
    bodyText("Module de pr\u00e9sences. Trois vues : liste (group\u00e9e par date/classe), cr\u00e9ation (s\u00e9lection classe+date puis marquage par \u00e9l\u00e8ve), \u00e9dition. Export PDF/Excel."),

    heading3("4.3.12 payments.tsx (1746 lignes)"),
    bodyText("Module de paiements. Re\u00e7u PDF (format A5 stylis\u00e9), export Excel, re\u00e7u thermique (58mm/80mm), simulation Mobile Money (Orange Money, MTN, Wave, Moov)."),

    heading3("4.3.13 school-calendar.tsx (1373 lignes)"),
    bodyText("Calendrier scolaire. Vues calendrier/agenda, navigation par mois avec raccourcis ann\u00e9e scolaire, graphique de distribution des \u00e9v\u00e9nements, CRUD."),

    heading3("4.3.14 communication.tsx (1812 lignes)"),
    bodyText("Module de communication avec deux onglets : annonces et messages. \u00c9diteur de texte riche (contentEditable avec barre d'outils), upload de m\u00e9dias (images/vid\u00e9os, max 10MB), lightbox pour visualisation des m\u00e9dias."),

    heading3("4.3.15 settings.tsx (2578 lignes)"),
    bodyText("Module de param\u00e8tres. Sections : profil utilisateur, configuration \u00e9tablissement, th\u00e8me (clair/sombre/syst\u00e8me), gestion des utilisateurs, gestion des mots de passe (par r\u00f4le et individuel), gestion du personnel, multi-institution, base de donn\u00e9es (seed/reset/download)."),

    heading3("4.3.16 enrollments-table.tsx (126 lignes)"),
    bodyText("Composant r\u00e9utilisable affichant les inscriptions r\u00e9centes avec pagination (10 par page), avatars color\u00e9s par genre, dates en fran\u00e7ais."),
  ];
}

// --- Section 5: Library Files ---
function buildLibSection() {
  return [
    heading1("5. Biblioth\u00e8ques et Utilitaires"),

    heading2("5.1 store.ts (149 lignes) - Store Zustand"),
    bodyText("Store global avec persistance localStorage (cl\u00e9 'masomo-storage'). \u00c9tat persist\u00e9 : currentUser, isAuthenticated, sessionId, activeModule, sidebarOpen, schoolYear, institutionId/Name/Password. \u00c9tat non persist\u00e9 : onlineUsers, toasts. Actions : login/logout, setActiveModule, setInstitution/clearInstitution, addToast/removeToast avec auto-suppression apr\u00e8s 5 secondes."),

    heading2("5.2 api.ts (553 lignes) - Client API Typ\u00e9"),
    bodyText("Client REST typ\u00e9 pour tous les endpoints CRUD. Utilise un fetch wrapper (apiFetch) avec gestion d'erreurs (ApiError), constructeur de query params (buildQuery). Modules : authApi, studentsApi, teachersApi, classesApi, gradesApi, schedulesApi, paymentsApi, bulletinsApi, announcementsApi, messagesApi, attendanceApi, subjectsApi, dashboardApi, seedApi."),

    heading2("5.3 types.ts (664 lignes) - Types TypeScript"),
    bodyText("D\u00e9finitions compl\u00e8tes de tous les types TypeScript align\u00e9s sur le sch\u00e9ma Prisma. Inclut : types de base (UserRole, GradeType, Trimester, etc.), mod\u00e8les de domaine (Institution, User, Student, Teacher, etc.), types de requ\u00eate/r\u00e9ponse API, types de statistiques du dashboard, types de notifications et toasts."),

    heading2("5.4 constants.ts (459 lignes) - Constantes Francophones"),
    bodyText("Toutes les constantes UI en fran\u00e7ais : NAV_ITEMS (15 modules avec ic\u00f4nes), ROLES et ROLE_LABELS, GRADE_TYPES/GRADE_TYPE_LABELS, PAYMENT_TYPES/METHODS/STATUSES, ATTENDANCE_STATUSES, DAYS_OF_WEEK (Lun-Ven), TRIMESTERS, CLASS_LEVELS (CP \u00e0 Terminale, par cycle), TIME_SLOTS (07:00-19:30), CURRENT_SCHOOL_YEAR (auto-d\u00e9tect\u00e9), NOTIFICATION_TYPES/CATEGORIES."),

    heading2("5.5 permissions.ts (276 lignes) - Syst\u00e8me RBAC"),
    bodyText("Matrice de permissions d\u00e9taill\u00e9e : 35 permissions (view/create/edit/delete par module) pour 5 r\u00f4les. Visibilit\u00e9 des modules par r\u00f4le (MODULE_VISIBILITY). Fonctions utilitaires : hasPermission(), canCreate(), canEdit(), canDelete(), canView(), isModuleVisible(), getVisibleModules(), isAdmin(), isTeacher(), isStudent(), canWriteResource()."),

    heading2("5.6 api-auth.ts (148 lignes) - Protection API"),
    bodyText("Protection des routes API c\u00f4t\u00e9 serveur. Matrice WRITE_ACCESS d\u00e9finissant les r\u00f4les autoris\u00e9s en \u00e9criture par ressource. Lecture du r\u00f4le depuis l'en-t\u00eate x-user-role. Support multi-institution avec cache en m\u00e9moire (TTL 5 min) pour les lookups institutionId. Fonctions : checkApiAccess(), getInstitutionId(), getInstitutionIdWithFallback()."),

    heading2("5.7 db.ts (12 lignes) - Client Prisma"),
    bodyText("Singleton PrismaClient avec d\u00e9duplication en d\u00e9veloppement (pattern standard Next.js avec globalThis)."),

    heading2("5.8 utils.ts (21 lignes) - Utilitaires"),
    bodyText("Fonction cn() (clsx + tailwind-merge) pour la composition de classes CSS. Fonction getImageUrl() pour convertir les URLs d'images upload\u00e9es en URLs proxy fonctionnelles en mode standalone."),

    heading2("5.9 notifications.ts (58 lignes) - Aide aux Notifications"),
    bodyText("Fonctions serveur pour cr\u00e9er des notifications : notifyAdmins() envoie \u00e0 tous les administrateurs actifs, notifyUser() envoie \u00e0 un utilisateur sp\u00e9cifique. Utilis\u00e9es par les routes API lors d'\u00e9v\u00e9nements cl\u00e9s."),

    heading2("5.10 image-processing.ts (236 lignes) - Traitement d'Images"),
    bodyText("Pipeline de traitement d'images c\u00f4t\u00e9 client : recadrage centr\u00e9 carr\u00e9, redimensionnement (400x400), masque flou (unsharp mask) pour la nettet\u00e9, ajustement automatique luminosit\u00e9/contraste, compression JPEG (qualit\u00e9 0.88). Fonction analyzeImageQuality() pour \u00e9valuer si une image n\u00e9cessite une am\u00e9lioration (score 0-100)."),
  ];
}

// --- Section 6: Hooks ---
function buildHooksSection() {
  return [
    heading1("6. Hooks Personnalis\u00e9s"),

    heading2("6.1 use-offline.ts (39 lignes)"),
    bodyText("Hook d\u00e9tectant le statut en ligne/hors ligne via useSyncExternalStore. Suit \u00e9galement les transitions offline\u2192online avec le flag wasOffline (r\u00e9initialis\u00e9 apr\u00e8s 5 secondes), utilis\u00e9 pour afficher un toast 'De retour en ligne'."),

    heading2("6.2 use-toast.ts (194 lignes)"),
    bodyText("Syst\u00e8me de toast imp\u00e9ratif (shadcn/ui pattern). Store externe avec reducer (ADD/UPDATE/DISMISS/REMOVE), limite de 1 toast visible, file d'attente de suppression automatique. API : toast({...}), dismiss(id), useToast() hook."),

    heading2("6.3 use-mobile.ts (20 lignes)"),
    bodyText("Hook d\u00e9tectant la taille d'\u00e9cran mobile (< 768px) via window.matchMedia avec \u00e9couteur d'\u00e9v\u00e9nements pour les changements dynamiques."),
  ];
}

// --- Section 7: Configuration ---
function buildConfigSection() {
  return [
    heading1("7. Configuration du Projet"),

    heading2("7.1 next.config.ts"),
    codeBlock("output: 'standalone'"),
    codeBlock("typescript.ignoreBuildErrors: true"),
    codeBlock("reactStrictMode: false"),
    codeBlock("experimental.serverActions.bodySizeLimit: '50mb'"),

    heading2("7.2 tsconfig.json"),
    codeBlock("target: ES2017, module: esnext, moduleResolution: bundler"),
    codeBlock("strict: true, noImplicitAny: false"),
    codeBlock("paths: { '@/*': ['./src/*'] }"),

    heading2("7.3 tailwind.config.ts"),
    codeBlock("darkMode: 'class'"),
    codeBlock("Couleurs via variables CSS HSL (primary, secondary, muted, accent, etc.)"),
    codeBlock("Plugin: tailwindcss-animate"),

    heading2("7.4 Composants shadcn/ui"),
    bodyText("49 composants shadcn/ui sont install\u00e9s dans src/components/ui/, couvrant : accordion, alert, alert-dialog, avatar, badge, button, calendar, card, carousel, chart, checkbox, command, dialog, drawer, dropdown-menu, form, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toggle, tooltip. Style 'New York', couleur de base 'neutral', ic\u00f4nes Lucide."),

    heading2("7.5 Scripts de Base de Donn\u00e9es"),
    bulletItem("seed-events.ts : Peuplement des \u00e9v\u00e9nements du calendrier scolaire"),
    bulletItem("create-test-accounts.ts : Cr\u00e9ation de comptes de test"),
    bulletItem("export-db.ts : Export de la base de donn\u00e9es en SQL"),
    bulletItem("assign-institution.ts : Assignation d'utilisateurs \u00e0 une institution"),
    bulletItem("bun run db:push : Appliquer le sch\u00e9ma Prisma \u00e0 la base"),
    bulletItem("bun run db:generate : G\u00e9n\u00e9rer le client Prisma"),
    bulletItem("bun run db:reset : R\u00e9initialiser la base de donn\u00e9es"),
  ];
}

// --- Section 8: Security ---
function buildSecuritySection() {
  return [
    heading1("8. S\u00e9curit\u00e9 et Bonnes Pratiques"),

    heading2("8.1 Authentification"),
    bulletItem("Mots de passe stock\u00e9s en clair dans SQLite ( limitation du prototype - production n\u00e9cessiterait bcrypt)"),
    bulletItem("Double v\u00e9rification : mot de passe institution + identifiants utilisateur"),
    bulletItem("Sessions avec heartbeat (30s) et d\u00e9connexion propre via navigator.sendBeacon"),

    heading2("8.2 Contr\u00f4le d'Acc\u00e8s"),
    bulletItem("R\u00f4le envoy\u00e9 via en-t\u00eate HTTP (x-user-role) - confiance c\u00f4t\u00e9 serveur"),
    bulletItem("Matrice de permissions c\u00f4t\u00e9 serveur (api-auth.ts) et c\u00f4t\u00e9 client (permissions.ts)"),
    bulletItem("Filtrage par institutionId sur toutes les requ\u00eates Prisma"),
    bulletItem("Les enseignants ne voient que les donn\u00e9es de leurs classes"),
    bulletItem("Les \u00e9l\u00e8ves ne voient que leurs propres donn\u00e9es"),

    heading2("8.3 Upload de Fichiers"),
    bulletItem("Fichiers m\u00e9dia stock\u00e9s en base64 dans MediaFile (SQLite)"),
    bulletItem("Limite de taille : 10 MB par fichier, 50 MB pour le corps de la requ\u00eate"),
    bulletItem("Types accept\u00e9s : images (JPG, PNG, GIF, WebP), vid\u00e9os (MP4, WebM, MOV, etc.)"),
    bulletItem("Traitement d'image c\u00f4t\u00e9 client : recadrage, redimensionnement, nettet\u00e9"),

    heading2("8.4 Limitations Connues"),
    bulletItem("Mots de passe non hach\u00e9s (prototype)"),
    bulletItem("Pas de HTTPS obligatoire"),
    bulletItem("Pas de rate limiting sur les endpoints API"),
    bulletItem("Pas de validation CSRF"),
    bulletItem("Fichiers stock\u00e9s en base64 (non optimis\u00e9 pour les gros volumes)"),
    bulletItem("Authentification bas\u00e9e sur des en-t\u00eates personnalis\u00e9s (pas de JWT)"),
  ];
}

// ===== Assemble Document =====
const coverChildren = buildCover();
const bodyChildren = [
  ...buildIntroSection(),
  new Paragraph({ children: [new PageBreak()] }),
  ...buildDatabaseSection(),
  new Paragraph({ children: [new PageBreak()] }),
  ...buildAPISection(),
  new Paragraph({ children: [new PageBreak()] }),
  ...buildFrontendSection(),
  new Paragraph({ children: [new PageBreak()] }),
  ...buildLibSection(),
  new Paragraph({ children: [new PageBreak()] }),
  ...buildHooksSection(),
  new Paragraph({ children: [new PageBreak()] }),
  ...buildConfigSection(),
  new Paragraph({ children: [new PageBreak()] }),
  ...buildSecuritySection(),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      }
    }
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
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 300 },
          children: [new TextRun({ text: "Table des Mati\u00e8res", bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
        }),
        new TableOfContents("Table des Mati\u00e8res", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [new TextRun({ text: "(Clic droit sur la table \u2192 \u00ab Mettre \u00e0 jour les champs \u00bb pour rafra\u00eechir les num\u00e9ros de page)", italics: true, size: 18, color: c(P.secondary) })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Section 3: Body (Arabic numerals, start at 1)
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
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "MASOMO \u2014 Documentation du Code Source", size: 16, color: c(P.secondary), italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) }),
            ],
          })],
        }),
      },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/MASOMO_Documentation_Code_Source.docx", buf);
  console.log("Document generated: MASOMO_Documentation_Code_Source.docx");
});
