# EduGest — Code Source Complet

> **Version 11** — Archive générée à la volée, reflète toujours l'état actuel du code.

## Description
**EduGest** (MASOMO) — Système de Gestion Scolaire multi-institutions.
Application Next.js 16 complète avec gestion des élèves, enseignants, personnel,
classes, paiements, notes, présence, annonces, devoirs, calendrier, etc.

## Stack technique
- **Framework**: Next.js 16 (App Router)
- **Langage**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Base de données**: Prisma ORM (SQLite)
- **State**: Zustand (client) + TanStack Query (server)
- **Animations**: Framer Motion
- **Auth**: Sessions personnalisées (multi-institutions)
- **Realtime**: Socket.io (mini-service)

## Structure du projet
```
EduGest/
├── src/
│   ├── app/              # Routes App Router (pages + API routes)
│   │   ├── api/          # API routes (REST)
│   │   ├── layout.tsx    # Layout racine
│   │   └── page.tsx      # Point d'entrée (login / app-shell)
│   ├── components/       # Composants React
│   │   ├── ui/           # shadcn/ui primitives
│   │   └── modules/      # Modules fonctionnels (dashboard, students, ...)
│   ├── hooks/            # Hooks React personnalisés
│   └── lib/              # Utilitaires (api, store, prisma, types, ...)
├── prisma/
│   ├── schema.prisma     # Schéma de base de données
│   └── seed.ts           # Données de démonstration
├── public/               # Assets statiques (PWA, icônes, logo)
├── scripts/              # Scripts utilitaires
├── mini-services/        # Services annexes (websocket, etc.)
├── skills/               # Skills Z.ai
└── examples/             # Exemples (websocket demo)
```

## Installation
```bash
# 1. Installer les dépendances
bun install

# 2. La base de données SQLite est DÉJÀ INCLUSE dans ce ZIP :
#    - Fichier : db/custom.db
#    - Elle contient toutes les données actuelles (institutions, utilisateurs,
#      élèves, enseignants, parents, personnel, classes, paiements, etc.)
#    - Le fichier .env fourni pointe déjà vers ce fichier via DATABASE_URL.
#
#    ⚠️ Ne lancez PAS `bun run db:push` ni `bun run db:seed` si vous voulez
#       conserver les données existantes. Le seed est de toute façon conditionnel
#       (il ne s'exécute que si la base est vide).

# 3. (Optionnel) Régénérer une base vierge avec données de démo :
#    rm db/custom.db && bun run db:push && bun run db:seed

# 4. Lancer le serveur de développement
bun run dev
# → http://localhost:3000
```

## Base de données incluse
Ce ZIP contient la base SQLite **avec toutes les données actuelles** dans
`db/custom.db`. Aucune étape de migration ou de seed n'est nécessaire pour
retrouver l'état exact de l'application au moment de l'export.

Instantané des enregistrements au moment de l'export :

```
Institution: 3 | User: 121 | Student: 48 | Teacher: 13 | Parent: 48 | Staff: 9 | Class: 11 | Payment: 144 | Grade: 864 | Attendance: 240 | Homework: 0 | Announcement: 10 | Schedule: 275
```

## Comptes de démonstration
### École Internationale EduGest
- Admin: admin@ecole.com / admin123
- Enseignant: amadou.diallo@ecole.com / teacher123
- Élève: moussa.keita@ecole.com / student123
- Parent: parent@ecole.com / parent123
- Personnel: staff@ecole.com / staff123

### Lycée Test
- Admin: directeur@lycee-test.sn / lycee2024
- Enseignant: fatou.sow@lycee-test.sn / prof2024
- Élève: moussa.niang@lycee-test.sn / eleve2024
- Parent: parent@lycee-test.sn / parent2024
- Personnel: surveillant@lycee-test.sn / staff2024

### Polytech (3e institution)
- Admin: admin3@polytech.com / poly2024

### Super Admin
- superadmin@edugest.com / super123

## Fonctionnalités principales
- Tableau de bord multi-institutions (comptes filtrés par institution)
- Gestion des élèves / enseignants / personnel / parents
- Statuts spéciaux: actif, abandonné, migré, décédé (avec date)
- Gestion des classes & affectations enseignants
- **NOUVEAU v11 — Centre de notifications (cloche) entièrement fonctionnel**:
  - Badge rouge en temps réel avec le nombre de notifications non lues (polling 30 s)
  - Les **devoirs** apparaissent dans la cloche (icône BookOpen violette) pour admin/enseignants/élèves/parents
  - Les **événements du calendrier scolaire** apparaissent dans la cloche (icône Calendar teal) pour tous les utilisateurs concernés
  - Les **annonces** apparaissent dans la cloche (icône Megaphone violette) pour tous les destinataires ciblés
  - Clic sur une notification → marque comme lu + navigation vers le module concerné
  - "Tout marquer lu", suppression individuelle, indicateur de lecture
  - Correction de 3 bugs bloquants: data shape mismatch (`json.data`→`json.notifications`), static bell hardcoded → vrai composant `<NotificationDropdown />`, types/constantes manquants (`NotificationType`, `NOTIFICATION_TYPE_ICONS`)
  - Correction racine `notifyAdmins`/`notifyUser`/`notifyUsers`: `institutionId` désormais requis et transmis (le modèle `Notification.institutionId` est NOT NULL — sans cela `createMany` échouait silencieusement)
- **NOUVEAU v11 — En-tête responsive mobile**:
  - Badge d'institution masqué sous `md` (768 px) pour éviter le chevauchement avec le sélecteur d'année scolaire
  - Sélecteur d'année scolaire responsive (`w-[124px]` mobile / `w-[150px]` sm+) avec `shrink-0`
  - Gaps et tailles de police resserrés sur mobile (`gap-2`/`text-base`)
  - Vérifié sans chevauchement sur 4 tailles d'écran (390 / 640 / 768 / 1024 px)
- **NOUVEAU v11 — Création d'annonces corrigée**:
  - Ajout des champs `mediaUrl`/`mediaType` au modèle Prisma `Announcement` (l'upload de médias ne cassait plus la création)
  - Suppression du champ `authorId` invalide dans le `createMany` des notifications d'annonce (le modèle `Notification` n'a pas d'`authorId`)
- **NOUVEAU v11 — Lecteur de présence pour les élèves**:
  - Les élèves ne peuvent plus modifier ni supprimer les listes de présence (`canManage = role ∈ {admin, super_admin, teacher}`)
  - Boutons Modifier/Supprimer masqués, bannière "lecture seule"
  - Les exports PDF/Excel restent accessibles à tous
- **v10 — Export PDF & Excel des bulletins** (inclus):
  - jsPDF + autoTable, colonnes: N° ordre, Noms, Classes, Jour, Pointage
  - Cellules de pointage colorées par statut (vert/rouge/ambre/bleu)
  - En-tête avec résumé (Présents/Absents/Retard/Excusés + taux)
  - Feuille Excel "Résumé" avec indicateurs
- **v9 — Noms des enseignants visibles sur les cartes de classe**:
  - Chaque carte de classe affiche directement la liste des enseignants affectés
  - Pastilles teal "Prénom Nom · Matière" pour chaque enseignant (ex: "Amadou Diallo · Mathématiques")
  - Badge avec le nombre d'enseignants en haut à droite
  - Défilement automatique si beaucoup d'enseignants (max-h + scrollbar fine)
  - Message "Aucun enseignant assigné" si la classe n'a pas d'enseignant
  - Gestion gracieuse: "Inconnu" si l'enseignant est manquant, matière seule si pas de nom
  - Aucune modification backend (l'API renvoyait déjà la relation teachers)
  - Fichier modifié: src/components/modules/classes.tsx (ajout import GraduationCap + remplacement du bloc count)
- Notes & bulletins par trimestre
- **v8 — Restriction des notes par enseignant** (inclus):
  - Chaque enseignant ne voit et ne modifie QUE les notes de ses propres classes
  - Filtrage automatique par année scolaire active
  - Sélecteur de classe limité aux classes assignées à l'enseignant
  - Bannière "Vue enseignant" indiquant le nombre de classes, la matière et l'année
  - Sécurité côté serveur (défense en profondeur):
    * GET /api/grades → limité aux classes de l'enseignant ∪ notes qu'il a créées
    * POST /api/grades → 403 si la classe n'appartient pas à l'enseignant
    * PUT/DELETE /api/grades/[id] → 403 si la note n'appartient pas à l'enseignant
  - Nouveau helper: src/lib/teacher-classes.ts (getTeacherIdFromUserId, getTeacherClassIds)
  - Nouvelle route: src/app/api/grades/[id]/route.ts (PUT + DELETE avec garde de propriété)
- Présence (attendance) avec calendrier
- Paiements (scolarité, inscription, etc.) avec méthode & statut
- Devoirs (homework) par classe & matière
- Annonces & communication interne
- Calendrier des événements scolaires
- Emploi du temps (schedules)
- Gestion multi-années scolaires (sélecteur d'année dans l'en-tête)
- Badge d'institution animé dans l'en-tête
- Sélecteur de comptes démo par rôle sur la page de connexion
- Mode sombre / clair
- PWA installable

## Notes
- La base SQLite **est incluse** dans ce ZIP (`db/custom.db`) avec toutes les données
  actuelles (institutions, utilisateurs, élèves, enseignants, classes, notes, etc.).
- Les uploads d'images (`public/uploads/`) ne sont PAS inclus pour limiter la taille.
- Le code a été généré avec l'aide de Z.ai Code.

---

## Journal des versions

- **v11** — Centre de notifications (cloche) pleinement fonctionnel: devoirs, événements du calendrier et annonces apparaissent dans le badge. En-tête responsive mobile (plus de chevauchement). Création d'annonces corrigée (champs média + notifications). Présence en lecture seule pour les élèves. Correction racine `notifyAdmins`/`notifyUser` (`institutionId` obligatoire). Graphique de revenus du tableau de bord simplifié et lisible.
- **v10** — Export PDF & Excel des bulletins de présence (colonnes N° ordre / Noms / Classes / Jour / Pointage). Cellules colorées par statut. Feuille de résumé Excel.
- **v9** — Noms des enseignants visibles sur les cartes de classe (pastilles teal).
- **v8** — Restriction des notes par enseignant (vue + API défense en profondeur).

---
Généré automatiquement.
