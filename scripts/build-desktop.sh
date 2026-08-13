#!/usr/bin/env bash
# ============================================================================
# build-desktop.sh — Build MASOMO as a standalone native desktop app
#
# Produces installable binaries for the CURRENT platform:
#   - Windows:  .msi (installer) + .exe (via NSIS)
#   - macOS:    .dmg (disk image) + .app (in the dmg)
#   - Linux:    .deb (Debian/Ubuntu) + .AppImage (universal) + .rpm (Fedora)
#
# The resulting app bundles a Next.js standalone server and launches it
# automatically — NO manual server startup needed by the end user.
#
# Prerequisites (install ONCE per machine):
#   1. Rust toolchain:     https://rustup.rs  (rustup default stable)
#   2. Bun:                 https://bun.sh    (curl -fsSL https://bun.sh/install | bash)
#   3. Platform-specific:
#      - Windows:  Microsoft C++ Build Tools (https://visualstudio.microsoft.com/visual-cpp-build-tools/)
#      - macOS:    Xcode Command Line Tools  (xcode-select --install)
#      - Linux:    sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
#
# Usage:
#   bash scripts/build-desktop.sh          # build for current platform
#   bash scripts/build-desktop.sh --debug  # debug build (faster compile, larger binary)
# ============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

BUILD_TYPE="${1:-release}"
TAURI_ARGS=""
if [ "$BUILD_TYPE" = "--debug" ]; then
  TAURI_ARGS="--debug"
  echo "=== Building MASOMO desktop (DEBUG) ==="
else
  echo "=== Building MASOMO desktop (RELEASE) ==="
fi

# ---- Step 1: Install JS dependencies ----
echo ""
echo "→ [1/4] Installing JS dependencies (bun install)..."
bun install

# ---- Step 2: Build Next.js + prepare Tauri resources ----
echo ""
echo "→ [2/4] Building Next.js standalone + copying to src-tauri/resources/..."
# Clean previous standalone build to force a fresh build
rm -rf .next/standalone
node scripts/prepare-tauri-resources.mjs

# ---- Step 3: Check Rust / Cargo ----
echo ""
echo "→ [3/4] Checking Rust toolchain..."
if ! command -v cargo &>/dev/null; then
  echo "✗ Rust/Cargo not found. Install it from https://rustup.rs"
  exit 1
fi
echo "  Cargo: $(cargo --version)"

# ---- Step 4: Build Tauri ----
echo ""
echo "→ [4/4] Running: tauri build $TAURI_ARGS"
echo "  (This compiles Rust + bundles the Next.js server. First run: ~5-10 min.)"
echo ""
# Use `bunx tauri` (the @tauri-apps/cli NPM package is already in devDependencies).
# This avoids needing the standalone `cargo tauri` Rust crate.
cd "$PROJECT_ROOT"

# On Windows, Git Bash / MSYS2 ships a GNU `link.exe` in /usr/bin that SHADOWS
# MSVC's link.exe (the real one needed by Rust). The GNU version fails with
# "link: extra operand ..." because it only accepts 2 args, not the 20+ that
# Rust passes. To avoid this, we delegate the build to cmd.exe which uses the
# native Windows PATH (without Git's /usr/bin).
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    echo "⚠ Detected Git Bash / MSYS on Windows."
    echo "  Delegating build to cmd.exe to avoid GNU link.exe shadowing MSVC link.exe..."
    echo ""
    # Convert Unix path to Windows path (e.g. /e/MASOMO2 → E:\MASOMO2)
    WIN_ROOT="$(cygpath -w "$PROJECT_ROOT" 2>/dev/null)"
    if [ -z "$WIN_ROOT" ]; then
      echo "✗ Could not convert project path. Please run from PowerShell instead:"
      echo "    cd \"$PROJECT_ROOT\""
      echo "    bunx tauri build"
      exit 1
    fi
    # Check that MSVC link.exe is available in the system PATH
    if ! cmd.exe /c "where link.exe" 2>/dev/null | grep -qiE 'Visual Studio|MSVC|VC\\\\Tools'; then
      echo "✗ MSVC link.exe not found in system PATH."
      echo ""
      echo "  Install Microsoft C++ Build Tools:"
      echo "    https://visualstudio.microsoft.com/visual-cpp-build-tools/"
      echo "  Select workload: 'Desktop development with C++'"
      echo "  Then restart your terminal and retry."
      exit 1
    fi
    # Run the build via cmd.exe with the native Windows PATH
    MSYS_NO_PATHCONV=1 cmd.exe /c "cd /d \"${WIN_ROOT}\" && bunx tauri build $TAURI_ARGS"
    ;;
  *)
    # Linux / macOS — run directly
    bunx tauri build $TAURI_ARGS
    ;;
esac

# ---- Report output location ----
echo ""
echo "============================================"
echo "✅ Build complete!"
echo "============================================"
echo ""
echo "Output location: src-tauri/target/release/bundle/"
echo ""
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows*)
    echo "Windows binaries:"
    echo "  .msi installer:  src-tauri/target/release/bundle/msi/MASOMO_*.msi"
    echo "  .exe (NSIS):     src-tauri/target/release/bundle/nsis/MASOMO_*.exe"
    ;;
  Darwin)
    echo "macOS binaries:"
    echo "  .dmg:            src-tauri/target/release/bundle/dmg/MASOMO_*.dmg"
    echo "  .app:            src-tauri/target/release/bundle/macos/MASOMO.app"
    echo ""
    echo "To create a .pkg installer:"
    echo "  productbuild --component src-tauri/target/release/bundle/macos/MASOMO.app /Applications MASOMO.pkg"
    ;;
  Linux)
    echo "Linux binaries:"
    echo "  .deb:            src-tauri/target/release/bundle/deb/MASOMO_*.deb"
    echo "  .AppImage:       src-tauri/target/release/bundle/appimage/MASOMO_*.AppImage"
    echo "  .rpm (if rpmfind): src-tauri/target/release/bundle/rpm/MASOMO_*.rpm"
    ;;
esac
echo ""
echo "The built app bundles the Next.js server — double-click to launch,"
echo "no separate server startup needed."
