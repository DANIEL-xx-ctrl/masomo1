// ============================================================================
// Bulletin Templates — Permissions
// ----------------------------------------------------------------------------
// Règle métier : SEUL le Super Administrateur peut uploader, modifier ou
// supprimer un modèle de bulletin. Les administrateurs d'établissement
// (role='admin') peuvent uniquement les visualiser, les prévisualiser
// et les exporter. Les autres rôles n'ont aucun accès.
// ============================================================================

export const BULLETIN_TEMPLATE_PERMISSIONS = {
  read:   ['super_admin', 'admin'],
  write:  ['super_admin'],
  delete: ['super_admin'],
} as const

/**
 * Retourne true si l'utilisateur peut gérer (uploader/modifier/supprimer)
 * les modèles de bulletins. Réservé au Super Administrateur.
 */
export function canManageBulletinTemplates(role?: string | null): boolean {
  return role === 'super_admin'
}

/**
 * Retourne true si l'utilisateur peut consulter les modèles de bulletins
 * (liste, aperçu, export). Super Admin + Admin.
 */
export function canViewBulletinTemplates(role?: string | null): boolean {
  return role === 'super_admin' || role === 'admin'
}
