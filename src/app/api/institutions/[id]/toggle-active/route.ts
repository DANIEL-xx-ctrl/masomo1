import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// PATCH /api/institutions/[id]/toggle-active
//
// Super Admin ONLY. Toggles the `active` flag of an institution.
//  - When deactivating: also deactivates all the institution's users
//    and ends their active sessions (so they can't keep using the app
//    even if they're already logged in).
//  - When reactivating: re-enables the institution but does NOT
//    automatically reactivate individual users — the super admin must
//    explicitly re-enable users from the Super Admin module (this
//    prevents accidentally re-granting access to accounts that were
//    individually disabled for cause).
//
// Body:
//   { active: boolean }   // true = reactivate, false = block/deactivate
// ============================================================

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // ---- Role guard: Super Admin only ----
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'super_admin') {
    return NextResponse.json(
      { error: 'Seul un Super Admin peut bloquer ou réactiver une institution.' },
      { status: 403 }
    )
  }

  // ---- Validate super admin exists in DB (prevent role-header forgery) ----
  const saId = request.headers.get('x-user-id')
  if (saId) {
    try {
      const sa = await db.superAdmin.findUnique({
        where: { id: saId },
        select: { id: true, active: true },
      })
      if (!sa || !sa.active) {
        return NextResponse.json(
          { error: 'Super Admin non valide ou désactivé.' },
          { status: 403 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Erreur de validation du Super Admin.' },
        { status: 500 }
      )
    }
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json(
      { error: 'ID institution requis.' },
      { status: 400 }
    )
  }

  // ---- Parse body ----
  let active: boolean
  try {
    const body = await request.json()
    active = !!body.active
  } catch {
    return NextResponse.json(
      { error: ' Corps de requête invalide (attendu: { active: boolean }).' },
      { status: 400 }
    )
  }

  // ---- Find the institution ----
  const existing = await db.institution.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
      users: { select: { id: true }, take: 1000 },
    },
  })
  if (!existing) {
    return NextResponse.json(
      { error: 'Institution introuvable.' },
      { status: 404 }
    )
  }

  // ---- No-op guard ----
  if (existing.active === active) {
    return NextResponse.json({
      message: active
        ? 'L\'institution est déjà active.'
        : 'L\'institution est déjà désactivée.',
      institution: { id: existing.id, name: existing.name, active: existing.active },
    })
  }

  // ---- Safety: don't allow deactivating the LAST active institution ----
  if (!active) {
    const activeCount = await db.institution.count({ where: { active: true } })
    if (activeCount <= 1) {
      return NextResponse.json(
        {
          error:
            'Impossible de désactiver la dernière institution active. ' +
            'Il doit toujours y avoir au moins une institution active.',
        },
        { status: 400 }
      )
    }
  }

  // ---- Perform the toggle ----
  const userIds = existing.users.map((u) => u.id)

  if (active) {
    // ---- Reactivate institution ONLY (users stay as-is) ----
    // The super admin must explicitly re-enable individual users from the
    // Super Admin module after reactivating the institution. This is
    // intentional: blocking an institution is a severe action, and
    // re-enabling everything in one click could re-grant access to
    // accounts that were individually disabled for cause.
    await db.institution.update({
      where: { id },
      data: { active: true },
    })
    return NextResponse.json({
      message:
        `Institution « ${existing.name} » réactivée. ` +
        `${userIds.length} utilisateur(s) restent désactivé(s) — réactivez-les ` +
        `individuellement depuis le module Super Admin si nécessaire.`,
      institution: { id: existing.id, name: existing.name, active: true },
      affectedUsers: 0,
    })
  } else {
    // ---- Deactivate institution + all its users + end active sessions ----
    await db.$transaction([
      db.institution.update({
        where: { id },
        data: { active: false },
      }),
      db.user.updateMany({
        where: { institutionId: id },
        data: { active: false },
      }),
    ])
    // End active sessions OUTSIDE the transaction (updateMany on UserSession
    // doesn't need to be atomic with the above).
    if (userIds.length > 0) {
      await db.userSession.updateMany({
        where: { userId: { in: userIds }, isActive: true },
        data: { isActive: false },
      })
    }
    return NextResponse.json({
      message:
        `Institution « ${existing.name} » bloquée. ` +
        `${userIds.length} utilisateur(s) désactivé(s) et session(s) clôturée(s).`,
      institution: { id: existing.id, name: existing.name, active: false },
      affectedUsers: userIds.length,
    })
  }
}
