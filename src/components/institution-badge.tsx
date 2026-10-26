'use client'

import { motion } from 'framer-motion'
import { School, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { getInstitutionTypeLabel } from '@/lib/constants'

/**
 * Petit badge animé affichant le TYPE de l'institution connectée
 * (École Primaire / École Secondaire / Université) à la place du nom.
 *
 * - Pour le Super Admin : affiche le type de l'institution actuellement sélectionnée
 *   (via activeInstitutionType), ou "Vue globale" si aucune n'est sélectionnée.
 * - Pour les autres rôles : affiche le type de l'institution de l'utilisateur
 *   (via currentUser.institutionType).
 *
 * Le badge apparaît avec une animation douce (fade + slide + pulse subtil)
 * et est conçu pour s'afficher en petit format dans l'en-tête de l'application.
 */

export function InstitutionBadge() {
  const currentUser = useAppStore((s) => s.currentUser)
  const activeInstitutionName = useAppStore((s) => s.activeInstitutionName)
  const activeInstitutionType = useAppStore((s) => s.activeInstitutionType)

  const isSuperAdmin = currentUser?.role === 'super_admin'

  // Détermine le type à afficher
  const institutionType = isSuperAdmin
    ? (activeInstitutionType || null)
    : (currentUser?.institutionType || null)

  // Le libellé affichable
  const label = isSuperAdmin
    ? (activeInstitutionName
        ? (getInstitutionTypeLabel(institutionType) || 'Institution')
        : 'Vue globale')
    : (getInstitutionTypeLabel(institutionType) || currentUser?.institutionName || null)

  // Si aucune information d'institution n'est disponible, on n'affiche rien
  if (!label) return null

  // Clé d'animation : change quand le label change pour re-déclencher l'animation
  const animKey = isSuperAdmin
    ? `${activeInstitutionName || 'global'}-${label}`
    : label

  return (
    <motion.div
      key={animKey}
      initial={{ opacity: 0, y: -6, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        ease: 'easeOut',
      }}
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
      title={isSuperAdmin && activeInstitutionName ? `${activeInstitutionName} — ${label}` : label}
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
        transition={{
          duration: 2.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <span className="truncate leading-tight">
        {label}
      </span>
    </motion.div>
  )
}

