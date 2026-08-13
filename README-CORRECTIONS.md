# MASOMO - Corrections Workflow GitHub Actions

## PROBLÈMES RÉSOLUS

### 1. Windows échouait : "failed to watch Cargo.toml"
- **Cause** : Tauri v2 cherche un `Cargo.toml` à la racine du projet
- **Fix** : Création de `Cargo.toml` workspace à la racine

### 2. Desktop (Windows/macOS/Linux) échouait : frontendDist vide
- **Cause** : `.gitignore` ignorait `src-tauri/resources/placeholder/`
- **Fix** : Retiré du `.gitignore` + `index.html` ajouté

### 3. Android échouait : "cap add android"
- **Cause** : La commande échouait si la plateforme existait déjà
- **Fix** : Ajout de `|| true` comme pour iOS

### 4. Sécurité supplémentaire
- `prepare-tauri-resources.mjs` génère maintenant `index.html` si manquant
- Étape de vérification ajoutée dans le workflow desktop

---

## INSTALLATION DES CORRECTIONS

### Étape 1 — Extraire ce ZIP
Extrayez ce ZIP **à la racine de votre projet** dans VSCode.
Les fichiers vont REMPLACER les fichiers existants :

```
Cargo.toml                                    ← NOUVEAU
.gitignore                                    ← MODIFIÉ
.github/workflows/build-native.yml            ← MODIFIÉ
scripts/prepare-tauri-resources.mjs           ← MODIFIÉ
src-tauri/Cargo.toml                          ← VÉRIFIÉ
src-tauri/tauri.conf.json                     ← VÉRIFIÉ
src-tauri/resources/placeholder/index.html    ← NOUVEAU
```

### Étape 2 — Vérifier dans VSCode
Ouvrez le terminal dans VSCode et tapez :

```bash
# Vérifier que Cargo.toml existe à la racine
cat Cargo.toml

# Vérifier que placeholder/index.html existe
ls -la src-tauri/resources/placeholder/index.html
```

### Étape 3 — Pousser vers GitHub

```bash
# 1. Ajouter tous les fichiers modifiés
git add -A

# 2. Committer
git commit -m "fix: corrections workflow GitHub Actions (Windows/macOS/Linux/Android)"

# 3. Connecter votre dépôt GitHub (si pas déjà fait)
git remote add origin https://github.com/VOTRE-USER/VOTRE-REPO.git

# 4. Pousser (en force pour écraser l'ancienne version)
git push -u origin main --force
```

### Étape 4 — Relancer le workflow
1. Allez sur **GitHub → votre dépôt → Actions**
2. Cliquez **"Build Native Apps"** → **"Run workflow"**
3. Choisissez :
   - **server_url** : `http://localhost:3000`
   - **build_type** : `release`
4. Cliquez **"Run workflow"**

---

## SI UN JOB ÉCHELLE ENCORE

Cliquez sur le job rouge → descendez jusqu'à l'étape échouée → **copiez l'erreur**.
Les erreurs possibles :
- `bun install` échoue → problème de lockfile
- `bun run build` échoue → erreur de compilation Next.js
- `tauri build` échoue → erreur de configuration Tauri
- `prisma generate` échoue → problème de génération Prisma
