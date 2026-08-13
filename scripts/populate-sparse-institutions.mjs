// ============================================================================
// Populate sparse institutions with demo data in 2024-2025
// ----------------------------------------------------------------------------
// This script identifies institutions that have very little data (< 5 students
// or < 2 classes) and populates them with a full demo dataset using the shared
// `generateDefaultInstitutionConfig()` + `seedInstitutionData()` helpers.
//
// The data is created in the institution's currentYear (2024-2025).
// It DOES NOT touch existing users/classes — only ADDS missing teachers,
// classes, students, parents, staff, payments, grades, schedules, etc.
//
// Usage: bun run scripts/populate-sparse-institutions.mjs
// ============================================================================

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// -------- Replicate the helpers from src/lib/seed-institution.ts --------
// (We inline them here because the original module imports from '@/lib/db'
// which is a Next.js alias — not resolvable from a standalone bun script.)

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'inst'
}

function institutionSuffix(institutionId) {
  return institutionId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-6)
}

function randomGrade(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 2) / 2
}

function buildStudentEmail(firstName, lastName, domain, index) {
  const f = slugify(firstName)
  const l = slugify(lastName)
  // Include index to guarantee uniqueness across students with same name
  return `${f}.${l}.${index}@${domain}`
}

// -------- Subject rows (global, shared by all institutions) --------
async function getGlobalSubjects() {
  const subjects = await db.subject.findMany()
  if (subjects.length === 0) {
    // Create them if missing
    const defs = [
      { name: 'Mathématiques', code: 'MATH', coefficient: 4 },
      { name: 'Français', code: 'FR', coefficient: 4 },
      { name: 'Anglais', code: 'ANG', coefficient: 3 },
      { name: 'Histoire-Géo', code: 'HG', coefficient: 3 },
      { name: 'SVT', code: 'SVT', coefficient: 3 },
      { name: 'Physique-Chimie', code: 'PC', coefficient: 3 },
    ]
    const created = []
    for (const s of defs) {
      created.push(await db.subject.create({ data: s }))
    }
    return created.map(s => ({ id: s.id, name: s.name, code: s.code, coefficient: s.coefficient }))
  }
  return subjects.map(s => ({ id: s.id, name: s.name, code: s.code, coefficient: s.coefficient }))
}

// -------- Build a default config for an institution --------
function buildConfig(inst, existingAdmin) {
  const suffix = institutionSuffix(inst.id)
  const slug = slugify(inst.name)
  const domain = `${slug}-${suffix}.demo`
  const year = inst.currentYear || '2024-2025'

  return {
    institution: {
      name: inst.name,
      password: inst.password,
      address: inst.address || 'Douala, Cameroun',
      phone: inst.phone || '+243 600 000 000',
      email: inst.email || `contact@${domain}`,
      currentYear: year,
    },
    admin: {
      email: existingAdmin?.email || `admin@${domain}`,
      password: existingAdmin?.password || 'admin123',
      name: existingAdmin?.name || `Administrateur ${inst.name}`,
      userCode: existingAdmin?.userCode || `ADM-${suffix}-001`,
      phone: inst.phone || '+243 699 000 000',
    },
    staff: {
      email: `staff@${domain}`,
      password: 'staff123',
      name: 'Jean-Pierre Essomba',
      userCode: `STF-${suffix}-001`,
      phone: '+243 677 000 000',
      firstName: 'Jean-Pierre',
      lastName: 'Essomba',
      fonction: 'Secrétaire général',
    },
    parent: {
      email: `parent@${domain}`,
      password: 'parent123',
      name: 'Mariam Keita',
      userCode: `PAR-${suffix}-001`,
      phone: '+243 611 100 001',
      firstName: 'Mariam',
      lastName: 'Keita',
      address: inst.address || 'Douala, Cameroun',
    },
    teachers: [
      { firstName: 'Amadou', lastName: 'Diallo', subject: 'Mathématiques', email: `amadou.diallo@${domain}`, phone: '+243 691 111 111', qualification: 'Doctorat en Mathématiques', userCode: `TCH-${suffix}-001` },
      { firstName: 'Aïcha', lastName: 'Toure', subject: 'Français', email: `aicha.toure@${domain}`, phone: '+243 694 444 444', qualification: 'Licence en Lettres Modernes', userCode: `TCH-${suffix}-002` },
      { firstName: 'Kouadio', lastName: 'Yao', subject: 'Anglais', email: `kouadio.yao@${domain}`, phone: '+243 695 555 555', qualification: 'Master en Anglais', userCode: `TCH-${suffix}-003` },
      { firstName: 'Fatou', lastName: 'Ndiaye', subject: 'Histoire-Géo', email: `fatou.ndiaye@${domain}`, phone: '+243 696 666 666', qualification: 'Licence en Histoire', userCode: `TCH-${suffix}-004` },
      { firstName: 'Ibrahim', lastName: 'Sow', subject: 'SVT', email: `ibrahim.sow@${domain}`, phone: '+243 697 777 777', qualification: 'Master en Biologie', userCode: `TCH-${suffix}-005` },
    ],
    classes: [
      { name: '6ème A', level: '6ème', section: 'A', capacity: 35, room: 'Salle 101', schoolYear: year },
      { name: '5ème B', level: '5ème', section: 'B', capacity: 30, room: 'Salle 202', schoolYear: year },
      { name: '4ème C', level: '4ème', section: 'C', capacity: 28, room: 'Salle 303', schoolYear: year },
      { name: '3ème D', level: '3ème', section: 'D', capacity: 25, room: 'Salle 404', schoolYear: year },
    ],
    students: generateStudents(20, domain, suffix),
    announcements: [
      { title: `Rentrée scolaire ${year}`, content: `Nous avons le plaisir de vous annoncer que la rentrée scolaire aura lieu le 9 septembre. Tous les élèves sont tenus de se présenter à 7h30 avec leur fourniture complète.`, type: 'general', target: 'all', priority: 3 },
      { title: 'Réunion parents-professeurs', content: 'Une réunion parents-professeurs se tiendra le 15 du mois courant à 16h dans la salle de conférence. La présence d\'au moins un parent par élève est obligatoire.', type: 'meeting', target: 'parents', priority: 2 },
    ],
    messages: [
      { content: 'Bienvenue sur la plateforme MASOMO. N\'hésitez pas à contacter l\'administration pour toute question.', type: 'info' },
    ],
  }
}

// -------- Generate a list of demo students --------
const FIRST_NAMES_M = ['Amadou', 'Ibrahim', 'Kouadio', 'Mamadou', 'Cheikh', 'Ousmane', 'Moussa', 'Sékou', 'Boubacar', 'Abdoulaye']
const FIRST_NAMES_F = ['Aïcha', 'Fatou', 'Mariam', 'Awa', 'Kadiatou', 'Bineta', 'Aminata', 'Coumba', 'Ndèye', 'Rama']
const LAST_NAMES = ['Diallo', 'Touré', 'Ndiaye', 'Keita', 'Cissé', 'Sow', 'Ba', 'Diop', 'Camara', 'Sy', 'Koné', 'Traoré', 'Gueye', 'Fall', 'Sarr']

function generateStudents(count, domain, suffix) {
  const students = []
  const used = new Set()
  let i = 0
  while (students.length < count && i < count * 5) {
    i++
    const isMale = Math.random() > 0.5
    const firstName = isMale
      ? FIRST_NAMES_M[Math.floor(Math.random() * FIRST_NAMES_M.length)]
      : FIRST_NAMES_F[Math.floor(Math.random() * FIRST_NAMES_F.length)]
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const key = `${firstName}-${lastName}`
    if (used.has(key)) continue
    used.add(key)
    const num = String(students.length + 1).padStart(3, '0')
    students.push({
      firstName,
      lastName,
      gender: isMale ? 'M' : 'F',
      email: buildStudentEmail(firstName, lastName, domain, students.length + 1),
      phone: `+243 6${Math.floor(10000000 + Math.random() * 89999999)}`,
      userCode: `ELV-${suffix}-${num}`,
      dateOfBirth: `200${Math.floor(Math.random() * 8) + 1}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      address: 'Douala, Cameroun',
    })
  }
  return students
}

// -------- Main: populate one institution --------
async function populateInstitution(inst, subjects, today) {
  const existingAdmin = await db.user.findFirst({
    where: { institutionId: inst.id, role: 'admin' },
    select: { id: true, email: true, password: true, name: true, userCode: true }
  })

  const config = buildConfig(inst, existingAdmin)
  const year = inst.currentYear || '2024-2025'

  console.log(`   → Peuplement de "${inst.name}" (year=${year})`)

  // ---- Staff ----
  let staffUser = await db.user.findFirst({ where: { institutionId: inst.id, role: 'staff' } })
  if (!staffUser) {
    staffUser = await db.user.create({
      data: {
        email: config.staff.email,
        password: config.staff.password,
        name: config.staff.name,
        role: 'staff',
        phone: config.staff.phone,
        userCode: config.staff.userCode,
        institutionId: inst.id,
        active: true,
      }
    })
    await db.staff.create({
      data: {
        userId: staffUser.id,
        firstName: config.staff.firstName,
        lastName: config.staff.lastName,
        fonction: config.staff.fonction,
        phone: config.staff.phone,
      }
    })
    console.log(`   ✓ Staff créé: ${config.staff.email} / ${config.staff.password}`)
  }

  // ---- Teachers ----
  const createdTeachers = [] // { user, teacher, subjectName }
  for (const t of config.teachers) {
    const existing = await db.user.findFirst({ where: { email: t.email } })
    if (existing) {
      const teacherRec = await db.teacher.findFirst({ where: { userId: existing.id } })
      if (teacherRec) {
        createdTeachers.push({ user: existing, teacher: teacherRec, subjectName: t.subject })
        continue
      }
    }
    const user = await db.user.create({
      data: {
        email: t.email,
        password: 'teacher123',
        name: `${t.firstName} ${t.lastName}`,
        role: 'teacher',
        phone: t.phone,
        userCode: t.userCode,
        institutionId: inst.id,
        active: true,
      }
    })
    const teacherRec = await db.teacher.create({
      data: {
        userId: user.id,
        firstName: t.firstName,
        lastName: t.lastName,
        subject: t.subject,
        qualification: t.qualification || null,
        phone: t.phone,
      }
    })
    createdTeachers.push({ user, teacher: teacherRec, subjectName: t.subject })
  }
  console.log(`   ✓ ${createdTeachers.length} enseignant(s)`)

  // ---- Classes ----
  const createdClasses = [] // { class, teacherId, subjectId }
  for (let i = 0; i < config.classes.length; i++) {
    const c = config.classes[i]
    const existing = await db.class.findFirst({
      where: { institutionId: inst.id, name: c.name, schoolYear: c.schoolYear }
    })
    if (existing) {
      // Assign a teacher if not yet assigned
      const teacherForClass = createdTeachers[i % createdTeachers.length]
      const subjectForClass = subjects.find(s => s.name === teacherForClass.subjectName) || subjects[i % subjects.length]
      createdClasses.push({ class: existing, teacherId: teacherForClass.teacher.id, subjectId: subjectForClass.id })
      continue
    }
    const teacherForClass = createdTeachers[i % createdTeachers.length]
    const subjectForClass = subjects.find(s => s.name === teacherForClass.subjectName) || subjects[i % subjects.length]
    const cls = await db.class.create({
      data: {
        name: c.name,
        level: c.level,
        section: c.section,
        capacity: c.capacity,
        room: c.room,
        institutionId: inst.id,
        schoolYear: c.schoolYear,
      }
    })
    // Assign teacher to class (with subject name as required by schema)
    const existingCT = await db.classTeacher.findFirst({
      where: { classId: cls.id, teacherId: teacherForClass.teacher.id }
    })
    if (!existingCT) {
      await db.classTeacher.create({
        data: {
          classId: cls.id,
          teacherId: teacherForClass.teacher.id,
          subject: teacherForClass.subjectName,
        }
      })
    }
    createdClasses.push({ class: cls, teacherId: teacherForClass.teacher.id, subjectId: subjectForClass.id })
  }
  console.log(`   ✓ ${createdClasses.length} classe(s)`)

  // ---- Parent (single shared demo parent) ----
  let parentUser = await db.user.findFirst({ where: { email: config.parent.email } })
  let parentRec = null
  if (!parentUser) {
    parentUser = await db.user.create({
      data: {
        email: config.parent.email,
        password: config.parent.password,
        name: config.parent.name,
        role: 'parent',
        phone: config.parent.phone,
        userCode: config.parent.userCode,
        institutionId: inst.id,
        active: true,
      }
    })
    parentRec = await db.parent.create({
      data: {
        userId: parentUser.id,
        firstName: config.parent.firstName,
        lastName: config.parent.lastName,
        phone: config.parent.phone,
        address: config.parent.address,
      }
    })
    console.log(`   ✓ Parent démo créé: ${config.parent.email} / ${config.parent.password}`)
  } else {
    parentRec = await db.parent.findFirst({ where: { userId: parentUser.id } })
    console.log(`   → Parent démo existe déjà`)
  }

  // ---- Students ----
  // For existing students (created in a previous partial run), we still
  // create their grades/payments/attendance if missing.
  let createdStudents = 0
  for (let i = 0; i < config.students.length; i++) {
    const s = config.students[i]
    // Assign student to a class (round-robin)
    const cls = createdClasses[i % createdClasses.length]

    let studentRec = null
    const existing = await db.user.findFirst({
      where: { email: s.email },
      include: { student: true }
    })
    if (existing && existing.student) {
      studentRec = existing.student
      // Make sure the student is assigned to a class
      if (!studentRec.classId) {
        await db.student.update({
          where: { id: studentRec.id },
          data: { classId: cls.class.id, parentId: parentRec?.id || studentRec.parentId || null }
        })
      }
    } else {
      const user = await db.user.create({
        data: {
          email: s.email,
          password: 'student123',
          name: `${s.firstName} ${s.lastName}`,
          role: 'student',
          phone: s.phone,
          userCode: s.userCode,
          institutionId: inst.id,
          active: true,
        }
      })
      studentRec = await db.student.create({
        data: {
          userId: user.id,
          firstName: s.firstName,
          lastName: s.lastName,
          gender: s.gender,
          dateOfBirth: s.dateOfBirth,
          address: s.address,
          parentPhone: s.phone,
          classId: cls.class.id,
          parentId: parentRec?.id || null,
          status: 'active',
        }
      })
      createdStudents++
    }

    // Grades: 2 per teacher (trimester 1 and 2) — idempotent
    const existingGrades = await db.grade.count({
      where: { studentId: studentRec.id, schoolYear: year }
    })
    if (existingGrades === 0) {
      for (const t of createdTeachers) {
        const subject = subjects.find(sx => sx.name === t.subjectName) || subjects[0]
        for (const trimester of ['1er', '2eme']) {
          await db.grade.create({
            data: {
              studentId: studentRec.id,
              teacherId: t.teacher.id,
              subjectId: subject.id,
              value: randomGrade(8, 19),
              maxValue: 20,
              type: 'controle',
              trimester,
              schoolYear: year,
              date: today.toISOString().slice(0, 10),
            }
          })
        }
      }
    }

    // Payment: 1 per student — idempotent
    const existingPay = await db.payment.count({
      where: { studentId: studentRec.id, schoolYear: year }
    })
    if (existingPay === 0) {
      await db.payment.create({
        data: {
          studentId: studentRec.id,
          amount: 150000 + Math.floor(Math.random() * 100000),
          type: 'tuition',
          method: ['cash', 'mobile_money', 'bank_transfer'][Math.floor(Math.random() * 3)],
          status: Math.random() > 0.2 ? 'completed' : 'pending',
          description: `Frais de scolarité ${year}`,
          schoolYear: year,
          paymentDate: today.toISOString().slice(0, 10),
        }
      })
    }

    // Attendance: present today — idempotent
    const existingAtt = await db.attendance.findFirst({
      where: { studentId: studentRec.id, date: today.toISOString().slice(0, 10) }
    })
    if (!existingAtt) {
      await db.attendance.create({
        data: {
          studentId: studentRec.id,
          date: today.toISOString().slice(0, 10),
          status: 'present',
          schoolYear: year,
        }
      })
    }

    createdStudents++
  }
  console.log(`   ✓ ${createdStudents} élève(s) créé(s) avec notes, paiement et présence`)

  // ---- Schedules: 2 per class per day for 5 days ----
  // Schema: subject (String), dayOfWeek (Int 1=Mon..5=Fri), NO schoolYear
  const dayOffsets = [1, 2, 3, 4, 5]
  let createdSchedules = 0
  for (const cls of createdClasses) {
    const existingSchedCount = await db.schedule.count({ where: { classId: cls.class.id } })
    if (existingSchedCount > 0) continue
    for (const dayOfWeek of dayOffsets) {
      for (let slot = 0; slot < 2; slot++) {
        const teacherIdx = (createdClasses.indexOf(cls) + slot) % createdTeachers.length
        const teacher = createdTeachers[teacherIdx]
        const startHour = 8 + slot * 2
        await db.schedule.create({
          data: {
            classId: cls.class.id,
            teacherId: teacher.teacher.id,
            subject: teacher.subjectName,
            dayOfWeek,
            startTime: `${String(startHour).padStart(2, '0')}:00`,
            endTime: `${String(startHour + 2).padStart(2, '0')}:00`,
            room: cls.class.room || 'Salle 101',
          }
        })
        createdSchedules++
      }
    }
  }
  console.log(`   ✓ ${createdSchedules} créneau(x) d'emploi du temps`)

  // ---- Announcements ----
  // Note: Announcement has NO institutionId field — it's global with authorId
  const adminUser = existingAdmin || (await db.user.findFirst({
    where: { institutionId: inst.id, role: 'admin' },
    select: { id: true }
  }))
  let createdAnnouncements = 0
  for (const a of config.announcements) {
    const exists = await db.announcement.findFirst({
      where: { title: a.title, schoolYear: year, authorId: adminUser?.id }
    })
    if (exists) continue
    await db.announcement.create({
      data: {
        title: a.title,
        content: a.content,
        type: a.type,
        target: a.target,
        priority: a.priority,
        authorId: adminUser?.id || staffUser?.id || createdTeachers[0].user.id,
        schoolYear: year,
      }
    })
    createdAnnouncements++
  }
  console.log(`   ✓ ${createdAnnouncements} annonce(s)`)

  // ---- SchoolConfig (for institution-specific settings) ----
  const existingConfig = await db.schoolConfig.findFirst({ where: { institutionId: inst.id } })
  if (!existingConfig) {
    await db.schoolConfig.create({
      data: {
        schoolName: inst.name,
        address: inst.address || 'Douala, Cameroun',
        phone: inst.phone || '+243 600 000 000',
        email: inst.email,
        currentYear: year,
        institutionId: inst.id,
        institutionPassword: inst.password,
      }
    })
    console.log(`   ✓ SchoolConfig créé`)
  }
}

// -------- Main --------
async function main() {
  console.log('=== Peuplement des institutions incomplètes (2024-2025) ===\n')

  const subjects = await getGlobalSubjects()
  console.log(`Matières globales: ${subjects.map(s => s.name).join(', ')}\n`)

  const institutions = await db.institution.findMany()
  const today = new Date()

  let populated = 0
  for (const inst of institutions) {
    const studentCount = await db.user.count({
      where: { institutionId: inst.id, role: 'student' }
    })
    const classCount = await db.class.count({
      where: { institutionId: inst.id, schoolYear: '2024-2025' }
    })

    if (studentCount < 18 || classCount < 2) {
      console.log(`\n[Peuplement] ${inst.name} (students=${studentCount}, classes=${classCount})`)
      try {
        await populateInstitution(inst, subjects, today)
        populated++
      } catch (e) {
        console.error(`   ✗ Erreur: ${e.message}`)
      }
    } else {
      console.log(`[OK] ${inst.name} (students=${studentCount}, classes=${classCount}) — ignoré`)
    }
  }

  console.log(`\n=== ${populated} institution(s) peuplée(s) ===`)

  // Final summary
  console.log('\n=== RÉCAPITULATIF FINAL ===')
  for (const inst of institutions) {
    const users = await db.user.count({ where: { institutionId: inst.id } })
    const classes = await db.class.count({ where: { institutionId: inst.id, schoolYear: '2024-2025' } })
    const students = await db.user.count({ where: { institutionId: inst.id, role: 'student' } })
    const teachers = await db.user.count({ where: { institutionId: inst.id, role: 'teacher' } })
    const parents = await db.user.count({ where: { institutionId: inst.id, role: 'parent' } })
    console.log(`- ${inst.name}: ${users} users, ${classes} classes, ${students} élèves, ${teachers} enseignants, ${parents} parents`)
  }
}

main()
  .catch((e) => {
    console.error('Erreur fatale:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
