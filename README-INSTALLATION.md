# Modifications — Rechargement auto + Affichage type/trimestre + Modification type note

## Nouveautés

### 1. Rechargement automatique après ajout de note (NOUVEAU)
- Après chaque ajout de note, la page se recharge automatiquement (500ms)
- La note ajoutée s'affiche immédiatement dans la liste
- Les statistiques du dashboard sont aussi rafraîchies

### 2. Affichage du type et trimestre dans la liste des notes (NOUVEAU)
- **Type** : Badge coloré selon le type
  - Devoir (période) → bleu
  - Examen → violet
  - Contrôle → gris
- **Trimestre** : Badge coloré selon le trimestre
  - 1er Trimestre → vert
  - 2ème Trimestre → ambre
  - 3ème Trimestre → rose

### 3. Modification du type de note (NOUVEAU)
Le dialogue "Modifier la note" permet maintenant de changer :
- **Le trimestre** (3 boutons : 1er, 2ème, 3ème)
- **Le type d'évaluation** (3 boutons : 1ère Période, 2ème Période, Examen)
- La note et le max (qui s'adaptent au type sélectionné)
- La date et le commentaire

### 4. Saisie structurée par trimestre (déjà existant)
- Trimestre → Type (Période 1/2/Examen) → Note
- Max automatique selon le type et la matière

### 5. Gestion des bulletins + Promotion des classes + Dashboard
- Upload/visualisation/export de bulletins Excel
- Champ promotion sur les classes (primaire/secondaire)
- Cartes du dashboard avec bordures gauches colorées

## Installation

1. Extrayez ce zip à la racine de votre projet
2. Exécutez : `bash UPLOAD-TO-GITHUB.sh`

Ou manuellement :
```bash
bun install
bun run db:push
git add .
git commit -m "Rechargement auto + affichage type/trimestre + modification type note"
git push origin main
```
