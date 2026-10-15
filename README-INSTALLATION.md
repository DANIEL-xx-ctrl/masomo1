# Modifications — Saisie des notes par trimestre + Bulletins + Promotion des classes

## Nouveautés

### 1. Saisie des notes structurée par trimestre (NOUVEAU)
Dans le dialogue "Ajouter une note" de la page Notes :
- **Étape 1 — Trimestre** : 3 boutons (1er, 2ème, 3ème)
- **Étape 2 — Type d'évaluation** : 3 boutons (1ère Période, 2ème Période, Examen)
  - Le max par période et par examen s'affiche automatiquement selon la matière
- **Étape 3 — Saisie de la note** :
  - Le max est pré-rempli automatiquement :
    - Période 1 / Période 2 → `maxTJ` du sujet
    - Examen → `maxEX` du sujet
  - La zone de saisie s'adapte au sous-type sélectionné

### 2. Gestion des bulletins (Paramètres > Institution)
- Upload multiple de fichiers Excel (.xlsx)
- Visualisation fidèle du bulletin tel qu'il apparaît dans Excel
- Export Excel/PDF/Word avec mise en forme préservée

### 3. Section "Cours & Maxima" adaptée aux bulletins uploadés
- Si des bulletins sont uploadés : affiche les cours et maxima extraits
- MAXIMA GENERAUX affichés en bas de chaque bulletin

### 4. Tableau de bord — Cartes d'en haut
- Bordures gauches colorées (vert, violet, ambre, sarcelle, cyan, rose)
- Couleurs de remplissage supprimées (fond blanc)

### 5. Page Notes — Filtrage par promotion (degré)
- Si l'institution est primaire : sélecteur de promotion (élémentaire/moyen/terminal)
- Les classes et matières sont filtrées par la promotion
- Auto-sélection de la promotion au chargement de la page

### 6. Promotion des classes
- Nouveau champ `promotion` sur le modèle `Class`
- Permet de différencier "1A Primaire" de "1A Secondaire"
- Sélecteur de promotion dans le formulaire de création/édition de classe
- Badge 🎓 coloré sur les cartes et détails de classe

## Installation

1. Extrayez ce zip à la racine de votre projet
2. Exécutez : `bash UPLOAD-TO-GITHUB.sh`

Ou manuellement :
```bash
bun install
bun run db:push
git add .
git commit -m "Ajout saisie notes par trimestre + bulletins + promotion classes"
git push origin main
```
