import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  seedInstitutionData,
  wipeInstitutionData,
  generateDefaultInstitutionConfig,
  type SubjectRow,
} from '@/lib/seed-institution'
import { resolveInstitutionScope } from '@/lib/institution-scope'

export async function GET(request: Request) {
  try {
    // ---- Strict institution isolation ----
    // Use the server-side scope resolver so the admin's institutionId is
    // ALWAYS derived from their DB record — never from the forgeable
    // x-institution-id header. This closes the cross-institution read
    // vector where an admin could send another institution's ID in the
    // header and see its details (name, password, users, counts).
    const scope = await resolveInstitutionScope(request)
    if (scope instanceof NextResponse) return scope

    if (scope.isSuperAdmin) {
      // SuperAdmin sees ALL institutions with passwords
      const institutions = await db.institution.findMany({
        include: {
          users: {
            where: { role: 'admin' },
            select: { id: true, name: true, email: true, active: true },
          },
          _count: {
            select: { users: true, classes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(
        { institutions },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    // ---- Regular admin: sees ONLY their own institution ----
    // scope.institutionId is guaranteed to be their real institution (DB-derived).
    if (!scope.institutionId) {
      return NextResponse.json(
        { error: 'Aucune institution associée à ce compte.' },
        { status: 403 }
      )
    }

    const institution = await db.institution.findUnique({
      where: { id: scope.institutionId },
      include: {
        users: {
          where: { role: 'admin' },
          select: { id: true, name: true, email: true, active: true },
        },
        _count: {
          select: { users: true, classes: true },
        },
      },
    })

    if (!institution) {
      return NextResponse.json(
        { error: 'Institution non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { institutions: [institution] },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('Get institutions error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des institutions' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Seul un SuperAdmin peut créer une institution' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      password,
      address,
      phone,
      email,
      logo,
      currentYear,
      active,
      // Optional: admin credentials for the new institution
      adminName,
      adminEmail,
      adminPassword,
      // Optional: when true, auto-seed the new institution with demo data
      // (1 staff, 1 parent, 4 teachers, 3 classes, 12 students, 2 announcements,
      //  2 messages). When false, only an admin user is created (if adminEmail
      //  and adminPassword are provided) — or no admin at all (bare institution).
      autoSeed,
    } = body as {
      name?: string
      password?: string
      address?: string
      phone?: string
      email?: string
      logo?: string
      currentYear?: string
      active?: boolean
      adminName?: string
      adminEmail?: string
      adminPassword?: string
      autoSeed?: boolean
    }

    if (!name || !password) {
      return NextResponse.json(
        { error: 'Nom et mot de passe requis' },
        { status: 400 }
      )
    }

    const institution = await db.institution.create({
      data: {
        name,
        password,
        address,
        phone,
        email,
        logo,
        currentYear: currentYear || '2024-2025',
        active: active !== undefined ? active : true,
      },
    })

    // ---- Optional: seed the new institution with demo data ----
    let seeded = false
    let adminUser: { id: string; email: string; name: string } | null = null

    if (autoSeed === true) {
      // Fetch (or create) global subjects — same 6 defaults as /api/seed
      let subjects: SubjectRow[] = []
      const existingSubjects = await db.subject.findMany()
      if (existingSubjects.length > 0) {
        subjects = existingSubjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          coefficient: s.coefficient,
        }))
      } else {
        const subjectsData = [
          { name: 'Mathématiques', code: 'MATH', coefficient: 4 },
          { name: 'Français', code: 'FR', coefficient: 4 },
          { name: 'Anglais', code: 'ANG', coefficient: 3 },
          { name: 'Histoire-Géo', code: 'HG', coefficient: 3 },
          { name: 'SVT', code: 'SVT', coefficient: 3 },
          { name: 'Physique-Chimie', code: 'PC', coefficient: 3 },
        ]
        for (const s of subjectsData) {
          const created = await db.subject.create({ data: s })
          subjects.push({
            id: created.id,
            name: created.name,
            code: created.code,
            coefficient: created.coefficient,
          })
        }
      }

      // Generate a default demo config for this institution. The admin email
      // and password come from the request body if provided; otherwise
      // generateDefaultInstitutionConfig produces sensible defaults.
      const config = generateDefaultInstitutionConfig(
        {
          id: institution.id,
          name: institution.name,
          password: institution.password,
          address: institution.address,
          phone: institution.phone,
          email: institution.email,
          currentYear: institution.currentYear,
        },
        adminEmail,
        adminPassword
      )

      // If adminName was provided, override the generated admin name
      if (adminName) {
        config.admin.name = adminName
      }

      await seedInstitutionData(
        {
          id: institution.id,
          name: institution.name,
          password: institution.password,
          address: institution.address,
          phone: institution.phone,
          email: institution.email,
          currentYear: institution.currentYear,
        },
        config,
        subjects,
        new Date()
      )

      seeded = true
      adminUser = {
        id: '', // populated below by querying the freshly-seeded admin
        email: config.admin.email,
        name: config.admin.name,
      }
      const freshAdmin = await db.user.findFirst({
        where: { institutionId: institution.id, role: 'admin' },
        select: { id: true, email: true, name: true },
      })
      if (freshAdmin) {
        adminUser = freshAdmin
      }
    } else if (adminEmail && adminPassword) {
      // ---- Optional: create just a bare admin user (no demo data) ----
      const created = await db.user.create({
        data: {
          email: adminEmail,
          password: adminPassword,
          name: adminName || `Administrateur ${name}`,
          role: 'admin',
          institutionId: institution.id,
          userCode: `ADM-${institution.id.slice(-4).toUpperCase()}`,
          active: true,
        },
      })
      adminUser = {
        id: created.id,
        email: created.email,
        name: created.name,
      }
    }

    return NextResponse.json(
      { institution, admin: adminUser, seeded },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'institution' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Seul un SuperAdmin peut modifier une institution' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, password, address, phone, email, logo, currentYear, active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID institution requis' },
        { status: 400 }
      )
    }

    const existing = await db.institution.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Institution non trouvée' },
        { status: 404 }
      )
    }

    const institution = await db.institution.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(password !== undefined && { password }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(logo !== undefined && { logo }),
        ...(currentYear !== undefined && { currentYear }),
        ...(active !== undefined && { active }),
      },
    })

    // ---- CRITICAL: keep admin User.password in sync with Institution.password ----
    // The login page (/api/auth/login) authenticates against the User table,
    // NOT the Institution table. Institution.password is essentially a
    // "display password" shown in the Super Admin module — but users expect
    // that changing it from the Super Admin module lets the institution's
    // admin log in with the new password.
    //
    // Without this sync, the Super Admin "Modifier" / "Réinitialiser mot de
    // passe" actions update ONLY Institution.password, leaving User.password
    // unchanged — so the OLD password keeps working on the login page.
    //
    // We update the password of EVERY admin user attached to this institution
    // (there is normally exactly one, but we cover the multi-admin case too).
    let syncedAdminCount = 0
    if (password !== undefined && password !== existing.password) {
      const adminUpdate = await db.user.updateMany({
        where: { institutionId: id, role: 'admin' },
        data: { password },
      })
      syncedAdminCount = adminUpdate.count
    }

    return NextResponse.json({ institution, syncedAdminCount })
  } catch (error) {
    console.error('Update institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'institution' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    if (userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Seul un SuperAdmin peut supprimer une institution' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { id, mode } = body as { id?: string; mode?: 'permanent' | 'deactivate' }

    if (!id) {
      return NextResponse.json(
        { error: 'ID institution requis' },
        { status: 400 }
      )
    }

    const existing = await db.institution.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Institution non trouvée' },
        { status: 404 }
      )
    }

    // Don't allow deleting the last active institution
    const activeCount = await db.institution.count({ where: { active: true } })
    if (existing.active && activeCount <= 1) {
      return NextResponse.json(
        { error: 'Impossible de supprimer la dernière institution active.' },
        { status: 400 }
      )
    }

    // Get all user IDs in this institution (used by the soft-delete path to
    // end active sessions; the permanent path uses wipeInstitutionData).
    const usersInInst = await db.user.findMany({
      where: { institutionId: id },
      select: { id: true },
    })
    const userIds = usersInInst.map(u => u.id)

    const deleteMode = mode || 'deactivate'

    if (deleteMode === 'permanent') {
      // Permanent delete — remove institution and ALL its data.
      // Use the shared wipeInstitutionData() helper which deletes every
      // related table in FK-safe order (bulletin, attendance, message,
      // announcement, notification, homeworkSubmission, homework, payment,
      // grade, schedule, eventClass, schoolEvent, classTeacher, student,
      // teacher, parent, staff, class, schoolConfig, mediaFile, userSession,
      // user). The previous inline cascade was INCOMPLETE and missed Message,
      // Notification, Homework, HomeworkSubmission, Bulletin, Grade,
      // Attendance, Payment, Schedule, ClassTeacher, MediaFile and EventClass —
      // which caused a P2003 foreign-key violation on db.user.deleteMany().
      await wipeInstitutionData(id, { preserveAdminUser: false })

      // Finally delete the institution row itself
      await db.institution.delete({ where: { id } })

      return NextResponse.json({ message: 'Institution supprimée définitivement avec toutes ses données' })
    } else {
      // Soft delete — deactivate institution and its users
      await db.institution.update({
        where: { id },
        data: { active: false },
      })
      await db.user.updateMany({
        where: { institutionId: id },
        data: { active: false },
      })
      // End all active sessions for users in this institution
      if (userIds.length > 0) {
        await db.userSession.updateMany({
          where: { userId: { in: userIds }, isActive: true },
          data: { isActive: false },
        })
      }
      return NextResponse.json({
        message: 'Institution désactivée. Tous ses utilisateurs ont été désactivés.',
      })
    }
  } catch (error) {
    console.error('Delete institution error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'institution' },
      { status: 500 }
    )
  }
}
