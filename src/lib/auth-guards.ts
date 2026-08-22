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

/**
 * Guard helper that allows `admin`, `super_admin`, AND `teacher` users.
 *
 * Teachers are allowed to manage students/grades/attendance/homework within
 * their own classes (the class ownership check is done separately using
 * `getTeacherClassIds` from `@/lib/teacher-classes`).
 *
 * Returns a 403 NextResponse when access is denied, or `null` when allowed.
 * Also returns the role and userId for convenience.
 */
export function checkAdminSuperAdminOrTeacher(request: Request): {
  forbidden: NextResponse | null
  role: string
  userId: string
} {
  const role = request.headers.get('x-user-role') || ''
  const userId = request.headers.get('x-user-id') || ''
  if (role !== 'admin' && role !== 'super_admin' && role !== 'teacher') {
    return {
      forbidden: NextResponse.json(
        { error: 'Accès non autorisé. Seul un administrateur, super admin ou enseignant peut effectuer cette action.' },
        { status: 403 }
      ),
      role,
      userId,
    }
  }
  return { forbidden: null, role, userId }
}
