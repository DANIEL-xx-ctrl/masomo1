'use client';

import { useEffect, useRef } from 'react';
import { toast as sonnerToast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type { ToastType } from '@/lib/types';

/**
 * Bridge component that renders Zustand-store toasts via the Sonner
 * toaster (already mounted in the root layout).
 *
 * All modules call `addToast(...)` from the Zustand store, but the
 * store only holds the toast data — it never displays anything.
 * This component watches the store and forwards each new toast to
 * Sonner so the user actually sees the feedback.
 */
export function ToastBridge() {
  const toasts = useAppStore((s) => s.toasts);
  const shownIds = useRef(new Set<string>());

  useEffect(() => {
    for (const t of toasts) {
      if (shownIds.current.has(t.id)) continue;
      shownIds.current.add(t.id);

      const type: ToastType = t.type || 'info';
      const fn =
        type === 'success'
          ? sonnerToast.success
          : type === 'error'
            ? sonnerToast.error
            : type === 'warning'
              ? sonnerToast.warning
              : sonnerToast.info;

      fn(t.title, {
        description: t.description,
        duration: t.duration ?? 5000,
      });
    }
    // Prune shown IDs that are no longer in the store to avoid
    // unbounded growth of the Set over long sessions.
    const currentIds = new Set(toasts.map((t) => t.id));
    for (const id of Array.from(shownIds.current)) {
      if (!currentIds.has(id)) shownIds.current.delete(id);
    }
  }, [toasts]);

  return null;
}
