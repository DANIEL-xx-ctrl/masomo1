# EduGest — Guide d'installation dans VSCode

> **Version :** v1.17.0
> **Dernière mise à jour :** Juillet 2026
> **Durée d'installation :** ~5 minutes

Ce guide détaille **toutes les commandes nécessaires** pour installer, configurer
et lancer le projet EduGest dans Visual Studio Code, de zéro jusqu'au serveur
de développement opérationnel.

---

## Sommaire

1. [Prérequis système](#1-prérequis-système)
2. [Installation des outils](#2-installation-des-outils)
3. [Ouverture du projet dans VSCode](#3-ouverture-du-projet-dans-vscode)
4. [Installation des dépendances](#4-installation-des-dépendances)
5. [Configuration de l'environnement](#5-configuration-de-lenvironnement)
6. [Initialisation de la base de données](#6-initialisation-de-la-base-de-données)
7. [Démarrage du serveur de développement](#7-démarrage-du-serveur-de-développement)
8. [Comptes de démonstration](#8-comptes-de-démonstration)
9. [Scripts disponibles](#9-scripts-disponibles)
10. [Extensions VSCode recommandées](#10-extensions-vscode-recommandées)
11. [Configuration du débogueur VSCode](#11-configuration-du-débogueur-vscode)
12. [Structure du projet](#12-structure-du-projet)
13. [Build de production](#13-build-de-production)
14. [Dépannage](#14-dépannage)
15. [Technologies utilisées](#15-technologies-utilisées)

---

## 1. Prérequis système

| Outil | Version minimale | Vérification |
|-------|------------------|--------------|
| **Node.js** | 18.0+ (LTS recommandé) | `node --version` |
| **Bun** (recommandé) | 1.0+ | `bun --version` |
| **VSCode** | 1.85+ | `code --version` |
| **Git** | 2.30+ | `git --version` |
| **unzip** | tout | `unzip -v` |

> **Note :** Bun est **fortement recommandé** (3× plus rapide que npm pour ce projet).
> Mais npm fonctionne aussi parfaitement.

---

## 2. Installation des outils

### 2.1. Installer Node.js (si pas déjà fait)

**Windows / macOS :** Téléchargez l'installeur LTS sur https://nodejs.org/

**Linux (Ubuntu/Debian) :**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Vérification :**
```bash
node --version    # doit afficher v18.x ou supérieur
npm --version     # doit afficher 9.x ou supérieur
```

### 2.2. Installer Bun (recommandé)

**macOS / Linux :**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows :**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**Vérification :**
```bash
bun --version      # doit afficher 1.x
```

### 2.3. Installer VSCode

Téléchargez VSCode sur https://code.visualstudio.com/ et installez-le.

**Ajouter `code` au PATH (si nécessaire) :**
- **macOS :** Ouvrez VSCode → Palette de commandes (`Cmd+Shift+P`) →
  `Shell Command: Install 'code' command in PATH`
- **Windows :** Coché par défaut lors de l'installation
- **Linux :** Habituellement configuré automatiquement

**Vérification :**
```bash
code --version     # doit afficher la version de VSCode
```

---

## 3. Ouverture du projet dans VSCode

### 3.1. Extraire l'archive ZIP

```bash
# Placez-vous dans le dossier où vous voulez installer le projet
cd ~/Projets

# Extrayez l'archive (remplacez par le nom réel du ZIP téléchargé)
unzip EduGest_Source_Complet_20260718.zip

# Le projet se trouve dans un dossier "edugest" (ou le nom du ZIP)
cd edugest
```

### 3.2. Ouvrir dans VSCode

**Option A — En ligne de commande :**
```bash
code .
```

**Option B — Via l'interface :**
1. Ouvrez VSCode
2. `File` → `Open Folder…` (ou `Ouvrir un dossier…`)
3. Sélectionnez le dossier `edugest`
4. Cliquez sur `Sélectionner un dossier`

### 3.3. Vérifier que VSCode a bien chargé le projet

Dans VSCode, ouvrez le terminal intégré :
- Menu `Terminal` → `New Terminal` (ou raccourci `` Ctrl+` ``)

```bash
# Vous devez être dans le dossier du projet
pwd                    # doit afficher .../edugest
ls                     # doit afficher package.json, src/, prisma/, etc.
cat package.json | head -5    # doit afficher "name": "edugest", "version": "1.17.0"
```

---

## 4. Installation des dépendances

### 4.1. Avec Bun (recommandé — ~10 secondes)

```bash
bun install
```

### 4.2. Avec npm (alternative — ~60 secondes)

```bash
npm install
```

### 4.3. Avec pnpm (alternative)

```bash
pnpm install
```

### 4.4. Vérification de l'installation

```bash
# Vérifier que Next.js est bien installé
bun run --version          # ou : npx next --version

# Vérifier que Prisma est bien installé
bunx prisma --version      # ou : npx prisma --version

# Vérifier que le dossier node_modules existe et contient @prisma/client
ls node_modules/@prisma/client >/dev/null 2>&1 && echo "✓ Prisma client présent" || echo "✗ Prisma client manquant"
ls node_modules/next >/dev/null 2>&1 && echo "✓ Next.js présent" || echo "✗ Next.js manquant"
```

---

## 5. Configuration de l'environnement

### 5.1. Vérifier le fichier `.env`

Le fichier `.env` est **déjà inclus** dans l'archive avec un chemin
**relatif** qui fonctionne sur toutes les machines. Vérifiez son contenu :

```bash
cat .env
```

Contenu attendu :
```env
# Base de données SQLite (chemin RELATIF — fonctionne sur n'importe quelle machine)
DATABASE_URL="file:./db/custom.db"
```

> **IMPORTANT — Ne changez PAS le chemin en chemin absolu !**
>
> Le chemin `file:./db/custom.db` est **relatif** au dossier du projet.
> Il fonctionne **identiquement** sur Windows, macOS et Linux, sans
> aucune modification. N'utilisez **pas** de chemin absolu comme
> `file:/home/...` ou `file:C:\Users\...` — cela casserait le
> portage entre machines et provoquerait l'erreur
> `Environment variable not found: DATABASE_URL` si le fichier `.env`
> est recréé sur une autre machine.
>
> **Depuis la v1.28.4**, si le fichier `.env` manque ou ne contient
> pas `DATABASE_URL`, le hook `predev` le crée / le répare
> **automatiquement** au premier `bun run dev`. Vous n'avez normalement
> **rien à faire**.

### 5.2. Si le fichier `.env` est manquant (rare)

Si vous avez extrait l'archive et que le fichier `.env` n'est pas
présent (par exemple sous Windows si les fichiers cachés ne sont pas
affichés), vous pouvez le recréer manuellement :

```bash
# Linux / macOS / Windows (Git Bash)
echo 'DATABASE_URL="file:./db/custom.db"' > .env
```

```powershell
# Windows (PowerShell)
Set-Content -Path .env -Value 'DATABASE_URL="file:./db/custom.db"'
```

> **Rappel :** depuis la v1.28.4, `bun run dev` crée ce fichier
> automatiquement s'il manque. Cette étape manuelle n'est nécessaire
> que si vous voulez pré-configurer le fichier avant le premier
> lancement.

### 5.3. Variables d'environnement optionnelles

Créez ou modifiez `.env.local` pour ajouter des variables sensibles :

```env
# .env.local (optionnel — pour la production)
JWT_SECRET=votre-cle-secrete-tres-longue-et-aleatoire
NEXTAUTH_SECRET=autre-cle-secrete-tres-longue
PORT=3000
NODE_ENV=development
```

---

## 6. Initialisation de la base de données

### 6.1. Option A — Utiliser la base de démonstration incluse (recommandé)

L'archive contient **déjà** une base SQLite `db/custom.db` pré-remplie avec :
- **9 institutions** (écoles de démonstration)
- **9 administrateurs**
- **17 enseignants**
- **65 élèves**
- **4 parents**
- **4 membres du personnel**
- **1 Super Admin** (multi-institutions)

Aucune commande n'est nécessaire — passez directement à l'étape 7.

### 6.2. Option B — Régénérer la base à partir du schéma

```bash
# 1. Générer le client Prisma TypeScript
bun run db:generate

# 2. Pousser le schéma vers la base SQLite
bun run db:push
```

### 6.3. Option C — Réinitialiser complètement la base (efface toutes les données)

```bash
# ATTENTION : cette commande efface TOUTES les données
bun run db:reset

# Puis re-seeder avec des données de démonstration
bun run db:seed
```

### 6.4. Vérifier que la base est opérationnelle

```bash
# Vérifier que le fichier de base existe
ls -la db/custom.db

# Tester la connexion Prisma
bun -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.institution.count().then(c => {
  console.log('✓ Base connectée —', c, 'institutions');
  process.exit(0);
}).catch(e => {
  console.error('✗ Erreur :', e.message);
  process.exit(1);
});
"
```

Sortie attendue :
```
✓ Base connectée — 9 institutions
```

---

## 7. Démarrage du serveur de développement

### 7.1. Lancer le serveur

```bash
bun run dev
```

> **Note (v1.28.3+) :** la commande `bun run dev` exécute désormais
> automatiquement `prisma db push` **avant** le démarrage de `next dev`
> (via le hook `predev`). Cela synchronise le schéma SQLite avec
> `prisma/schema.prisma` à chaque lancement, ce qui évite les erreurs
> « no such column: attachmentUrl » lors de l'envoi de messages si vous
> avez restauré le code source v1.28.x sur une base de données plus
> ancienne. Si la synchronisation échoue (par exemple base verrouillée
> par un autre processus), le serveur démarre quand même et les routes
> API disposent d'un repli automatique pour les messages texte.

Sortie attendue :
```
$ node scripts/predev.js && next dev
[predev] Synchronisation du schéma Prisma (db push)...
The database is already in sync with the Prisma schema.
[predev] Schéma à jour. Démarrage du serveur de développement...
▲ Next.js 16.1.3 (Turbopack)
- Local:        http://localhost:3000
- Network:      http://192.168.x.x:3000
- Environments: .env

✓ Ready in 1.5s
○ Compiling / ...
✓ Compiled / in 8s
```

### 7.2. Ouvrir l'application dans le navigateur

Ouvrez **http://localhost:3000** dans votre navigateur.

Vous devriez voir la page de connexion EduGest avec :
- Le logo **EduGest**
- Le formulaire de connexion (email / mot de passe)
- Le bouton **« Super Admin »** (orange, raccourci de connexion rapide)
- Le bouton **« Créer mon établissement »** (inscription self-service)

### 7.3. (Optionnel) Démarrer les services temps réel pour la messagerie

La messagerie 1-à-1 fonctionne **même sans les services temps réel**
(via une API REST + un polling de secours toutes les 5 secondes). Le
badge « **Mode différé** » (ambre) s'affiche alors dans la page
Messagerie. Pour activer la livraison instantanée des messages
(badge « **En direct** » vert), démarrez les deux mini-services
Socket.io dans deux terminaux séparés :

```bash
# Terminal 2 — service de présence (port 3003)
cd mini-services/presence-service
bun install        # la première fois seulement
bun run dev

# Terminal 3 — service de messagerie (port 3004)
cd mini-services/chat-service
bun install        # la première fois seulement
bun run dev
```

> **Important :** ces services sont **optionnels**. Si vous ne les
> démarrez pas, l'envoi de messages fonctionne normalement (via
> `POST /api/messages`) ; seul le délai de réception est de ~5 secondes
> au lieu d'être instantané.

### 7.4. Arrêter le serveur

Dans le terminal VSCode, appuyez sur `Ctrl+C`.

---

## 8. Comptes de démonstration

### 8.1. Super Admin (accès multi-institutions)

| Champ | Valeur |
|-------|--------|
| **Email** | `superadmin@edugest.com` |
| **Mot de passe** | `super123` |
| **Accès** | Toutes les institutions, gestion globale |

> **Astuce :** Sur la page de connexion, cliquez simplement sur le bouton
> orange **« Super Admin »** — les identifiants sont pré-remplis automatiquement.

### 8.2. Administrateur d'institution

| Champ | Valeur |
|-------|--------|
| **Email** | `admin@ecole.com` |
| **Mot de passe** | `admin123` |
| **Institution** | École Internationale EduGest |

### 8.3. Enseignant

| Champ | Valeur |
|-------|--------|
| **Email** | `amadou.diallo@ecole.com` |
| **Mot de passe** | `teacher123` |

### 8.4. Élève

| Champ | Valeur |
|-------|--------|
| **Email** | `moussa.keita@ecole.com` |
| **Mot de passe** | `student123` |

### 8.5. Parent

| Champ | Valeur |
|-------|--------|
| **Email** | `parent@ecole.com` |
| **Mot de passe** | `parent123` |

### 8.6. Personnel

| Champ | Valeur |
|-------|--------|
| **Email** | `staff@ecole.com` |
| **Mot de passe** | `staff123` |

### 8.7. Institutions de démonstration (codes d'accès)

| Institution | Code / Mot de passe |
|-------------|---------------------|
| École Internationale EduGest | `inst4138` |
| Lycée Technique de Douala | `lycee2024` |
| Institut Polytechnique de Yaoundé | `polytech2024` |
| Test Institution Isolation | `testiso2024` |
| ECOLE PRIMAIRE X | `jean123X` |

---

## 9. Scripts disponibles

Tous les scripts se lancent avec `bun run <script>` ou `npm run <script>`.

### 9.1. Scripts principaux

```bash
bun run dev          # Démarre le serveur de développement (http://localhost:3000)
bun run build        # Build de production (crée le dossier .next/)
bun run start        # Lance le serveur de production (après build)
bun run lint         # Vérifie le code avec ESLint
```

### 9.2. Scripts de base de données

```bash
bun run db:generate  # Régénère le client Prisma TypeScript
bun run db:push      # Synchronise le schéma Prisma avec la base SQLite
bun run db:migrate   # Crée et applique une migration (mode dev)
bun run db:reset     # Réinitialise la base (ATTENTION : efface tout)
bun run db:seed      # Remplit la base avec des données de démonstration
bun run clean-db     # Nettoie les données sans supprimer le schéma
```

### 9.3. Scripts utilitaires (dans le dossier `scripts/`)

```bash
# Créer des comptes de test supplémentaires
bun run scripts/create-test-accounts.ts

# Assigner une institution à des utilisateurs existants
bun run scripts/assign-institution.ts

# Générer des avatars pour les élèves
bun run scripts/generate-student-avatars.ts

# Seeder des événements scolaires
bun run scripts/seed-events.ts

# Seeder des données de test pour le Lycée
bun run scripts/seed-lycee-test.ts

# Seeder des parents et personnel
bun run scripts/seed-parents-staff.ts

# Ajouter des parents/personnel de Dakar
bun run scripts/add-dakar-parents-staff.ts

# Exporter la base en SQL
bun run scripts/export-db.ts

# Vérifier les données
bun run scripts/check-dakar-data.ts
bun run scripts/check-api-parents.ts

# Construire un ZIP du code source
bash scripts/build-source-zip.sh
```

---

## 10. Extensions VSCode recommandées

Ouvrez la palette de commandes (`Ctrl+Shift+P` ou `Cmd+Shift+P`) et tapez
`Extensions: Install Extensions`, puis recherchez et installez :

### 10.1. Extensions essentielles

| Extension | ID | Description |
|-----------|-----|-------------|
| **ESLint** | `dbaeumer.vscode-eslint` | Linting JavaScript/TypeScript |
| **Prettier** | `esbenp.prettier-vscode` | Formatage automatique du code |
| **TypeScript** | (intégré) | Support TypeScript natif |

### 10.2. Extensions framework

| Extension | ID | Description |
|-----------|-----|-------------|
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Autocomplétion Tailwind CSS 4 |
| **Prisma** | `Prisma.prisma` | Support du schéma Prisma |
| **PostCSS Language Support** | `csstools.postcss` | Support PostCSS |

### 10.3. Extensions React / Next.js

| Extension | ID | Description |
|-----------|-----|-------------|
| **ES7+ React/Redux snippets** | `dsznajder.es7-react-js-snippets` | Snippets React |
| **Auto Rename Tag** | `formulahendry.auto-rename-tag` | Renommage automatique des balises |
| **Path Intellisense** | `christian-kohler.path-intellisense` | Autocomplétion des chemins |

### 10.4. Installation rapide en une commande

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension Prisma.prisma
code --install-extension csstools.postcss
code --install-extension dsznajder.es7-react-js-snippets
code --install-extension formulahendry.auto-rename-tag
code --install-extension christian-kohler.path-intellisense
```

### 10.5. Configuration VSCode recommandée

Créez un fichier `.vscode/settings.json` à la racine du projet :

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    "cva\\(([^)]*)\\)",
    "cn\\(([^)]*)\\)"
  ],
  "files.associations": {
    "*.prisma": "prisma"
  },
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  }
}
```

---

## 11. Configuration du débogueur VSCode

### 11.1. Déboguer le serveur Next.js

Créez un fichier `.vscode/launch.json` :

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "bun run dev",
      "cwd": "${workspaceFolder}",
      "serverReadyAction": {
        "pattern": "- Local:.+(https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

### 11.2. Lancer le débogueur

1. Ouvrez l'onglet **Run and Debug** (`Ctrl+Shift+D`)
2. Sélectionnez **« Next.js: debug server-side »**
3. Appuyez sur `F5` ou cliquez sur le bouton **Play**

### 11.3. Points de rupture (breakpoints)

- Placez des points de rupture dans les fichiers `src/app/api/*/route.ts`
- Le débogueur s'arrêtera automatiquement lors des requêtes API
- Inspectez les variables, la pile d'appels, etc.

---

## 12. Structure du projet

```
edugest/
├── src/
│   ├── app/                         # App Router Next.js 16
│   │   ├── page.tsx                # Page principale (login + dashboard)
│   │   ├── layout.tsx              # Layout racine
│   │   ├── globals.css             # Styles globaux Tailwind
│   │   └── api/                    # 91 routes API
│   │       ├── auth/               # Connexion, profil, logout
│   │       ├── dashboard/          # Statistiques tableau de bord
│   │       ├── students/           # CRUD élèves
│   │       ├── teachers/           # CRUD enseignants
│   │       ├── classes/            # CRUD classes
│   │       ├── grades/             # Notes
│   │       ├── bulletins/          # Bulletins PDF/Excel
│   │       ├── attendance/         # Présence
│   │       ├── homework/           # Devoirs + soumissions
│   │       ├── payments/           # Paiements
│   │       ├── parents/            # CRUD parents
│   │       ├── staff/              # CRUD personnel
│   │       ├── subjects/           # Matières
│   │       ├── institutions/       # Multi-institutions
│   │       ├── super-admin/        # Super Admin CRUD
│   │       ├── superadmin/         # Profil Super Admin
│   │       ├── schedules/          # Emploi du temps
│   │       ├── events/             # Événements scolaires
│   │       ├── notifications/      # Notifications
│   │       ├── messages/           # Messagerie
│   │       ├── announcements/      # Annonces
│   │       ├── media/              # Fichiers média
│   │       ├── upload-media/       # Upload fichiers
│   │       ├── school-config/      # Configuration école
│   │       ├── school-years/       # Années scolaires
│   │       ├── sessions/           # Sessions utilisateur
│   │       ├── users/              # Gestion utilisateurs
│   │       ├── settings/           # Paramètres système
│   │       ├── seed/               # Initialisation base
│   │       ├── heartbeat/          # Health check
│   │       ├── check-blur/         # Vérification blur images
│   │       ├── enhance-image/      # Amélioration images (IA)
│   │       ├── download/           # Téléchargement code source
│   │       └── project/            # Infos projet
│   ├── components/
│   │   ├── ui/                     # 40+ composants shadcn/ui
│   │   ├── modules/                # 17 modules métier
│   │   │   ├── dashboard.tsx       # Tableau de bord
│   │   │   ├── students.tsx        # Gestion élèves
│   │   │   ├── teachers.tsx        # Gestion enseignants
│   │   │   ├── classes.tsx         # Gestion classes
│   │   │   ├── schedule.tsx        # Emploi du temps
│   │   │   ├── grades.tsx          # Notes
│   │   │   ├── bulletins.tsx       # Bulletins
│   │   │   ├── attendance.tsx      # Présence
│   │   │   ├── homework.tsx        # Devoirs
│   │   │   ├── payments.tsx        # Paiements
│   │   │   ├── communication.tsx   # Communication
│   │   │   ├── parents.tsx         # Parents
│   │   │   ├── staff.tsx           # Personnel
│   │   │   ├── settings.tsx        # Paramètres
│   │   │   ├── super-admin.tsx     # Module Super Admin
│   │   │   ├── school-calendar.tsx # Calendrier scolaire
│   │   │   └── enrollments-table.tsx
│   │   ├── login.tsx               # Page de connexion
│   │   ├── app-shell.tsx           # Shell application
│   │   └── fetch-interceptor.tsx   # Intercepteur fetch
│   ├── lib/                        # 22 utilitaires
│   │   ├── db.ts                   # Client Prisma
│   │   ├── store.ts                # Store Zustand
│   │   ├── auth.ts                 # Authentification
│   │   ├── api-auth.ts             # Helper auth API
│   │   ├── types.ts                # Types TypeScript
│   │   ├── constants.ts            # Constantes
│   │   ├── utils.ts                # Utilitaires divers
│   │   ├── seed-institution.ts     # Seeder institutions
│   │   └── exports/                # Export PDF/Excel/Word
│   └── hooks/                      # 4 hooks React
│       ├── use-mobile.ts
│       ├── use-toast.ts
│       └── use-app-store.ts
├── prisma/
│   ├── schema.prisma               # Schéma base de données
│   ├── seed.ts                     # Script de seed
│   └── avatars/                    # Avatars générés
├── scripts/                        # 13 scripts utilitaires
├── scripts-doc/                    # Documentation technique
├── mini-services/                  # Services WebSocket
├── examples/                       # Exemples (démo websocket)
├── public/                         # Assets statiques
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service Worker
│   ├── logo.svg                    # Logo
│   └── avatars/                    # Avatars publics
├── db/
│   ├── custom.db                   # Base SQLite (1.9 Mo, données démo)
│   └── export_custom.sql           # Export SQL
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                 # Config shadcn/ui
├── eslint.config.mjs
├── next-env.d.ts
├── Caddyfile                       # Config reverse proxy
├── .env                            # Variables environnement
├── .env.example
├── README.md
├── BUILD_INFO.md                   # Infos de build archive
├── CHANGELOG.md
├── SETUP.md
└── INSTALLATION-VSCODE.md          # Ce fichier
```

---

## 13. Build de production

### 13.1. Créer le build

```bash
# Build optimisé pour la production
bun run build
```

Sortie attendue :
```
   ▲ Next.js 16.1.3 (Turbopack)
   Creating an optimized production build ...
   ✓ Compiled successfully
   ✓ Collecting page data
   ✓ Generating static pages
   ✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    1.2 kB         142 kB
├ ○ /api/*                               0 B            0 B
└ ○ /_next/static/*                      0 B            0 B
First Load JS shared by all              87.3 kB
```

### 13.2. Lancer le serveur de production

```bash
bun run start
```

Le serveur démarre sur **http://localhost:3000** en mode production.

### 13.3. Tester le build avant déploiement

```bash
# Lint complet
bun run lint

# Build
bun run build

# Démarrer en production
bun run start
```

---

## 14. Dépannage

### 14.1. Erreur « database disk image is malformed »

```bash
# Supprimer les fichiers SQLite corrompus
rm -f db/custom.db db/custom.db-shm db/custom.db-wal

# Recréer la base
bun run db:push

# Re-seeder avec les données démo
bun run db:seed
```

### 14.1.bis. Erreur « Environment variable not found: DATABASE_URL » (P1012)

Cette erreur survient au lancement de `bun run dev` quand Prisma ne
trouve pas la variable `DATABASE_URL` dans le fichier `.env`.

**Depuis la v1.28.4, cette erreur est corrigée automatiquement :** le
hook `predev` (`scripts/predev.js`) crée le fichier `.env` s'il
manque, ajoute `DATABASE_URL` si la variable est absente, et crée le
dossier `db/` si nécessaire — le tout **avant** d'exécuter
`prisma db push`. Vous ne devriez donc plus la rencontrer.

Si l'erreur persiste malgré tout (par exemple sur une très vieille
extraction), exécutez manuellement :

```bash
# 1. Créer le fichier .env avec la variable DATABASE_URL
echo 'DATABASE_URL="file:./db/custom.db"' > .env

# 2. Créer le dossier db/ s'il n'existe pas
mkdir -p db

# 3. Synchroniser le schéma
bun run db:push

# 4. Relancer le serveur
bun run dev
```

> **Note :** le chemin `file:./db/custom.db` est **relatif** au dossier
> du projet. Il fonctionne sur Windows, macOS et Linux sans
> modification. N'utilisez **pas** de chemin absolu
> (ex. `file:/home/...` ou `file:C:\Users\...`) — cela casserait le
> portage entre machines.

### 14.2. Erreur « Prisma Client not generated »

```bash
# Régénérer le client Prisma
bun run db:generate

# Si ça ne suffit pas, supprimer et réinstaller
rm -rf node_modules/@prisma
bun install
bun run db:generate
```

### 14.3. Port 3000 déjà utilisé

```bash
# Identifier le processus qui occupe le port
lsof -i :3000          # macOS / Linux
netstat -ano | findstr :3000    # Windows

# Option 1 : tuer le processus
kill -9 <PID>

# Option 2 : changer de port (temporaire)
bun run dev -- -p 3001
```

### 14.4. Erreur « Module not found »

```bash
# Nettoyer node_modules et réinstaller
rm -rf node_modules bun.lock package-lock.json
bun install
```

### 14.5. Erreur TypeScript lors du build

Le fichier `next.config.ts` contient `typescript: { ignoreBuildErrors: true }`
pour la compatibilité maximale. Si vous voulez le désactiver pour un typage strict :

```typescript
// next.config.ts
const config = {
  // Retirez ou passez à false :
  typescript: { ignoreBuildErrors: false },
}
```

### 14.6. Erreur « EACCES: permission denied »

```bash
# Linux / macOS : corriger les permissions
sudo chown -R $(whoami) ~/.bun
sudo chown -R $(whoami) node_modules
```

### 14.7. Le serveur ne démarre pas

```bash
# 1. Vérifier que vous êtes dans le bon dossier
pwd    # doit afficher .../edugest

# 2. Vérifier que package.json est valide
cat package.json | grep '"dev"'

# 3. Vérifier que next est installé
ls node_modules/.bin/next

# 4. Démarrer avec plus de logs
DEBUG=* bun run dev
```

### 14.8. Page blanche dans le navigateur

1. Ouvrez les DevTools du navigateur (`F12` ou `Ctrl+Shift+I`)
2. Regardez l'onglet **Console** pour les erreurs JavaScript
3. Regardez l'onglet **Network** pour les requêtes échouées
4. Vérifiez que le serveur tourne : `curl http://localhost:3000`

### 14.8.bis. Messagerie — « Mode différé » affiché ou envoi qui échoue

**Symptôme A : le badge « Mode différé » (ambre) s'affiche.**
C'est **normal** : cela signifie simplement que les mini-services
Socket.io (ports 3003 et 3004) ne sont pas démarrés. La messagerie
fonctionne quand même en mode REST + polling (délai de réception
~5 s). Pour passer en « En direct » (vert), démarrez les deux
services comme indiqué à la section [7.3](#73-optionnel-démarrer-les-services-temps-réel-pour-la-messagerie).

**Symptôme B : le bouton Envoyer affiche une erreur.**
Depuis la v1.28.3, le toast d'erreur affiche le **message exact** renvoyé
par l'API. Les causes les plus courantes :

1. **Schéma de base obsolète** — le toast affiche
   « *Votre base de données utilise un schéma antérieur à v1.28.0...* ».
   Solution :
   ```bash
   bun run db:push     # synchronise le schéma (ajoute les colonnes de pièces jointes)
   ```
   Le hook `predev` le fait automatiquement au prochain `bun run dev`.

2. **Expéditeur et destinataire requis** — vous n'êtes pas connecté
   (session expirée). Rechargez la page et reconnectez-vous.

3. **Impossible d'envoyer un message à soi-même** — vous avez
   sélectionné votre propre compte dans la liste des utilisateurs.

4. **Le message doit contenir du texte ou une pièce jointe** —
   l'éditeur est vide. Saisissez du texte ou joignez un fichier.

5. **Erreur réseau** — le serveur de développement ne répond pas.
   Vérifiez avec `curl http://localhost:3000/api/messages?userId=test`.

### 14.9. Réinitialiser complètement le projet

```bash
# ATTENTION : efface TOUT

# 1. Arrêter le serveur (Ctrl+C)

# 2. Supprimer les dossiers générés
rm -rf node_modules .next db/custom.db*

# 3. Réinstaller
bun install

# 4. Recréer la base
bun run db:generate
bun run db:push
bun run db:seed

# 5. Redémarrer
bun run dev
```

---

## 15. Technologies utilisées

| Catégorie | Technologie | Version |
|-----------|-------------|---------|
| **Framework** | Next.js (App Router) | 16.1.x |
| **Langage** | TypeScript | 5.x |
| **Runtime** | Bun (ou Node.js 18+) | 1.x |
| **Base de données** | SQLite via Prisma ORM | Prisma 6.x |
| **Styling** | Tailwind CSS | 4.x |
| **UI Components** | shadcn/ui (New York) | latest |
| **Icons** | Lucide React | 0.525+ |
| **State (client)** | Zustand | 5.x |
| **State (server)** | TanStack Query | 5.x |
| **Forms** | React Hook Form + Zod | 7.x / 4.x |
| **Charts** | Recharts | 2.x |
| **PDF** | jsPDF + jsPDF-AutoTable | 4.x / 5.x |
| **Excel** | SheetJS (xlsx) | 0.18.x |
| **Word** | docx | 9.x |
| **Auth** | NextAuth.js | 4.x |
| **Thème** | next-themes | 0.4.x |
| **Temps réel** | Socket.io (mini-services) | latest |
| **Animations** | Framer Motion | 12.x |
| **Markdown** | @mdxeditor/editor | 3.x |

---

## Récapitulatif des commandes essentielles

```bash
# === Installation (une seule fois) ===
unzip EduGest_Source_Complet_*.zip     # 1. Extraire
cd edugest                              # 2. Entrer dans le dossier
code .                                  # 3. Ouvrir dans VSCode
bun install                             # 4. Installer les dépendances

# === Configuration base de données (si nécessaire) ===
bun run db:generate                     # 5. Générer client Prisma
bun run db:push                         # 6. Synchroniser schéma

# === Développement ===
bun run dev                             # 7. Démarrer le serveur (http://localhost:3000)

# === Vérification ===
bun run lint                            # Lint
bun run build                           # Build production
```

---

## Support

Pour toute question :

- **`README.md`** — Documentation générale du projet
- **`SETUP.md`** — Guide de configuration avancée
- **`README-SOURCE.md`** — Notes sur le code source
- **`BUILD_INFO.md`** — Détails de la version et du contenu de l'archive
- **`CHANGELOG.md`** — Historique des versions

---

**Version du guide :** v1.17.0 — Juillet 2026
**Projet EduGest :** v1.17.0
**Auteur :** Équipe EduGest
