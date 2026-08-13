# MASOMO Source — Version déploiement Vercel

Version : 1.29.0
Date : 2026-08-12

## Contenu de cette archive

Code source complet de MASOMO (système de gestion scolaire) avec toutes les modifications nécessaires au déploiement sur Vercel.

## Fichiers ajoutés/modifiés pour le déploiement Vercel

| Fichier | Action | Rôle |
|---------|--------|------|
| `vercel.json` | AJOUT | Config Vercel (framework Next.js, build command) |
| `prisma.config.ts` | MODIFIÉ | Ajout de `dotenv.config()` pour Prisma 6.19+ |
| `.env.vercel.example` | AJOUT | Template des variables d'environnement |
| `DEPLOYMENT-GUIDE.md` | AJOUT | Guide de déploiement pas à pas (8 étapes) |
| `scripts/migrate-export.ts` | AJOUT | Export SQLite → JSON |
| `scripts/migrate-import.ts` | AJOUT | Import JSON → PostgreSQL |
| `scripts/migrate-switch-to-postgres.ts` | AJOUT | Bascule schema sqlite → postgresql |
| `package.json` | MODIFIÉ | Scripts `vercel-build`, `migrate:*` ajoutés |
| `src/app/layout.tsx` | MODIFIÉ | Remplacement Google Fonts par polices système |
| `src/app/globals.css` | MODIFIÉ | Variables CSS pour polices système |
| `.gitignore` | MODIFIÉ | Exclusion `db/migration-data/`, `*.sqlite.bak` |

## Installation rapide

```bash
unzip masomo-source-vercel.zip
cd MASOMO-SOURCE
bun install
bun run dev
```

Ouvrez http://localhost:3000

## Identifiants de démonstration

- Institution : admin@ecole.com / admin123
- Super Admin : superadmin@edugest.com / super123

## Déploiement sur Vercel

Lisez DEPLOYMENT-GUIDE.md — 8 étapes détaillées :

1. Créer une base PostgreSQL sur Neon (https://neon.tech)
2. bun run migrate:export (exporte ~7700 lignes en JSON)
3. bun run migrate:switch-to-postgres (bascule le schéma)
4. Mettre à jour .env + bun run db:push + bun run migrate:import
5. Pousser sur GitHub
6. Importer le projet sur Vercel
7. Configurer les variables d'environnement sur Vercel
8. Déployer

## Données incluses

Base SQLite db/custom.db (3 Mo) avec données de démonstration :
- 15 institutions, 658 users, 393 élèves, 110 enseignants
- 124 parents, 74 classes, 49 matières, 3630 notes
- 1260 créneaux, 501 paiements, 511 présences, 32 annonces
- 7723 lignes au total sur 26 tables

## Exclusions

- node_modules/ (régénéré par bun install)
- .next/ (régénéré par bun run build)
- .git/ (historique de version)
- scripts-doc/video-assets/ (assets vidéo lourds, ~17 Mo)
- prisma/db/custom.db (doublon de db/custom.db)

## Stack technique

- Framework : Next.js 16 (App Router, webpack)
- Langage : TypeScript 5
- Base de données : Prisma ORM (SQLite local, PostgreSQL sur Vercel)
- UI : Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons
- Auth : Client-side (Zustand store + headers x-user-role)
- State : Zustand (client) + TanStack Query (server)
- Fonts : System fonts (remplacement Google Fonts pour le sandbox)
