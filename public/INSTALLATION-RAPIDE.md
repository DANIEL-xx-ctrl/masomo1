# 🚀 Installation EduGest dans VSCode — Guide rapide

## ✅ Prérequis

- [Node.js](https://nodejs.org/) 18+ installé
- [Bun](https://bun.sh/) installé : `npm install -g bun`
- VSCode avec l'extension TypeScript

## 📦 Installation en 4 étapes

### 1. Décompresser le ZIP

Décompressez `EduGest_Complet.zip` dans un dossier, par exemple `E:\MASOMO2\`.

> ⚠️ **IMPORTANT** : Si vous décompressez dans un dossier qui contient DÉJÀ un `package.json` d'un autre projet (ex. `nextjs_tailwind_shadcn_ts`), **supprimez d'abord** l'ancien `package.json` et l'ancien `node_modules/` avant de continuer. Sinon Bun risque de charger l'ancienne config et l'installation échouera.

### 2. Installer les dépendances

```bash
cd E:\MASOMO2
bun install
```

> ✅ Depuis la v1.18, le `postinstall` est **résilient** : si `prisma generate` échoue (DLL bloquée), `bun install` se termine quand même correctement. Vous verrez juste un message d'avertissement — voir le dépannage ci-dessous pour finir.

### 3. Générer le client Prisma

```bash
bun run db:generate
```

> ⚠️ **IMPORTANT : Ne lancez PAS `bun run db:push`** — la base de données est déjà incluse dans le ZIP avec toutes les données de démonstration. La commande `db:push` pourrait vider ou réinitialiser la base.

### 4. Démarrer le serveur

```bash
bun run dev
```

Le serveur démarre sur **http://localhost:3000**

## 🔐 Connexion

### Super Admin (bouton orange sur la page de connexion)

Cliquez simplement sur le bouton **« Super Admin »** en bas du formulaire de connexion.

**Identifiants manuels :**
- Email : `superadmin@edugest.com`
- Mot de passe : `super123`

### Autres comptes de démonstration

| Rôle | Email | Mot de passe |
|:---|:---|:---|
| Admin (École) | `admin@ecole.com` | `admin123` |
| Enseignant | `amadou.diallo@ecole.com` | `teacher123` |
| Parent | `parent@ecole.com` | `parent123` |
| Personnel | `staff@ecole.com` | `staff123` |

## 🗄️ Base de données

La base SQLite `db/custom.db` est **déjà incluse** dans le ZIP avec :

- **9 institutions** de démonstration
- **1 Super Admin** global
- **99 utilisateurs** (admins, enseignants, élèves, parents, personnel)
- **64 élèves**, **17 enseignants**, **16 classes**
- **1080 notes**, **180 paiements**

### Si la base est vide ou le Super Admin ne fonctionne pas

Le système a un **filet de sécurité automatique** :

1. **Au démarrage** : l'instrumentation vérifie et crée le SuperAdmin si manquant
2. **À la connexion** : si le SuperAdmin n'existe pas, le bouton "Super Admin" appelle `/api/ensure-superadmin` pour le recréer automatiquement

Vous pouvez aussi appeler manuellement l'endpoint :

```bash
curl http://localhost:3000/api/ensure-superadmin
```

Ou dans le navigateur, visitez : `http://localhost:3000/api/ensure-superadmin`

### Réinitialiser complètement la base

Si vous voulez repartir de zéro avec les données de démo :

```bash
# Option 1 : via l'interface
# Connectez-vous comme Super Admin → Paramètres → Système → « Tout réinitialiser »

# Option 2 : via l'API
curl -X POST http://localhost:3000/api/seed
```

### 🌱 Ajouter 5 institutions supplémentaires (nouveau!)

Le projet inclut un seed supplémentaire qui crée **5 nouvelles institutions** (Saint-Joseph Douala, Garoua, Bafoussam, Maroua, Bamenda) avec leurs enseignants, élèves, parents, notes, etc.

```bash
bun run seed:extra
```

Le script est **idempotent** — vous pouvez le relancer sans risque. Pour voir tous les identifiants générés, consultez `public/SEED-EXTRA-README.md` ou téléchargez-le depuis `http://localhost:3000/SEED-EXTRA-README.md`.

**Nouvelles institutions créées :**

| Institution | Mot de passe | Admin |
|:---|:---|:---|
| Institut Saint-Joseph de Douala | `saintjoseph2024` | `admin@saintjoseph.cm` / `admin123` |
| École Laïque de Garoua | `garoua2024` | `admin@garoua.cm` / `admin123` |
| Lycée Bilingue de Bafoussam | `bafoussam2024` | `admin@bafoussam.cm` / `admin123` |
| Collège Protestant de Maroua | `maroua2024` | `admin@maroua.cm` / `admin123` |
| Institut Technique de Bamenda | `bamenda2024` | `admin@bamenda.cm` / `admin123` |

Vous pouvez aussi télécharger le script seul : `http://localhost:3000/seed-extra-institutions.ts`

## 🔧 Configuration

Le fichier `.env` est **déjà configuré** avec un chemin relatif :

```env
DATABASE_URL="file:./db/custom.db"
PORT=3000
```

Ce chemin fonctionne sur **n'importe quelle machine** (Windows, Mac, Linux).

## 🆘 Dépannage

### ⚠️ Erreur EPERM pendant `bun install` (Windows)

```
EPERM: operation not permitted, rename
'E:\MASOMO2\node_modules\.prisma\client\query_engine-windows.dll.node.tmp5612'
-> 'E:\MASOMO2\node_modules\.prisma\client\query_engine-windows.dll.node'
```

Cette erreur arrive quand un processus Windows **bloque** la DLL Prisma (`query_engine-windows.dll.node`). Les coupables typiques :
- Le serveur de langage TypeScript de VSCode
- Un serveur `next dev` ou Node.js déjà en cours d'exécution
- Un autre onglet VSCode qui a chargé la DLL en mémoire

> ✅ **Depuis la v1.18**, `bun install` ne se bloque plus sur cette erreur — il s'achève correctement. Mais vous devez quand même générer le client Prisma manuellement (voir ci-dessous).

#### Solution A — Recommandée (rapide)

1. **Fermez complètement VSCode** (pas juste le terminal — toute l'application)
2. Ouvrez un terminal Windows **ordinaire** (PowerShell ou CMD, pas dans VSCode)
3. Tuez tous les processus Node :

```powershell
taskkill /F /IM node.exe
```

4. Allez dans le dossier du projet et générez le client Prisma :

```bash
cd E:\MASOMO2
bun run db:generate
```

5. Vous pouvez maintenant rouvrir VSCode et lancer :

```bash
bun run dev
```

#### Solution B — Ignorer les scripts postinstall

Si la Solution A ne marche pas, contournez le postinstall :

```bash
# 1. Supprimez node_modules
rmdir /S /Q node_modules

# 2. Réinstallez en ignorant les scripts postinstall
bun install --ignore-scripts

# 3. Fermez VSCode, tuez Node, puis générez Prisma manuellement
taskkill /F /IM node.exe
bun run db:generate

# 4. Relancez VSCode et démarrez le serveur
bun run dev
```

#### Solution C — Nettoyer les fichiers .tmp résiduels

Parfois, des fichiers `.tmpXXXX` restent bloqués dans `node_modules/.prisma/client/` :

```powershell
# Supprimez tous les fichiers .tmp dans le dossier Prisma
del /Q "E:\MASOMO2\node_modules\.prisma\client\*.tmp*"

# Puis relancez
bun run db:generate
```

### La page reste blanche au démarrage

```bash
# Vérifiez que le serveur tourne
curl http://localhost:3000

# Si erreur, supprimez le cache et redémarrez
rmdir /S /Q .next
bun run dev
```

### Erreur "Cannot find module '.prisma/client'"

```bash
bun run db:generate
bun run dev
```

### Le Super Admin ne se connecte pas

1. Vérifiez que le serveur tourne (`bun run dev`)
2. Ouvrez `http://localhost:3000/api/ensure-superadmin` dans le navigateur
3. Vous devriez voir `{"ok":true,"action":"created",...}` ou `{"ok":true,"action":"noop",...}`
4. Rechargez la page de connexion et cliquez sur "Super Admin"

### La base de données est vide

```bash
# Vérifiez que le fichier db/custom.db existe et fait ~1.9 Mo
dir db\custom.db

# Si le fichier est trop petit ou absent, réinitialisez via l'API
curl -X POST http://localhost:3000/api/seed
```

## 📚 Documentation

- `README.md` — Documentation principale
- `INSTALLATION-VSCODE.md` — Guide détaillé d'installation
- `SETUP.md` — Configuration avancée
- `CHANGELOG.md` — Historique des versions
- `BUILD_INFO.md` — Détails de construction de l'archive

---

**Version :** EduGest v1.19.0  
**Framework :** Next.js 16 + TypeScript + Prisma + SQLite  
**Interface :** shadcn/ui + Tailwind CSS
