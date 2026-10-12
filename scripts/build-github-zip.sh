#!/bin/bash
# ============================================================
# build-github-zip.sh
# Crée un zip du code source de MASOMO prêt à pousser sur GitHub.
# Utilise rsync vers un dossier temporaire pour exclure proprement,
# puis zip le dossier temporaire.
# ============================================================

set -e

cd /home/z/my-project

OUTPUT_DIR="public"
OUTPUT_NAME="masomo-source-$(date +%Y%m%d-%H%M%S).zip"
OUTPUT="$OUTPUT_DIR/$OUTPUT_NAME"
TEMP_DIR="/tmp/masomo-src-$$"

# Nettoyer le dossier temporaire
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR/masomo"

# 1) Rsync les fichiers en excluant les artefacts de build
echo "📂 Copie des fichiers sources vers $TEMP_DIR/masomo..."
rsync -a \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='build' \
  --exclude='*.db' \
  --exclude='*.db-journal' \
  --exclude='prisma/db' \
  --exclude='db/custom.db' \
  --exclude='public/custom.db' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.development.local' \
  --exclude='.env.test.local' \
  --exclude='.env.production.local' \
  --exclude='npm-debug.log*' \
  --exclude='yarn-debug.log*' \
  --exclude='yarn-error.log*' \
  --exclude='.vercel' \
  --exclude='*.tsbuildinfo' \
  --exclude='next-env.d.ts' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='*.swp' \
  --exclude='*.swo' \
  --exclude='.DS_Store' \
  --exclude='Thumbs.db' \
  --exclude='dev.log' \
  --exclude='server.log' \
  --exclude='.pm2' \
  --exclude='upload' \
  --exclude='agent-ctx' \
  --exclude='src-tauri/target' \
  --exclude='src-tauri/resources/server' \
  --exclude='electron/dist' \
  --exclude='electron/build' \
  --exclude='electron/resources/server' \
  --exclude='android' \
  --exclude='ios' \
  --exclude='*.apk' \
  --exclude='*.aab' \
  --exclude='*.ipa' \
  --exclude='*.msi' \
  --exclude='*.dmg' \
  --exclude='*.deb' \
  --exclude='*.AppImage' \
  --exclude='*.rpm' \
  --exclude='*.pkg' \
  --exclude='*.exe' \
  --exclude='db/migration-data' \
  --exclude='prisma/schema.prisma.sqlite.bak' \
  --exclude='skills' \
  --exclude='.zscripts' \
  --exclude='.source-zip-env.tmp' \
  --exclude='public/masomo-source-*.zip' \
  --exclude='public/uploads' \
  --exclude='test-results' \
  --exclude='scripts-doc' \
  --exclude='mini-services/*/node_modules' \
  --exclude='.git' \
  ./ "$TEMP_DIR/masomo/"

# 2) Créer le zip
echo "📦 Création du zip: $OUTPUT"
cd "$TEMP_DIR"
zip -r -q "/home/z/my-project/$OUTPUT" masomo/

# 3) Nettoyer
cd /home/z/my-project
rm -rf "$TEMP_DIR"

# 4) Afficher les stats
SIZE=$(du -h "$OUTPUT" | cut -f1)
FILES=$(unzip -l "$OUTPUT" | tail -1 | awk '{print $2}')

echo "✅ Zip créé avec succès"
echo "   Chemin: $OUTPUT"
echo "   Taille: $SIZE"
echo "   Fichiers: $FILES"
