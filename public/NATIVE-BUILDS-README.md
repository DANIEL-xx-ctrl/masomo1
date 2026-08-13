# MASOMO — Builds Natifs

## 📦 Fichiers disponibles

### 1. Linux AppImage (téléchargement direct)

**Fichier :** `MASOMO-1.29.0.AppImage` (482 MB)

C'est un fichier auto-contenu qui fonctionne sur toutes les distributions Linux. Pas d'installation requise.

```bash
chmod +x MASOMO-1.29.0.AppImage
./MASOMO-1.29.0.AppImage
```

L'AppImage contient :
- L'application Electron
- Le serveur Next.js complet
- La base de données SQLite
- Le binaire Node.js
- Toutes les dépendances

---

### 2. Autres formats (.exe, .apk, .dmg, .pkg, .deb, .ipa)

Ces formats ne peuvent pas être construits sur cette machine sandbox (limitation de disque 9.9 GB). Vous devez les construire via **GitHub Actions** ou sur votre propre machine.

**Méthode recommandée : GitHub Actions (build les 5 plateformes en parallèle)**

1. Poussez le projet sur GitHub
2. Allez dans **Actions** → **Build Native Apps**
3. Cliquez **Run workflow**
4. Téléchargez les artefacts quand les builds sont verts ✅

| Plateforme | Format | Runner GitHub | Artefact |
|---|---|---|---|
| 🟦 Windows | `.exe` (NSIS) | `windows-latest` | `masomo-windows` |
| 🍎 macOS | `.dmg` (x64+arm64) | `macos-latest` | `masomo-macos` |
| 🐧 Linux | `.deb` + `.AppImage` | `ubuntu-latest` | `masomo-linux` |
| 🤖 Android | `.apk` | `ubuntu-latest` | `masomo-android` |
| 📱 iOS | `.ipa` | `macos-latest` | `masomo-ios` |

---

## 🔧 Build local (sur votre machine)

### Windows (.exe)
```powershell
bun install
bun run electron:build:win
# → electron/dist/MASOMO-1.29.0-Setup.exe
```

### macOS (.dmg)
```bash
bun install
bun run electron:build:mac
# → electron/dist/MASOMO-1.29.0.dmg
```

### Linux (.deb + .AppImage)
```bash
bun install
bun run electron:build:linux
# → electron/dist/masomo_1.29.0_amd64.deb
# → electron/dist/MASOMO-1.29.0.AppImage
```

### Android (.apk)
```bash
bun install
bun add @capacitor/android@^6
bunx cap add android
bunx cap sync android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

### iOS (.ipa)
```bash
bun install
bun add @capacitor/ios@^6
bunx cap add ios
bunx cap sync ios
cd ios/App && pod install
cd ../..
# Build via Xcode: cap open ios
```

---

## 📋 Prérequis par plateforme

| Format | Prérequis |
|---|---|
| `.exe` | Windows 10+ ou Wine (cross-compile), Node.js 20+, Bun |
| `.dmg` | macOS (Intel/ARM) ou Linux (cross-compile unsigned), Node.js 20+, Bun |
| `.deb` | Linux, Node.js 20+, Bun |
| `.AppImage` | Linux, Node.js 20+, Bun |
| `.apk` | Android Studio + JDK 17 + Android SDK (API 34) |
| `.ipa` | macOS + Xcode + CocoaPods + compte Apple Developer ($99/an) pour signature |

---

## ⚠️ Limitations connues

- **iOS .ipa** : Sans compte Apple Developer, l'IPA est non signé. Installation via AltStore/Sideloadly uniquement.
- **macOS .dmg** : Non signé. L'utilisateur doit faire clic-droit → Ouvrir la première fois.
- **Windows .exe** : Non signé. SmartScreen peut afficher un avertissement.

---

*MASOMO v1.29.0 — Builds natifs*
