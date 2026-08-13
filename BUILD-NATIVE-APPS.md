# MASOMO — Guide de Build des Applications Natives

Ce guide explique comment générer les installables natifs de MASOMO :
- **Windows** : `.exe` + `.msi`
- **macOS** : `.dmg` + `.pkg`
- **Linux** : `.deb` + `.AppImage`
- **Android** : `.apk`

---

## 🎯 Trois méthodes disponibles

| Méthode | Plateformes | Difficulté | Quand l'utiliser |
|---------|-------------|------------|------------------|
| **GitHub Actions** (recommandé) | Les 4 | ⭐ Facile | Vous voulez tous les binaires sans installer d'outils |
| **Build local** | Selon votre OS | ⭐⭐ Moyenne | Vous avez le bon OS et voulez tester rapidement |
| **PWA** | Les 4 | ⭐ Très facile | Vous voulez juste une icône sur le bureau/homme |

---

## 1️⃣ Méthode GitHub Actions (RECOMMANDÉE — tous les binaires)

Cette méthode construit les 4 installables en parallèle sur les serveurs GitHub.
Vous n'avez besoin de **rien installer** sur votre machine.

### Étapes

1. **Poussez le projet sur GitHub**
   ```bash
   git init
   git add .
   git commit -m "MASOMO - Ready for native builds"
   git branch -M main
   git remote add origin https://github.com/VOTRE-USER/masomo.git
   git push -u origin main
   ```

2. **Allez dans l'onglet Actions**
   - Sur GitHub.com → votre repo → onglet **Actions**
   - Sélectionnez **Build Native Apps** dans la sidebar

3. **Lancez le workflow**
   - Cliquez **Run workflow**
   - Choisissez :
     - **Server URL** : l'URL où MASOMO est déployé (pour l'APK Android)
       - Pour test émulateur : `http://10.0.2.2:3000`
       - Pour production : `https://masomo.mon-ecole.com`
     - **Build type** : `release` (recommandé) ou `debug`
   - Cliquez **Run workflow**

4. **Patientez ~15-20 min** (les 4 builds tournent en parallèle)

5. **Téléchargez les binaires**
   - Quand le workflow est terminé (✓ vert), cliquez sur le run
   - En bas, section **Artifacts** :
     - `masomo-windows` → contient `.exe` + `.msi`
     - `masomo-macos` → contient `.dmg` + `.pkg`
     - `masomo-linux` → contient `.deb` + `.AppImage`
     - `masomo-android` → contient `.apk`

### Pour un APK Android signé (production)

Pour un APK de production signé (pour Google Play Store) :

1. Générez un keystore :
   ```bash
   keytool -genkey -v -keystore masomo.keystore -alias masomo \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Ajoutez-le comme secret GitHub :
   - Repo → **Settings** → **Secrets and variables** → **Actions**
   - **New repository secret** :
     - `ANDROID_KEYSTORE_BASE64` : `base64 masomo.keystore`
     - `ANDROID_KEY_ALIAS` : `masomo`
     - `ANDROID_KEY_PASSWORD` : votre mot de passe
     - `ANDROID_STORE_PASSWORD` : votre mot de passe

3. Relancez le workflow en mode `release`

---

## 2️⃣ Méthode Build Local (par OS)

### Prérequis communs
- **Bun** : https://bun.sh
- **Rust** : https://rustup.rs (`rustup default stable`)
- **Node.js 18+**

### Windows — `.exe` + `.msi`

```powershell
# Prérequis : Microsoft C++ Build Tools
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Cochez "Développement Desktop en C++"

# Build
cd E:\MASOMO2
bun install
bunx tauri build
```

**Sortie** : `src-tauri/target/release/bundle/nsis/MASOMO_*-setup.exe` + `.msi`

> ⚠️ Utilisez **PowerShell** (pas Git Bash) pour éviter le bug `link.exe`

### macOS — `.dmg` + `.pkg`

```bash
xcode-select --install
cd /path/to/masomo
bun install
bunx tauri build
# Puis créer le .pkg :
productbuild --component src-tauri/target/release/bundle/macos/MASOMO.app /Applications MASOMO.pkg
```

**Sortie** : `src-tauri/target/release/bundle/dmg/MASOMO_*.dmg` + `MASOMO.pkg`

### Linux — `.deb` + `.AppImage`

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
cd /path/to/masomo
bun install
bunx tauri build
```

**Sortie** : `src-tauri/target/release/bundle/deb/masomo_*.deb`

### Android — `.apk`

```bash
# Prérequis : Android Studio (SDK + JDK 17)
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

cd /path/to/masomo
bun install
bun add @capacitor/android@^6

# Créer le dossier web (requis même en mode server.url)
mkdir -p out && echo '<html><body></body></html>' > out/index.html

# Configurer l'URL du serveur dans capacitor.config.ts
# (changez localhost par l'URL de votre serveur déployé)

bunx cap add android
bunx cap sync android
cd android
./gradlew assembleDebug     # debug APK
# ou
./gradlew assembleRelease   # release APK (signé si keystore configuré)
```

**Sortie** : `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 3️⃣ Méthode PWA (le plus simple — 5 plateformes)

Aucune compilation. Ouvrez l'app dans le navigateur et installez-la :

| Plateforme | Navigateur | Étapes |
|------------|------------|--------|
| Windows | Edge/Chrome | Menu ⋮ → **Installer MASOMO** |
| macOS | Chrome/Edge | Menu ⋮ → **Installer MASOMO** |
| Linux | Chrome/Firefox | Menu ⋮ → **Installer MASOMO** |
| Android | Chrome | Menu ⋮ → **Installer l'application** |
| iOS | Safari | Partager 📤 → **Sur l'écran d'accueil** |

---

## 📋 Résumé — quelle méthode choisir ?

```
Vous voulez .exe + .msi + .pkg + .deb + .apk ?
  └─→ GitHub Actions (méthode 1) — poussez sur GitHub, cliquez Run

Vous avez un PC Windows et voulez juste le .exe ?
  └─→ Build local Windows (méthode 2) — PowerShell + bunx tauri build

Vous voulez juste une icône sur le bureau sans rien installer ?
  └─→ PWA (méthode 3) — installez depuis le navigateur
```

---

## 🔧 Fichiers de configuration inclus

| Fichier | Rôle |
|---------|------|
| `.github/workflows/build-native.yml` | Workflow GitHub Actions pour les 4 plateformes |
| `src-tauri/tauri.conf.json` | Config Tauri (Windows/macOS/Linux) |
| `src-tauri/Cargo.toml` | Dépendances Rust |
| `capacitor.config.ts` | Config Capacitor (Android/iOS) |
| `scripts/build-desktop.sh` | Script de build desktop (Linux/macOS) |
| `scripts/build-mobile.sh` | Script de build mobile |

---

## ❓ Dépannage

Voir `NATIVE-BUILD.md` pour les erreurs courantes et leurs solutions.
