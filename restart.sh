#!/bin/bash
# Kill any existing server
pkill -f "next dev" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 2

# Start server
exec npx next dev -p 3000 --webpack
