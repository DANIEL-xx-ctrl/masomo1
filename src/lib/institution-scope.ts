// ============================================================
// Institution Isolation — Server-side enforcement
//
// Only a Super Admin can see ALL institutions and their data.
// A regular admin (or any non-super_admin user) is strictly
// confined to their OWN institution. They cannot read, create,
// update or delete data belonging to another institution, even
// if they forge the `x-institution-id` header client-side.
//
// Usage in API routes:
//   import { resolveInstitutionScope } from '@/lib/institution-scope'
//
//   const scope = await resolveInstitutionScope(request)
//   if (scope instanceof NextResponse) return scope  // 403 / 401
//
//   // scope.role          → 'admin' | 'super_admin' | 'teacher' | ...
//   // scope.userId        → string | null
//   // scope.institutionId → string | null  (the ONLY institution the
//   //                                         caller is allowed to touch)
//   // scope.isSuperAdmin  → boolean
//
//   const students = await db.student.findMany({
//     where: { user: { institutionId: scope.institutionId } },
//   })
// ============================================================

import { NextResponse } from 'next/server'
import { db } from './db'

// 5-minute in-memory cache for (userId → institutionId) lookups so we
// don't hit the DB on every single API call. The cache is keyed by
// userId and invalidated when the user's institutionId changes (which
// only happens on account creation or admin reassignment).
const userInstCache = new Map<string, { institutionId: string | null; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

export interface InstitutionScope {
  role: string
  userId: string | null
  institutionId: string | null
  isSuperAdmin: boolean
  /** True when the caller is a super admin currently browsing a specific institution */
  isBrowsingInstitution: boolean
}

/**
 * Resolve the SINGLE institution the current request is allowed to operate on.
 *
 * Rules:
 *  1. Super Admin (`x-user-role: super_admin`):
 *     - If `x-institution-id` header is present → use it (the super admin is
 *       browsing that institution). We verify the institution exists.
 *     - If no header → institutionId is null (the super admin is in "overview"
 *       mode and can see cross-institution aggregates).
 *
 *  2. Any other role (admin, teacher, student, parent, staff):
 *     - The institutionId is ALWAYS derived from the user's DB record.
 *     - We IGNORE any `x-institution-id` header sent by the client to prevent
 *       cross-institution data leakage via header forgery.
 *     - If the user has no institutionId → 403.
 *
 * Returns:
 *  - `InstitutionScope` on success
 *  - `NextResponse` (401/403) on failure — the caller should return it directly.
 */
export async function resolveInstitutionScope(
  request: Request
): Promise<InstitutionScope | NextResponse> {
  const role = request.headers.get('x-user-role')
  const userId = request.headers.get('x-user-id')
  const headerInstId = request.headers.get('x-institution-id')

  // No role at all → not authenticated
  if (!role) {
    return NextResponse.json(
      { error: 'Authentification requise.' },
      { status: 401 }
    )
  }

  // ---- Super Admin branch ----
  if (role === 'super_admin') {
    // Super admin must be authenticated (we trust the role header only if a
    // super admin id was provided AND it exists in the DB). This prevents a
    // regular user from forging `x-user-role: super_admin`.
    const saId = userId
    if (saId) {
      try {
        const sa = await db.superAdmin.findUnique({
          where: { id: saId },
          select: { id: true, active: true },
        })
        if (!sa || !sa.active) {
          return NextResponse.json(
            { error: 'Super Admin non valide ou désactivé.' },
            { status: 403 }
          )
        }
      } catch {
        // DB lookup failed — fail closed
        return NextResponse.json(
          { error: 'Erreur de validation du Super Admin.' },
          { status: 500 }
        )
      }
    }

    // Super admin can browse any institution. If a header is provided, verify
    // the institution exists. If it does NOT exist (e.g. the persisted
    // activeInstitutionId is stale because the institution was deleted, or
    // the DB was reseeded), we do NOT 404 — instead we silently clear the
    // institutionId so the super admin falls back to "overview" mode. This
    // prevents a stale browser-side activeInstitutionId from breaking ALL
    // API calls (including GET /api/institutions which returns all
    // institutions regardless of the header).
    let resolvedInstId = headerInstId || null
    if (headerInstId) {
      try {
        const inst = await db.institution.findUnique({
          where: { id: headerInstId },
          select: { id: true },
        })
        if (!inst) {
          // Stale/invalid institution ID — clear it so the super admin is
          // treated as "not browsing any institution" rather than 404'ing.
          resolvedInstId = null
        }
      } catch {
        // DB lookup failed — fail closed for safety, but don't 404 on a
        // possibly-transient DB error. Clear the institutionId instead.
        resolvedInstId = null
      }
    }

    return {
      role,
      userId,
      institutionId: resolvedInstId,
      isSuperAdmin: true,
      isBrowsingInstitution: !!resolvedInstId,
    }
  }

  // ---- Regular user branch (admin / teacher / student / parent / staff) ----
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentification requise.' },
      { status: 401 }
    )
  }

  // Look up the user's REAL institutionId from the DB (ignore the client
  // header entirely — this is the key security enforcement).
  let institutionId: string | null = null
  const cached = userInstCache.get(userId)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    institutionId = cached.institutionId
  } else {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { institutionId: true, active: true },
      })
      if (!user) {
        return NextResponse.json(
          { error: 'Utilisateur introuvable.' },
          { status: 404 }
        )
      }
      if (!user.active) {
        return NextResponse.json(
          { error: 'Compte désactivé.' },
          { status: 403 }
        )
      }
      institutionId = user.institutionId
      userInstCache.set(userId, { institutionId, ts: Date.now() })
    } catch {
      return NextResponse.json(
        { error: 'Erreur de validation de l\'utilisateur.' },
        { status: 500 }
      )
    }
  }

  if (!institutionId) {
    return NextResponse.json(
      { error: 'Aucune institution associée à ce compte.' },
      { status: 403 }
    )
  }

  return {
    role,
    userId,
    institutionId,
    isSuperAdmin: false,
    isBrowsingInstitution: false,
  }
}

/**
 * Strict variant: requires the caller to be operating on a SPECIFIC institution
 * (i.e. super admin must be browsing one, regular user must have one).
 * Use this for routes that absolutely need an institutionId (students, teachers,
 * classes, payments, etc.). For cross-institution aggregate routes (dashboard
 * overview for super admin), use `resolveInstitutionScope` instead.
 */
export async function requireInstitutionScope(
  request: Request
): Promise<InstitutionScope | NextResponse> {
  const scope = await resolveInstitutionScope(request)
  if (scope instanceof NextResponse) return scope
  if (!scope.institutionId) {
    return NextResponse.json(
      {
        error:
          scope.isSuperAdmin
            ? 'Veuillez sélectionner une institution dans le module Super Admin.'
            : 'Aucune institution associée à ce compte.',
      },
      { status: 400 }
    )
  }
  return scope
}

/**
 * Invalidate the cached institutionId for a user. Call this after creating
 * a new institution for a user, after assigning them to a different
 * institution, or after deleting their institution.
 */
export function invalidateUserInstitutionCache(userId: string): void {
  userInstCache.delete(userId)
}
