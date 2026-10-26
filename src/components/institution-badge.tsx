'use client'

import { motion } from 'framer-motion'
import { School, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { getInstitutionTypeLabel } from '@/lib/constants'

/**
 * Petit badge animé affichant le NOM et le TYPE de l'institution connectée.
 *
 * - Pour le Super Admin : affiche le nom + le type de l'institution
 *   actuellement sélectionnée (via activeInstitutionName/Type), ou
 *   "Vue globale" si aucune n'est sélectionnée.
 * - Pour les autres rôles : affiche le nom + le type de l'institution
 *   de l'utilisateur (via currentUser.institutionName/Type).
 *
 * Composition visuelle :
 *   [icône] [pulse] [NOM institution] | [puce TYPE]
 *
 * Le badge apparaît avec une animation douce (fade + slide + pulse subtil)
 * et est conçu pour s'afficher en petit format dans l'en-tête de l'application.
 */
export function InstitutionBadge() {
  const currentUser = useAppStore((s) => s.currentUser)
  const activeInstitutionName = useAppStore((s) => s.activeInstitutionName)
  const activeInstitutionType = useAppStore((s) => s.activeInstitutionType)

  const isSuperAdmin = currentUser?.role === 'super_admin'

  // Détermine le nom + le type à afficher
  const institutionName = isSuperAdmin
    ? (activeInstitutionName || null)
    : (currentUser?.institutionName || null)

  const institutionType = isSuperAdmin
    ? (activeInstitutionType || null)
    : (currentUser?.institutionType || null)

  const typeLabel = getInstitutionTypeLabel(institutionType)

  // Cas spécial : super admin sans institution sélectionnée
  if (isSuperAdmin && !institutionName) {
    return (
      <motion.div
        key="vue-globale"
        initial={{ opacity: 0, y: -6, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="
          hidden md:inline-flex items-center gap-1.5
          px-2.5 py-1
          rounded-full
          bg-primary/5 border border-primary/15
          text-primary
          text-[11px] font-medium
          max-w-[180px] lg:max-w-[240px] xl:max-w-[300px]
          shrink-0
        "
        title="Vue globale — aucune institution sélectionnée"
      >
        <ShieldCheck className="w-3 h-3 shrink-0" />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="truncate leading-tight">Vue globale</span>
      </motion.div>
    )
  }

  // Si aucune information d'institution n'est disponible, on n'affiche rien
  if (!institutionName) return null

  // Clé d'animation : change quand le nom ou le type change
  const animKey = `${institutionName}-${typeLabel || 'notype'}`

  return (
    <motion.div
      key={animKey}
      initial={{ opacity: 0, y: -6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="
        hidden md:inline-flex items-center gap-1.5
        px-2.5 py-1
        rounded-full
        bg-primary/5 border border-primary/15
        text-primary
        text-[11px] font-medium
        max-w-[180px] lg:max-w-[260px] xl:max-w-[320px]
        shrink-0
      "
      title={`${institutionName}${typeLabel ? ` — ${typeLabel}` : ''}`}
    >
      {isSuperAdmin ? (
        <ShieldCheck className="w-3 h-3 shrink-0" />
      ) : (
        <School className="w-3 h-3 shrink-0" />
      )}

      {/* Pulse subtil sur le point indicateur */}
      <motion.span
        className="w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* NOM de l'institution (principal) */}
      <span className="truncate leading-tight">
        {institutionName}
      </span>

      {/* Puce TYPE (secondaire) — visible uniquement si on a un type connu */}
      {typeLabel && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
          {typeLabel}
        </span>
      )}
    </motion.div>
  )
}
