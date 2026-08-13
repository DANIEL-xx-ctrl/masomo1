// ============================================================
// MASOMO — Floating offline indicator + pending-queue badge
// ------------------------------------------------------------
// Renders a small pill at the bottom-left of the viewport that shows:
//   - an amber "Hors ligne — X en attente" badge (when offline)
//   - a blue "Synchronisation... (X)" badge (when flushing)
//   - hidden when online + queue empty
//
// Clicking the badge when there are pending items forces a flush.
// ============================================================

'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, RefreshCw, CloudUpload } from 'lucide-react'
import { useOfflineStatus } from '@/hooks/use-offline'
import { flushQueue } from '@/lib/offline-queue'

export function OfflineBadge() {
  const { isOnline, pendingCount } = useOfflineStatus()
  const [flushing, setFlushing] = useState(false)

  // Auto-flush when coming back online. We defer the setState to a microtask
  // to avoid the "setState synchronously within an effect" lint warning.
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !flushing) {
      const handle = setTimeout(() => {
        setFlushing(true)
        flushQueue()
          .catch(() => {})
          .finally(() => setFlushing(false))
      }, 0)
      return () => clearTimeout(handle)
    }
  }, [isOnline, pendingCount, flushing])

  // Hidden when: online + no pending + not flushing (nothing to show)
  const visible = !isOnline || pendingCount > 0 || flushing

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-4 left-4 z-40 print:hidden"
        >
          <button
            type="button"
            onClick={() => {
              if (pendingCount > 0 && !flushing) {
                setFlushing(true)
                flushQueue()
                  .catch(() => {})
                  .finally(() => setFlushing(false))
              }
            }}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium
              shadow-lg border backdrop-blur-md transition-colors
              ${
                !isOnline
                  ? 'bg-amber-500/90 text-white border-amber-400 hover:bg-amber-500'
                  : flushing
                    ? 'bg-blue-500/90 text-white border-blue-400'
                    : 'bg-emerald-500/90 text-white border-emerald-400 hover:bg-emerald-500'
              }
            `}
            title={
              !isOnline
                ? `${pendingCount} enregistrement(s) en attente de synchronisation`
                : flushing
                  ? 'Synchronisation en cours...'
                  : 'En ligne'
            }
          >
            {!isOnline ? (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Hors ligne{pendingCount > 0 ? ` · ${pendingCount} en attente` : ''}</span>
              </>
            ) : flushing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Synchronisation{pendingCount > 0 ? ` · ${pendingCount}` : '...'}</span>
              </>
            ) : (
              <>
                <CloudUpload className="h-3.5 w-3.5" />
                <span>{pendingCount} en attente — cliquez pour synchroniser</span>
              </>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
