# MASOMO — Guide de compilation native

Ce guide explique comment transformer MASOMO en **exécutable installable** sur
les 5 plateformes : **Windows (.exe/.msi), macOS (.dmg/.pkg), Linux (.deb/.AppImage),
Android (.apk), iOS (.ipa)**.

Deux approches sont disponibles :

| Approche | Plateformes | Difficulté | Résultat |
|----------|-------------|------------|----------|
| **PWA** (navigateur) | Les 5 | ⭐ Très facile | Icône sur le bureau, fonctionne hors ligne |
| **App native bureau** (Tauri) | Windows, macOS, Linux | ⭐⭐ Moyenne | `.exe` / `.dmg` / `.deb` autonome |
| **App native mobile** (Capacitor) | Android, iOS | ⭐⭐⭐ Avancée | `.apk` / `.ipa` |

---

## Sommaire

1. [Installation PWA (le plus simple — 5 plateformes)](#1--installation-pwa-le-plus-simple--5-plateformes)
2. [Prérequis communs](#2--prérequis-communs)
3. [Windows — .exe / .msi (Tauri)](#3--windows--exe--msi-tauri)
4. [macOS — .dmg / .pkg (Tauri)](#4--macos--dmg--pkg-tauri)
5. [Linux — .deb / .AppImage (Tauri)](#5--linux--deb--appimage-tauri)
6. [Android — .apk (Capacitor)](#6--android--apk-capacitor)
7. [iOS — .ipa (Capacitor)](#7--ios--ipa-capacitor)
8. [Architecture — comment ça marche](#8--architecture--comment-ça-marche)
9. [Dépannage](#9--dépannage)

---

## 1) Installation PWA (le plus simple — 5 plateformes)

Aucune compilation. Ouvrez l'application dans le navigateur et installez-la :

| Plateforme | Navigateur | Étapes |
|------------|------------|--------|
| **Windows** | Edge / Chrome | Ouvrez l'app → menu **⋮** ou **⋯** → **Installer MASOMO** |
| **macOS** | Chrome / Edge | Ouvrez l'app → menu **⋮** → **Installer MASOMO** |
| **macOS** | Safari | Ouvrez l'app → **Partager** 📤 → **Ajouter au Dock** |
| **Linux** | Chrome / Edge / Firefox | Ouvrez l'app → menu **⋮** → **Installer MASOMO** |
| **Android** | Chrome | Ouvrez l'app → menu **⋮** → **Installer l'application** |
| **iOS/iPadOS** | Safari | Ouvrez l'app → **Partager** 📤 → **Sur l'écran d'accueil** |

L'icône apparaît sur le bureau / l'écran d'accueil. L'app fonctionne hors ligne.

---

## 2) Prérequis communs

Pour construire les **binaires natifs**, installez d'abord ces outils sur votre
machine de développement (celle qui contient le code source dans VSCode) :

### Tous les OS
- **Bun** (runtime JS) — https://bun.sh
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Node.js 18+** — https://nodejs.org (requis pour lancer le serveur Next.js bundlé)

### Pour les apps desktop (Tauri) — Windows/macOS/Linux
- **Rust** — https://rustup.rs
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  rustup default stable
  ```

### Pour Windows uniquement
- **Microsoft C++ Build Tools** — https://visualstudio.microsoft.com/visual-cpp-build-tools/
  Cochez « Développement Desktop en C++ » lors de l'installation.

### Pour macOS uniquement
- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```

### Pour Linux uniquement
```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

### Pour Android
- **Android Studio** — https://developer.android.com/studio
  (inclut le SDK Android + JDK 17)

### Pour iOS (macOS uniquement)
- **Xcode 15+** — https://developer.apple.com/xcode/
- Un compte développeur Apple (gratuit pour test sur appareil personnel,
  payant pour distribution App Store)

---

## 3) Windows — .exe / .msi (Tauri)

### Étapes

```bash
# 1. Dans VSCode, ouvrez le dossier du projet MASOMO
# 2. Ouvrez un terminal (Ctrl + `)
# 3. Installez les dépendances JS
bun install

# 4. Construisez l'app Windows
bash scripts/build-desktop.sh
```

Le script va :
1. Construire Next.js en mode standalone (`bun run build`)
2. Copier le serveur + base de données + assets dans `src-tauri/resources/`
3. Compiler le binaire Rust via Tauri
4. Produire l'installateur dans `src-tauri/target/release/bundle/`

### Fichiers de sortie

```
src-tauri/target/release/bundle/
├── msi/
│   └── MASOMO_1.28.8_x64_en-US.msi     ← Installeur Windows (double-clic pour installer)
└── nsis/
    └── MASOMO_1.28.8_x64-setup.exe      ← Installeur alternatif (NSIS)
```

### Distribution
- Double-cliquez sur le `.msi` pour installer MASOMO sur n'importe quel PC Windows 10/11
- L'app se lance depuis le menu Démarrer → « MASOMO »
- Le serveur Next.js est **bundlé à l'intérieur** — aucune installation séparée requise

---

## 4) macOS — .dmg / .pkg (Tauri)

### Étapes

```bash
# 1. Dans VSCode (sur macOS), ouvrez le projet MASOMO
# 2. Terminal
bun install

# 3. Construisez l'app macOS
bash scripts/build-desktop.sh
```

### Fichiers de sortie

```
src-tauri/target/release/bundle/
├── dmg/
│   └── MASOMO_1.28.8_aarch64.dmg        ← Image disque (glisser vers Applications)
└── macos/
    └── MASOMO.app                        ← L'application elle-même
```

### Créer un .pkg (installateur macOS)

```bash
# Après le build Tauri, créez un .pkg installable :
productbuild --component \
  src-tauri/target/release/bundle/macos/MASOMO.app \
  /Applications \
  MASOMO_1.28.8.pkg
```

Le fichier `MASOMO_1.28.8.pkg` peut être distribué et installé par double-clic.

### Architecture (Intel vs Apple Silicon)
- Sur un Mac **M1/M2/M3** (Apple Silicon) : le build produit `aarch64.dmg`
- Sur un Mac **Intel** : le build produit `x64.dmg`
- Pour un binaire universel : `rustup target add x86_64-apple-darwin aarch64-apple-darwin` puis
  `bash scripts/build-desktop.sh --universal` (non couvert ici)

### Note sur la signature
Pour distribuer hors du Mac App Store sans avertissement « application non identifiée »,
signez l'app avec un Developer ID Certificate :
```bash
# Dans tauri.conf.json, section bundle.macOS :
#   "signingIdentity": "Developer ID Application: Votre Nom (XXXXXXXXXX)"
```

---

## 5) Linux — .deb / .AppImage (Tauri)

### Étapes

```bash
# 1. Installez les dépendances système (voir section 2)
# 2. Dans VSCode, ouvrez le projet
# 3. Terminal
bun install

# 4. Construisez
bash scripts/build-desktop.sh
```

### Fichiers de sortie

```
src-tauri/target/release/bundle/
├── deb/
│   └── masomo_1.28.8_amd64.deb          ← Debian/Ubuntu (dpkg -i)
├── appimage/
│   └── masomo_1.28.8_amd64.AppImage      ← Exécutable universel (chmod +x && ./...)
└── rpm/                                  ← Fedora/RedHat (si rpmbuild est installé)
    └── masomo-1.28.8-1.x86_64.rpm
```

### Installation

```bash
# Debian/Ubuntu :
sudo dpkg -i masomo_1.28.8_amd64.deb
# Puis lancez depuis le menu Applications → MASOMO

# AppImage (aucune installation) :
chmod +x masomo_1.28.8_amd64.AppImage
./masomo_1.28.8_amd64.AppImage

# Fedora/RedHat :
sudo rpm -i masomo-1.28.8-1.x86_64.rpm
```

---

## 6) Android — .apk (Capacitor)

### ⚠️ Important — Architecture mobile

Contrairement au desktop (où le serveur Next.js est **bundlé dans l'app**),
une app mobile **ne peut pas** contenir un serveur Node.js. L'app Android
est une webview qui charge votre serveur MASOMO depuis une URL.

**Vous devez donc déployer le serveur MASOMO sur une URL publique** (Vercel,
Railway, votre VPS…) avant de construire l'APK, OU utiliser l'émulateur avec
`localhost` (pour test uniquement).

### Étapes (test local avec émulateur)

```bash
# 1. Démarrez le serveur MASOMO sur votre machine
bun run dev   # ou: bun run build && bun run start

# 2. Dans un autre terminal, construisez l'APK
#    (10.0.2.2 = localhost de la machine hôte vu depuis l'émulateur Android)
bash scripts/build-mobile.sh android --server http://10.0.2.2:3000
```

### Étapes (production — serveur déployé)

```bash
# 1. Déployez MASOMO sur Vercel/Railway/etc. (exemple : https://masomo.mon-ecole.com)
# 2. Construisez l'APK pointant vers cette URL
bash scripts/build-mobile.sh android --server https://masomo.mon-ecole.com
```

### Fichiers de sortie

```
android/app/build/outputs/apk/
├── debug/
│   └── app-debug.apk                    ← APK de test (sideloadable)
└── release/
    └── app-release.apk                   ← APK de production (signé)
```

### Installer l'APK sur un téléphone

```bash
# Via adb (le téléphone doit être en mode développeur + débogage USB) :
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Ou copiez le .apk sur le téléphone (USB, Google Drive…) et ouvrez-le
# (activez « Sources inconnues » dans les paramètres Android si besoin)
```

### APK pour Google Play Store (.aab)

```bash
cd android
./gradlew bundleRelease
# Sortie : android/app/build/outputs/bundle/release/app-release.aab
```

---

## 7) iOS — .ipa (Capacitor)

### ⚠️ Prérequis
- Un **Mac** (obligatoire — Xcode n'existe que sur macOS)
- **Xcode 15+** installé
- Un compte Apple Developer (gratuit pour test personnel, 99 €/an pour l'App Store)

### Étapes

```bash
# 1. Démarrez le serveur MASOMO (ou utilisez une URL déployée)
bun run dev

# 2. Ouvrez le projet dans Xcode
bash scripts/build-mobile.sh ios --server http://localhost:3000
#    (cela ajoute la plateforme iOS si elle n'existe pas, puis ouvre Xcode)
```

### Dans Xcode

1. Sélectionnez une **Signing Team** (onglet *Signing & Capabilities*)
2. Branchez votre **iPhone** en USB (sélectionnez-le comme cible)
3. **Product → Run** (⌘R) pour tester sur l'appareil
4. Pour produire un `.ipa` :
   - **Product → Archive** (cela crée une archive)
   - **Window → Organizer** → sélectionnez l'archive
   - **Distribute App** → choisissez le mode (Ad Hoc, App Store, etc.)

### Fichiers de sortie
- L'archive `.ipa` est exportée par Xcode Organizer vers le dossier de votre choix
- Pour l'App Store : utilisez **Distribute App → App Store Connect**

---

## 8) Architecture — comment ça marche

### Desktop (Tauri) — serveur bundlé

```
┌─────────────────────────────────────────┐
│  MASOMO.exe / .app / .AppImage          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Tauri (Rust)                     │  │
│  │  • Lance le serveur Node.jsbundlé │  │
│  │  • Ouvre une fenêtre webview      │  │
│  │  • Charge http://127.0.0.1:3000   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Serveur Next.js (bundlé)         │  │
│  │  • server.js (standalone)         │  │
│  │  • .next/static/ (assets)         │  │
│  │  • public/ (favicon, manifest)    │  │
│  │  • db/custom.db (SQLite)          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

L'utilisateur final n'a **rien d'autre à installer** — l'app contient tout.
Au lancement, Tauri démarre le serveur Node.js en arrière-plan, attend qu'il
soit prêt (port 3000), puis affiche la fenêtre.

### Mobile (Capacitor) — serveur distant

```
┌──────────────────┐         ┌──────────────────────────┐
│  MASOMO.apk      │         │  Serveur MASOMO          │
│  (Android/iOS)   │  HTTP   │  (Vercel / VPS / LAN)    │
│                  │ ──────> │                          │
│  Webview qui     │         │  • Next.js + API routes  │
│  charge l'URL    │         │  • Prisma + SQLite       │
└──────────────────┘         └──────────────────────────┘
```

Le serveur doit être **déployé et accessible** depuis le téléphone. Pour un
usage purement local (test), utilisez l'IP de votre machine sur le réseau Wi-Fi.

---

## 9) Dépannage

### `bun run build` échoue avec SIGKILL (mémoire insuffisante)
Le build Next.js standalone consomme beaucoup de RAM. Solutions :
- Fermez les autres applications (Chrome, VSCode peut consommer 2-4 Go)
- Augmentez la mémoire swap : `sudo fallocate -l 4G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
- Utilisez une machine avec au moins 4 Go de RAM libre

### `error: failed to run custom build command for tauri-build`
Rust n'est pas installé ou pas dans le PATH :
```bash
source "$HOME/.cargo/env"
rustc --version  # doit afficher une version
```

### `error: no such command: \`tauri\`` (cargo tauri)
Le CLI Tauri n'est pas installé comme binaire Cargo. Deux solutions :

**Solution 1 — Utiliser `bunx tauri` (recommandé, déjà configuré dans ce projet)**
```bash
bunx tauri --version    # doit afficher "tauri-cli 2.x.x"
bunx tauri build        # build direct (depuis la racine du projet)
```
Le script `scripts/build-desktop.sh` utilise déjà `bunx tauri build`.

**Solution 2 — Installer le CLI Rust globalement**
```bash
cargo install tauri-cli --version "^2"
cargo tauri --version
```

### `link: extra operand ...` / `linking with link.exe failed` (Windows)
**Cause** : Git Bash / MSYS2 installe un GNU `link.exe` dans `/usr/bin/` qui **masque** le vrai `link.exe` de MSVC. Le GNU `link` n'accepte que 2 arguments, d'où l'erreur `extra operand`.

**Solution 1 — Lancer le build depuis PowerShell (le plus simple)**
Ferme Git Bash, ouvre **PowerShell** dans VSCode (Terminal → New Terminal → sélectionne PowerShell), puis :
```powershell
cd E:\MASOMO2
bunx tauri build
```
PowerShell utilise le PATH Windows natif, donc MSVC `link.exe` est trouvé en premier.

**Solution 2 — Le script `build-desktop.sh` détecte maintenant Git Bash**
Le script détecte automatiquement Git Bash et délègue le build à `cmd.exe` (qui utilise le PATH natif). Vous pouvez donc continuer à utiliser :
```bash
bash scripts/build-desktop.sh
```

**Solution 3 — Vérifier que MSVC Build Tools sont installés**
```powershell
where.exe link.exe
```
- Si vous ne voyez que `C:\Program Files\Git\usr\bin\link.exe` → MSVC n'est **pas** installé.
- Installez-le : https://visualstudio.microsoft.com/visual-cpp-build-tools/
  - Cochez **« Développement Desktop en C++ »**
  - Vérifiez que **MSVC v143 - VS 2022 C++ x64/x86 build tools** est sélectionné
- Redémarrez le terminal après installation.

### Tauri build : `webkit2gtk-4.1 not found` (Linux)
Installez les dépendances système (voir section 2 — Linux).

### Android : `SDK location not found`
Définissez `ANDROID_HOME` :
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

### iOS : `xcrun: error: invalid active developer path`
```bash
sudo xcode-select --reset
xcode-select --install
```

### L'app desktop affiche une page blanche
Le serveur bundled n'a pas démarré. Vérifiez :
- Que `node` est installé sur la machine cible (ou utilisez `bun` — voir `src-tauri/src/main.rs`)
- Que le pare-feu autorise localhost:3000

### Reconstruire les icônes
```bash
bun run scripts/generate-icons.mjs
```

### Reconstruire le ZIP source
```bash
bash scripts/build-public-zip.sh
```
