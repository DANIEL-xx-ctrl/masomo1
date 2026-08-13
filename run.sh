#!/bin/bash
# Auto-restart Next.js dev server
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting server..."
  npx next dev -p 3000 --webpack
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE. Restarting in 2s..."
  sleep 2
done
