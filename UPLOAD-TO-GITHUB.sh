#!/bin/bash
# ============================================================
# Script d'upload vers GitHub — à exécuter après extraction du zip
# ============================================================
# Ce script :
# 1. Installe les dépendances
# 2. Pousse le schéma Prisma vers la base de données
# 3. Ajoute tous les fichiers modifiés
# 4. Commit et push vers GitHub
# ============================================================

set -e

echo "📦 Installation des dépendances..."
bun install

echo ""
echo "🗄️ Synchronisation de la base de données..."
bun run db:push

echo ""
echo "📝 Ajout des fichiers modifiés..."
git add .

echo ""
echo "📊 Fichiers à committer :"
git status --short

echo ""
echo "💾 Commit..."
git commit -m "Ajout gestion bulletins + notes par promotion + promotion des classes + dashboard"

echo ""
echo "🚀 Push vers GitHub..."
git push origin main

echo ""
echo "✅ Terminé ! Vercel va redéployer automatiquement."
