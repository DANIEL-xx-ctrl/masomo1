#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 node --max-old-space-size=512 .next/standalone/server.js 2>&1
  echo "Server exited at $(date), restarting in 2s..." >> /home/z/my-project/server-restarts.log
  sleep 2
done
