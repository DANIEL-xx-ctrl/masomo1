# 🏫 MASOMO - Application de Gestion Scolaire

## Guide d'installation complet pour VSCode

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé ces logiciels sur votre machine :

| Logiciel | Version minimale | Lien de téléchargement |
|----------|-----------------|----------------------|
| **Node.js** | 18.x ou supérieur | [nodejs.org](https://nodejs.org/) |
| **Bun** (recommandé) ou **npm** | Dernière version | [bun.sh](https://bun.sh/) |
| **Git** | 2.x | [git-scm.com](https://git-scm.com/) |
| **VSCode** | Dernière version | [code.visualstudio.com](https://code.visualstudio.com/) |

---

## 🚀 Installation étape par étape

### Étape 1 : Télécharger le code source

**Option A : Depuis le sandbox (recommandé)**
1. Téléchargez l'archive ZIP du projet depuis le sandbox
2. Extrayez l'archive dans le dossier de votre choix

**Option B : Depuis Git (si le projet est sur un dépôt)**
```bash
git clone <url-du-depot>
cd masomo
```

### Étape 2 : Ouvrir le projet dans VSCode

1. Ouvrez VSCode
2. Allez dans **Fichier → Ouvrir le dossier...** (File → Open Folder)
3. Sélectionnez le dossier extrait du projet
4. Le projet s'ouvre dans VSCode

### Étape 3 : Installer les extensions VSCode recommandées

Ouvrez le marketplace des extensions (`Ctrl+Shift+X` ou `Cmd+Shift+X`) et installez :

- **ES7+ React/Redux/React-Native snippets** - Snippets React
- **Tailwind CSS IntelliSense** - Autocomplétion Tailwind
- **Prisma** - Support Prisma ORM
- **TypeScript Import Sorter** - Tri des imports
- **Prettier** - Formatage du code
- **ESLint** - Linting JavaScript/TypeScript

### Étape 4 : Configurer les variables d'environnement

```bash
# Copier le fichier exemple
cp .env.example .env
```

Ouvrez le fichier `.env` et vérifiez/modifiez les valeurs :
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="votre-cle-secrete-changez-moi-en-production"
PORT=3000
```

### Étape 5 : Installer les dépendances

**Avec Bun (recommandé, plus rapide) :**
```bash
bun install
```

**Ou avec npm :**
```bash
npm install
```

### Étape 6 : Configurer la base de données

```bash
# Générer le client Prisma
npx prisma generate

# Créer la base de données et les tables
npx prisma db push

# (Optionnel) Remplir avec des données de démonstration
npx prisma db seed
```

### Étape 7 : Lancer le serveur de développement

**Avec Bun :**
```bash
bun run dev
```

**Ou avec npm :**
```bash
npm run dev
```

L'application sera accessible à l'adresse : **http://localhost:3000**

---

## 📁 Structure du projet

```
masomo/
├── prisma/
│   └── schema.prisma          # Schéma de la base de données (14 modèles)
├── public/
│   ├── avatars/               # Photos des élèves et enseignants
│   ├── manifest.json          # PWA manifest
│   └── logo.svg               # Logo de l'application
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Layout principal avec ThemeProvider
│   │   ├── page.tsx           # Page d'entrée (redirige vers l'app)
│   │   ├── globals.css        # Styles globaux + thème dark/light
│   │   └── api/               # Routes API (16 endpoints)
│   │       ├── auth/          # Authentification (login, register, me)
│   │       ├── students/      # CRUD élèves
│   │       ├── teachers/      # CRUD enseignants
│   │       ├── classes/       # CRUD classes
│   │       ├── grades/        # CRUD notes
│   │       ├── schedules/     # CRUD emplois du temps
│   │       ├── payments/      # CRUD paiements
│   │       ├── attendance/    # CRUD présences
│   │       ├── bulletins/     # CRUD bulletins
│   │       ├── announcements/ # CRUD annonces
│   │       ├── messages/      # CRUD messages
│   │       ├── subjects/      # CRUD matières
│   │       ├── dashboard/     # Statistiques dashboard
│   │       └── seed/          # Données de démonstration
│   ├── components/
│   │   ├── app-shell.tsx      # Shell principal (sidebar + header + contenu)
│   │   ├── login.tsx          # Page de connexion
│   │   ├── modules/
│   │   │   ├── dashboard.tsx  # Tableau de bord avec graphiques
│   │   │   ├── students.tsx   # Gestion des élèves
│   │   │   ├── teachers.tsx   # Gestion des enseignants
│   │   │   ├── classes.tsx    # Gestion des classes
│   │   │   ├── schedule.tsx   # Emplois du temps
│   │   │   ├── grades.tsx     # Gestion des notes
│   │   │   ├── bulletins.tsx  # Bulletins scolaires
│   │   │   ├── payments.tsx   # Paiements (Mobile Money)
│   │   │   ├── communication.tsx # Annonces + messagerie
│   │   │   └── settings.tsx   # Paramètres + thème dark/light
│   │   └── ui/                # Composants shadcn/ui (40+ composants)
│   └── lib/
│       └── db.ts              # Client Prisma
├── .env.example               # Variables d'environnement exemple
├── .gitignore                 # Fichiers ignorés par Git
├── package.json               # Dépendances et scripts
├── tailwind.config.ts         # Configuration Tailwind CSS
├── tsconfig.json              # Configuration TypeScript
└── next.config.ts             # Configuration Next.js
```

---

## 🔑 Identifiants de démonstration

Après avoir exécuté le seed, vous pouvez vous connecter avec :

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@masomo.com | admin123 | Administrateur |
| teacher@masomo.com | teacher123 | Enseignant |
| student@masomo.com | student123 | Élève |

---

## 🛠️ Scripts disponibles

| Commande | Description |
|----------|------------|
| `bun run dev` | Lance le serveur de développement (port 3000) |
| `bun run build` | Compile l'application pour la production |
| `bun run start` | Lance le serveur de production |
| `bun run lint` | Vérifie la qualité du code avec ESLint |
| `bun run db:push` | Pousse le schéma Prisma vers la base |
| `bun run db:generate` | Génère le client Prisma |
| `bun run db:migrate` | Crée une migration |
| `bun run db:reset` | Réinitialise la base de données |

---

## 🌙 Mode Sombre (Dark Mode)

L'application supporte le mode sombre sur toutes les pages :
- Le toggle est accessible depuis la page **Paramètres**
- Le thème est mémorisé dans le navigateur
- Toutes les pages s'adaptent automatiquement

---

## 🔧 Dépannage

### Erreur "Module not found"
```bash
# Supprimer node_modules et réinstaller
rm -rf node_modules
bun install
```

### Erreur de base de données
```bash
# Régénérer la base
npx prisma db push --force-reset
npx prisma generate
```

### Erreur "Port 3000 déjà utilisé"
```bash
# Tuer le processus sur le port 3000
# Linux/Mac :
lsof -ti:3000 | xargs kill -9
# Windows :
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Problème de cache Next.js
```bash
# Nettoyer le cache
rm -rf .next
bun run dev
```

---

## 📱 Accès depuis un téléphone (réseau local)

1. Trouvez votre adresse IP locale :
   - **Windows** : `ipconfig` → IPv4 Address
   - **Mac/Linux** : `ifconfig` → inet address
2. Lancez le serveur : `bun run dev`
3. Sur votre téléphone, ouvrez : `http://VOTRE_IP:3000`

---

## 📚 Technologies utilisées

- **Framework** : Next.js 16 (App Router)
- **Langage** : TypeScript 5
- **Styling** : Tailwind CSS 4 + shadcn/ui
- **Base de données** : SQLite via Prisma ORM
- **Graphiques** : Recharts
- **Animations** : Framer Motion
- **Thème** : next-themes (dark/light)
- **Icônes** : Lucide React
- **Authentification** : JWT + bcryptjs

---

## 📄 Licence

Ce projet est fourni à des fins éducatives. Libre d'utilisation et de modification.
