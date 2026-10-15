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
git commit -m "Ajout saisie notes par trimestre (periode1/periode2/examen) + bulletins + promotion classes"
echo "🚀 Push vers GitHub..."
git push origin main
echo "✅ Terminé ! Vercel va redéployer automatiquement."
