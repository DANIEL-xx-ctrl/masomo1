# Modifications apportées — Gestion des bulletins

## Fichiers modifiés/créés

### Backend (lib + API)
- `src/lib/bulletin-parser.ts` — Parser qui extrait la structure d'un Excel bulletin RDC
- `src/lib/bulletin-export.ts` — Générateurs d'export Excel/PDF/Word
- `src/app/api/settings/bulletin-templates/route.ts` — GET (liste) + POST (upload)
- `src/app/api/settings/bulletin-templates/[id]/route.ts` — GET/PUT/DELETE
- `src/app/api/settings/bulletin-templates/[id]/export/route.ts` — Export xlsx/pdf/word

### Frontend
- `src/components/modules/bulletin-templates-section.tsx` — Composant React complet
- `src/components/modules/settings.tsx` — Intégration dans l'onglet Institution

### Base de données
- `prisma/schema.prisma` — Nouveau modèle `BulletinTemplate` + relation sur `Institution`

### Dépendances
- `package.json` — Ajout de `exceljs@4.4.0`
- `bun.lock` — Lockfile mis à jour

### Script utilitaire
- `scripts/build-github-zip.sh` — Script pour recréer ce zip

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

1. Connectez-vous en tant qu'admin
2. Allez dans **Paramètres → onglet Institution**
3. Section **« Modèles de Bulletins »** (en bas, après la section Type d'institution)
4. Glissez-déposez vos fichiers `.xlsx` (bulletins RDC 1ère à 6ème primaire)
5. Utilisez les boutons Voir/Modifier/Excel/PDF/Word pour gérer chaque modèle

## Fonctionnalités

- ✅ Upload multiple de fichiers Excel (.xlsx)
- ✅ Détection automatique du niveau (1ère à 6ème primaire)
- ✅ Parsing automatique de la structure (en-tête, domaines, matières, maxima)
- ✅ Visualisation HTML complète du bulletin
- ✅ Modification du nom et du niveau
- ✅ Export Excel (.xlsx) avec styles complets (couleurs RDC)
- ✅ Export PDF (.pdf) en paysage A4
- ✅ Export Word (.docx) avec tableau structuré
- ✅ Suppression d'un modèle (avec son fichier Excel associé)
