import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a stored image URL to a proxy URL that works with the standalone server.
 * In dev mode, /uploads/* is served directly by Next.js.
 * In standalone production, /uploads/* is not served, so we proxy through /api/uploads/*.
 *
 * When `version` is provided (e.g. the user's `updatedAt` timestamp), a `?v=`
 * query parameter is appended so the browser fetches a FRESH copy of the image
 * whenever the avatar changes. Without this, the browser serves a stale cached
 * copy of the old avatar (same URL → same cached bytes) even after the user
 * uploaded a new one. This is what makes avatar changes propagate across ALL
 * pages of the application immediately.
 */
export function getImageUrl(
  url: string | null | undefined,
  version?: string | number | Date | null
): string | undefined {
  if (!url) return undefined
  let resolved = url
  // If already proxied or external, keep as-is for the path part
  if (!url.startsWith('/api/') && !url.startsWith('http') && !url.startsWith('data:')) {
    // Convert /uploads/... to /api/uploads/...
    if (url.startsWith('/uploads/')) resolved = url.replace('/uploads/', '/api/uploads/')
  }
  // Append a cache-busting `?v=` param when a version is available.
  // Skip for data: URLs (they're inline, never cached) and external http(s)
  // URLs whose server we don't control (caching is up to them).
  if (version && !resolved.startsWith('data:') && !resolved.startsWith('http')) {
    const v = typeof version === 'number'
      ? String(version)
      : version instanceof Date
        ? String(version.getTime())
        : String(version)
    const sep = resolved.includes('?') ? '&' : '?'
    resolved = `${resolved}${sep}v=${encodeURIComponent(v)}`
  }
  return resolved
}

/**
 * Convenience wrapper around getImageUrl for avatar URLs specifically.
 * Accepts the same (url, version) signature so callers can pass the user's
 * `updatedAt` directly. Returns undefined when the user has no avatar, so the
 * <Avatar> component falls back to initials automatically.
 */
export function avatarUrl(
  url: string | null | undefined,
  version?: string | number | Date | null
): string | undefined {
  return getImageUrl(url, version)
}

/**
 * Append a schoolYear query parameter to a base URL.
 * Uses '&' if the URL already contains a '?', otherwise uses '?'.
 * The schoolYear value is URL-encoded for safety.
 */
export function withSchoolYear(baseUrl: string, schoolYear: string | undefined | null): string {
  if (!schoolYear) return baseUrl
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}schoolYear=${encodeURIComponent(schoolYear)}`
}

/**
 * Append an institutionId query parameter to a base URL.
 * Used by Super Admin to scope list/dashboard endpoints to one institution.
 */
export function withInstitution(baseUrl: string, institutionId: string | undefined | null): string {
  if (!institutionId) return baseUrl
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}institutionId=${encodeURIComponent(institutionId)}`
}

/**
 * Append both schoolYear and institutionId query parameters to a base URL.
 */
export function withSchoolYearAndInstitution(
  baseUrl: string,
  schoolYear: string | undefined | null,
  institutionId: string | undefined | null
): string {
  let url = withSchoolYear(baseUrl, schoolYear)
  url = withInstitution(url, institutionId)
  return url
}
