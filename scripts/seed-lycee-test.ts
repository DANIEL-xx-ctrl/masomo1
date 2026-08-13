import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EDUGEST_ID = 'cmquuqwhg0001nhvhvvqj45pp'

async function main() {
  // Idempotency: skip if Lycée Test already exists
  const existing = await prisma.institution.findUnique({ where: { password: 'lycee2024' } })
  if (existing) {
    console.log('Lycée Test already exists, skipping seed.')
    return
  }

  console.log('Creating Lycée Test institution...')
  const institution = await prisma.institution.create({
    data: {
      name: 'Lycée Test',
      password: 'lycee2024',
      address: 'Dakar, Sénégal',
      phone: '+221 33 825 00 00',
      email: 'contact@lycee-test.sn',
      currentYear: '2024-2025',
      active: true,
    },
  })
  const instId = institution.id
  console.log('Institution created:', instId)

  // ---------- Admin ----------
  const adminUser = await prisma.user.create({
    data: {
      email: 'directeur@lycee-test.sn',
      password: 'lycee2024',
      name: 'Directeur Lycée Test',
      role: 'admin',
      institutionId: instId,
      active: true,
    },
  })
  console.log('Admin created:', adminUser.email)

  // ---------- Teachers (6, distinct subjects) ----------
  const teacherData = [
    { firstName: 'Ndèye Fatou', lastName: 'Sow', email: 'nfatou.sow@lycee-test.sn', subject: 'Mathématiques', phone: '+221 77 123 45 01' },
    { firstName: 'Mamadou', lastName: 'Diop', email: 'mamadou.diop@lycee-test.sn', subject: 'Physique-Chimie', phone: '+221 77 123 45 02' },
    { firstName: 'Awa', lastName: 'Diallo', email: 'awa.diallo@lycee-test.sn', subject: 'Français', phone: '+221 77 123 45 03' },
    { firstName: 'Cheikh', lastName: 'Fall', email: 'cheikh.fall@lycee-test.sn', subject: 'Histoire-Géo', phone: '+221 77 123 45 04' },
    { firstName: 'Aminata', lastName: 'Guèye', email: 'aminata.gueye@lycee-test.sn', subject: 'Anglais', phone: '+221 77 123 45 05' },
    { firstName: 'Ousmane', lastName: 'Bâ', email: 'ousmane.ba@lycee-test.sn', subject: 'SVT', phone: '+221 77 123 45 06' },
  ]
  const teachers = []
  for (const t of teacherData) {
    const u = await prisma.user.create({
      data: {
        email: t.email,
        password: 'prof2024',
        name: `${t.firstName} ${t.lastName}`,
        role: 'teacher',
        phone: t.phone,
        institutionId: instId,
        active: true,
      },
    })
    const teacher = await prisma.teacher.create({
      data: {
        userId: u.id,
        firstName: t.firstName,
        lastName: t.lastName,
        subject: t.subject,
        phone: t.phone,
        qualification: 'Licence en ' + t.subject,
        hireDate: '2022-09-15',
      },
    })
    teachers.push(teacher)
  }
  console.log('Teachers created:', teachers.length)

  // ---------- Classes (Lycée levels, distinct from EduGest) ----------
  const classData = [
    { name: 'Seconde A', level: 'Seconde', section: 'A', capacity: 40, room: 'S101' },
    { name: 'Première C', level: 'Première', section: 'C', capacity: 35, room: 'S201' },
    { name: 'Terminale S', level: 'Terminale', section: 'S', capacity: 30, room: 'S301' },
    { name: 'Terminale L', level: 'Terminale', section: 'L', capacity: 25, room: 'S302' },
  ]
  const classes = []
  for (const c of classData) {
    const cls = await prisma.class.create({
      data: {
        name: c.name,
        level: c.level,
        section: c.section,
        capacity: c.capacity,
        room: c.room,
        schoolYear: '2024-2025',
        institutionId: instId,
      },
    })
    classes.push(cls)
  }
  console.log('Classes created:', classes.length)

  // Assign teachers to classes (ClassTeacher)
  const subjectByTeacher = teachers.map(t => ({ id: t.id, subject: t.subject }))
  for (const cls of classes) {
    for (const t of subjectByTeacher) {
      await prisma.classTeacher.create({
        data: { classId: cls.id, teacherId: t.id, subject: t.subject },
      })
    }
  }
  console.log('Class-teacher links created')

  // ---------- Students (19, distinct Senegalese names) ----------
  const studentData = [
    { firstName: 'Moussa', lastName: 'Niang', gender: 'M', class: 'Terminale S' },
    { firstName: 'Fatima', lastName: 'Sarr', gender: 'F', class: 'Terminale S' },
    { firstName: 'Pape', lastName: 'Diouf', gender: 'M', class: 'Terminale S' },
    { firstName: 'Khady', lastName: 'Mbaye', gender: 'F', class: 'Terminale S' },
    { firstName: 'Serigne', lastName: 'Faye', gender: 'M', class: 'Première C' },
    { firstName: 'Awa', lastName: 'Sy', gender: 'F', class: 'Première C' },
    { firstName: 'Babacar', lastName: 'Sène', gender: 'M', class: 'Première C' },
    { firstName: 'Mariama', lastName: 'Cissé', gender: 'F', class: 'Première C' },
    { firstName: 'Cheikh', lastName: 'Diagne', gender: 'M', class: 'Première C' },
    { firstName: 'Sokhna', lastName: 'Wade', gender: 'F', class: 'Seconde A' },
    { firstName: 'Assane', lastName: 'Kâ', gender: 'M', class: 'Seconde A' },
    { firstName: 'Aminata', lastName: 'Touré', gender: 'F', class: 'Seconde A' },
    { firstName: 'Omar', lastName: 'Ba', gender: 'M', class: 'Seconde A' },
    { firstName: 'Astou', lastName: 'Gueye', gender: 'F', class: 'Seconde A' },
    { firstName: 'Modou', lastName: 'Diallo', gender: 'M', class: 'Seconde A' },
    { firstName: 'Coumba', lastName: 'Lo', gender: 'F', class: 'Terminale L' },
    { firstName: 'Ibrahima', lastName: 'Sarr', gender: 'M', class: 'Terminale L' },
    { firstName: 'Ndèye', lastName: 'Diop', gender: 'F', class: 'Terminale L' },
    { firstName: 'Lamine', lastName: 'Camara', gender: 'M', class: 'Terminale L' },
  ]
  const students = []
  for (let i = 0; i < studentData.length; i++) {
    const s = studentData[i]
    const cls = classes.find(c => c.name === s.class)!
    const email = `${s.firstName.toLowerCase().replace(/[èé]/g,'e')}.${s.lastName.toLowerCase().replace(/[èé]/g,'e')}@lycee-test.sn`
    const u = await prisma.user.create({
      data: {
        email,
        password: 'eleve2024',
        name: `${s.firstName} ${s.lastName}`,
        role: 'student',
        institutionId: instId,
        active: true,
      },
    })
    const student = await prisma.student.create({
      data: {
        userId: u.id,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: `200${i % 8}-0${(i % 9) + 1}-1${i % 9}`,
        gender: s.gender,
        address: 'Dakar, Sénégal',
        enrollmentDate: '2024-09-01',
        parentContact: 'Parent ' + s.lastName,
        parentPhone: '+221 76 000 ' + String(1000 + i).padStart(4, '0'),
        classId: cls.id,
      },
    })
    students.push(student)
  }
  console.log('Students created:', students.length)

  // ---------- Parent ----------
  const parentUser = await prisma.user.create({
    data: {
      email: 'parent@lycee-test.sn',
      password: 'parent2024',
      name: 'Aïssatou Mbaye',
      role: 'parent',
      institutionId: instId,
      active: true,
    },
  })
  const parent = await prisma.parent.create({
    data: {
      userId: parentUser.id,
      firstName: 'Aïssatou',
      lastName: 'Mbaye',
      phone: '+221 76 333 22 11',
      address: 'Dakar, Sénégal',
    },
  })
  // Link parent to first 2 students
  await prisma.student.updateMany({ where: { id: { in: [students[0].id, students[1].id] } }, data: { parentId: parent.id } })
  console.log('Parent created')

  // ---------- Staff ----------
  const staffUser = await prisma.user.create({
    data: {
      email: 'surveillant@lycee-test.sn',
      password: 'staff2024',
      name: 'Ibrahima Ndiaye',
      role: 'staff',
      institutionId: instId,
      active: true,
    },
  })
  await prisma.staff.create({
    data: {
      userId: staffUser.id,
      firstName: 'Ibrahima',
      lastName: 'Ndiaye',
      fonction: 'Surveillant général',
      phone: '+221 77 555 44 33',
      email: 'surveillant@lycee-test.sn',
    },
  })
  console.log('Staff created')

  // ---------- Subjects (ensure exist) ----------
  const subjectCodes = [
    { name: 'Mathématiques', code: 'MATH', coefficient: 4 },
    { name: 'Physique-Chimie', code: 'PC', coefficient: 3 },
    { name: 'Français', code: 'FR', coefficient: 4 },
    { name: 'Histoire-Géo', code: 'HG', coefficient: 3 },
    { name: 'Anglais', code: 'ANG', coefficient: 3 },
    { name: 'SVT', code: 'SVT', coefficient: 3 },
  ]
  const subjects = []
  for (const s of subjectCodes) {
    const sub = await prisma.subject.upsert({ where: { code: s.code }, update: {}, create: s })
    subjects.push(sub)
  }

  // ---------- Grades ----------
  let gradeCount = 0
  const trimesters = ['1er', '2eme', '3eme']
  const gradeTypes = ['devoir', 'examen', 'controle']
  for (const student of students) {
    for (const subject of subjects) {
      for (const tri of trimesters) {
        for (const type of gradeTypes) {
          const value = Math.round((8 + Math.random() * 11) * 10) / 10 // 8 to 19
          await prisma.grade.create({
            data: {
              studentId: student.id,
              subjectId: subject.id,
              classId: student.classId,
              value,
              maxValue: 20,
              type,
              trimester: tri,
              schoolYear: '2024-2025',
              date: '2024-11-15',
            },
          })
          gradeCount++
        }
      }
    }
  }
  console.log('Grades created:', gradeCount)

  // ---------- Payments (USD amounts) ----------
  const paymentTypes = ['tuition', 'registration', 'exam_fee', 'other']
  const methods = ['cash', 'mobile_money', 'bank_transfer']
  const statuses = ['completed', 'pending']
  let paymentCount = 0
  for (const student of students) {
    const numPayments = 2 + Math.floor(Math.random() * 2) // 2-3 payments
    for (let i = 0; i < numPayments; i++) {
      const amount = Math.floor(30000 + Math.random() * 120000) // 30k-150k USD
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      await prisma.payment.create({
        data: {
          studentId: student.id,
          amount,
          type: paymentTypes[i % paymentTypes.length],
          method: methods[Math.floor(Math.random() * methods.length)],
          status,
          reference: 'WAVE-LYCEE-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          description: 'Frais ' + paymentTypes[i % paymentTypes.length],
          schoolYear: '2024-2025',
          paymentDate: status === 'completed' ? '2024-10-15' : null,
        },
      })
      paymentCount++
    }
  }
  console.log('Payments created:', paymentCount)

  // ---------- Attendance ----------
  const attStatuses = ['present', 'absent', 'late', 'excused']
  const attWeights = [0.7, 0.12, 0.1, 0.08]
  let attCount = 0
  for (const student of students) {
    const numDays = 5 + Math.floor(Math.random() * 3)
    for (let d = 0; d < numDays; d++) {
      const r = Math.random()
      let status = 'present'
      let acc = 0
      for (let j = 0; j < attStatuses.length; j++) {
        acc += attWeights[j]
        if (r <= acc) { status = attStatuses[j]; break }
      }
      await prisma.attendance.create({
        data: {
          studentId: student.id,
          date: `2024-11-${String(1 + d).padStart(2, '0')}`,
          status,
          comment: status === 'absent' ? 'Absence non justifiée' : null,
        },
      })
      attCount++
    }
  }
  console.log('Attendance records created:', attCount)

  // ---------- Schedules ----------
  const days = [1, 2, 3, 4, 5]
  const timeSlots = [
    { start: '08:00', end: '10:00' },
    { start: '10:15', end: '12:15' },
    { start: '15:00', end: '17:00' },
  ]
  let schedCount = 0
  for (const cls of classes) {
    for (const day of days) {
      for (const slot of timeSlots) {
        const teacher = teachers[schedCount % teachers.length]
        await prisma.schedule.create({
          data: {
            classId: cls.id,
            teacherId: teacher.id,
            subject: teacher.subject,
            dayOfWeek: day,
            startTime: slot.start,
            endTime: slot.end,
            room: cls.room,
          },
        })
        schedCount++
      }
    }
  }
  console.log('Schedules created:', schedCount)

  // ---------- Announcements (distinct, Lycée-specific) ----------
  const announcementData = [
    { title: 'Rentrée scolaire 2024-2025', content: 'La rentrée scolaire est fixée au 1er octobre 2024. Tous les élèves doivent se présenter à 8h00.', type: 'academic', target: 'students' },
    { title: 'Examens du 1er trimestre', content: 'Les examens du premier trimestre se dérouleront du 9 au 20 décembre 2024. Les emplois du temps seront affichés une semaine avant.', type: 'academic', target: 'students' },
    { title: 'Réunion de l\'APE', content: 'L\'Association des Parents d\'Élèves se réunira le 25 janvier 2025 à 16h dans la salle de conférence.', type: 'event', target: 'parents' },
    { title: 'Conseil de discipline', content: 'Le conseil de discipline se réunira le 15 février 2025. Les élèves ayant reçu plus de 3 avertissements seront convoqués.', type: 'urgent', target: 'all' },
    { title: 'Cross country inter-classes', content: 'Le cross country annuel inter-classes aura lieu le 20 mars 2025 au parc de Hann. Inscriptions au bureau des sports.', type: 'event', target: 'students' },
    { title: 'Formation continue enseignants', content: 'Une session de formation continue est programmée le 12 avril 2025 pour tous les enseignants. Thème: pédagogie active.', type: 'academic', target: 'teachers' },
    { title: 'Sortie pédagogique Terminale S', content: 'Une sortie pédagogique en SVT est organisée pour les Terminale S le 10 mai 2025. Coût: $5,000 par élève.', type: 'event', target: 'students' },
  ]
  for (const a of announcementData) {
    await prisma.announcement.create({
      data: {
        title: a.title,
        content: a.content,
        type: a.type,
        target: a.target,
        authorId: adminUser.id,
        institutionId: instId,
      },
    })
  }
  console.log('Announcements created:', announcementData.length)

  // ---------- School Events ----------
  const eventData = [
    { title: 'Portes ouvertes du Lycée', date: '2025-02-08', endDate: '2025-02-08', type: 'celebration', description: 'Journée portes ouvertes pour les futurs élèves' },
    { title: 'Vacances de Pâques', date: '2025-04-12', endDate: '2025-04-20', type: 'holiday', description: 'Congé de Pâques' },
    { title: 'Commémoration de l\'Indépendance', date: '2025-04-04', endDate: '2025-04-04', type: 'celebration', description: 'Défilé du 4 avril' },
    { title: 'Examens BAC 2025', date: '2025-06-23', endDate: '2025-07-04', type: 'exam', description: 'Session normale du Baccalauréat' },
  ]
  for (const e of eventData) {
    await prisma.schoolEvent.create({
      data: {
        title: e.title,
        description: e.description,
        date: e.date,
        endDate: e.endDate,
        type: e.type,
        schoolYear: '2024-2025',
        isGlobal: false,
        institutionId: instId,
      },
    })
  }
  console.log('School events created:', eventData.length)

  // ---------- Homework ----------
  const homeworkData = [
    { title: 'Devoir Maison - Suites numériques', subject: 'Mathématiques', cls: 'Terminale S', dueDate: '2025-01-20', type: 'homework' },
    { title: 'Dissertation - Le roman et ses personnages', subject: 'Français', cls: 'Terminale L', dueDate: '2025-01-25', type: 'homework' },
    { title: 'Exposé - Décolonisation en Afrique', subject: 'Histoire-Géo', cls: 'Première C', dueDate: '2025-02-01', type: 'project' },
    { title: 'TP - Réactions acido-basiques', subject: 'Physique-Chimie', cls: 'Terminale S', dueDate: '2025-01-30', type: 'exam_prep' },
  ]
  for (const hw of homeworkData) {
    const cls = classes.find(c => c.name === hw.cls)!
    const sub = subjects.find(s => s.name === hw.subject)!
    const teacher = teachers.find(t => t.subject === hw.subject)!
    await prisma.homework.create({
      data: {
        title: hw.title,
        description: 'Travail à rendre individuellement.',
        subjectId: sub.id,
        classId: cls.id,
        teacherId: teacher.id,
        dueDate: hw.dueDate,
        assignedDate: '2025-01-10',
        type: hw.type,
        status: 'active',
        schoolYear: '2024-2025',
        institutionId: instId,
      },
    })
  }
  console.log('Homework created:', homeworkData.length)

  // ---------- Notifications ----------
  const notifData = [
    { title: 'Nouveau devoir de Mathématiques', message: 'Un devoir maison a été assigné en Mathématiques.', category: 'homework', link: 'homework' },
    { title: 'Paiement reçu', message: 'Votre paiement de frais de scolarité a bien été enregistré.', category: 'payment', link: 'payments' },
    { title: 'Réunion parents-professeurs', message: 'Une réunion est prévue le 25 janvier 2025.', category: 'event', link: 'events' },
  ]
  for (const n of notifData) {
    await prisma.notification.create({
      data: {
        userId: adminUser.id,
        title: n.title,
        message: n.message,
        type: 'info',
        category: n.category,
        link: n.link,
        read: false,
        institutionId: instId,
      },
    })
  }
  console.log('Notifications created:', notifData.length)

  // ---------- School Config ----------
  await prisma.schoolConfig.create({
    data: {
      schoolName: 'Lycée Test',
      address: 'Dakar, Sénégal',
      phone: '+221 33 825 00 00',
      email: 'contact@lycee-test.sn',
      currentYear: '2024-2025',
      institutionId: instId,
      institutionPassword: 'lycee2024',
    },
  })
  console.log('School config created')

  console.log('\n✅ Lycée Test seed complete!')
  console.log('   Admin: directeur@lycee-test.sn / lycee2024')
  console.log('   Institution ID:', instId)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
