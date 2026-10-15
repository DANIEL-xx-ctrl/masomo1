# Modification — Édition de la matière dans le dialogue "Modifier la note"

## Nouveautés

### Modification de la matière (NOUVEAU)
Le dialogue "Modifier la note" permet maintenant de changer la matière :
- Champ texte avec autocomplétion (datalist)
- Pour les institutions primaires : liste cliquable des matières filtrées par promotion
- La matière modifiée est enregistrée dans la base de données
- Si la matière n'existe pas, elle est créée automatiquement

### Modification du trimestre (NOUVEAU)
Le dialogue envoie aussi le trimestre modifié au backend.

## Fichiers modifiés

- `src/components/modules/grades.tsx` — Ajout du champ matière dans le dialogue d'édition + envoi de subjectId/subjectName/trimester dans handleEditGrade
- `src/app/api/grades/[id]/route.ts` — Support de subjectId, subjectName et trimester dans le PUT (avec find-or-create de la matière)

## Installation

1. Extrayez ce zip à la racine de votre projet
2. Exécutez : `bash UPLOAD-TO-GITHUB.sh`

Ou manuellement :
```bash
git add .
git commit -m "Modification de la matiere dans le dialogue d edition des notes"
git push origin main
```
