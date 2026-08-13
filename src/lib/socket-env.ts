// ============================================================
// Environment-aware socket URL helper
// ------------------------------------------------------------
// In the cloud sandbox, a Caddy reverse proxy routes requests
// with `?XTransformPort=<port>` to the corresponding internal
// mini-service (presence 3003, chat 3004, ...). The browser
// talks to the public sandbox URL, so a RELATIVE socket URL
// like `/?XTransformPort=3004` is the only thing that works.
//
// In a local dev environment (VSCode, laptop, on-prem), there
// is no Caddy. The browser hits http://localhost:3000 directly
// and the mini-services listen on their own ports (3003/3004).
// The socket must therefore connect DIRECTLY to
// `http://localhost:<port>` (cross-origin, but socket.io handles
// CORS automatically when no origin restriction is set on the
// server).
//
// Detection: if the browser's current hostname is `localhost`
// or `127.0.0.1`, we are in local mode. Otherwise we are behind
// the sandbox gateway. This is reliable because:
//  - VSCode users open http://localhost:3000 → hostname=localhost
//  - Sandbox preview is served from a public domain → hostname
//    is NOT localhost.
// ============================================================

export type SocketMode = 'sandbox' | 'local'

export function getSocketMode(): SocketMode {
  if (typeof window === 'undefined') return 'sandbox'
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
    return 'local'
  }
  return 'sandbox'
}

/**
 * Build the socket.io connection URL for a given mini-service port.
 *
 * - `sandbox` mode → `/?XTransformPort=<port>` (relative, routed by Caddy)
 * - `local` mode   → `http://localhost:<port>` (direct cross-origin)
 */
export function getSocketUrl(port: number): string {
  const mode = getSocketMode()
  if (mode === 'local') {
    return `http://localhost:${port}`
  }
  return `/?XTransformPort=${port}`
}

/**
 * Whether real-time socket features are available at all.
 * In local mode this is only true when the mini-service is actually
 * running on its port — but we can't know that from here without a
 * connection attempt, so this returns true optimistically. The UI
 * should use the hook's `connected` flag for the real status.
 */
export function isRealtimeSupported(): boolean {
  return true
}
