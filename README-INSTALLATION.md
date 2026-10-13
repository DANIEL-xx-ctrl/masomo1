# Modifications apportées — Bulletins + Dashboard + Cours & Maxima

## Nouveautés de cette version

### 1. Gestion des bulletins (Paramètres > Institution)
- Upload multiple de fichiers Excel (.xlsx)
- Détection automatique du niveau (1ère à 6ème primaire)
- Visualisation fidèle du bulletin tel qu'il apparaît dans Excel
- Modification du nom et du niveau
- Export Excel (.xlsx) — fichier original
- Export PDF (.pdf) — avec couleurs et bordures extraites de l'original
- Export Word (.docx) — avec mise en forme préservée
- Suppression d'un modèle (avec son fichier Excel associé)

### 2. Section "Cours & Maxima" adaptée aux bulletins uploadés
La section "Bulletin du Primaire — Cours & Maxima" s'adapte désormais aux bulletins uploadés :
- **Si des bulletins sont uploadés** pour le degré sélectionné (élémentaire/moyen/terminal) :
  - Affiche les cours et maxima extraits directement des fichiers Excel uploadés
  - Montre la structure complète : domaines → sous-domaines → cours
  - Affiche les maxima TJ, EX, TR, et Annuel (calculé) pour chaque cours
  - Affiche les MAXIMA GENERAUX en bas de chaque bulletin
  - Bordure verte pour distinguer les bulletins uploadés des données statiques
- **Si aucun bulletin n'est uploadé** : affiche les matières de la base de données (comportement existant)
- **Indicateurs visuels** :
  - Badge sur le titre indiquant le nombre de bulletins uploadés
  - Pastilles vertes sur les onglets de degrés avec le nombre de bulletins correspondants
  - Message d'incitation à uploader si aucun bulletin n'est trouvé

### 3. Tableau de bord — Cartes d'en haut
- Bordures gauches colorées restaurées (vert, violet, ambre, sarcelle, cyan, rose)
- Couleurs de remplissage supprimées (fond blanc)

## Fichiers modifiés/créés

### Backend (lib + API)
- `src/lib/bulletin-parser.ts` — Parser qui extrait la structure d'un Excel bulletin RDC
- `src/lib/bulletin-export.ts` — Générateurs d'export (Excel + PDF + Word)
- `src/lib/bulletin-excel-renderer.ts` — Rendu HTML fidèle depuis l'Excel original
- `src/app/api/settings/bulletin-templates/route.ts` — GET (liste) + POST (upload)
- `src/app/api/settings/bulletin-templates/[id]/route.ts` — GET/PUT/DELETE
- `src/app/api/settings/bulletin-templates/[id]/export/route.ts` — Export xlsx/pdf/word
- `src/app/api/settings/bulletin-templates/[id]/preview/route.ts` — HTML fidèle

### Frontend
- `src/components/modules/bulletin-templates-section.tsx` — Composant upload/visualisation/export
- `src/components/modules/settings.tsx` — Section "Cours & Maxima" adaptée aux uploads + intégration
- `src/components/modules/dashboard.tsx` — Cartes d'en haut (bordures gauches, fonds supprimés)

### Style
- `src/app/globals.css` — Suppression des couleurs de remplissage forcées sur les cards

### Base de données
- `prisma/schema.prisma` — Modèle `BulletinTemplate` + relation sur `Institution`

### Dépendances
- `package.json` — `exceljs@4.4.0` + `html-to-docx@1.8.0`
- `bun.lock` — Lockfile mis à jour

## Installation

1. Extrayez ce zip à la racine de votre projet (en remplaçant les fichiers existants)
2. Installez les dépendances :
   ```bash
   bun install
   ```
3. Synchronisez la base de données :
   ```bash
   bun run db:push
   ```
4. Démarrez le serveur :
   ```bash
   bun run dev
   ```

## Utilisation

### Bulletins
1. Connectez-vous en tant qu'admin ou super_admin
2. Allez dans **Paramètres → onglet Institution**
3. Section **« Modèles de Bulletins »** (en bas) — uploadez vos fichiers `.xlsx`
4. Cliquez sur **"Voir"** pour afficher le bulletin original
5. Cliquez sur **Excel / PDF / Word** pour exporter

### Section "Cours & Maxima"
1. Dans **Paramètres → Institution → Bulletin du Primaire — Cours & Maxima**
2. Sélectionnez un degré (Élémentaire / Moyen / Terminal)
3. Si des bulletins sont uploadés pour ce degré, les cours et maxima s'affichent automatiquement
4. Les pastilles vertes sur les onglets indiquent le nombre de bulletins uploadés par degré
