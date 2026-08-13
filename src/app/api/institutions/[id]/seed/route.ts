import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  wipeInstitutionData,
  seedInstitutionData,
  generateDefaultInstitutionConfig,
  type SubjectRow,
} from '@/lib/seed-institution'

// ============================================================================
// POST /api/institutions/[id]/seed
//
// Wipe ALL data belonging to ONE institution (preserving the admin user so
// they can still log in) and reseed it with fresh demo data. Does NOT touch
// any other institution's data.
//
// Auth:
//   - super_admin: always allowed (uses the [id] from the URL)
//   - admin: allowed only if their institutionId matches [id]
//
// Optional body:
//   - adminEmail?: string    — the admin's login email (defaults to a
//                              generated demo email in the institution's
//                              demo domain)
//   - adminPassword?: string — the admin's password (defaults to "admin123")
// ============================================================================

interface SeedRequestBody {
  adminEmail?: string
  adminPassword?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ---- Auth guard ----
    const userRole = request.headers.get('x-user-role')
    const userId = request.headers.get('x-user-id')
    const institutionId = (await params).id

    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Accès refusé. Seul un admin ou un super admin peut réinitialiser une institution.' },
        { status: 403 }
      )
    }

    if (userRole === 'admin') {
      if (!userId) {
        return NextResponse.json(
          { error: 'Utilisateur non identifié.' },
          { status: 403 }
        )
      }
      const user = await db.user.findUnique({ where: { id: userId } })
      if (!user || user.institutionId !== institutionId) {
        return NextResponse.json(
          { error: 'Vous ne pouvez réinitialiser que votre propre institution.' },
          { status: 403 }
        )
      }
    }

    // ---- Find the institution ----
    const institution = await db.institution.findUnique({
      where: { id: institutionId },
    })
    if (!institution) {
      return NextResponse.json(
        { error: 'Institution introuvable.' },
        { status: 404 }
      )
    }

    // ---- Parse optional body ----
    let body: SeedRequestBody = {}
    try {
      body = (await request.json()) as SeedRequestBody
    } catch {
      // Body is optional — empty body is fine
      body = {}
    }

    // ---- 1. Wipe this institution's data (preserve admin user) ----
    await wipeInstitutionData(institutionId, { preserveAdminUser: true })

    // ---- 2. Fetch (or create) global subjects ----
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
      // Bootstrap the 6 default subjects if none exist yet (matches /api/seed)
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

    // ---- 3. Generate a default config for this institution ----
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
      body.adminEmail,
      body.adminPassword
    )

    // ---- 4. Seed ----
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

    // ---- 5. Stats (for THIS institution only) ----
    const usersInInst = await db.user.findMany({
      where: { institutionId },
      select: { role: true },
    })
    const instStats = {
      students: await db.student.count({
        where: { user: { institutionId } },
      }),
      teachers: await db.teacher.count({
        where: { user: { institutionId } },
      }),
      parents: await db.parent.count({
        where: { user: { institutionId } },
      }),
      staff: await db.staff.count({
        where: { user: { institutionId } },
      }),
      classes: await db.class.count({ where: { institutionId } }),
      grades: await db.grade.count({
        where: { student: { user: { institutionId } } },
      }),
      schedules: await db.schedule.count({
        where: { class: { institutionId } },
      }),
      payments: await db.payment.count({
        where: { student: { user: { institutionId } } },
      }),
      attendance: await db.attendance.count({
        where: { student: { user: { institutionId } } },
      }),
      announcements: await db.announcement.count({
        where: { author: { institutionId } },
      }),
      messages: usersInInst.length,
      users: usersInInst.length,
    }

    return NextResponse.json({
      message: `Institution « ${institution.name} » réinitialisée avec de nouvelles données de démonstration.`,
      stats: instStats,
      adminEmail: body.adminEmail || config.admin.email,
    })
  } catch (error) {
    console.error('Reset institution error:', error)
    return NextResponse.json(
      {
        error: 'Erreur lors de la réinitialisation de l\'institution.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
