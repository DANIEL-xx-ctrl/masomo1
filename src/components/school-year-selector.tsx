'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAppStore } from '@/lib/store'

// Fallback list used if the /api/school-years endpoint is unreachable.
const FALLBACK_YEARS = ['2023-2024', '2024-2025', '2025-2026']

/**
 * Compact school-year selector displayed in the app shell header.
 *
 * On mount, fetches the list of available school years from
 * `GET /api/school-years` and populates the store. The current value
 * is bound to the global `schoolYear` slice, so changing it immediately
 * propagates to every module that consumes the store.
 *
 * The selector is a Popover with:
 *   - A list of existing school years (click to select)
 *   - A free-text input where the user can type a custom year
 *     (e.g. "2026-2027") and press Enter to apply it
 */
export function SchoolYearSelector() {
  const schoolYear = useAppStore((s) => s.schoolYear)
  const setSchoolYear = useAppStore((s) => s.setSchoolYear)
  const availableSchoolYears = useAppStore((s) => s.availableSchoolYears)
  const setAvailableSchoolYears = useAppStore((s) => s.setAvailableSchoolYears)
  const addToast = useAppStore((s) => s.addToast)
  const currentUser = useAppStore((s) => s.currentUser)

  // Avoid refetching on every render — only fetch once per user session.
  const didFetchRef = useRef(false)

  // Local state for the popover + custom year input
  const [open, setOpen] = useState(false)
  const [customYear, setCustomYear] = useState('')

  useEffect(() => {
    if (didFetchRef.current) return
    didFetchRef.current = true

    let cancelled = false
    async function loadYears() {
      try {
        const res = await fetch('/api/school-years', {
          headers: {
            'x-user-id': currentUser?.id || '',
            'x-institution-id': currentUser?.institutionId || '',
            'x-user-role': currentUser?.role || '',
          },
        })
        if (!res.ok) throw new Error('school-years fetch failed')
        const data = await res.json()
        // API may return either an array directly or { schoolYears: [...] }
        const list: Array<{ label?: string } | string> =
          data?.schoolYears || data?.years || (Array.isArray(data) ? data : [])
        const labels = list
          .map((y) => (typeof y === 'string' ? y : y?.label))
          .filter((l): l is string => Boolean(l))
        if (cancelled) return

        // CRITICAL: MERGE the API years with the already-persisted years
        // instead of replacing them. When the user adds a custom year (e.g.
        // "2026-2027") that doesn't exist in the API yet, that year is
        // stored in `availableSchoolYears` via Zustand persist. If we replace
        // the list here, the custom year is lost on reload.
        const persisted = useAppStore.getState().availableSchoolYears
        const merged = Array.from(new Set([...persisted, ...labels])).sort()
        if (merged.length > 0) {
          setAvailableSchoolYears(merged)
        } else {
          setAvailableSchoolYears(FALLBACK_YEARS)
        }
      } catch {
        if (cancelled) return
        // On error, keep the persisted years — don't overwrite with fallback.
        const persisted = useAppStore.getState().availableSchoolYears
        if (persisted.length > 0) {
          // Keep persisted years as-is
        } else {
          setAvailableSchoolYears(FALLBACK_YEARS)
        }
      }
    }
    loadYears()
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.institutionId, currentUser?.role, setAvailableSchoolYears])

  const handleChange = (value: string) => {
    setSchoolYear(value)
    addToast('success', 'Année scolaire', `Basculé sur ${value}`)
    setOpen(false)
    setCustomYear('')
  }

  // Apply a custom year typed by the user (e.g. "2026-2027").
  // Validates the format: must match YYYY-YYYY (4 digits - 4 digits).
  const handleApplyCustomYear = () => {
    const trimmed = customYear.trim()
    // Accept formats: "2025-2026", "2025/2026", or just "2025-2026"
    const normalized = trimmed.replace('/', '-')
    if (!/^\d{4}-\d{4}$/.test(normalized)) {
      addToast('error', 'Format invalide', 'Utilisez le format AAAA-AAAA (ex: 2026-2027)')
      return
    }
    // Add the custom year to the available list if it's not already there
    if (!availableSchoolYears.includes(normalized)) {
      setAvailableSchoolYears([...availableSchoolYears, normalized].sort())
    }
    handleChange(normalized)
  }

  // Always render the selector (even with a single year) so the active
  // year is visible to the user.
  const options =
    availableSchoolYears.length > 0 ? availableSchoolYears : [schoolYear]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[124px] sm:w-[150px] h-9 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary shrink-0 justify-between"
          aria-label="Année scolaire"
        >
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate text-sm font-medium">{schoolYear}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[200px] p-2"
      >
        {/* Existing school years list */}
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {options.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => handleChange(y)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                y === schoolYear
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="my-2 border-t" />

        {/* Custom year input */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Nouvelle année scolaire
          </p>
          <div className="flex gap-1">
            <Input
              type="text"
              value={customYear}
              onChange={(e) => setCustomYear(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customYear.trim()) {
                  e.preventDefault()
                  handleApplyCustomYear()
                }
              }}
              placeholder="2026-2027"
              className="h-8 text-sm font-mono"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              onClick={handleApplyCustomYear}
              disabled={!customYear.trim()}
              className="h-8 px-2 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
