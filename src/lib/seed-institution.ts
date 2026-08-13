import { db } from '@/lib/db'

// ============================================================================
// seed-institution.ts
//
// Shared module for per-institution data seeding and wiping.
//
// This module is the SINGLE source of truth for:
//   - The shape of an `InstitutionSeedConfig` (the demo data blueprint)
//   - `wipeInstitutionData()` — deletes ALL data belonging to ONE institution
//     (without deleting the Institution row itself; optionally preserves the
//      admin user so they can still log in after a reset)
//   - `seedInstitutionData()` — creates ALL per-institution demo data
//     (admin, staff, parent, teachers, classes, students, grades, schedules,
//      payments, attendance, announcements, messages) for an EXISTING
//      institution. Does NOT create the Institution row — the caller must
//      create it first (or pass an existing one).
//   - `generateDefaultInstitutionConfig()` — produces a generic
//     InstitutionSeedConfig for a newly created institution (1 admin, 1 staff,
//     1 parent, 4 teachers, 3 classes, ~12 students, 2 announcements, 2
//     messages) with institution-unique emails/userCodes.
//
// Used by:
//   - /api/seed/route.ts (global wipe + 3 hardcoded configs)
//   - /api/institutions/route.ts POST (autoSeed option for new institutions)
//   - /api/institutions/[id]/seed/route.ts POST (per-institution reseed)
//   - /api/institutions/[id]/data/route.ts DELETE (per-institution wipe)
// ============================================================================

// ----------------------------------------------------------------------------
// TypeScript interfaces (re-exported for callers)
// ----------------------------------------------------------------------------

export interface InstitutionInfo {
  name: string
  password: string
  address: string
  phone: string
  email: string
  currentYear: string
}

export interface AdminInfo {
  email: string
  password: string
  name: string
  userCode: string
  phone: string
}

export interface StaffInfo {
  email: string
  password: string
  name: string
  userCode: string
  phone: string
  firstName: string
  lastName: string
  fonction: string
}

export interface ParentInfo {
  email: string
  password: string
  name: string
  userCode: string
  phone: string
  firstName: string
  lastName: string
  address: string
}

export interface TeacherInfo {
  firstName: string
  lastName: string
  subject: string
  email: string
  phone: string
  qualification: string
  image: string
  userCode: string
}

export interface ClassInfo {
  name: string
  level: string
  section: string
  capacity: number
  room: string
  schoolYear: string
}

export interface StudentInfo {
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  classIndex: number
  parentContact: string
  parentPhone: string
  image: string
  userCode: string
  email: string
  phone: string
}

export interface AnnouncementInfo {
  title: string
  content: string
  type: string
  target: string
  priority: number
}

export interface MessageInfo {
  senderTeacherIndex?: number
  senderRole?: 'admin'
  receiverTeacherIndex?: number
  receiverRole?: 'admin'
  content: string
}

export interface InstitutionSeedConfig {
  institution: InstitutionInfo
  admin: AdminInfo
  staff: StaffInfo
  parent: ParentInfo
  teachers: TeacherInfo[]
  classes: ClassInfo[]
  students: StudentInfo[]
  announcements: AnnouncementInfo[]
  messages: MessageInfo[]
}

export interface SubjectRow {
  id: string
  name: string
  code: string
  coefficient: number
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Generate a random grade between min and max, rounded to nearest 0.5.
 * (Copied from /api/seed/route.ts so the shared module is self-contained.)
 */
export function randomGrade(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 2) / 2
}

/**
 * Build a clean, RFC-friendly email from a firstName + lastName + domain.
 * Strips accents (NFD normalization) and any non-alpha characters.
 * (Copied from /api/seed/route.ts so the shared module is self-contained.)
 */
export function buildStudentEmail(firstName: string, lastName: string, domain: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '')
  return `${clean(firstName)}.${clean(lastName)}@${domain}`
}

/**
 * Build a URL-safe slug from any string (institution name → email domain).
 * Strips accents and replaces non-alpha chars with hyphens.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'institution'
}

/**
 * Derive a deterministic short suffix (6 chars, uppercase alphanumeric) from
 * an institution id. Used to build institution-unique emails/userCodes for
 * auto-generated demo data so it never collides with users from other
 * institutions (or with the well-known demo accounts like admin@ecole.com).
 */
export function institutionSuffix(institutionId: string): string {
  const raw = institutionId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const tail = raw.slice(-6).padStart(6, 'X')
  return tail
}

// ----------------------------------------------------------------------------
// wipeInstitutionData
// ----------------------------------------------------------------------------

/**
 * Wipe ALL data belonging to a single institution, WITHOUT deleting the
 * Institution row itself. By default preserves the admin user(s) (so the
 * admin can still log in after a reset). Other users (teachers, students,
 * parents, staff) are deleted.
 *
 * This is the per-institution equivalent of the global deleteMany block in
 * /api/seed. It mirrors the DELETE permanent handler pattern in
 * /api/institutions/route.ts.
 *
 * Does NOT delete: Institution row, Subject (global), SchoolYear (global),
 * SuperAdmin.
 */
export async function wipeInstitutionData(
  institutionId: string,
  options?: { preserveAdminUser?: boolean }
): Promise<void> {
  const preserveAdminUser = options?.preserveAdminUser ?? true

  // 1. Find all user IDs in this institution
  const usersInInst = await db.user.findMany({
    where: { institutionId },
    select: { id: true, role: true },
  })

  // IDs we are going to DELETE (everyone except preserved admins)
  let userIdsToDelete: string[]
  let adminUserIds: string[] = []

  if (preserveAdminUser) {
    adminUserIds = usersInInst.filter((u) => u.role === 'admin').map((u) => u.id)
    userIdsToDelete = usersInInst.filter((u) => u.role !== 'admin').map((u) => u.id)
  } else {
    userIdsToDelete = usersInInst.map((u) => u.id)
  }

  // All user IDs in this institution (used for filtering related rows by
  // sender/receiver/author — includes the admin, because the admin may have
  // authored announcements or sent messages that we want to remove too).
  const allInstUserIds = usersInInst.map((u) => u.id)

  // 2. Delete in FK-safe order

  // bulletin (via student.user.institutionId)
  await db.bulletin.deleteMany({
    where: { student: { user: { institutionId } } },
  })

  // attendance (via student.user.institutionId)
  await db.attendance.deleteMany({
    where: { student: { user: { institutionId } } },
  })

  // message (via sender OR receiver in this institution)
  if (allInstUserIds.length > 0) {
    await db.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: allInstUserIds } },
          { receiverId: { in: allInstUserIds } },
        ],
      },
    })
  }

  // announcement (via authorId in this institution)
  if (allInstUserIds.length > 0) {
    await db.announcement.deleteMany({
      where: { authorId: { in: allInstUserIds } },
    })
  }

  // notification (has a required institutionId field)
  await db.notification.deleteMany({ where: { institutionId } })

  // homeworkSubmission (via homework.institutionId)
  await db.homeworkSubmission.deleteMany({
    where: { homework: { institutionId } },
  })

  // homework (has a required institutionId field)
  await db.homework.deleteMany({ where: { institutionId } })

  // payment (via student.user.institutionId)
  await db.payment.deleteMany({
    where: { student: { user: { institutionId } } },
  })

  // grade (via student.user.institutionId)
  await db.grade.deleteMany({
    where: { student: { user: { institutionId } } },
  })

  // schedule (via class.institutionId)
  await db.schedule.deleteMany({
    where: { class: { institutionId } },
  })

  // eventClass (via event.institutionId)
  await db.eventClass.deleteMany({
    where: { event: { institutionId } },
  })

  // schoolEvent (has a required institutionId field)
  await db.schoolEvent.deleteMany({ where: { institutionId } })

  // classTeacher (via class.institutionId)
  await db.classTeacher.deleteMany({
    where: { class: { institutionId } },
  })

  // student (via user.institutionId) — preserve admin (admins are never
  // students but the filter is harmless)
  await db.student.deleteMany({
    where: { user: { institutionId } },
  })

  // teacher (via user.institutionId)
  await db.teacher.deleteMany({
    where: { user: { institutionId } },
  })

  // parent (via user.institutionId)
  await db.parent.deleteMany({
    where: { user: { institutionId } },
  })

  // staff (via user.institutionId)
  await db.staff.deleteMany({
    where: { user: { institutionId } },
  })

  // class (via institutionId)
  await db.class.deleteMany({ where: { institutionId } })

  // schoolConfig (via institutionId)
  await db.schoolConfig.deleteMany({ where: { institutionId } })

  // mediaFile (has a required institutionId field)
  await db.mediaFile.deleteMany({ where: { institutionId } })

  // userSession (for the users we are about to delete)
  if (userIdsToDelete.length > 0) {
    await db.userSession.deleteMany({
      where: { userId: { in: userIdsToDelete } },
    })
  }

  // user (delete non-admin users belonging to this institution)
  if (preserveAdminUser) {
    // Delete everyone in this institution EXCEPT admins
    await db.user.deleteMany({
      where: {
        institutionId,
        role: { not: 'admin' },
      },
    })
  } else {
    // Delete ALL users in this institution
    await db.user.deleteMany({ where: { institutionId } })
  }

  // Note: adminUserIds are intentionally NOT deleted — they remain so the
  // admin can log in after the reset.
}

// ----------------------------------------------------------------------------
// seedInstitutionData
// ----------------------------------------------------------------------------

/**
 * Seed demo data for an EXISTING institution. Does NOT create the Institution
 * row (it already exists). Does NOT wipe anything (caller must wipe first if
 * needed). Creates: admin user (if not already existing), staff, parent,
 * teachers, classes, students, grades, schedules, payments, attendance,
 * announcements, messages, schoolConfig.
 *
 * This is a refactored version of the original seedInstitutionData() from
 * /api/seed/route.ts (lines 143-506), with these differences:
 *  - Takes an existing institution object (with .id) instead of creating one
 *  - If an admin user already exists for this institution, reuses its id
 *    (so announcements / messages are authored by the existing admin)
 *  - If no admin exists, creates one using config.admin
 *
 * The config is expected to be already-correct (no email transformation
 * happens here). Callers that need institution-unique emails/userCodes
 * should bake the suffix into the config before calling (see
 * generateDefaultInstitutionConfig).
 */
export async function seedInstitutionData(
  institution: {
    id: string
    name: string
    password: string
    address: string | null
    phone: string | null
    email: string | null
    currentYear: string
  },
  config: InstitutionSeedConfig,
  subjects: SubjectRow[],
  today: Date
): Promise<void> {
  // ---- Admin User (create only if no admin exists for this institution) ----
  const existingAdmin = await db.user.findFirst({
    where: { institutionId: institution.id, role: 'admin' },
  })
  let adminUser: { id: string }
  if (existingAdmin) {
    adminUser = { id: existingAdmin.id }
  } else {
    const created = await db.user.create({
      data: {
        email: config.admin.email,
        password: config.admin.password,
        name: config.admin.name,
        role: 'admin',
        phone: config.admin.phone,
        userCode: config.admin.userCode,
        institutionId: institution.id,
        active: true,
      },
    })
    adminUser = { id: created.id }
  }

  // ---- Staff User + Staff profile ----
  const staffUser = await db.user.create({
    data: {
      email: config.staff.email,
      password: config.staff.password,
      name: config.staff.name,
      role: 'staff',
      phone: config.staff.phone,
      userCode: config.staff.userCode,
      institutionId: institution.id,
      active: true,
    },
  })
  await db.staff.create({
    data: {
      userId: staffUser.id,
      firstName: config.staff.firstName,
      lastName: config.staff.lastName,
      fonction: config.staff.fonction,
      phone: config.staff.phone,
      email: config.staff.email,
    },
  })

  // ---- Parent User + Parent profile ----
  const parentUser = await db.user.create({
    data: {
      email: config.parent.email,
      password: config.parent.password,
      name: config.parent.name,
      role: 'parent',
      phone: config.parent.phone,
      userCode: config.parent.userCode,
      institutionId: institution.id,
      active: true,
    },
  })
  const parentProfile = await db.parent.create({
    data: {
      userId: parentUser.id,
      firstName: config.parent.firstName,
      lastName: config.parent.lastName,
      phone: config.parent.phone,
      address: config.parent.address,
    },
  })

  // ---- SchoolConfig (linked to institution) ----
  // Delete any stale config first (in case the institution already had one —
  // e.g. when reseeding without a full wipe).
  await db.schoolConfig.deleteMany({ where: { institutionId: institution.id } })
  await db.schoolConfig.create({
    data: {
      schoolName: config.institution.name,
      address: config.institution.address,
      phone: config.institution.phone,
      email: config.institution.email,
      currentYear: config.institution.currentYear,
      institutionId: institution.id,
      institutionPassword: config.institution.password,
    },
  })

  // ---- Teachers (User + Teacher profile) ----
  const teachers: Array<{
    id: string
    userId: string
    firstName: string
    lastName: string
    subject: string
  }> = []
  for (const t of config.teachers) {
    const user = await db.user.create({
      data: {
        email: t.email,
        password: 'teacher123',
        name: `${t.firstName} ${t.lastName}`,
        role: 'teacher',
        phone: t.phone,
        userCode: t.userCode,
        institutionId: institution.id,
        active: true,
      },
    })
    const teacher = await db.teacher.create({
      data: {
        userId: user.id,
        firstName: t.firstName,
        lastName: t.lastName,
        subject: t.subject,
        phone: t.phone,
        qualification: t.qualification,
        hireDate: '2020-09-01',
        image: t.image,
      },
    })
    teachers.push({
      id: teacher.id,
      userId: user.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      subject: teacher.subject,
    })
  }

  // ---- Classes (with institutionId set on every class) ----
  const classes: Array<{ id: string; name: string; room: string | null }> = []
  for (const c of config.classes) {
    const cls = await db.class.create({
      data: {
        name: c.name,
        level: c.level,
        section: c.section,
        capacity: c.capacity,
        schoolYear: c.schoolYear,
        room: c.room,
        institutionId: institution.id,
      },
    })
    classes.push({ id: cls.id, name: cls.name, room: cls.room })
  }

  // ---- ClassTeacher assignments (every teacher to every class, by subject) ----
  for (const cls of classes) {
    for (const teacher of teachers) {
      await db.classTeacher.create({
        data: {
          classId: cls.id,
          teacherId: teacher.id,
          subject: teacher.subject,
        },
      })
    }
  }

  // ---- Students (User + Student profile, linked to class & optionally parent) ----
  const students: Array<{ id: string; classId: string | null }> = []
  for (let i = 0; i < config.students.length; i++) {
    const s = config.students[i]
    const classObj = classes[s.classIndex]
    const user = await db.user.create({
      data: {
        email: s.email,
        password: 'student123',
        name: `${s.firstName} ${s.lastName}`,
        role: 'student',
        phone: s.phone,
        userCode: s.userCode,
        institutionId: institution.id,
        active: true,
      },
    })
    const student = await db.student.create({
      data: {
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        address: config.institution.address,
        enrollmentDate: '2024-09-01',
        parentContact: s.parentContact,
        parentPhone: s.parentPhone,
        classId: classObj.id,
        image: s.image,
        parentId: i === 0 ? parentProfile.id : null,
      },
    })
    students.push({ id: student.id, classId: student.classId })
  }

  // ---- Grades: 3 grades per subject per student (one per trimester) ----
  const trimesters = ['1er', '2eme', '3eme']
  const gradeTypes = ['devoir', 'examen', 'controle']
  const gradeDates = ['2024-11-15', '2025-02-15', '2025-05-15']

  for (const student of students) {
    for (const subject of subjects) {
      for (let g = 0; g < 3; g++) {
        let minVal = 8
        let maxVal = 18
        if (subject.code === 'MATH' || subject.code === 'PC') {
          minVal = 6
          maxVal = 17
        } else if (subject.code === 'FR' || subject.code === 'ANG') {
          minVal = 8
          maxVal = 19
        }
        const value = randomGrade(minVal, maxVal)
        await db.grade.create({
          data: {
            studentId: student.id,
            subjectId: subject.id,
            classId: student.classId,
            teacherId: teachers.find((t) => t.subject === subject.name)?.id || null,
            value,
            maxValue: 20,
            type: gradeTypes[g],
            trimester: trimesters[g],
            schoolYear: '2024-2025',
            date: gradeDates[g],
            comment:
              value >= 14 ? 'Bon travail' : value >= 10 ? 'Peut mieux faire' : 'Effort insuffisant',
          },
        })
      }
    }
  }

  // ---- Schedules: 5 periods/day × 5 days per class ----
  const timeSlots = [
    { start: '07:30', end: '08:30' },
    { start: '08:35', end: '09:35' },
    { start: '09:40', end: '10:40' },
    { start: '11:00', end: '12:00' },
    { start: '12:05', end: '13:05' },
    { start: '14:00', end: '15:00' },
  ]
  for (const cls of classes) {
    for (let day = 1; day <= 5; day++) {
      const numPeriods = 5
      const shuffledSubjects = [...subjects].sort(() => Math.random() - 0.5)
      for (let p = 0; p < numPeriods && p < timeSlots.length; p++) {
        const subject = shuffledSubjects[p % shuffledSubjects.length]
        const slot = timeSlots[p]
        const teacher = teachers.find((t) => t.subject === subject.name)
        await db.schedule.create({
          data: {
            classId: cls.id,
            teacherId: teacher?.id || null,
            subject: subject.name,
            dayOfWeek: day,
            startTime: slot.start,
            endTime: slot.end,
            room: cls.room,
          },
        })
      }
    }
  }

  // ---- Payments: 3 per student (frais de scolarité trimestriels, 150000 FCFA each) ----
  const paymentMethods = ['mobile_money', 'cash', 'bank_transfer']
  const paymentStatuses = ['completed', 'completed', 'pending'] as const
  const paymentDates = ['2024-09-15', '2024-12-15', '2025-03-15']

  for (const student of students) {
    for (let p = 0; p < 3; p++) {
      const method = paymentMethods[p]
      const status = paymentStatuses[p]
      await db.payment.create({
        data: {
          studentId: student.id,
          amount: 150000,
          type: 'tuition',
          method,
          status,
          reference:
            method === 'mobile_money'
              ? `MM${Date.now()}${Math.floor(Math.random() * 10000)}`
              : null,
          description: `Frais de scolarité - Trimestre ${p + 1}`,
          schoolYear: '2024-2025',
          paymentDate: paymentDates[p],
        },
      })
    }
  }

  // ---- Attendance: 5 records per student (mix of present/absent/late) ----
  const attendanceStatuses = ['present', 'present', 'present', 'absent', 'late']
  const attendanceDates: string[] = []
  const tmpDate = new Date(today)
  let backDays = 0
  while (attendanceDates.length < 5 && backDays < 30) {
    tmpDate.setDate(today.getDate() - backDays)
    const day = tmpDate.getDay()
    if (day !== 0 && day !== 6) {
      attendanceDates.push(tmpDate.toISOString().split('T')[0])
    }
    backDays++
  }

  for (const student of students) {
    for (let d = 0; d < 5; d++) {
      const status = attendanceStatuses[d % attendanceStatuses.length]
      await db.attendance.create({
        data: {
          studentId: student.id,
          date: attendanceDates[d],
          status,
          comment:
            status === 'absent' ? 'Non justifié' : status === 'late' ? 'Retard de 15 min' : null,
        },
      })
    }
  }

  // ---- Announcements (authored by the institution admin) ----
  for (const a of config.announcements) {
    await db.announcement.create({
      data: {
        title: a.title,
        content: a.content,
        type: a.type,
        target: a.target,
        authorId: adminUser.id,
        priority: a.priority,
      },
    })
  }

  // ---- Messages (between admin and that institution's teachers) ----
  for (const m of config.messages) {
    let senderId: string | undefined
    let receiverId: string | undefined

    if (m.senderRole === 'admin') {
      senderId = adminUser.id
    } else if (typeof m.senderTeacherIndex === 'number') {
      senderId = teachers[m.senderTeacherIndex]?.userId
    }

    if (m.receiverRole === 'admin') {
      receiverId = adminUser.id
    } else if (typeof m.receiverTeacherIndex === 'number') {
      receiverId = teachers[m.receiverTeacherIndex]?.userId
    }

    if (senderId && receiverId) {
      await db.message.create({
        data: {
          senderId,
          receiverId,
          content: m.content,
          read: Math.random() > 0.5,
        },
      })
    }
  }
}

// ----------------------------------------------------------------------------
// generateDefaultInstitutionConfig
// ----------------------------------------------------------------------------

/**
 * Generate a default InstitutionSeedConfig for a newly created institution,
 * based on its name and existing data. Used when the user clicks "create
 * institution with demo data". Produces a generic set of:
 *  - 1 admin (email derived from institution name slug + adminEmail if given)
 *  - 1 staff
 *  - 1 parent
 *  - 4 teachers (Math, Français, Anglais, Histoire-Géo)
 *  - 3 classes
 *  - 12 students
 *  - 2 announcements
 *  - 2 messages
 *
 * All emails/userCodes are made institution-unique via a deterministic suffix
 * derived from the institution id (so reseeding the same institution produces
 * the same emails, while different institutions never collide).
 */
export function generateDefaultInstitutionConfig(
  institution: {
    id: string
    name: string
    password: string
    address: string | null
    phone: string | null
    email: string | null
    currentYear: string
  },
  adminEmail?: string,
  adminPassword?: string
): InstitutionSeedConfig {
  const suffix = institutionSuffix(institution.id)
  const slug = slugify(institution.name)
  // Demo-only domain — clearly fake so it never clashes with a real one.
  // The institution-unique suffix guarantees no collision with other
  // institutions' demo users.
  const domain = `${slug}-${suffix}.demo`

  // Admin email: if the caller provided one (user-chosen), use it as-is.
  // Otherwise generate one in the institution's demo domain.
  const finalAdminEmail =
    adminEmail && adminEmail.trim().length > 0
      ? adminEmail.trim()
      : `admin@${domain}`
  const finalAdminPassword = adminPassword && adminPassword.length >= 6
    ? adminPassword
    : 'admin123'

  const instInfo: InstitutionInfo = {
    name: institution.name,
    password: institution.password,
    address: institution.address || 'Douala, Cameroun',
    phone: institution.phone || '+243 600 000 000',
    email: institution.email || `contact@${domain}`,
    currentYear: institution.currentYear || '2024-2025',
  }

  const admin: AdminInfo = {
    email: finalAdminEmail,
    password: finalAdminPassword,
    name: `Administrateur ${institution.name}`,
    userCode: `ADM-${suffix}-001`,
    phone: institution.phone || '+243 699 000 000',
  }

  const staff: StaffInfo = {
    email: `staff@${domain}`,
    password: 'staff123',
    name: 'Jean-Pierre Essomba',
    userCode: `STF-${suffix}-001`,
    phone: '+243 677 000 000',
    firstName: 'Jean-Pierre',
    lastName: 'Essomba',
    fonction: 'Secrétaire général',
  }

  const parent: ParentInfo = {
    email: `parent@${domain}`,
    password: 'parent123',
    name: 'Mariam Keita',
    userCode: `PAR-${suffix}-001`,
    phone: '+243 611 100 001',
    firstName: 'Mariam',
    lastName: 'Keita',
    address: institution.address || 'Douala, Cameroun',
  }

  const teachers: TeacherInfo[] = [
    {
      firstName: 'Amadou',
      lastName: 'Diallo',
      subject: 'Mathématiques',
      email: `amadou.diallo@${domain}`,
      phone: '+243 691 111 111',
      qualification: 'Doctorat en Mathématiques',
      image: '/avatars/amadou-diallo.png',
      userCode: `TCH-${suffix}-001`,
    },
    {
      firstName: 'Aïcha',
      lastName: 'Toure',
      subject: 'Français',
      email: `aicha.toure@${domain}`,
      phone: '+243 694 444 444',
      qualification: 'Licence en Lettres Modernes',
      image: '/avatars/aicha-toure.png',
      userCode: `TCH-${suffix}-002`,
    },
    {
      firstName: 'Kouadio',
      lastName: 'Yao',
      subject: 'Anglais',
      email: `kouadio.yao@${domain}`,
      phone: '+243 695 555 555',
      qualification: 'Master en Anglais',
      image: '/avatars/kouadio-yao.png',
      userCode: `TCH-${suffix}-003`,
    },
    {
      firstName: 'Fatou',
      lastName: 'Ndiaye',
      subject: 'Histoire-Géo',
      email: `fatou.ndiaye@${domain}`,
      phone: '+243 696 666 666',
      qualification: 'Licence en Histoire',
      image: '/avatars/fatou-ndiaye.png',
      userCode: `TCH-${suffix}-004`,
    },
  ]

  const classes: ClassInfo[] = [
    {
      name: '6ème A',
      level: '6ème',
      section: 'A',
      capacity: 30,
      room: 'Salle 101',
      schoolYear: '2024-2025',
    },
    {
      name: '5ème A',
      level: '5ème',
      section: 'A',
      capacity: 30,
      room: 'Salle 102',
      schoolYear: '2024-2025',
    },
    {
      name: '4ème A',
      level: '4ème',
      section: 'A',
      capacity: 30,
      room: 'Salle 201',
      schoolYear: '2024-2025',
    },
  ]

  // 12 students: 4 per class
  const firstNamesM = ['Moussa', 'Ibrahim', 'Ousmane', 'Aboubakar', 'Yacouba', 'Souleymane']
  const firstNamesF = ['Aïssatou', 'Fatoumata', 'Mariam', 'Aminata', 'Rokia', 'Kadiatou']
  const lastNames = ['Keita', 'Traoré', 'Diarra', 'Coulibaly', 'Touré', 'Cissé', 'Diallo', 'Camara', 'Sidibé', 'Sangaré', 'Konaté', 'Bah']

  const students: StudentInfo[] = []
  let nameIdx = 0
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 4; i++) {
      const isMale = nameIdx % 2 === 0
      const first = isMale ? firstNamesM[nameIdx % firstNamesM.length] : firstNamesF[nameIdx % firstNamesF.length]
      const last = lastNames[nameIdx % lastNames.length]
      const email = buildStudentEmail(first, last, domain)
      const userCode = `STU-${suffix}-${String(nameIdx + 1).padStart(3, '0')}`
      students.push({
        firstName: first,
        lastName: last,
        gender: isMale ? 'M' : 'F',
        dateOfBirth: `201${(c + 2) % 10}-0${(i % 9) + 1}-1${i % 9}`,
        classIndex: c,
        parentContact: `${first} ${last} Parent`,
        parentPhone: '+243 611 100 001',
        image: isMale ? '/avatars/student-male-1.png' : '/avatars/student-female-1.png',
        userCode,
        email,
        phone: '+243 655 000 000',
      })
      nameIdx++
    }
  }

  const announcements: AnnouncementInfo[] = [
    {
      title: `Bienvenue à ${institution.name}`,
      content: `La rentrée scolaire de ${institution.name} est officiellement lancée. Tous les élèves sont attendus pour les cours à 7h30.`,
      type: 'general',
      target: 'all',
      priority: 3,
    },
    {
      title: 'Conseil de classe du 1er trimestre',
      content: 'Le conseil de classe du premier trimestre se tiendra à la fin du mois. Les enseignants sont invités à préparer leurs appréciations.',
      type: 'academic',
      target: 'teachers',
      priority: 2,
    },
  ]

  const messages: MessageInfo[] = [
    {
      senderRole: 'admin',
      receiverTeacherIndex: 0,
      content: 'Monsieur Diallo, veuillez préparer les énoncés de mathématiques pour le premier trimestre.',
    },
    {
      senderRole: 'admin',
      receiverTeacherIndex: 1,
      content: 'Madame Toure, merci de finaliser les séquences de français pour la semaine prochaine.',
    },
  ]

  return {
    institution: instInfo,
    admin,
    staff,
    parent,
    teachers,
    classes,
    students,
    announcements,
    messages,
  }
}
