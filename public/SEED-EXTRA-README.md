# 🌱 Seed — 5 nouvelles institutions de démonstration

Ce fichier `seed-extra-institutions.ts` ajoute **5 nouvelles institutions** complète à votre base de données EduGest :

1. **Institut Saint-Joseph de Douala** (Catholique)
2. **École Laïque de Garoua**
3. **Lycée Bilingue de Bafoussam**
4. **Collège Protestant de Maroua**
5. **Institut Technique de Bamenda**

## 📊 Données créées

Pour chaque institution, le script crée :

- 1 administrateur
- 5 à 10 enseignants
- 3 à 6 classes
- 15 à 30 élèves (avec 1 parent par élève)
- 1 membre du personnel
- 8 à 10 matières
- 4 notes par élève (2 matières × 2 trimestres)
- 1 paiement par élève
- Un emploi du temps complet (5 jours × 5 créneaux par classe)

**Totaux pour les 5 institutions :**

| Entité       | Total |
|:---|---:|
| Institutions | 5 |
| Matières     | 43 |
| Enseignants  | 43 |
| Classes      | 22 |
| Élèves       | 110 |
| Parents      | 110 |
| Personnel    | 5 |
| Notes        | 440 |
| Paiements    | 110 |
| Cours (EDT)  | 550 |

## 🚀 Utilisation

### Étape 1 — Placer le fichier

Si vous avez téléchargé ce fichier séparément, placez-le dans le dossier `scripts/` de votre projet EduGest :

```
edugest/
├── scripts/
│   └── seed-extra-institutions.ts   ← ici
├── prisma/
├── src/
└── package.json
```

### Étape 2 — Lancer le seed

Depuis la racine du projet EduGest :

```bash
# Méthode 1 : via le script npm (recommandé)
bun run seed:extra

# Méthode 2 : directement avec bun
bun run scripts/seed-extra-institutions.ts
```

### Étape 3 — Vérifier

Le script affiche un récapitulatif clair à la fin avec toutes les informations de connexion.

## 🔐 Identifiants de connexion

### Super Admin (global)

- Email : `superadmin@edugest.com`
- Mot de passe : `super123`

### Admins des 5 nouvelles institutions

| Institution | Email | Mot de passe | Mot de passe institution |
|:---|:---|:---|:---|
| Institut Saint-Joseph de Douala | `admin@saintjoseph.cm` | `admin123` | `saintjoseph2024` |
| École Laïque de Garoua | `admin@garoua.cm` | `admin123` | `garoua2024` |
| Lycée Bilingue de Bafoussam | `admin@bafoussam.cm` | `admin123` | `bafoussam2024` |
| Collège Protestant de Maroua | `admin@maroua.cm` | `admin123` | `maroua2024` |
| Institut Technique de Bamenda | `admin@bamenda.cm` | `admin123` | `bamenda2024` |

### Autres comptes (mêmes mots de passe pour toutes les institutions)

| Rôle | Mot de passe |
|:---|:---|
| Enseignant | `enseignant123` |
| Élève | `eleve123` |
| Parent | `parent123` |
| Personnel | `staff123` |

> Pour vous connecter en tant qu'enseignant/élève/parent, utilisez l'email affiché dans le récapitulatif du script.

## 🔁 Idempotence

Le script est **idempotent** : il peut être relancé sans risque.

- Si une institution existe déjà (identifiée par son mot de passe unique), elle est **ignorée**.
- Aucune donnée n'est dupliquée.
- Le récapitulatif affiche `⟳ EXISTANTE` pour les institutions déjà présentes.

## 🛠️ Prérequis

- Node.js 18+ installé
- Bun installé (`npm install -g bun`)
- Projet EduGest installé (`bun install` déjà exécuté)
- Client Prisma généré (`bun run db:generate`)
- Base de données SQLite `db/custom.db` présente

## 📝 Exemple de sortie

```
════════════════════════════════════════════════════════════════
  EduGest — Seed : 5 nouvelles institutions de démonstration
════════════════════════════════════════════════════════════════

[seed] Création de « Institut Saint-Joseph de Douala »...
  ✓ Admin : admin@saintjoseph.cm / admin123
  ✓ 8 matières
  ✓ 8 enseignants (mot de passe: enseignant123)
  ✓ 4 classes
  ✓ 100 créneaux d'emploi du temps
  ✓ 20 élèves (mot de passe: eleve123), 20 parents (mot de passe: parent123)
  ✓ 80 notes, 20 paiements
  ✓ 1 personnel (mot de passe: staff123)

...

────────────────────────────────────────────────────────────────
Institutions créées lors de ce run : 5 / 5
Totaux ajoutés :
  - Matières     : 43
  - Enseignants  : 43    (mot de passe : enseignant123)
  - Classes      : 22
  - Élèves       : 110    (mot de passe : eleve123)
  - Parents      : 110    (mot de passe : parent123)
  - Personnel    : 5    (mot de passe : staff123)
  - Notes        : 440
  - Paiements    : 110
  - Cours (EDT)  : 550
────────────────────────────────────────────────────────────────

✓ Seed terminé avec succès !
```

## 🆘 Dépannage

### Erreur "Cannot find module '@prisma/client'"

```bash
bun run db:generate
bun run seed:extra
```

### Erreur "DATABASE_URL not found"

Vérifiez que le fichier `.env` existe à la racine du projet et contient :

```env
DATABASE_URL="file:./db/custom.db"
```

### Le script ne crée aucune institution (toutes "EXISTANTE")

C'est normal — le script est idempotent. Si vous voulez forcer la recréation, supprimez d'abord les institutions existantes via l'interface Super Admin, ou réinitialisez la base :

```bash
# ATTENTION : cela efface toutes les données
curl -X POST http://localhost:3000/api/seed
```

---

**Version :** EduGest v1.19.0
