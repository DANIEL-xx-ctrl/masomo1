# MASOMO — Correctifs des builds natifs (v3 — définitif)

Ce ZIP contient **tous les fichiers corrigés** pour faire fonctionner le workflow
GitHub Actions `Build Native Apps` sur **toutes les plateformes** (Windows, macOS,
Linux, Android, iOS) — sans l'erreur `Visual Studio not found` sur Windows.

---

## 1. Le problème résolu

Le workflow GitHub Actions échouait sur Windows avec :

```
executing @electron/rebuild
preparing moduleName=@parcel/watcher
⨯ Error: Could not find any Visual Studio installation to use
```

### Cause racine (définitivement identifiée)

`@electron/rebuild` scanne le **répertoire de l'application** (la racine du projet
par défaut) à la recherche de modules natifs à recompiler. Comme la racine contient
`node_modules/` (hérité de Next.js, avec `@parcel/watcher`, `sharp`, etc.),
`@electron/rebuild` essayait de les recompiler contre les headers d'Electron —
ce qui nécessite Visual Studio Build Tools, absent des runners GitHub Actions.

Les tentatives précédentes (`npmRebuild: false` dans le YAML, override CLI
`--config.npmRebuild=false`, suppression manuelle de modules) ont échoué car
elles laissaient l'arbre des dépendances du `package.json` racine référencer
encore ces modules natifs.

---

## 2. La solution : répertoire « app » propre

On ne supprime plus les modules un par un. On indique à electron-builder de
**packager un répertoire d'application séparé et vide** :

```
electron/app/
├── main.js          ← processus principal Electron (Node.js built-ins uniquement)
├── preload.js       ← preload script
└── package.json     ← ZÉRO dependencies, ZÉRO devDependencies
```

Comme ce répertoire n'a **pas de `node_modules`**, `@electron/rebuild` trouve
**rien à recompiler** → aucun besoin de Visual Studio (Windows), Xcode (macOS)
ou build-essential (Linux).

Le serveur Next.js (avec **ses propres** `node_modules` + binaire Node.js + base
SQLite) est bundlé **séparément** via `extraResources` et tourne comme un
**processus enfant Node.js indépendant** — pas dans le process Electron.

### Vérifié localement (Linux)

```
• electron-builder  version=25.1.8
• loaded configuration  file=electron-builder.yml
• skipped dependencies rebuild  reason=npmRebuild is set to false  ← ✓
• packaging  platform=linux arch=x64 electron=33.4.11
EXIT: 0
```

Contenu de l'asar généré : `/main.js`, `/package.json`, `/preload.js` — **rien d'autre**.

---

## 3. Fichiers contenus dans ce ZIP

| Fichier | Rôle |
|---|---|
| `electron/app/main.js` | Processus principal Electron (NOUVEAU — clean dir) |
| `electron/app/preload.js` | Preload script (NOUVEAU — clean dir) |
| `electron/app/package.json` | package.json minimal, ZÉRO dépendances (NOUVEAU) |
| `electron/main.js` | Version originale (pour dev local) |
| `electron/preload.js` | Version originale (pour dev local) |
| `electron-builder.yml` | Config avec `directories.app: electron/app` |
| `scripts/prepare-electron-resources.mjs` | Bundle le serveur Next.js + binaire Node + DB |
| `package.json` | package.json racine mis à jour (`main` → `electron/app/main.js`) |
| `.github/workflows/build-native.yml` | Workflow GitHub Actions simplifié (5 jobs) |
| `.gitignore` | Ignore `electron/dist/`, `electron/resources/server/` |

---

## 4. Comment appliquer les correctifs

### Étape 1 — Copier les fichiers dans votre projet

Remplacez les fichiers existants par ceux de ce ZIP. Le répertoire `electron/app/`
est NOUVEAU — il doit être créé.

### Étape 2 — Commit & push

```powershell
git add -A
git commit -m "Fix: clean app dir to skip @electron/rebuild on all platforms"
git push
```

### Étape 3 — Lancer le workflow

1. GitHub → onglet **Actions**
2. Sélectionnez **Build Native Apps**
3. **Run workflow**
4. Choisissez :
   - **Server URL** : `http://10.0.2.2:3000` (émulateur Android) ou `https://votre-serveur.com`
   - **Build type** : `release`
5. **Run workflow**

### Étape 4 — Télécharger les artifacts

| Job | Artifact | Fichiers produits |
|---|---|---|
| Desktop (windows) | `masomo-windows` | `MASOMO-1.29.0-Setup.exe`, portable `.exe` |
| Desktop (macos) | `masomo-macos` | `MASOMO-1.29.0.dmg` (x64 + arm64) |
| Desktop (linux) | `masomo-linux` | `MASOMO-1.29.0.deb`, `.AppImage` |
| Android | `masomo-android` | `app-release-unsigned.apk` ou `app-debug.apk` |
| iOS | `masomo-ios` | `MASOMO.ipa` (non signé) |

---

## 5. Notes iOS

L'`.ipa` est **non signé**. Pour un appareil physique :

1. Compte Apple Developer (99 $/an)
2. Ajoutez ces secrets GitHub :
   - `IOS_P12_BASE64`, `IOS_P12_PASSWORD`
   - `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_TEAM_ID`
3. Relancez le workflow → signature automatique

Sans signature : installer via **AltStore** / **Sideloadly**, ou tester dans le
**Simulateur iOS**.

---

## 6. Vérification rapide (optionnel, avant push)

```bash
bun install
bun run db:generate
bun run build
node scripts/prepare-electron-resources.mjs
bunx electron-builder --config electron-builder.yml --linux --dir
```

Vous devez voir :
```
• skipped dependencies rebuild  reason=npmRebuild is set to false
```

C'est la preuve que `@electron/rebuild` ne tentera rien sur Windows non plus.
