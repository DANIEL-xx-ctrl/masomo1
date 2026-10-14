# Modifications — Bulletins + Dashboard + Notes par promotion + Promotion des classes

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

### 5. Rechargement automatique après changement de type d'institution
- Quand l'admin change le type d'institution dans Paramètres → Institution
- La page se recharge automatiquement après 1.2 secondes
- Tous les modules (Notes, Bulletins, etc.) sont re-synchronisés

### 6. Auto-sélection de la promotion au chargement de la page Notes
- Quand la page Notes s'ouvre, elle vérifie le type d'institution
- Si primaire : la promotion est automatiquement sélectionnée (la première avec classes)
- Les cours correspondants s'affichent immédiatement

### 7. Dialogue "Ajouter note" — Matières selon la promotion
- Pour les institutions primaires, le dialogue a 3 étapes :
  1. Sélection de la promotion (boutons ambre avec compteur)
  2. Sélection de la classe (filtrée par promotion)
  3. Sélection de la matière (liste cliquable filtrée par promotion)
- Pour le secondaire : champ texte libre (comportement existant)

### 8. Promotion des classes (NOUVEAU)
- Nouveau champ `promotion` sur le modèle `Class` dans le schéma Prisma
- Permet de différencier une classe "1A" du primaire d'une "1A" du secondaire
- Promotions disponibles :
  - **Primaire — Degré Élémentaire** (1ère & 2ème) → degree: elementaire
  - **Primaire — Degré Moyen** (3ème & 4ème) → degree: moyen
  - **Primaire — Degré Terminal** (5ème & 6ème) → degree: terminal
  - **Secondaire — Collège** (1er cycle)
  - **Secondaire — Lycée** (2nd cycle)
- Sélecteur de promotion dans le formulaire de création/édition de classe
- Routes API mises à jour (POST et PUT) pour accepter le champ `promotion`
- La page Notes utilise en priorité le champ `promotion` pour filtrer les classes

## Fichiers modifiés/créés

### Backend
- `prisma/schema.prisma` — Provider PostgreSQL + modèle BulletinTemplate + champ `promotion` sur Class
- `src/lib/types.ts` — Ajout du champ `promotion` sur l'interface Class
- `src/lib/constants.ts` — Ajout de CLASS_PROMOTIONS + promotionToDegree()
- `src/lib/bulletin-parser.ts` — Parser Excel → JSON
- `src/lib/bulletin-export.ts` — Générateurs Excel/PDF/Word
- `src/lib/bulletin-excel-renderer.ts` — Rendu HTML fidèle
- `src/app/api/settings/bulletin-templates/**` — 4 routes API
- `src/app/api/classes/route.ts` — Ajout du champ promotion (POST)
- `src/app/api/classes/[id]/route.ts` — Ajout du champ promotion (PUT)

### Frontend
- `src/components/modules/bulletin-templates-section.tsx` — Upload/visualisation/export
- `src/components/modules/settings.tsx` — Cours & Maxima + rechargement auto
- `src/components/modules/dashboard.tsx` — Bordures gauches, fonds supprimés
- `src/components/modules/grades.tsx` — Auto-sélection promotion + liste matières cliquable
- `src/components/modules/classes.tsx` — **NOUVEAU** Sélecteur de promotion dans le formulaire

### Style
- `src/app/globals.css` — Suppression des couleurs de remplissage

### Dépendances
- `package.json` — exceljs@4.4.0 + html-to-docx@1.8.0
- `bun.lock` — Lockfile

## Installation

1. Extrayez ce zip à la racine de votre projet
2. `bun install`
3. `bun run db:push` (ajoute la colonne `promotion` à la table Class)
4. `bun run dev`

## Utilisation

### Paramètres → Institution
1. Changez le type d'institution → la page se recharge auto
2. Section « Modèles de Bulletins » — uploadez vos fichiers .xlsx
3. Section « Cours & Maxima » — s'adapte aux bulletins uploadés

### Page Classes (NOUVEAU)
1. Créez ou éditez une classe
2. Remplissez le nom, niveau, section
3. **Sélectionnez la promotion** (ex: "Primaire — Degré Élémentaire")
4. Sauvegardez
- Exemple : une classe "1A" avec promotion "Primaire — Degré Élémentaire"
- sera reconnue comme primaire élémentaire dans la page Notes.

### Page Notes (si institution primaire)
1. La page s'ouvre → la promotion est auto-sélectionnée
2. Les classes avec la promotion correspondante s'affichent
3. Les matières du degré correspondant s'affichent
4. Cliquez sur "Ajouter une note" → la promotion est déjà sélectionnée
5. Sélectionnez une classe (filtrée par promotion)
6. Sélectionnez une matière dans la liste cliquable
7. Saisissez la note et validez

### Tableau de bord
- 6 cartes d'en haut avec bordures gauches colorées (sans fond)
