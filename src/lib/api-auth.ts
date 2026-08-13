// ============================================================
// API Route Protection - Role-Based Access Control
// Since the app uses client-side auth (Zustand store), we protect
// API routes by reading the user role from the x-user-role header
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'

// Role hierarchy for write operations per resource
const WRITE_ACCESS: Record<string, string[]> = {
  students: ['admin'],
  teachers: ['admin'],
  classes: ['admin'],
  schedules: ['admin', 'teacher'],
  grades: ['admin', 'teacher'],
  bulletins: ['admin', 'teacher'],
  payments: ['admin'],
  announcements: ['admin', 'teacher'],
  messages: ['admin', 'teacher', 'student', 'parent'],
  subjects: ['admin'],
  attendance: ['admin', 'teacher'],
  seed: ['admin'],
  staff: ['admin'],
  parents: ['admin'],
  homework: ['admin', 'teacher'],
  events: ['admin'],
  notifications: ['admin', 'teacher', 'student', 'parent'],
}

/**
 * Get user role from the request header (client sends it via x-user-role)
 */
function getRoleFromRequest(request: NextRequest | Request): string | null {
  const header = request.headers.get('x-user-role')
  return header || null
}

/**
 * Check if a role can perform an HTTP method on a resource
 * - GET requests are always allowed (view data)
 * - Super Admin (`super_admin`) is ALWAYS allowed to create, modify and delete
 *   on ANY resource (full power across all institutions).
 * - Write operations require the role to be in the WRITE_ACCESS list
 */
export function canAccess(role: string | null, resource: string, method: string): boolean {
  // GET requests are always allowed (view data)
  if (method === 'GET') return true

  // No role = no write access
  if (!role) return false

  // Super Admin has full CRUD power on every resource / page
  if (role === 'super_admin') return true

  // Check write access
  const allowedRoles = WRITE_ACCESS[resource]
  if (!allowedRoles) return role === 'admin' // Default: only admin

  return allowedRoles.includes(role)
}

/**
 * Middleware helper for API routes.
 * Returns a 403 NextResponse if access is denied, or null if access is allowed.
 *
 * Usage in route handlers:
 * ```ts
 * const accessError = checkApiAccess(request, 'students')
 * if (accessError) return accessError
 * ```
 */
export function checkApiAccess(request: NextRequest | Request, resource: string): NextResponse | null {
  const role = getRoleFromRequest(request)
  const method = request.method

  if (!canAccess(role, resource, method)) {
    return NextResponse.json(
      { error: 'Accès non autorisé. Vous n\'avez pas les permissions nécessaires.' },
      { status: 403 }
    )
  }

  return null // No error, proceed
}

// ============ Multi-Institution Support ============

// Simple in-memory cache for institutionId lookups
const institutionIdCache = new Map<string, { institutionId: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get institutionId from the request.
 * First checks the x-institution-id header (sent by client).
 * Falls back to looking up the user's institutionId from x-user-id.
 *
 * Usage in route handlers:
 * ```ts
 * const institutionId = await getInstitutionId(request)
 * if (!institutionId) {
 *   return NextResponse.json({ error: 'Institution non trouvée' }, { status: 400 })
 * }
 * // Then use in Prisma queries:
 * // db.user.findMany({ where: { institutionId } })
 * ```
 */
export async function getInstitutionId(request: NextRequest | Request): Promise<string | null> {
  // First try: x-institution-id header (fastest, no DB query)
  const headerInstId = request.headers.get('x-institution-id')
  if (headerInstId) return headerInstId

  // Second try: look up user's institutionId from x-user-id
  const userId = request.headers.get('x-user-id')
  if (!userId) return null

  // Check cache
  const cached = institutionIdCache.get(userId)
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.institutionId
  }

  // Look up user in DB
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { institutionId: true },
    })
    if (user?.institutionId) {
      institutionIdCache.set(userId, { institutionId: user.institutionId, timestamp: Date.now() })
      return user.institutionId
    }
  } catch {
    // User not found or DB error
  }

  return null
}

/**
 * Convenience helper: get institutionId from request, with fallback to
 * looking up any institution if no user context is available.
 * Returns the first active institution's ID if no specific one is found.
 */
export async function getInstitutionIdWithFallback(request: NextRequest | Request): Promise<string> {
  const instId = await getInstitutionId(request)
  if (instId) return instId

  // Fallback: find any active institution
  const institution = await db.institution.findFirst({ where: { active: true } })
  return institution?.id || 'inst_default'
}
