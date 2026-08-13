'use client'

import { useEffect } from 'react'

/**
 * Global avatar-change refresh hook.
 *
 * Whenever an avatar is updated anywhere in the app (Settings page, a student's
 * edit dialog, a teacher's profile, etc.), the updating code should call
 * `notifyAvatarChanged()`. This hook, mounted once in AppShell, listens for
 * that notification and refreshes the current user's profile from the API so
 * that the header / sidebar avatar updates immediately.
 *
 * List modules (students, teachers, parents, staff) that display avatars in a
 * grid or list should ALSO listen to the event and re-fetch their data, so
 * that an avatar change made in one place (e.g. the student detail dialog)
 * instantly reflects in the parent list.
 *
 * The mechanism is intentionally a simple CustomEvent on `window` so it works
 * across all components without prop drilling or a global state store.
 */

export const AVATAR_CHANGED_EVENT = 'masomo:avatar-changed'

export interface AvatarChangedDetail {
  /** The id of the user whose avatar changed (null for "current user"). */
  userId?: string
  /** The role of the user whose avatar changed, when known. */
  role?: string
}

export function notifyAvatarChanged(detail?: AvatarChangedDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AVATAR_CHANGED_EVENT, { detail: detail ?? {} }))
}

/**
 * Subscribe to avatar-changed events. The callback is invoked on every event.
 * Returns a cleanup function.
 */
export function onAvatarChanged(cb: (detail: AvatarChangedDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<AvatarChangedDetail>).detail || {}
    cb(detail)
  }
  window.addEventListener(AVATAR_CHANGED_EVENT, handler)
  return () => window.removeEventListener(AVATAR_CHANGED_EVENT, handler)
}

/**
 * React hook variant — re-runs the effect when `deps` change.
 */
export function useAvatarChangedListener(
  cb: (detail: AvatarChangedDetail) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    return onAvatarChanged(cb)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
