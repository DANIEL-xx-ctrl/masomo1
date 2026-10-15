# Modifications — Dropdowns trimestres avec périodes + 6 périodes + 3 examens

## Nouveautés

### 1. Structure des notes par trimestre (NOUVEAU)
Chaque trimestre contient ses propres périodes :
- **1er Trimestre** : 1ère Période (p1), 2ème Période (p2), Examen T1 (examen_t1)
- **2ème Trimestre** : 3ème Période (p3), 4ème Période (p4), Examen T2 (examen_t2)
- **3ème Trimestre** : 5ème Période (p5), 6ème Période (p6), Examen T3 (examen_t3)

### 2. Dropdowns par trimestre dans "Ajouter note" (NOUVEAU)
Au lieu de boutons, chaque trimestre est un **dropdown** contenant ses périodes :
- L'utilisateur sélectionne une période dans le dropdown du trimestre correspondant
- Le max s'affiche automatiquement selon le type (maxTJ pour périodes, maxEX pour examens)
- La zone de saisie s'adapte au type sélectionné

### 3. Modification du type de note (NOUVEAU)
Le dialogue "Modifier la note" permet de changer :
- Le trimestre et la période (mêmes dropdowns)
- La note et le max
- La date et le commentaire

### 4. Filtre étendu dans la page Notes (NOUVEAU)
La zone de liste "Type" du filtre contient maintenant :
- **Tous les types**
- Groupé par trimestre : 1er T (p1, p2, examen_t1), 2ème T (p3, p4, examen_t2), 3ème T (p5, p6, examen_t3)
- Types legacy : Devoir, Contrôle

### 5. Affichage dans la liste des notes (NOUVEAU)
- **Type** : Badge coloré
  - Périodes (p1-p6) → bleu
  - Examens (examen_t1-t3) → violet
  - Legacy → gris
- **Trimestre** : Badge coloré (1er vert, 2ème ambre, 3ème rose)

### 6. Enregistrement en base de données
- Le type exact (p1, p2, ..., examen_t1, ...) est enregistré dans le champ `type` de la table `Grade`
- Le trimestre est aussi enregistré dans le champ `trimester`
- Les notes peuvent être modifiées ou supprimées avec leur type complet

## Installation

1. Extrayez ce zip à la racine de votre projet
2. Exécutez : `bash UPLOAD-TO-GITHUB.sh`

Ou manuellement :
```bash
bun install
bun run db:push
git add .
git commit -m "Dropdowns trimestres + 6 periodes + 3 examens"
git push origin main
```
