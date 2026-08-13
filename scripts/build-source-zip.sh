#!/usr/bin/env bash
# Build a clean source-code ZIP of the EduGest project.
# Excludes node_modules, build artifacts, git, databases, screenshots,
# existing download ZIPs, and other bulky/non-source items.

set -euo pipefail

PROJECT_ROOT="/home/z/my-project"
OUTPUT_ZIP="${PROJECT_ROOT}/public/EduGest_Source_Complet_v3.zip"
STAGE_LIST="${PROJECT_ROOT}/.source-zip-filelist.txt"

cd "$PROJECT_ROOT"

# --- Build the list of files to include ---
# Strategy: enumerate everything, then filter out exclusions via grep -vE.
{
  # Top-level config + docs (explicitly listed)
  for f in \
    package.json bun.lock package-lock.json \
    tsconfig.json next.config.ts \
    tailwind.config.ts postcss.config.mjs \
    eslint.config.mjs components.json \
    next-env.d.ts \
    Caddyfile \
    .env.example .gitignore \
    README.md README-SOURCE.md SETUP.md INSTALLATION-VSCODE.md \
    setup.bat setup.ps1 \
    run.sh start.sh restart.sh run-server.sh start-server.sh \
    run-dev.sh start-dev.sh keep-alive.sh watchdog-dev.sh \
    verify-grades.sh \
    SOURCE-README.md \
    CHANGELOG.md ; do
    [ -f "$f" ] && echo "$f"
  done

  # Source code (full src tree)
  find src -type f 2>/dev/null

  # Prisma (schema + migrations + seeds) — exclude the DB binaries
  find prisma -type f 2>/dev/null | grep -vE '\.(db|db-shm|db-wal)$'

  # Mini services
  find mini-services -type f 2>/dev/null

  # Examples (small)
  find examples -type f 2>/dev/null

  # Project scripts (only the small project ones, not skills)
  find scripts -type f 2>/dev/null
  find masomo-backup-scripts -type f 2>/dev/null

  # Public assets that are part of the app (NOT the download zips / screenshots)
  find public -type f 2>/dev/null \
    | grep -vE '\.zip$' \
    | grep -vE '\.(mp4|docx|pdf|txt)$' \
    | grep -vE 'public/(announcements|avatars|uploads|tool-results)/' \
    | grep -vE 'public/(dashboard-|login-|payments-|bulletin-|classes-|attendance-|calendar-|comm|parent-|teacher|students-|super-|badge-|restored-|restore-|screenshot|verify-|debug-|step[0-9]|view_|final_|initial-|date-picker|school-year|notifications-|settings-|grades-|homework-|proclamation-|polytech-|lycee-|edugest-|login-|dashboard-)' \
    | grep -vE 'public/.*\.png$'
  # Re-include the small app icons that were filtered by the .png rule above
  for icon in \
    public/apple-touch-icon.png \
    public/favicon-16x16.png public/favicon-32x32.png \
    public/icon-72x72.png public/icon-96x96.png \
    public/icon-128x128.png public/icon-144x144.png \
    public/icon-152x152.png public/icon-192x192.png \
    public/icon-384x384.png public/icon-512x512.png ; do
    [ -f "$icon" ] && echo "$icon"
  done

  # zscripts (daemon scripts)
  find .zscripts -type f 2>/dev/null

  # agent-ctx (work context — small, useful documentation)
  find agent-ctx -type f 2>/dev/null

} | sort -u > "$STAGE_LIST"

# --- Sanity check ---
COUNT=$(wc -l < "$STAGE_LIST")
echo "Files to zip: $COUNT"

# --- Build the ZIP (store paths relative to project root) ---
rm -f "$OUTPUT_ZIP"
zip -q -X "$OUTPUT_ZIP" -@ < "$STAGE_LIST"

# --- Cleanup ---
rm -f "$STAGE_LIST"

# --- Report ---
SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)
echo "----------------------------------------"
echo "ZIP created: $OUTPUT_ZIP"
echo "Size:        $SIZE"
echo "Files:       $COUNT"
echo "----------------------------------------"
unzip -l "$OUTPUT_ZIP" | tail -5
