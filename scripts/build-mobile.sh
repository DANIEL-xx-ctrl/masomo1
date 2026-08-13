#!/usr/bin/env bash
# ============================================================================
# build-mobile.sh — Build MASOMO as a native mobile app
#
# Produces installable packages:
#   - Android:  .apk  (sideloadable) + .aab (Google Play Store)
#   - iOS:      .ipa  (via Xcode Archive — macOS host required)
#
# IMPORTANT — Mobile architecture:
#   Unlike desktop (where the Next.js server is bundled inside the app),
#   mobile apps CANNOT bundle a Node.js server. The mobile app is a thin
#   webview that loads your MASOMO server from a URL.
#
#   You MUST either:
#   (A) Deploy the Next.js app to a public URL (Vercel, Railway, your VPS)
#       and point capacitor.config.ts → server.url to that URL, OR
#   (B) Run the Next.js server on your development machine and use the app
#       only on the same local network (good for testing, not production).
#
# This script handles both scenarios. Set MASOMO_SERVER_URL before running
# to override the default localhost URL.
#
# Prerequisites:
#   - Android: Android Studio + JDK 17+ (https://developer.android.com/studio)
#   - iOS:     macOS + Xcode 15+ (https://developer.apple.com/xcode/)
#
# Usage:
#   bash scripts/build-mobile.sh android           # build APK
#   bash scripts/build-mobile.sh ios               # open in Xcode (macOS only)
#   bash scripts/build-mobile.sh android --server https://my.masomo.com
# ============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

PLATFORM="${1:-}"
SERVER_URL="${MASOMO_SERVER_URL:-http://10.0.2.2:3000}"  # 10.0.2.2 = host loopback from Android emulator

if [ -z "$PLATFORM" ]; then
  echo "Usage: bash scripts/build-mobile.sh <android|ios> [--server URL]"
  echo ""
  echo "  android    Build the APK (sideloadable) + AAB (Google Play)"
  echo "  ios        Open the project in Xcode for Archive (.ipa) — macOS only"
  echo ""
  echo "Environment:"
  echo "  MASOMO_SERVER_URL  Override the server URL (default: $SERVER_URL)"
  echo "                     Use your deployed URL for production builds."
  exit 1
fi

# Allow --server flag as 2nd arg
if [ "${2:-}" = "--server" ] && [ -n "${3:-}" ]; then
  SERVER_URL="$3"
fi

echo "=== Building MASOMO mobile ($PLATFORM) ==="
echo "  Server URL: $SERVER_URL"
echo ""

# ---- Step 1: Install deps ----
echo "→ [1/4] Installing JS dependencies..."
bun install

# ---- Step 2: Update capacitor.config.ts with the server URL ----
echo ""
echo "→ [2/4] Updating capacitor.config.ts with server URL..."
cat > capacitor.config.ts << EOF
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.masomo.app',
  appName: 'MASOMO',
  webDir: 'out',
  server: {
    url: '$SERVER_URL',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0d1a1a',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0d1a1a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#10b981',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
    },
  },
}

export default config
EOF
echo "  ✓ capacitor.config.ts updated"

# ---- Step 3: Add platform if not already added ----
echo ""
echo "→ [3/4] Ensuring platform is added..."

# Capacitor requires the webDir ("out") to exist even in server.url mode
mkdir -p out
echo '<html><body></body></html>' > out/index.html

if [ "$PLATFORM" = "android" ]; then
  if [ ! -d "android" ]; then
    echo "  Adding Android platform..."
    # Ensure @capacitor/android is installed
    bun add @capacitor/android@^6 2>/dev/null || true
    bunx cap add android
  else
    echo "  Android platform already exists."
  fi
elif [ "$PLATFORM" = "ios" ]; then
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "✗ iOS builds require macOS (Xcode). You are on: $(uname -s)"
    exit 1
  fi
  if [ ! -d "ios" ]; then
    echo "  Adding iOS platform..."
    bunx cap add ios
  else
    echo "  iOS platform already exists."
  fi
fi

# ---- Step 4: Sync + build ----
echo ""
echo "→ [4/4] Syncing + building..."
bunx cap sync "$PLATFORM"

if [ "$PLATFORM" = "android" ]; then
  echo ""
  echo "============================================"
  echo "Building APK via Gradle..."
  echo "============================================"
  cd android
  ./gradlew assembleDebug
  cd ..
  echo ""
  echo "✅ Android build complete!"
  echo ""
  echo "Output:"
  echo "  Debug APK:     android/app/build/outputs/apk/debug/app-debug.apk"
  echo ""
  echo "To build a release APK / AAB (for distribution):"
  echo "  cd android"
  echo "  ./gradlew assembleRelease    # → app-release.apk"
  echo "  ./gradlew bundleRelease      # → app-release.aab (Google Play)"
  echo ""
  echo "Or open in Android Studio:"
  echo "  bun run cap:open:android"

elif [ "$PLATFORM" = "ios" ]; then
  echo ""
  echo "============================================"
  echo "Opening in Xcode..."
  echo "============================================"
  echo ""
  echo "In Xcode:"
  echo "  1. Select a signing team (Signing & Capabilities tab)"
  echo "  2. Product → Archive (produces the .ipa)"
  echo "  3. Window → Organizer → Distribute App"
  echo ""
  bunx cap open ios
fi

echo ""
echo "NOTE: The mobile app loads: $SERVER_URL"
echo "      Make sure this URL is reachable from the device/emulator."
echo "      - Android emulator: use http://10.0.2.2:3000 (maps to host localhost)"
echo "      - Physical device:   use your machine's LAN IP (e.g. http://192.168.1.50:3000)"
echo "      - Production:        deploy Next.js to a public URL first"
