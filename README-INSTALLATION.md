# Modifications — Bulletins + Dashboard + Notes par promotion + Auto-chargement

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

### 4. Page Notes — Filtrage par promotion (degré)
- Si l'institution est de type **primaire**, un sélecteur de promotion apparaît
- L'utilisateur sélectionne une promotion :
  - **Degré Élémentaire** (1ère & 2ème)
  - **Degré Moyen** (3ème & 4ème)
  - **Degré Terminal** (5ème & 6ème)
- Une fois la promotion sélectionnée :
  - Les classes sont filtrées pour ne montrer que celles du degré
  - Les matières sont filtrées pour ne montrer que celles du degré
  - La datalist d'autocomplétion est aussi filtrée
  - Les compteurs de classes par promotion s'affichent

### 5. Rechargement automatique après changement de type d'institution
- Quand l'admin change le type d'institution dans Paramètres → Institution
- La page se recharge automatiquement après 1.2 secondes
- Tous les modules (Notes, Bulletins, etc.) sont re-synchronisés avec le nouveau type

### 6. Auto-sélection de la promotion au chargement de la page Notes (NOUVEAU)
- Quand la page Notes s'ouvre, elle vérifie le type d'institution défini dans les paramètres
- Si l'institution est **primaire** :
  - La promotion est **automatiquement sélectionnée** (la première qui a des classes)
  - Les cours correspondants s'affichent immédiatement
  - L'utilisateur n'a pas besoin de cliquer manuellement
- Si l'institution est **secondaire/université** :
  - Pas de sélecteur de promotion (comportement existant)
  - Toutes les matières s'affichent directement

### 7. Dialogue "Ajouter note" — Matières selon la promotion
- Pour les institutions primaires, le dialogue a 3 étapes :
  1. **Sélection de la promotion** (3 boutons ambre avec compteur de matières)
  2. **Sélection de la classe** (filtrée par la promotion)
  3. **Sélection de la matière** (liste cliquable des matières de la promotion)
- La liste des matières affiche : nom + domaine + maxTJ
- La matière sélectionnée est mise en surbrillance (ambre)
- Pour le secondaire/université : champ texte libre (comportement existant)

## Fichiers modifiés/créés

### Backend
- `prisma/schema.prisma` — Provider PostgreSQL + modèle BulletinTemplate
- `src/lib/bulletin-parser.ts` — Parser Excel → JSON
- `src/lib/bulletin-export.ts` — Générateurs Excel/PDF/Word
- `src/lib/bulletin-excel-renderer.ts` — Rendu HTML fidèle
- `src/app/api/settings/bulletin-templates/**` — 4 routes API

### Frontend
- `src/components/modules/bulletin-templates-section.tsx` — Upload/visualisation/export
- `src/components/modules/settings.tsx` — Cours & Maxima adapté + rechargement auto
- `src/components/modules/dashboard.tsx` — Bordures gauches, fonds supprimés
- `src/components/modules/grades.tsx` — **NOUVEAU** Auto-sélection promotion + liste matières cliquable

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

### Paramètres → Institution
1. Changez le type d'institution (primaire/secondaire) → la page se recharge auto
2. Section « Modèles de Bulletins » — uploadez vos fichiers .xlsx
3. Section « Cours & Maxima » — s'adapte aux bulletins uploadés

### Page Notes (si institution primaire)
1. La page s'ouvre → la promotion est auto-sélectionnée
2. Les classes et matières correspondantes s'affichent immédiatement
3. Cliquez sur "Ajouter une note"
4. La promotion est déjà sélectionnée dans le dialogue
5. Sélectionnez une classe (filtrée par promotion)
6. Sélectionnez une matière dans la liste cliquable
7. Saisissez la note et validez

### Tableau de bord
- 6 cartes d'en haut avec bordures gauches colorées (sans fond)
