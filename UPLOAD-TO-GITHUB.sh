#!/bin/bash
set -e
echo "📝 Ajout des fichiers modifiés..."
git add .
git status --short
echo "💾 Commit..."
git commit -m "Modification de la matiere dans le dialogue d edition des notes"
echo "🚀 Push vers GitHub..."
git push origin main
echo "✅ Terminé !"
