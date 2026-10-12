# Modifications apportées — Gestion des bulletins

## Nouveautés de cette version

### 1. Visualisation fidèle du bulletin Excel original
Le bouton **"Voir"** ouvre maintenant une boîte de dialogue qui affiche le
bulletin **tel qu'il apparaît dans Excel** — avec :
- Les couleurs de fond originales
- Les bordures et fusions de cellules
- Les polices, gras, italiques
- Les largeurs de colonnes et hauteurs de lignes
- L'alignement (gauche/centre/droite)

Techniquement : le serveur lit le fichier `.xlsx` avec `exceljs`, extrait
tous les styles de cellules, et génère un HTML fidèle qui s'affiche dans
un iframe.

### 2. Export PDF fidèle
L'export PDF utilise maintenant les **styles extraits du fichier Excel
original** (couleurs, bordures, fusions) pour générer un PDF qui ressemble
au bulletin original, pas une régénération générique.

### 3. Export Word qui préserve la mise en forme
L'export Word utilise `html-to-docx` pour convertir le HTML fidèle
(généré depuis l'Excel original) en `.docx`, en préservant :
- Les couleurs de fond
- Les bordures
- Les fusions de cellules
- Les polices et styles

## Fichiers modifiés/créés

### Backend (lib + API)
- `src/lib/bulletin-parser.ts` — Parser qui extrait la structure d'un Excel bulletin RDC
- `src/lib/bulletin-export.ts` — Générateurs d'export (Excel régénéré + PDF + Word)
- `src/lib/bulletin-excel-renderer.ts` — **NOUVEAU** Rendu HTML fidèle depuis l'Excel original
- `src/app/api/settings/bulletin-templates/route.ts` — GET (liste) + POST (upload)
- `src/app/api/settings/bulletin-templates/[id]/route.ts` — GET/PUT/DELETE
- `src/app/api/settings/bulletin-templates/[id]/export/route.ts` — Export xlsx/pdf/word
- `src/app/api/settings/bulletin-templates/[id]/preview/route.ts` — **NOUVEAU** Renvoie le HTML fidèle

### Frontend
- `src/components/modules/bulletin-templates-section.tsx` — Composant React complet
- `src/components/modules/settings.tsx` — Intégration dans l'onglet Institution

### Base de données
- `prisma/schema.prisma` — Nouveau modèle `BulletinTemplate` + relation sur `Institution`

### Dépendances
- `package.json` — Ajout de `exceljs@4.4.0` et `html-to-docx@1.8.0`
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

1. Connectez-vous en tant qu'admin ou super_admin
2. Allez dans **Paramètres → onglet Institution**
3. Section **« Modèles de Bulletins »** (en bas)
4. Glissez-déposez vos fichiers `.xlsx`
5. Cliquez sur **"Voir"** pour afficher le bulletin original
6. Cliquez sur **Excel / PDF / Word** pour exporter

## Fonctionnalités

- ✅ Upload multiple de fichiers Excel (.xlsx)
- ✅ Détection automatique du niveau (1ère à 6ème primaire)
- ✅ **Visualisation fidèle** du bulletin tel qu'il apparaît dans Excel
- ✅ Modification du nom et du niveau
- ✅ Export Excel (.xlsx) — fichier original
- ✅ Export PDF (.pdf) — avec couleurs et bordures extraites de l'original
- ✅ Export Word (.docx) — avec mise en forme préservée
- ✅ Suppression d'un modèle (avec son fichier Excel associé)
- ✅ Support super_admin (utilisation de l'institution active du store)
