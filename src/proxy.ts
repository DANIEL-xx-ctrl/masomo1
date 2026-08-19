import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Proxy (formerly "middleware" in Next.js ≤15) — adds `Cache-Control:
 * no-store` to ALL /api/* responses.
 *
 * This is the SERVER-SIDE belt-and-suspenders companion to the CLIENT-SIDE
 * fix in src/components/fetch-interceptor.tsx (which adds `cache: 'no-store'`
 * to every fetch call). Together they guarantee that NO layer of the browser
 * HTTP cache ever serves a stale user-specific API response to a different
 * user after a logout/login cycle.
 *
 * Why both? The fetch-interceptor covers all client-side fetch() calls, but:
 *   - A direct browser navigation to an /api/* URL bypasses the interceptor.
 *   - Server-side fetches (SSR / RSC) don't go through the client interceptor.
 *   - Some browsers (desktop Chrome in particular) have aggressive HTTP cache
 *     heuristics that can revalidate even `cache: 'no-store'` responses in
 *     edge cases; an explicit `Cache-Control: no-store` response header from
 *     the server is the authoritative signal.
 *
 * This proxy is the authoritative server-side guarantee.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
