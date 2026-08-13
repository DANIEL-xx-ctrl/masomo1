import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// MIME types
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

const STATIC_DIR = path.join(__dirname, '.next', 'static');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CHUNKS_DIR = path.join(__dirname, '.next', 'static', 'chunks');

// Load the pre-rendered HTML page
const INDEX_HTML = fs.readFileSync(path.join(__dirname, '.next', 'server', 'app', 'index.html'), 'utf-8');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = url.pathname;

  console.log(`${req.method} ${filePath}`);

  // Serve API routes - proxy to Next.js standalone server logic
  if (filePath.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API server starting...' }));
    return;
  }

  // Serve static Next.js files
  if (filePath.startsWith('/_next/static/')) {
    // Remove /_next prefix - files are in .next/static
    const relPath = filePath.replace('/_next', '.next');
    const fullPath = path.join(__dirname, relPath);
    
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(fullPath);
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      fs.createReadStream(fullPath).pipe(res);
      return;
    }
  }

  // Serve public files
  if (filePath !== '/' && !filePath.startsWith('/_next')) {
    const publicPath = path.join(PUBLIC_DIR, filePath);
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      const ext = path.extname(publicPath);
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(publicPath).pipe(res);
      return;
    }
  }

  // Serve the main page for all other routes (SPA)
  res.writeHead(200, { 
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(INDEX_HTML);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MASOMO static server running on http://localhost:${PORT}`);
});
