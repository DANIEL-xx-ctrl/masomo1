# EduGest — Code Source Complet

Cette archive contient le code source complet du projet **EduGest** (Next.js 16 + TypeScript + Prisma + SQLite).

## Contenu de l'archive

| Dossier / Fichier           | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `src/`                      | Code source de l'application (App Router, composants, hooks, lib) |
| `src/app/`                  | Routes App Router (pages, API routes)                        |
| `src/components/`           | Composants UI (shadcn/ui) et modules fonctionnels            |
| `src/hooks/`                | Hooks React personnalisés                                    |
| `src/lib/`                  | Utilitaires, store Zustand, types, constantes, db client     |
| `prisma/`                   | Schéma Prisma, migrations, seeds                             |
| `mini-services/`            | Services indépendants (websocket, etc.)                      |
| `examples/`                 | Exemples de code (démo websocket)                            |
| `scripts/`                  | Scripts utilitaires (build source zip, etc.)                 |
| `masomo-backup-scripts/`    | Scripts de sauvegarde                                        |
| `.zscripts/`                | Scripts daemon (production)                                  |
| `agent-ctx/`                | Contexte de travail des agents                               |
| `public/`                   | Assets statiques (manifest, icons, sw, fonts, logo)          |
| `package.json`              | Dépendances et scripts npm/bun                               |
| `bun.lock` / `package-lock.json` | Lockfiles des dépendances                              |
| `tsconfig.json`             | Configuration TypeScript                                     |
| `next.config.ts`            | Configuration Next.js 16                                     |
| `tailwind.config.ts`        | Configuration Tailwind CSS 4                                 |
| `postcss.config.mjs`        | Configuration PostCSS                                        |
| `eslint.config.mjs`         | Configuration ESLint                                         |
| `components.json`           | Configuration shadcn/ui (style New York)                     |
| `Caddyfile`                 | Configuration du gateway Caddy                               |
| `.env.example`              | Modèle de variables d'environnement (SANS secrets)           |
| `.gitignore`                | Règles d'exclusion git                                       |
| `README.md` / `README-SOURCE.md` / `SETUP.md` / `INSTALLATION-VSCODE.md` | Documentation |
| `setup.bat` / `setup.ps1`   | Scripts d'installation Windows                               |
| `run*.sh` / `start*.sh` / `restart.sh` / `keep-alive.sh` / `watchdog-dev.sh` | Scripts de lancement |

## Exclusions (non incluses dans l'archive)

- `node_modules/` — dépendances installées (régénérées via `bun install`)
- `.next/` — build artifacts
- `.git/` — historique de version
- `db/*.db`, `db/*.db-shm`, `db/*.db-wal` — bases de données SQLite binaires
- `skills/` — compétences tierces Z.ai (73 Mo, non spécifiques au projet)
- `scripts-doc/` — documentation PDF/vidéo lourde
- Captures d'écran `.png` à la racine du projet (~250 fichiers)
- Fichiers `.zip`, `.mp4`, `.docx`, `.pdf` déjà présents dans `public/`
- Contenu utilisateur (`public/announcements/`, `public/avatars/`, `public/uploads/`)
- Logs (`dev.log`, `*.log`) et PID files
- Dossiers de vérification (`verification-*`, `tool-results/`, `test-results/`, `download/`)

## Stack technique

- **Framework** : Next.js 16 (App Router) + Turbopack
- **Langage** : TypeScript 5
- **Runtime** : Bun
- **Styling** : Tailwind CSS 4 + shadcn/ui (style New York)
- **Database** : Prisma ORM + SQLite (`db/custom.db`)
- **State** : Zustand (client) + TanStack Query (server)
- **Auth** : NextAuth.js v4
- **Animations** : Framer Motion
- **Icons** : Lucide React

## Installation

```bash
# 1. Installer les dépendances
bun install

# 2. Configurer l'environnement
cp .env.example .env
# éditer .env avec vos valeurs

# 3. Pousser le schéma Prisma vers la base SQLite
bun run db:push

# 4. (Optionnel) Seeder la base
bun run db:seed

# 5. Lancer le serveur de développement
bun run dev
```

L'application démarre sur le port 3000.

## Scripts disponibles

```bash
bun run dev      # serveur de développement (Turbopack, port 3000)
bun run build    # build de production (standalone)
bun run start    # serveur de production
bun run lint     # ESLint
bun run db:push  # pousser le schéma Prisma
bun run db:seed  # insérer les données de démonstration
```

## Structure de la base de données

Le schéma Prisma (`prisma/schema.prisma`) définit les modèles :

- `Institution` — établissements scolaires (multi-tenant)
- `User` — utilisateurs (admin, super_admin, teacher, parent, student)
- `Student` — élèves
- `Teacher` — enseignants
- `Parent` — parents
- `Class` — classes
- `Payment` — paiements (avec reçu)
- `Bulletin` — bulletins de notes
- `Grade` — notes
- `Attendance` — présences
- `Announcement` — annonces/communications
- `Timetable` — emplois du temps
- `Homework` — devoirs
- Et plus encore…

## Fonctionnalités principales

- Tableau de bord avec statistiques par année scolaire
- Gestion multi-établissements (super_admin)
- Gestion des élèves, enseignants, parents, classes
- Gestion des paiements avec reçus exportables (PDF, Excel, Word, ticket thermique)
- Bulletins de notes exportables (PDF, Excel, Word)
- Gestion des présences (présence/absence/retard)
- Communications / annonces
- Emplois du temps
- Devoirs
- Proclamations de résultats
- Filtre par année scolaire
- Authentification par rôles
- Mode sombre / clair
- Design responsive (mobile-first)

## License

Code source propriétaire du projet EduGest.

---

_Généré automatiquement le $(date +%Y-%m-%d)._
