#!/usr/bin/env node
// Persistent server daemon for MASOMO
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, '.next', 'standalone', 'server.js');
const PID_FILE = path.join(__dirname, 'server.pid');

// Write our own PID
fs.writeFileSync(PID_FILE, process.pid.toString());

console.log(`[daemon] Starting MASOMO server daemon (PID: ${process.pid})`);

function startServer() {
  const child = spawn('node', [SERVER_PATH], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000', HOSTNAME: '0.0.0.0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('error', (err) => {
    console.error(`[daemon] Server error: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    console.log(`[daemon] Server exited with code ${code}, signal ${signal}`);
    console.log(`[daemon] Restarting in 3 seconds...`);
    setTimeout(startServer, 3000);
  });

  console.log(`[daemon] Server started (PID: ${child.pid})`);
  return child;
}

const server = startServer();

process.on('SIGTERM', () => {
  console.log('[daemon] Received SIGTERM, shutting down...');
  server.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[daemon] Received SIGINT, shutting down...');
  server.kill('SIGINT');
  process.exit(0);
});

// Prevent the process from exiting
setInterval(() => {
  // Keep alive heartbeat
}, 60000);
