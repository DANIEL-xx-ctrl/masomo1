# Modifications — Bulletins + Dashboard + Cours & Maxima + Notes par promotion

## Nouveautés

### 1. Gestion des bulletins (Paramètres > Institution)
- Upload multiple de fichiers Excel (.xlsx)
- Détection automatique du niveau (1ère à 6ème primaire)
- Visualisation fidèle du bulletin tel qu'il apparaît dans Excel
- Export Excel/PDF/Word avec mise en forme préservée
- Support super_admin (utilisation de l'institution active du store)

### 2. Section "Cours & Maxima" adaptée aux bulletins uploadés
- Si des bulletins sont uploadés : affiche les cours et maxima extraits
- Si aucun bulletin : affiche les matières de la base de données
- Pastilles vertes sur les onglets indiquant le nombre de bulletins par degré
- MAXIMA GENERAUX affichés en bas de chaque bulletin

### 3. Tableau de bord — Cartes d'en haut
- Bordures gauches colorées (vert, violet, ambre, sarcelle, cyan, rose)
- Couleurs de remplissage supprimées (fond blanc)

### 4. Page Notes — Filtrage par promotion (NOUVEAU)
- Si l'institution est de type **primaire**, un sélecteur de promotion (degré) apparaît
- L'utilisateur sélectionne d'abord une promotion :
  - **Degré Élémentaire** (1ère & 2ème)
  - **Degré Moyen** (3ème & 4ème)
  - **Degré Terminal** (5ème & 6ème)
- Une fois la promotion sélectionnée :
  - Les classes sont filtrées pour ne montrer que celles du degré
  - Les matières sont filtrées pour ne montrer que celles du degré
  - La datalist d'autocomplétion est aussi filtrée
  - Les compteurs de classes par promotion s'affichent
- Si aucune promotion n'est sélectionnée, toutes les classes/matières s'affichent
- Pour les institutions secondaires/université : pas de sélecteur de promotion

## Fichiers modifiés/créés

### Backend
- `prisma/schema.prisma` — Provider PostgreSQL + modèle BulletinTemplate
- `src/lib/bulletin-parser.ts` — Parser Excel → JSON
- `src/lib/bulletin-export.ts` — Générateurs Excel/PDF/Word
- `src/lib/bulletin-excel-renderer.ts` — Rendu HTML fidèle
- `src/app/api/settings/bulletin-templates/**` — 4 routes API

### Frontend
- `src/components/modules/bulletin-templates-section.tsx` — Upload/visualisation/export
- `src/components/modules/settings.tsx` — Section "Cours & Maxima" adaptée
- `src/components/modules/dashboard.tsx` — Bordures gauches, fonds supprimés
- `src/components/modules/grades.tsx` — **NOUVEAU** Sélecteur de promotion pour primaire

### Style
- `src/app/globals.css` — Suppression des couleurs de remplissage

### Dépendances
- `package.json` — exceljs@4.4.0 + html-to-docx@1.8.0
- `bun.lock` — Lockfile

## Installation

1. Extrayez ce zip à la racine de votre projet
2. `bun install`
3. `bun run db:push`
4. `bun run dev`

## Utilisation

### Bulletins (Paramètres → Institution)
1. Section « Modèles de Bulletins » — uploadez vos fichiers .xlsx
2. Section « Cours & Maxima » — s'adapte aux bulletins uploadés

### Page Notes (si institution primaire)
1. Sélectionnez une promotion (degré) en haut de la barre de filtre
2. Les classes et matières se filtrent automatiquement
3. Saisissez vos notes normalement

### Tableau de bord
- 6 cartes d'en haut avec bordures gauches colorées (sans fond)
