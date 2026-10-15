#!/bin/bash
set -e
echo "📦 Installation des dépendances..."
bun install
echo "🗄️ Synchronisation de la base de données..."
bun run db:push
echo "📝 Ajout des fichiers modifiés..."
git add .
git status --short
echo "💾 Commit..."
git commit -m "Dropdowns trimestres avec periodes P1-P6 + examens T1-T3 + filtre etendu"
echo "🚀 Push vers GitHub..."
git push origin main
echo "✅ Terminé !"
