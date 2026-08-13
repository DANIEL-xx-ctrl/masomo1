import { db } from '@/lib/db'

// ============================================================================
// Helpers
// ============================================================================

// Generate a random grade between min and max, rounded to nearest 0.5
function randomGrade(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 2) / 2
}

// Build a clean, RFC-friendly email from a firstName + lastName + domain.
// Strips accents (NFD normalization) and any non-alpha characters.
function buildStudentEmail(firstName: string, lastName: string, domain: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/g, '')
  return `${clean(firstName)}.${clean(lastName)}@${domain}`
}

// ============================================================================
// TypeScript interfaces for the per-institution seed config
// ============================================================================

interface InstitutionInfo {
  name: string
  password: string
  address: string
  phone: string
  email: string
  currentYear: string
}

interface AdminInfo {
  email: string
  password: string
  name: string
  userCode: string
  phone: string
}

interface StaffInfo {
  email: string
  password: string
  name: string
  userCode: string
  phone: string
  firstName: string
  lastName: string
  fonction: string
}

interface ParentInfo {
  email: string
  password: string
  name: string
  userCode: string
  phone: string
  firstName: string
  lastName: string
  address: string
}

interface TeacherInfo {
  firstName: string
  lastName: string
  subject: string
  email: string
  phone: string
  qualification: string
  image: string
  userCode: string
}

interface ClassInfo {
  name: string
  level: string
  section: string
  capacity: number
  room: string
  schoolYear: string
}

interface StudentInfo {
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

interface AnnouncementInfo {
  title: string
  content: string
  type: string
  target: string
  priority: number
}

interface MessageInfo {
  // Either senderTeacherIndex is set (sender = that teacher) or senderRole='admin'
  senderTeacherIndex?: number
  senderRole?: 'admin'
  // Either receiverTeacherIndex is set (receiver = that teacher) or receiverRole='admin'
  receiverTeacherIndex?: number
  receiverRole?: 'admin'
  content: string
}

interface InstitutionSeedConfig {
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

interface SubjectRow {
  id: string
  name: string
  code: string
  coefficient: number
}

// ============================================================================
// Reusable helper that creates ALL per-institution data
// ============================================================================

async function seedInstitutionData(
  config: InstitutionSeedConfig,
  subjects: SubjectRow[],
  today: Date
): Promise<void> {
  // ---- Create the Institution record ----
  const institution = await db.institution.create({
    data: {
      name: config.institution.name,
      password: config.institution.password,
      address: config.institution.address,
      phone: config.institution.phone,
      email: config.institution.email,
      currentYear: config.institution.currentYear,
      active: true,
    },
  })

  // ---- Admin User ----
  const adminUser = await db.user.create({
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
  const teachers: Array<{ id: string; userId: string; firstName: string; lastName: string; subject: string }> = []
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

  // ---- Grades: 3 grades per subject per student (one per trimester), against GLOBAL subjects ----
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

// ============================================================================
// 3 Institution configs
// ============================================================================

const ecoleConfig: InstitutionSeedConfig = {
  institution: {
    name: 'École Internationale EduGest',
    password: 'ecole2024',
    address: 'Douala, Cameroun',
    phone: '+243 334 000 000',
    email: 'contact@edugest.cm',
    currentYear: '2024-2025',
  },
  admin: {
    email: 'admin@ecole.com',
    password: 'admin123',
    name: 'Administrateur Système',
    userCode: 'ADM-001',
    phone: '+243 699 000 000',
  },
  staff: {
    email: 'staff@ecole.com',
    password: 'staff123',
    name: 'Jean-Pierre Essomba',
    userCode: 'STF-001',
    phone: '+243 677 000 000',
    firstName: 'Jean-Pierre',
    lastName: 'Essomba',
    fonction: 'Secrétaire général',
  },
  parent: {
    email: 'parent@ecole.com',
    password: 'parent123',
    name: 'Mariam Keita',
    userCode: 'PAR-001',
    phone: '+243 611 100 001',
    firstName: 'Mariam',
    lastName: 'Keita',
    address: 'Douala, Cameroun',
  },
  teachers: [
    {
      firstName: 'Amadou',
      lastName: 'Diallo',
      subject: 'Mathématiques',
      email: 'amadou.diallo@ecole.com',
      phone: '+243 691 111 111',
      qualification: 'Doctorat en Mathématiques',
      image: '/avatars/amadou-diallo.png',
      userCode: 'TCH-001',
    },
    {
      firstName: 'Aïcha',
      lastName: 'Toure',
      subject: 'Histoire-Géo',
      email: 'aicha.toure@ecole.com',
      phone: '+243 694 444 444',
      qualification: 'Licence en Histoire',
      image: '/avatars/aicha-toure.png',
      userCode: 'TCH-002',
    },
    {
      firstName: 'Kouadio',
      lastName: 'Yao',
      subject: 'SVT',
      email: 'kouadio.yao@ecole.com',
      phone: '+243 695 555 555',
      qualification: 'Master en Biologie',
      image: '/avatars/kouadio-yao.png',
      userCode: 'TCH-003',
    },
    {
      firstName: 'Fatou',
      lastName: 'Ndiaye',
      subject: 'Français',
      email: 'fatou.ndiaye@ecole.com',
      phone: '+243 692 222 222',
      qualification: 'Maîtrise en Lettres Modernes',
      image: '/avatars/fatou-ndiaye.png',
      userCode: 'TCH-004',
    },
    {
      firstName: 'Emmanuel',
      lastName: 'Biya',
      subject: 'Anglais',
      email: 'emmanuel.biya@ecole.com',
      phone: '+243 693 333 333',
      qualification: 'Master en Anglais',
      image: '/avatars/emmanuel-biya.png',
      userCode: 'TCH-005',
    },
  ],
  classes: [
    { name: '6ème A', level: '6ème', section: 'A', capacity: 35, room: 'Salle 101', schoolYear: '2024-2025' },
    { name: '5ème B', level: '5ème', section: 'B', capacity: 30, room: 'Salle 202', schoolYear: '2024-2025' },
    { name: '4ème C', level: '4ème', section: 'C', capacity: 28, room: 'Salle 303', schoolYear: '2024-2025' },
    { name: 'Terminale D', level: 'Terminale', section: 'D', capacity: 25, room: 'Salle 404', schoolYear: '2024-2025' },
  ],
  students: [
    // 6ème A — 6 students
    { firstName: 'Moussa', lastName: 'Keita', gender: 'M', dateOfBirth: '2012-03-15', classIndex: 0, parentContact: 'Mariam Keita', parentPhone: '+243 611 100 001', image: '/avatars/boy-1.png', userCode: 'ELV-001', email: buildStudentEmail('Moussa', 'Keita', 'ecole.com'), phone: '+243 600 000 001' },
    { firstName: 'Adama', lastName: 'Traoré', gender: 'M', dateOfBirth: '2012-05-22', classIndex: 0, parentContact: 'Oumou Traoré', parentPhone: '+243 611 100 002', image: '/avatars/boy-2.png', userCode: 'ELV-002', email: buildStudentEmail('Adama', 'Traoré', 'ecole.com'), phone: '+243 600 000 002' },
    { firstName: 'Aminata', lastName: 'Diarra', gender: 'F', dateOfBirth: '2012-07-10', classIndex: 0, parentContact: 'Seydou Diarra', parentPhone: '+243 611 100 003', image: '/avatars/girl-1.png', userCode: 'ELV-003', email: buildStudentEmail('Aminata', 'Diarra', 'ecole.com'), phone: '+243 600 000 003' },
    { firstName: 'Ibrahim', lastName: 'Sow', gender: 'M', dateOfBirth: '2012-01-30', classIndex: 0, parentContact: 'Aissatou Sow', parentPhone: '+243 611 100 004', image: '/avatars/boy-3.png', userCode: 'ELV-004', email: buildStudentEmail('Ibrahim', 'Sow', 'ecole.com'), phone: '+243 600 000 004' },
    { firstName: 'Fatoumata', lastName: 'Camara', gender: 'F', dateOfBirth: '2012-09-05', classIndex: 0, parentContact: 'Lamine Camara', parentPhone: '+243 611 100 005', image: '/avatars/girl-2.png', userCode: 'ELV-005', email: buildStudentEmail('Fatoumata', 'Camara', 'ecole.com'), phone: '+243 600 000 005' },
    { firstName: 'Ousmane', lastName: 'Barry', gender: 'M', dateOfBirth: '2012-11-18', classIndex: 0, parentContact: 'Kadiatou Barry', parentPhone: '+243 611 100 006', image: '/avatars/boy-4.png', userCode: 'ELV-006', email: buildStudentEmail('Ousmane', 'Barry', 'ecole.com'), phone: '+243 600 000 006' },

    // 5ème B — 5 students
    { firstName: 'Aïssatou', lastName: 'Bah', gender: 'F', dateOfBirth: '2011-04-12', classIndex: 1, parentContact: 'Thierno Bah', parentPhone: '+243 622 200 001', image: '/avatars/girl-3.png', userCode: 'ELV-007', email: buildStudentEmail('Aïssatou', 'Bah', 'ecole.com'), phone: '+243 600 000 007' },
    { firstName: 'Cheikh', lastName: 'Sylla', gender: 'M', dateOfBirth: '2011-06-25', classIndex: 1, parentContact: 'Mariama Sylla', parentPhone: '+243 622 200 002', image: '/avatars/boy-5.png', userCode: 'ELV-008', email: buildStudentEmail('Cheikh', 'Sylla', 'ecole.com'), phone: '+243 600 000 008' },
    { firstName: 'Kadiatou', lastName: 'Koné', gender: 'F', dateOfBirth: '2011-08-03', classIndex: 1, parentContact: 'Bakary Koné', parentPhone: '+243 622 200 003', image: '/avatars/girl-4.png', userCode: 'ELV-009', email: buildStudentEmail('Kadiatou', 'Koné', 'ecole.com'), phone: '+243 600 000 009' },
    { firstName: 'Boubacar', lastName: 'Cissé', gender: 'M', dateOfBirth: '2011-02-14', classIndex: 1, parentContact: 'Fatoumata Cissé', parentPhone: '+243 622 200 004', image: '/avatars/boy-6.png', userCode: 'ELV-010', email: buildStudentEmail('Boubacar', 'Cissé', 'ecole.com'), phone: '+243 600 000 010' },
    { firstName: 'Mariam', lastName: 'Sangaré', gender: 'F', dateOfBirth: '2011-12-01', classIndex: 1, parentContact: 'Sékou Sangaré', parentPhone: '+243 622 200 005', image: '/avatars/girl-5.png', userCode: 'ELV-011', email: buildStudentEmail('Mariam', 'Sangaré', 'ecole.com'), phone: '+243 600 000 011' },

    // 4ème C — 5 students
    { firstName: 'Seydou', lastName: 'Coulibaly', gender: 'M', dateOfBirth: '2010-07-20', classIndex: 2, parentContact: 'Ami Coulibaly', parentPhone: '+243 633 300 001', image: '/avatars/boy-7.png', userCode: 'ELV-012', email: buildStudentEmail('Seydou', 'Coulibaly', 'ecole.com'), phone: '+243 600 000 012' },
    { firstName: 'Oumou', lastName: 'Kanouté', gender: 'F', dateOfBirth: '2010-09-15', classIndex: 2, parentContact: 'Mamadou Kanouté', parentPhone: '+243 633 300 002', image: '/avatars/girl-6.png', userCode: 'ELV-013', email: buildStudentEmail('Oumou', 'Kanouté', 'ecole.com'), phone: '+243 600 000 013' },
    { firstName: 'Modibo', lastName: 'Dembélé', gender: 'M', dateOfBirth: '2010-03-08', classIndex: 2, parentContact: 'Hawa Dembélé', parentPhone: '+243 633 300 003', image: '/avatars/boy-8.png', userCode: 'ELV-014', email: buildStudentEmail('Modibo', 'Dembélé', 'ecole.com'), phone: '+243 600 000 014' },
    { firstName: 'Djénéba', lastName: 'Maïga', gender: 'F', dateOfBirth: '2010-05-30', classIndex: 2, parentContact: 'Abdoulaye Maïga', parentPhone: '+243 633 300 004', image: '/avatars/girl-7.png', userCode: 'ELV-015', email: buildStudentEmail('Djénéba', 'Maïga', 'ecole.com'), phone: '+243 600 000 015' },
    { firstName: 'Abdou', lastName: 'Haidara', gender: 'M', dateOfBirth: '2010-01-22', classIndex: 2, parentContact: 'Zeinabou Haidara', parentPhone: '+243 633 300 005', image: '/avatars/boy-1.png', userCode: 'ELV-016', email: buildStudentEmail('Abdou', 'Haidara', 'ecole.com'), phone: '+243 600 000 016' },

    // Terminale D — 4 students
    { firstName: 'Alassane', lastName: 'Ouattara', gender: 'M', dateOfBirth: '2007-10-05', classIndex: 3, parentContact: 'Awa Ouattara', parentPhone: '+243 644 400 001', image: '/avatars/boy-2.png', userCode: 'ELV-017', email: buildStudentEmail('Alassane', 'Ouattara', 'ecole.com'), phone: '+243 600 000 017' },
    { firstName: 'Aminata', lastName: 'Fofana', gender: 'F', dateOfBirth: '2007-06-18', classIndex: 3, parentContact: 'Moussa Fofana', parentPhone: '+243 644 400 002', image: '/avatars/girl-8.png', userCode: 'ELV-018', email: buildStudentEmail('Aminata', 'Fofana', 'ecole.com'), phone: '+243 600 000 018' },
    { firstName: 'Ibrahima', lastName: 'Touré', gender: 'M', dateOfBirth: '2007-08-25', classIndex: 3, parentContact: 'Assétou Touré', parentPhone: '+243 644 400 003', image: '/avatars/boy-3.png', userCode: 'ELV-019', email: buildStudentEmail('Ibrahima', 'Touré', 'ecole.com'), phone: '+243 600 000 019' },
    { firstName: 'Sitan', lastName: 'Keita', gender: 'F', dateOfBirth: '2007-04-12', classIndex: 3, parentContact: 'Boubacar Keita', parentPhone: '+243 644 400 004', image: '/avatars/girl-1.png', userCode: 'ELV-020', email: buildStudentEmail('Sitan', 'Keita', 'ecole.com'), phone: '+243 600 000 020' },
  ],
  announcements: [
    { title: 'Rentrée scolaire 2024-2025', content: 'Nous avons le plaisir de vous annoncer que la rentrée scolaire aura lieu le 9 septembre 2024. Tous les élèves sont tenus de se présenter à 7h30 avec leur fourniture complète.', type: 'general', target: 'all', priority: 3 },
    { title: 'Examens du 1er trimestre', content: 'Les examens du premier trimestre se dérouleront du 9 au 20 décembre 2024. Les élèves sont invités à réviser régulièrement. Les emplois du temps d\'examen seront affichés une semaine avant.', type: 'academic', target: 'students', priority: 2 },
    { title: 'Réunion parents-professeurs', content: 'Une réunion parents-professeurs est prévue le 25 janvier 2025 de 9h à 16h. La présence de tous les parents est vivement recommandée pour le suivi académique de vos enfants.', type: 'event', target: 'parents', priority: 2 },
    { title: 'Conseil de discipline', content: 'Le conseil de discipline se réunira le 15 février 2025. Tout élève ayant cumulé plus de 5 avertissements sera convoqué.', type: 'urgent', target: 'all', priority: 3 },
    { title: 'Journée sportive', content: 'La journée sportive annuelle aura lieu le 15 mars 2025. Les inscriptions pour les différentes disciplines sont ouvertes auprès du bureau des sports.', type: 'event', target: 'students', priority: 1 },
    { title: 'Formation continue enseignants', content: 'Une formation continue sur les nouvelles méthodes pédagogiques sera organisée les 20-21 février 2025. La participation est obligatoire pour tous les enseignants.', type: 'academic', target: 'teachers', priority: 2 },
  ],
  messages: [
    { senderRole: 'admin', receiverTeacherIndex: 0, content: 'Bonjour M. Diallo, veuillez préparer les sujets d\'examen de mathématiques pour le premier trimestre.' },
    { senderRole: 'admin', receiverTeacherIndex: 3, content: 'Madame Ndiaye, les résultats de la classe de 6ème A sont attendus avant vendredi.' },
    { senderTeacherIndex: 0, receiverRole: 'admin', content: 'Monsieur le Directeur, les sujets sont prêts. Je vous les transmets demain matin.' },
    { senderRole: 'admin', receiverTeacherIndex: 4, content: 'M. Biya, merci de bien vouloir animer la journée portes ouvertes du mois prochain.' },
  ],
}

// ---- Lycée Technique de Douala ----
const lyceeStudents: StudentInfo[] = [
  // 2nde A — 4 students
  { firstName: 'Aristide', lastName: 'Kamga', gender: 'M', dateOfBirth: '2008-04-12', classIndex: 0, parentContact: 'Paul Mbarga', parentPhone: '+243 611 200 001', image: '/avatars/boy-1.png', userCode: 'ELV-201', email: 'aristide.kamga@lycee.com', phone: '+243 600 200 001' },
  { firstName: 'Brigitte', lastName: 'Ekambi', gender: 'F', dateOfBirth: '2008-06-25', classIndex: 0, parentContact: 'Solange Ekambi', parentPhone: '+243 611 200 002', image: '/avatars/girl-1.png', userCode: 'ELV-202', email: buildStudentEmail('Brigitte', 'Ekambi', 'lycee.com'), phone: '+243 600 200 002' },
  { firstName: 'Christian', lastName: 'Talla', gender: 'M', dateOfBirth: '2008-09-30', classIndex: 0, parentContact: 'Albert Talla', parentPhone: '+243 611 200 003', image: '/avatars/boy-2.png', userCode: 'ELV-203', email: buildStudentEmail('Christian', 'Talla', 'lycee.com'), phone: '+243 600 200 003' },
  { firstName: 'Diane', lastName: 'Ndongo', gender: 'F', dateOfBirth: '2008-11-15', classIndex: 0, parentContact: 'Marguerite Ndongo', parentPhone: '+243 611 200 004', image: '/avatars/girl-2.png', userCode: 'ELV-204', email: buildStudentEmail('Diane', 'Ndongo', 'lycee.com'), phone: '+243 600 200 004' },

  // 1ère D — 4 students
  { firstName: 'Éric', lastName: 'Mfoudi', gender: 'M', dateOfBirth: '2007-02-18', classIndex: 1, parentContact: 'Jean Mfoudi', parentPhone: '+243 622 300 001', image: '/avatars/boy-3.png', userCode: 'ELV-205', email: buildStudentEmail('Éric', 'Mfoudi', 'lycee.com'), phone: '+243 600 200 005' },
  { firstName: 'Fabienne', lastName: 'Beyala', gender: 'F', dateOfBirth: '2007-05-22', classIndex: 1, parentContact: 'Christine Beyala', parentPhone: '+243 622 300 002', image: '/avatars/girl-3.png', userCode: 'ELV-206', email: buildStudentEmail('Fabienne', 'Beyala', 'lycee.com'), phone: '+243 600 200 006' },
  { firstName: 'Gilbert', lastName: 'Etoa', gender: 'M', dateOfBirth: '2007-08-10', classIndex: 1, parentContact: 'Pierre Etoa', parentPhone: '+243 622 300 003', image: '/avatars/boy-4.png', userCode: 'ELV-207', email: buildStudentEmail('Gilbert', 'Etoa', 'lycee.com'), phone: '+243 600 200 007' },
  { firstName: 'Hélène', lastName: 'Fotso', gender: 'F', dateOfBirth: '2007-10-03', classIndex: 1, parentContact: 'André Fotso', parentPhone: '+243 622 300 004', image: '/avatars/girl-4.png', userCode: 'ELV-208', email: buildStudentEmail('Hélène', 'Fotso', 'lycee.com'), phone: '+243 600 200 008' },

  // Terminale C — 4 students
  { firstName: 'Ivan', lastName: 'Ngono', gender: 'M', dateOfBirth: '2006-03-14', classIndex: 2, parentContact: 'Théodore Ngono', parentPhone: '+243 633 400 001', image: '/avatars/boy-5.png', userCode: 'ELV-209', email: buildStudentEmail('Ivan', 'Ngono', 'lycee.com'), phone: '+243 600 200 009' },
  { firstName: 'Julie', lastName: 'Nyobe', gender: 'F', dateOfBirth: '2006-06-20', classIndex: 2, parentContact: 'Suzanne Nyobe', parentPhone: '+243 633 400 002', image: '/avatars/girl-5.png', userCode: 'ELV-210', email: buildStudentEmail('Julie', 'Nyobe', 'lycee.com'), phone: '+243 600 200 010' },
  { firstName: 'Kevin', lastName: 'Simeu', gender: 'M', dateOfBirth: '2006-09-08', classIndex: 2, parentContact: 'Marc Simeu', parentPhone: '+243 633 400 003', image: '/avatars/boy-6.png', userCode: 'ELV-211', email: buildStudentEmail('Kevin', 'Simeu', 'lycee.com'), phone: '+243 600 200 011' },
  { firstName: 'Laura', lastName: 'Zang', gender: 'F', dateOfBirth: '2006-12-12', classIndex: 2, parentContact: 'Bernard Zang', parentPhone: '+243 633 400 004', image: '/avatars/girl-6.png', userCode: 'ELV-212', email: buildStudentEmail('Laura', 'Zang', 'lycee.com'), phone: '+243 600 200 012' },
]

const lyceeConfig: InstitutionSeedConfig = {
  institution: {
    name: 'Lycée Technique de Douala',
    password: 'lycee2024',
    address: 'Akwa, Douala, Cameroun',
    phone: '+243 334 222 222',
    email: 'contact@lyceedouala.cm',
    currentYear: '2024-2025',
  },
  admin: {
    email: 'admin2@lycee.com',
    password: 'admin123',
    name: 'Directeur Lycée Technique',
    userCode: 'ADM-101',
    phone: '+243 699 222 222',
  },
  staff: {
    email: 'staff2@lycee.com',
    password: 'staff123',
    name: 'Marie Tchoumi',
    userCode: 'STF-101',
    phone: '+243 677 222 222',
    firstName: 'Marie',
    lastName: 'Tchoumi',
    fonction: 'Surveillante générale',
  },
  parent: {
    email: 'parent2@lycee.com',
    password: 'parent123',
    name: 'Paul Mbarga',
    userCode: 'PAR-101',
    phone: '+243 611 200 001',
    firstName: 'Paul',
    lastName: 'Mbarga',
    address: 'Akwa, Douala, Cameroun',
  },
  teachers: [
    {
      firstName: 'Joseph',
      lastName: 'Kamga',
      subject: 'Mathématiques',
      email: 'joseph.kamga@lycee.com',
      phone: '+243 691 222 001',
      qualification: 'Master en Mathématiques Appliquées',
      image: '/avatars/teacher-male-1.png',
      userCode: 'TCH-101',
    },
    {
      firstName: 'Bernadette',
      lastName: 'Eyenga',
      subject: 'Français',
      email: 'bernadette.eyenga@lycee.com',
      phone: '+243 691 222 002',
      qualification: 'Doctorat en Lettres Modernes',
      image: '/avatars/teacher-female-1.png',
      userCode: 'TCH-102',
    },
    {
      firstName: 'Robert',
      lastName: 'Atangana',
      subject: 'Physique-Chimie',
      email: 'robert.atangana@lycee.com',
      phone: '+243 691 222 003',
      qualification: 'Ingénieur Génie Électrique',
      image: '/avatars/teacher-male-2.png',
      userCode: 'TCH-103',
    },
    {
      firstName: 'Christine',
      lastName: 'Nkomo',
      subject: 'Anglais',
      email: 'christine.nkomo@lycee.com',
      phone: '+243 691 222 004',
      qualification: 'Master en Anglais',
      image: '/avatars/teacher-female-2.png',
      userCode: 'TCH-104',
    },
  ],
  classes: [
    { name: '2nde A', level: '2nde', section: 'A', capacity: 40, room: 'Salle A101', schoolYear: '2024-2025' },
    { name: '1ère D', level: '1ère', section: 'D', capacity: 35, room: 'Salle A102', schoolYear: '2024-2025' },
    { name: 'Terminale C', level: 'Terminale', section: 'C', capacity: 30, room: 'Salle A103', schoolYear: '2024-2025' },
  ],
  students: lyceeStudents,
  announcements: [
    { title: 'Rentrée Lycée Technique 2024-2025', content: 'La rentrée académique du Lycée Technique de Douala est fixée au 9 septembre 2024. Les élèves des classes de 2nde, 1ère et Terminale sont convoqués à 7h30 devant l\'amphi principal pour la cérémonie de rentrée.', type: 'general', target: 'all', priority: 3 },
    { title: 'Travaux pratiques obligatoires', content: 'Les travaux pratiques de Physique-Chimie sont obligatoires pour toutes les classes. Les élèves doivent se munir de leurs blouses et blazers pour chaque séance.', type: 'academic', target: 'students', priority: 2 },
  ],
  messages: [
    { senderRole: 'admin', receiverTeacherIndex: 0, content: 'Monsieur Kamga, veuillez préparer le programme de mathématiques pour les classes de Terminale C.' },
    { senderRole: 'admin', receiverTeacherIndex: 2, content: 'Monsieur Atangana, merci de finaliser les fiches de travaux pratiques pour le premier semestre.' },
  ],
}

// ---- Institut Polytechnique de Yaoundé ----
const polytechStudents: StudentInfo[] = [
  // Licence 1 GI — 4 students
  { firstName: 'Alain', lastName: 'Ekambi', gender: 'M', dateOfBirth: '2005-03-12', classIndex: 0, parentContact: 'Thérèse Ekambi', parentPhone: '+243 611 300 001', image: '/avatars/boy-1.png', userCode: 'ELV-301', email: buildStudentEmail('Alain', 'Ekambi', 'polytech.com'), phone: '+243 600 300 001' },
  { firstName: 'Brigitte', lastName: 'Abena', gender: 'F', dateOfBirth: '2005-05-25', classIndex: 0, parentContact: 'Joseph Abena', parentPhone: '+243 611 300 002', image: '/avatars/girl-1.png', userCode: 'ELV-302', email: buildStudentEmail('Brigitte', 'Abena', 'polytech.com'), phone: '+243 600 300 002' },
  { firstName: 'Charles', lastName: 'Talla', gender: 'M', dateOfBirth: '2005-07-30', classIndex: 0, parentContact: 'Marie Talla', parentPhone: '+243 611 300 003', image: '/avatars/boy-2.png', userCode: 'ELV-303', email: buildStudentEmail('Charles', 'Talla', 'polytech.com'), phone: '+243 600 300 003' },
  { firstName: 'Diane', lastName: 'Ndongo', gender: 'F', dateOfBirth: '2005-10-15', classIndex: 0, parentContact: 'Pierre Ndongo', parentPhone: '+243 611 300 004', image: '/avatars/girl-2.png', userCode: 'ELV-304', email: buildStudentEmail('Diane', 'Ndongo', 'polytech.com'), phone: '+243 600 300 004' },

  // Licence 2 GI — 4 students
  { firstName: 'Éric', lastName: 'Mfoudi', gender: 'M', dateOfBirth: '2004-01-18', classIndex: 1, parentContact: 'Suzanne Mfoudi', parentPhone: '+243 622 400 001', image: '/avatars/boy-3.png', userCode: 'ELV-305', email: buildStudentEmail('Éric', 'Mfoudi', 'polytech.com'), phone: '+243 600 300 005' },
  { firstName: 'Fabienne', lastName: 'Atangana', gender: 'F', dateOfBirth: '2004-04-22', classIndex: 1, parentContact: 'Jean Atangana', parentPhone: '+243 622 400 002', image: '/avatars/girl-3.png', userCode: 'ELV-306', email: buildStudentEmail('Fabienne', 'Atangana', 'polytech.com'), phone: '+243 600 300 006' },
  { firstName: 'Gervais', lastName: 'Beyala', gender: 'M', dateOfBirth: '2004-06-10', classIndex: 1, parentContact: 'Annie Beyala', parentPhone: '+243 622 400 003', image: '/avatars/boy-4.png', userCode: 'ELV-307', email: buildStudentEmail('Gervais', 'Beyala', 'polytech.com'), phone: '+243 600 300 007' },
  { firstName: 'Hélène', lastName: 'Etoa', gender: 'F', dateOfBirth: '2004-08-03', classIndex: 1, parentContact: 'Luc Etoa', parentPhone: '+243 622 400 004', image: '/avatars/girl-4.png', userCode: 'ELV-308', email: buildStudentEmail('Hélène', 'Etoa', 'polytech.com'), phone: '+243 600 300 008' },

  // Licence 1 GE — 4 students
  { firstName: 'Inès', lastName: 'Fotso', gender: 'F', dateOfBirth: '2005-02-14', classIndex: 2, parentContact: 'Robert Fotso', parentPhone: '+243 633 500 001', image: '/avatars/girl-5.png', userCode: 'ELV-309', email: buildStudentEmail('Inès', 'Fotso', 'polytech.com'), phone: '+243 600 300 009' },
  { firstName: 'Joël', lastName: 'Kamga', gender: 'M', dateOfBirth: '2005-04-20', classIndex: 2, parentContact: 'Solange Kamga', parentPhone: '+243 633 500 002', image: '/avatars/boy-5.png', userCode: 'ELV-310', email: buildStudentEmail('Joël', 'Kamga', 'polytech.com'), phone: '+243 600 300 010' },
  { firstName: 'Karine', lastName: 'Mbarga', gender: 'F', dateOfBirth: '2005-06-08', classIndex: 2, parentContact: 'Théodore Mbarga', parentPhone: '+243 633 500 003', image: '/avatars/girl-6.png', userCode: 'ELV-311', email: buildStudentEmail('Karine', 'Mbarga', 'polytech.com'), phone: '+243 600 300 011' },
  { firstName: 'Landry', lastName: 'Ngono', gender: 'M', dateOfBirth: '2005-09-12', classIndex: 2, parentContact: 'Esther Ngono', parentPhone: '+243 633 500 004', image: '/avatars/boy-6.png', userCode: 'ELV-312', email: buildStudentEmail('Landry', 'Ngono', 'polytech.com'), phone: '+243 600 300 012' },

  // Licence 2 GE — 4 students
  { firstName: 'Marlyse', lastName: 'Nyobe', gender: 'F', dateOfBirth: '2004-03-15', classIndex: 3, parentContact: 'Béatrice Nyobe', parentPhone: '+243 644 600 001', image: '/avatars/girl-7.png', userCode: 'ELV-313', email: buildStudentEmail('Marlyse', 'Nyobe', 'polytech.com'), phone: '+243 600 300 013' },
  { firstName: 'Norbert', lastName: 'Simeu', gender: 'M', dateOfBirth: '2004-05-28', classIndex: 3, parentContact: 'Albert Simeu', parentPhone: '+243 644 600 002', image: '/avatars/boy-7.png', userCode: 'ELV-314', email: buildStudentEmail('Norbert', 'Simeu', 'polytech.com'), phone: '+243 600 300 014' },
  { firstName: 'Odile', lastName: 'Tchoumi', gender: 'F', dateOfBirth: '2004-08-11', classIndex: 3, parentContact: 'Henri Tchoumi', parentPhone: '+243 644 600 003', image: '/avatars/girl-8.png', userCode: 'ELV-315', email: buildStudentEmail('Odile', 'Tchoumi', 'polytech.com'), phone: '+243 600 300 015' },
  { firstName: 'Patrick', lastName: 'Zang', gender: 'M', dateOfBirth: '2004-12-04', classIndex: 3, parentContact: 'Catherine Zang', parentPhone: '+243 644 600 004', image: '/avatars/boy-8.png', userCode: 'ELV-316', email: buildStudentEmail('Patrick', 'Zang', 'polytech.com'), phone: '+243 600 300 016' },
]

const polytechConfig: InstitutionSeedConfig = {
  institution: {
    name: 'Institut Polytechnique de Yaoundé',
    password: 'polytech2024',
    address: 'Ngoa-Ekélé, Yaoundé, Cameroun',
    phone: '+243 222 23 34 55',
    email: 'contact@polytech-yaounde.cm',
    currentYear: '2024-2025',
  },
  admin: {
    email: 'admin3@polytech.com',
    password: 'admin123',
    name: 'Directeur Institut Polytechnique',
    userCode: 'ADM-201',
    phone: '+243 699 333 333',
  },
  staff: {
    email: 'staff3@polytech.com',
    password: 'staff123',
    name: 'Robert Mbarga',
    userCode: 'STF-201',
    phone: '+243 677 333 333',
    firstName: 'Robert',
    lastName: 'Mbarga',
    fonction: 'Comptable principal',
  },
  parent: {
    email: 'parent3@polytech.com',
    password: 'parent123',
    name: 'Thérèse Ekambi',
    userCode: 'PAR-201',
    phone: '+243 611 300 001',
    firstName: 'Thérèse',
    lastName: 'Ekambi',
    address: 'Ngoa-Ekélé, Yaoundé, Cameroun',
  },
  teachers: [
    {
      firstName: 'Pierre',
      lastName: 'Ekambi',
      subject: 'Mathématiques',
      email: 'pierre.ekambi@polytech.com',
      phone: '+243 691 333 001',
      qualification: 'Master en Mathématiques Appliquées',
      image: '/avatars/teacher-male-1.png',
      userCode: 'TCH-201',
    },
    {
      firstName: 'Jeanne',
      lastName: 'Abena',
      subject: 'Physique-Chimie',
      email: 'jeanne.abena@polytech.com',
      phone: '+243 691 333 002',
      qualification: 'Doctorat en Physique',
      image: '/avatars/teacher-female-1.png',
      userCode: 'TCH-202',
    },
    {
      firstName: 'Marc',
      lastName: 'Talla',
      subject: 'Anglais',
      email: 'marc.talla@polytech.com',
      phone: '+243 691 333 003',
      qualification: 'Master en Anglais',
      image: '/avatars/teacher-male-2.png',
      userCode: 'TCH-203',
    },
    {
      firstName: 'Sophie',
      lastName: 'Ndongo',
      subject: 'SVT',
      email: 'sophie.ndongo@polytech.com',
      phone: '+243 691 333 004',
      qualification: 'Master en Biologie',
      image: '/avatars/teacher-female-2.png',
      userCode: 'TCH-204',
    },
  ],
  classes: [
    { name: 'Licence 1 GI', level: 'Licence 1', section: 'GI', capacity: 40, room: 'Salle A101', schoolYear: '2024-2025' },
    { name: 'Licence 2 GI', level: 'Licence 2', section: 'GI', capacity: 35, room: 'Salle A102', schoolYear: '2024-2025' },
    { name: 'Licence 1 GE', level: 'Licence 1', section: 'GE', capacity: 40, room: 'Salle B201', schoolYear: '2024-2025' },
    { name: 'Licence 2 GE', level: 'Licence 2', section: 'GE', capacity: 35, room: 'Salle B202', schoolYear: '2024-2025' },
  ],
  students: polytechStudents,
  announcements: [
    {
      title: 'Rentrée Polytechnique 2024-2025',
      content: 'La rentrée académique de l\'Institut Polytechnique de Yaoundé est fixée au 15 septembre 2024. Les étudiants sont convoqués à 8h00 dans la grande salle pour la cérémonie de rentrée.',
      type: 'general',
      target: 'all',
      priority: 3,
    },
    {
      title: 'Examens du 1er semestre',
      content: 'Les examens du premier semestre se dérouleront du 10 au 20 janvier 2025. Les emplois du temps d\'examen seront affichés au secrétariat.',
      type: 'academic',
      target: 'all',
      priority: 2,
    },
  ],
  messages: [
    {
      senderRole: 'admin',
      receiverTeacherIndex: 0,
      content: 'Monsieur Ekambi, veuillez préparer les énoncés de mathématiques pour le premier semestre.',
    },
    {
      senderRole: 'admin',
      receiverTeacherIndex: 1,
      content: 'Madame Abena, merci de finaliser les sujets de physique pour les examens.',
    },
  ],
}

// ============================================================================
// Main seed runner — called by /api/seed AND by instrumentation auto-seed
// ============================================================================

export async function runSeed() {
  try {
    // ---- DELETE all existing data in correct order (respect foreign keys) ----
    await db.bulletin.deleteMany()
    await db.attendance.deleteMany()
    await db.message.deleteMany()
    await db.announcement.deleteMany()
    await db.notification.deleteMany()
    await db.homeworkSubmission.deleteMany()
    await db.homework.deleteMany()
    await db.payment.deleteMany()
    await db.grade.deleteMany()
    await db.schedule.deleteMany()
    await db.eventClass.deleteMany()
    await db.schoolEvent.deleteMany()
    await db.classTeacher.deleteMany()
    await db.student.deleteMany()
    await db.teacher.deleteMany()
    await db.parent.deleteMany()
    await db.staff.deleteMany()
    await db.subject.deleteMany()
    await db.class.deleteMany()
    await db.schoolConfig.deleteMany()
    await db.userSession.deleteMany()
    await db.user.deleteMany()
    await db.mediaFile.deleteMany()
    await db.institution.deleteMany()
    await db.superAdmin.deleteMany()

    // ---- Create SuperAdmin (once) ----
    await db.superAdmin.create({
      data: {
        name: 'Super Administrateur',
        email: 'superadmin@edugest.com',
        password: 'super123',
        active: true,
      },
    })

    // ---- Create GLOBAL subjects (once, shared by all 3 institutions) ----
    const subjectsData = [
      { name: 'Mathématiques', code: 'MATH', coefficient: 4 },
      { name: 'Français', code: 'FR', coefficient: 4 },
      { name: 'Anglais', code: 'ANG', coefficient: 3 },
      { name: 'Histoire-Géo', code: 'HG', coefficient: 3 },
      { name: 'SVT', code: 'SVT', coefficient: 3 },
      { name: 'Physique-Chimie', code: 'PC', coefficient: 3 },
    ]
    const subjects: SubjectRow[] = []
    for (const s of subjectsData) {
      const subject = await db.subject.create({ data: s })
      subjects.push({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        coefficient: subject.coefficient,
      })
    }

    const today = new Date()

    // ---- Seed the 3 institutions ----
    await seedInstitutionData(ecoleConfig, subjects, today)
    await seedInstitutionData(lyceeConfig, subjects, today)
    await seedInstitutionData(polytechConfig, subjects, today)

    // ---- Stats ----
    const stats = {
      users: await db.user.count(),
      students: await db.student.count(),
      teachers: await db.teacher.count(),
      classes: await db.class.count(),
      subjects: await db.subject.count(),
      grades: await db.grade.count(),
      schedules: await db.schedule.count(),
      payments: await db.payment.count(),
      attendance: await db.attendance.count(),
      announcements: await db.announcement.count(),
      messages: await db.message.count(),
      institutions: await db.institution.count(),
    }

    return {
      message: 'Base de données peuplée avec succès avec 3 institutions',
      stats,
    }
  } catch (error) {
    console.error('Seed error:', error)
    throw error
  }
}
