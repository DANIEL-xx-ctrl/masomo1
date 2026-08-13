'use client'

import { useEffect, useRef } from 'react'
import { CalendarDays } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
        if (labels.length > 0) {
          setAvailableSchoolYears(labels)
        } else {
          setAvailableSchoolYears(FALLBACK_YEARS)
        }
      } catch {
        if (cancelled) return
        setAvailableSchoolYears(FALLBACK_YEARS)
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
  }

  // Always render the selector (even with a single year) so the active
  // year is visible to the user. Use the current schoolYear as fallback
  // if it isn't part of the available list.
  const options =
    availableSchoolYears.length > 0 ? availableSchoolYears : [schoolYear]
  const currentValue = options.includes(schoolYear)
    ? schoolYear
    : options[0]

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger
        className="w-[124px] sm:w-[150px] h-9 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary shrink-0"
        aria-label="Année scolaire"
      >
        <CalendarDays className="w-4 h-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((y) => (
          <SelectItem key={y} value={y}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
