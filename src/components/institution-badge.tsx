'use client'

import { motion } from 'framer-motion'
import { School, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/lib/store'

/**
 * Petit badge animé affichant le nom de l'institution connectée.
 *
 * - Pour le Super Admin : affiche le nom de l'institution actuellement sélectionnée
 *   (via activeInstitutionName), ou "Vue globale" si aucune n'est sélectionnée.
 * - Pour les autres rôles : affiche le nom de l'institution de l'utilisateur
 *   (via currentUser.institutionName).
 *
 * Le badge apparaît avec une animation douce (fade + slide + pulse subtil)
 * et est conçu pour s'afficher en petit format dans l'en-tête de l'application.
 */
export function InstitutionBadge() {
  const currentUser = useAppStore((s) => s.currentUser)
  const activeInstitutionName = useAppStore((s) => s.activeInstitutionName)

  const isSuperAdmin = currentUser?.role === 'super_admin'

  // Détermine le nom à afficher
  const institutionName = isSuperAdmin
    ? (activeInstitutionName || 'Vue globale')
    : (currentUser?.institutionName || null)

  // Si aucune information d'institution n'est disponible, on n'affiche rien
  if (!institutionName) return null

  return (
    <motion.div
      key={institutionName} // re-déclenche l'animation quand le nom change
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
        max-w-[140px] lg:max-w-[220px] xl:max-w-[280px]
        shrink-0
      "
      title={`Institution connectée : ${institutionName}`}
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
        {institutionName}
      </span>
    </motion.div>
  )
}
