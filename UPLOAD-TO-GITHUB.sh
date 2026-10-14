#!/bin/bash
# ============================================================
# Script d'upload vers GitHub
# Exécutez ce script après avoir extrait le zip dans votre dépôt
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
