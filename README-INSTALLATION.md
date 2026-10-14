# Modifications — Bulletins + Dashboard + Notes par promotion + Promotion des classes

## Nouveautés

### 1. Gestion des bulletins (Paramètres > Institution)
- Upload multiple de fichiers Excel (.xlsx)
- Détection automatique du niveau (1ère à 6ème primaire)
- Visualisation fidèle du bulletin tel qu'il apparaît dans Excel
- Export Excel/PDF/Word avec mise en forme préservée

### 2. Section "Cours & Maxima" adaptée aux bulletins uploadés
- Si des bulletins sont uploadés : affiche les cours et maxima extraits
- Si aucun bulletin : affiche les matières de la base de données
- MAXIMA GENERAUX affichés en bas de chaque bulletin

### 3. Tableau de bord — Cartes d'en haut
- Bordures gauches colorées (vert, violet, ambre, sarcelle, cyan, rose)
- Couleurs de remplissage supprimées (fond blanc)

### 4. Page Notes — Filtrage par promotion (degré)
- Si l'institution est de type **primaire**, un sélecteur de promotion apparaît
- L'utilisateur sélectionne une promotion (élémentaire/moyen/terminal)
- Les classes et matières sont filtrées par la promotion

### 5. Rechargement automatique après changement de type d'institution
- Quand l'admin change le type d'institution → la page se recharge auto
- Tous les modules sont re-synchronisés

### 6. Auto-sélection de la promotion au chargement de la page Notes
- La page Notes vérifie le type d'institution au chargement
- Si primaire : la promotion est auto-sélectionnée (la première avec classes)
- Les cours correspondants s'affichent immédiatement

### 7. Dialogue "Ajouter note" — Matières selon la promotion
- 3 étapes : promotion → classe → matière (liste cliquable)
- Pour le secondaire : champ texte libre

### 8. Promotion des classes (NOUVEAU)
- Nouveau champ `promotion` sur le modèle `Class`
- Permet de différencier une classe "1A" du primaire d'une "1A" du secondaire
- Promotions disponibles :
  - Primaire — Degré Élémentaire (1ère & 2ème)
  - Primaire — Degré Moyen (3ème & 4ème)
  - Primaire — Degré Terminal (5ème & 6ème)
  - Secondaire — Collège (1er cycle)
  - Secondaire — Lycée (2nd cycle)
- Sélecteur de promotion dans le formulaire de création/édition de classe

### 9. Affichage de la promotion sur les cartes et détails (NOUVEAU)
- Badge 🎓 coloré sur chaque carte de classe
- Couleurs différentes selon le type et le degré :
  - Primaire Élémentaire → vert émeraude
  - Primaire Moyen → sarcelle
  - Primaire Terminal → cyan
  - Secondaire → bleu
- Badge affiché aussi dans le dialogue de détails de la classe

## Installation

1. Extrayez ce zip à la racine de votre projet
2. Exécutez le script : `bash UPLOAD-TO-GITHUB.sh`

Ou manuellement :
```bash
bun install
bun run db:push
git add .
git commit -m "Ajout promotion des classes + bulletins + notes par promotion"
git push origin main
```
