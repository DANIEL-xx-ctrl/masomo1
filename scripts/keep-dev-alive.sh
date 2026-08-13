#!/usr/bin/env bash
# Keep dev server alive — restart if it dies
cd /home/z/my-project
while true; do
  if ! pgrep -f "next dev" > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] next dev not running — starting..." >> /home/z/my-project/.dev-watcher.log
    nohup bun run dev > /home/z/my-project/dev.log 2>&1 &
    DEV_PID=$!
    disown
    echo "[$(date +%H:%M:%S)] Started dev PID=$DEV_PID" >> /home/z/my-project/.dev-watcher.log
    sleep 20  # wait for it to be ready
  fi
  sleep 5
done
