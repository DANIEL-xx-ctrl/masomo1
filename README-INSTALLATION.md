# Modifications — Gestion des bulletins + Dashboard + Cours & Maxima

## Nouveautés

### 1. Gestion des bulletins (Paramètres > Institution)
- Upload multiple de fichiers Excel (.xlsx)
- Détection automatique du niveau (1ère à 6ème primaire)
- Visualisation fidèle du bulletin tel qu'il apparaît dans Excel
- Modification du nom et du niveau
- Export Excel (.xlsx) — fichier original
- Export PDF (.pdf) — avec couleurs et bordures extraites de l'original
- Export Word (.docx) — avec mise en forme préservée
- Support super_admin (utilisation de l'institution active du store)

### 2. Section "Cours & Maxima" adaptée aux bulletins uploadés
- Si des bulletins sont uploadés : affiche les cours et maxima extraits des fichiers Excel
- Si aucun bulletin : affiche les matières de la base de données
- Pastilles vertes sur les onglets indiquant le nombre de bulletins par degré
- MAXIMA GENERAUX affichés en bas de chaque bulletin

### 3. Tableau de bord — Cartes d'en haut
- Bordures gauches colorées (vert, violet, ambre, sarcelle, cyan, rose)
- Couleurs de remplissage supprimées (fond blanc)

## Fichiers modifiés/créés

### Backend
- `prisma/schema.prisma` — Provider PostgreSQL + modèle BulletinTemplate + String[] pour subjects
- `src/lib/bulletin-parser.ts` — Parser Excel → JSON
- `src/lib/bulletin-export.ts` — Générateurs Excel/PDF/Word
- `src/lib/bulletin-excel-renderer.ts` — Rendu HTML fidèle
- `src/app/api/settings/bulletin-templates/route.ts` — GET + POST
- `src/app/api/settings/bulletin-templates/[id]/route.ts` — GET + PUT + DELETE
- `src/app/api/settings/bulletin-templates/[id]/export/route.ts` — Export xlsx/pdf/word
- `src/app/api/settings/bulletin-templates/[id]/preview/route.ts` — HTML fidèle

### Frontend
- `src/components/modules/bulletin-templates-section.tsx` — Upload/visualisation/export
- `src/components/modules/settings.tsx` — Section "Cours & Maxima" adaptée + intégration
- `src/components/modules/dashboard.tsx` — Bordures gauches, fonds supprimés

### Style
- `src/app/globals.css` — Suppression des couleurs de remplissage

### Prisma
- `prisma/avatars/` — Avatars pour étudiants, enseignants, parents, staff
- `prisma/seed.ts` — Script de seed
- `prisma/seed-superadmin.mjs` — Seed super admin
- `prisma/*.mjs` — Scripts utilitaires

### Dépendances
- `package.json` — exceljs@4.4.0 + html-to-docx@1.8.0
- `bun.lock` — Lockfile

## Installation

1. Extrayez ce zip à la racine de votre projet
2. `bun install`
3. `bun run db:push` (crée la table BulletinTemplate sur PostgreSQL Neon)
4. `bun run dev`

## Utilisation

1. Connectez-vous en tant qu'admin
2. Paramètres → onglet Institution
3. Section « Modèles de Bulletins » — uploadez vos fichiers .xlsx
4. Section « Cours & Maxima » — s'adapte automatiquement aux bulletins uploadés
5. Cliquez sur Voir/Excel/PDF/Word pour gérer chaque modèle
