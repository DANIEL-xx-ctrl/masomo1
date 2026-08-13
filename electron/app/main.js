// ============================================================================
// electron/main.js — Electron main process for MASOMO
//
// Architecture:
//   1. On app launch, find a free TCP port on 127.0.0.1
//   2. Spawn `node server.js` (the bundled Next.js standalone server) as a
//      child process, with PORT env set to the chosen port
//   3. Poll http://127.0.0.1:PORT until the server responds
//   4. Create a BrowserWindow that loads http://127.0.0.1:PORT
//   5. On app quit / window-all-closed, kill the child server process
//
// The bundled server lives in <app>/resources/server/ (extraResources in
// electron-builder config). On Windows the node binary is at
// <app>/resources/server/node-bin/node.exe; on macOS/Linux it's
// <app>/resources/server/node-bin/node.
// ============================================================================

const { app, BrowserWindow, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')
const http = require('http')
const fs = require('fs')

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
let mainWindow = null
let serverProcess = null
let serverPort = 0
let serverStarted = false

// ---------------------------------------------------------------------------
// Path helpers — work both in dev (electron/ folder) and packaged app
// ---------------------------------------------------------------------------
function getResourcesDir() {
  // In a packaged app, extraResources are placed under process.resourcesPath.
  // In dev (running via `electron electron/app/main.js`), this file lives at
  // electron/app/main.js, so resources are at electron/resources/.
  if (!app.isPackaged) {
    return path.join(__dirname, '..', 'resources')
  }
  return process.resourcesPath
}

function getServerDir() {
  return path.join(getResourcesDir(), 'server')
}

function getNodeBinary() {
  const dir = path.join(getServerDir(), 'node-bin')
  const exe = process.platform === 'win32' ? 'node.exe' : 'node'
  const candidate = path.join(dir, exe)
  if (fs.existsSync(candidate)) return candidate
  // Fallback to system node if the bundled binary is missing
  return exe
}

// ---------------------------------------------------------------------------
// Find a free TCP port on 127.0.0.1 (starting from 3000)
// ---------------------------------------------------------------------------
function findFreePort(startPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => {
      resolve(findFreePort(startPort + 1))
    })
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

// ---------------------------------------------------------------------------
// Wait for the HTTP server to be ready (poll up to 60 seconds)
// ---------------------------------------------------------------------------
function waitForServer(port, timeoutMs = 60000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Server did not start within 60 seconds'))
      }
      const req = http.get(
        { hostname: '127.0.0.1', port, path: '/', timeout: 2000 },
        (res) => {
          // Any HTTP response means the server is up
          res.resume()
          resolve()
        }
      )
      req.on('error', () => setTimeout(check, 500))
      req.on('timeout', () => {
        req.destroy()
        setTimeout(check, 500)
      })
    }
    check()
  })
}

// ---------------------------------------------------------------------------
// Spawn the Next.js standalone server
// ---------------------------------------------------------------------------
function startServer(port) {
  const serverDir = getServerDir()
  const serverJs = path.join(serverDir, 'server.js')

  if (!fs.existsSync(serverJs)) {
    throw new Error(`server.js not found at: ${serverJs}`)
  }

  const nodeBin = getNodeBinary()
  console.log(`[MASOMO] Starting server: ${nodeBin} ${serverJs} (port ${port})`)

  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'production',
    // Ensure the SQLite database path is relative to the server dir
    DATABASE_URL: 'file:./db/custom.db',
    ELECTRON_RUN: '1',
  }

  serverProcess = spawn(nodeBin, [serverJs], {
    cwd: serverDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  serverProcess.stdout.on('data', (data) => {
    console.log(`[server] ${data.toString().trim()}`)
  })
  serverProcess.stderr.on('data', (data) => {
    console.error(`[server:err] ${data.toString().trim()}`)
  })
  serverProcess.on('exit', (code, signal) => {
    console.log(`[server] exited with code ${code} signal ${signal}`)
    serverProcess = null
  })

  return waitForServer(port)
}

// ---------------------------------------------------------------------------
// Create the main browser window
// ---------------------------------------------------------------------------
function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'MASOMO - Système de Gestion Scolaire',
    backgroundColor: '#0f172a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Load the Next.js app from the local server
  mainWindow.loadURL(`http://127.0.0.1:${port}`)

  // Show window once it's ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Open external links (http/https) in the default browser, not in-app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  try {
    serverPort = await findFreePort(3000)
    console.log(`[MASOMO] Using port ${serverPort}`)
    await startServer(serverPort)
    serverStarted = true
    createWindow(serverPort)
  } catch (err) {
    console.error('[MASOMO] Failed to start:', err)
    // Show an error window
    const win = new BrowserWindow({ width: 600, height: 400 })
    win.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          `<html><body style="font-family:sans-serif;padding:2rem;background:#1e293b;color:#fca5a5"><h1>MASOMO — Erreur de démarrage</h1><p>Le serveur local n'a pas pu démarrer.</p><pre>${err.message}</pre></body></html>`
        )
    )
  }
})

app.on('window-all-closed', () => {
  // On all platforms, quit when all windows are closed
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverStarted) {
    createWindow(serverPort)
  }
})

// ---------------------------------------------------------------------------
// Cleanup: kill the child server process before quitting
// ---------------------------------------------------------------------------
app.on('before-quit', () => {
  if (serverProcess) {
    console.log('[MASOMO] Stopping server process...')
    try {
      if (process.platform === 'win32') {
        // Use taskkill to kill the whole process tree on Windows
        spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t'], {
          windowsHide: true,
        })
      } else {
        serverProcess.kill('SIGTERM')
        // Force kill after 3 seconds if still alive
        setTimeout(() => {
          try {
            serverProcess && serverProcess.kill('SIGKILL')
          } catch (_) {
            /* already dead */
          }
        }, 3000)
      }
    } catch (e) {
      console.error('[MASOMO] Error stopping server:', e)
    }
  }
})

// Prevent the app from being killed externally without cleanup
process.on('SIGINT', () => app.quit())
process.on('SIGTERM', () => app.quit())
