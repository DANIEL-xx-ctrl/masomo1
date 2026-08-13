#!/bin/bash
cd /home/z/my-project
while true; do
  rm -rf .next/cache .next/dev/lock 2>/dev/null
  npx next dev -p 3000 --webpack
  echo "Server crashed at $(date), restarting in 3s..." >> /tmp/server-restart.log
  sleep 3
done
