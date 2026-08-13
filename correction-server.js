const { spawn } = require('child_process');
const fs = require('fs');

const PID_FILE = '/home/z/my-project/server.pid';

function startServer() {
  const child = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000', HOSTNAME: '0.0.0.0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
  
  child.unref();
  fs.writeFileSync(PID_FILE, child.pid.toString());
  console.log(`Server started with PID ${child.pid}`);
}

startServer();
