// ============================================================
// Client-side fetch utilities for institution-aware API calls
// All API calls should use these helpers to ensure the correct
// institution context is sent with every request.
// ============================================================

import { useAppStore } from './store'

/**
 * Get auth headers for API requests.
 * Uses the current user from the Zustand store to build headers.
 * These headers are read by the API routes via getInstitutionId().
 */
export function getAuthHeaders(): Record<string, string> {
  const currentUser = useAppStore.getState().currentUser
  return {
    'x-user-id': currentUser?.id || '',
    'x-institution-id': currentUser?.institutionId || '',
    'x-user-role': currentUser?.role || '',
  }
}

/**
 * Fetch wrapper that automatically includes institution auth headers.
 * Use this for ALL API calls to ensure correct institution filtering.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...(options?.headers || {}),
  }
  return fetch(url, { ...options, headers })
}
