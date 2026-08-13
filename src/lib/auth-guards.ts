import { NextResponse } from 'next/server'

/**
 * Guard helper that allows only `admin` or `super_admin` users.
 *
 * The role is read from the `x-user-role` request header (sent by the client
 * via the Zustand store / FetchInterceptor, and by the Super Admin module
 * via `saHeaders()`).
 *
 * Usage in a route handler:
 * ```ts
 * const forbidden = checkAdminOrSuperAdmin(request)
 * if (forbidden) return forbidden
 * ```
 *
 * Returns a 403 NextResponse when access is denied, or `null` when allowed.
 */
export function checkAdminOrSuperAdmin(request: Request): NextResponse | null {
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return NextResponse.json(
      { error: 'Accès non autorisé. Seul un administrateur ou super admin peut effectuer cette action.' },
      { status: 403 }
    )
  }
  return null
}
