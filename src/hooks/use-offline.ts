'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { getPendingQueue, type QueuedRequest } from '@/lib/offline-queue'

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot() {
  return navigator.onLine
}

function getServerSnapshot() {
  return true
}

export function useOfflineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [wasOffline, setWasOffline] = useState(false)
  const [prevOnline, setPrevOnline] = useState(true)
  const [pending, setPending] = useState<QueuedRequest[]>([])

  // Track transitions from offline to online
  if (!prevOnline && isOnline) {
    setPrevOnline(true)
    setWasOffline(true)
    setTimeout(() => setWasOffline(false), 5000)
  } else if (prevOnline && !isOnline) {
    setPrevOnline(false)
  }

  // Subscribe to the offline queue size (separate from online/offline events)
  useEffect(() => {
    let mounted = true
    const refresh = () => {
      getPendingQueue()
        .then((items) => {
          if (mounted) setPending(items)
        })
        .catch(() => {})
    }
    refresh()
    window.addEventListener('masomo:queue-changed', refresh)
    window.addEventListener('masomo:queue-flushed', refresh)
    return () => {
      mounted = false
      window.removeEventListener('masomo:queue-changed', refresh)
      window.removeEventListener('masomo:queue-flushed', refresh)
    }
  }, [isOnline])

  return { isOnline, wasOffline, pending, pendingCount: pending.length }
}
