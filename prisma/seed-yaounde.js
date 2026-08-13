// Seed script for Collège Moderne de Yaoundé
// Run: node prisma/seed-yaounde.js
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const INST_ID = 'cmqjgfklf0000nqc1junmtwod';

// Helpers
function randomGrade(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 2) / 2;
}
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Get current max userCode numbers to avoid conflicts
async function getMaxCounters() {
  const users = await db.user.findMany({
    select: { userCode: true },
    orderBy: { userCode: 'asc' },
  });
  const counters = { admin: 0, teacher: 0, student: 0, parent: 0, staff: 0 };
  for (const u of users) {
    const match = u.userCode.match(/^(ADM|ENS|ELV|PAR|STF)-(\d+)$/);
    if (match) {
      const num = parseInt(match[2]);
      if (match[1] === 'ADM') counters.admin = Math.max(counters.admin, num);
      if (match[1] === 'ENS') counters.teacher = Math.max(counters.teacher, num);
      if (match[1] === 'ELV') counters.student = Math.max(counters.student, num);
      if (match[1] === 'PAR') counters.parent = Math.max(counters.parent, num);
      if (match[1] === 'STF') counters.staff = Math.max(counters.staff, num);
    }
  }
  return counters;
}

function generateUserCode(role, count) {
  const prefixMap = { admin: 'ADM', teacher: 'ENS', student: 'ELV', parent: 'PAR', staff: 'STF' };
  return `${prefixMap[role] || 'USR'}-${String(count).padStart(3, '0')}`;
}

async function seed() {
  console.log('=== Seed Collège Moderne de Yaoundé ===');

  const counters = await getMaxCounters();
  console.log('Starting counters:', counters);

  // Update admin userCode if needed
  const adminUser = await db.user.findFirst({
    where: { institutionId: INST_ID, role: 'admin' },
  });
  if (!adminUser) {
    console.error('No admin user found for Yaoundé institution!');
    return;
  }
  console.log('Admin user:', adminUser.email, adminUser.userCode);

  // ============ CREATE SUBJECTS ============
  const subjectsData = [
    { name: 'Mathématiques', code: 'MATH-Y', coefficient: 5, institutionId: INST_ID },
    { name: 'Français', code: 'FR-Y', coefficient: 5, institutionId: INST_ID },
    { name: 'Anglais', code: 'ANG-Y', coefficient: 4, institutionId: INST_ID },
    { name: 'Histoire-Géographie', code: 'HG-Y', coefficient: 3, institutionId: INST_ID },
    { name: 'Sciences de la Vie et de la Terre', code: 'SVT-Y', coefficient: 3, institutionId: INST_ID },
    { name: 'Physique-Chimie', code: 'PC-Y', coefficient: 4, institutionId: INST_ID },
    { name: 'Éducation Civique', code: 'EC-Y', coefficient: 2, institutionId: INST_ID },
    { name: 'Informatique', code: 'INFO-Y', coefficient: 2, institutionId: INST_ID },
  ];

  const subjects = [];
  for (const s of subjectsData) {
    const subject = await db.subject.create({ data: s });
    subjects.push(subject);
  }
  console.log(`Created ${subjects.length} subjects`);

  // ============ CREATE TEACHERS ============
  const teachersData = [
    { firstName: 'Paul', lastName: 'Essomba', subject: 'Mathématiques', email: 'paul.essomba@college-yaounde.edu', phone: '+243 699 101 001', qualification: 'Doctorat en Mathématiques' },
    { firstName: 'Marie', lastName: 'Ngassa', subject: 'Français', email: 'marie.ngassa@college-yaounde.edu', phone: '+243 699 101 002', qualification: 'Maîtrise en Lettres Modernes' },
    { firstName: 'Jean', lastName: 'Fotso', subject: 'Anglais', email: 'jean.fotso@college-yaounde.edu', phone: '+243 699 101 003', qualification: 'Master en Langues Étrangères' },
    { firstName: 'Chantal', lastName: 'Atangana', subject: 'Histoire-Géographie', email: 'chantal.atangana@college-yaounde.edu', phone: '+243 699 101 004', qualification: 'Licence en Histoire' },
    { firstName: 'André', lastName: 'Mbah', subject: 'Sciences de la Vie et de la Terre', email: 'andre.mbah@college-yaounde.edu', phone: '+243 699 101 005', qualification: 'Master en Biologie' },
    { firstName: 'Sylvie', lastName: 'Nkoulou', subject: 'Physique-Chimie', email: 'sylvie.nkoulou@college-yaounde.edu', phone: '+243 699 101 006', qualification: 'Doctorat en Physique' },
    { firstName: 'Hervé', lastName: 'Tchinda', subject: 'Éducation Civique', email: 'herve.tchinda@college-yaounde.edu', phone: '+243 699 101 007', qualification: 'Maîtrise en Sciences Politiques' },
    { firstName: 'Clarisse', lastName: 'Biyong', subject: 'Informatique', email: 'clarisse.biyong@college-yaounde.edu', phone: '+243 699 101 008', qualification: 'Ingénieur en Informatique' },
  ];

  const teachers = [];
  for (const t of teachersData) {
    counters.teacher++;
    const user = await db.user.create({
      data: {
        userCode: generateUserCode('teacher', counters.teacher),
        email: t.email,
        password: 'enseignant123',
        name: `${t.firstName} ${t.lastName}`,
        role: 'teacher',
        phone: t.phone,
        active: true,
        institutionId: INST_ID,
      },
    });
    const teacher = await db.teacher.create({
      data: {
        userId: user.id,
        firstName: t.firstName,
        lastName: t.lastName,
        subject: t.subject,
        phone: t.phone,
        qualification: t.qualification,
        hireDate: '2021-09-01',
      },
    });
    teachers.push(teacher);
  }
  console.log(`Created ${teachers.length} teachers`);

  // ============ CREATE CLASSES ============
  const classesData = [
    { name: '6ème A', level: '6ème', section: 'A', capacity: 40, room: 'Salle 101', institutionId: INST_ID, schoolYear: '2024-2025' },
    { name: '5ème B', level: '5ème', section: 'B', capacity: 35, room: 'Salle 201', institutionId: INST_ID, schoolYear: '2024-2025' },
    { name: '4ème C', level: '4ème', section: 'C', capacity: 30, room: 'Salle 301', institutionId: INST_ID, schoolYear: '2024-2025' },
    { name: '3ème D', level: '3ème', section: 'D', capacity: 30, room: 'Salle 401', institutionId: INST_ID, schoolYear: '2024-2025' },
    { name: '2nde A', level: '2nde', section: 'A', capacity: 35, room: 'Salle 501', institutionId: INST_ID, schoolYear: '2024-2025' },
    { name: '1ère D', level: '1ère', section: 'D', capacity: 30, room: 'Salle 502', institutionId: INST_ID, schoolYear: '2024-2025' },
  ];

  const classes = [];
  for (const c of classesData) {
    const cls = await db.class.create({ data: c });
    classes.push(cls);
  }
  console.log(`Created ${classes.length} classes`);

  // ============ ASSIGN TEACHERS TO CLASSES ============
  for (const cls of classes) {
    for (const teacher of teachers) {
      await db.classTeacher.create({
        data: {
          classId: cls.id,
          teacherId: teacher.id,
          subject: teacher.subject,
        },
      });
    }
  }
  console.log('Assigned teachers to classes');

  // ============ CREATE STUDENTS ============
  const studentsData = [
    // 6ème A - 7 élèves
    { firstName: 'Yannick', lastName: 'Etoa', gender: 'M', dateOfBirth: '2013-03-12', classIndex: 0, parentContact: 'Hélène Etoa', parentPhone: '+243 691 200 001' },
    { firstName: 'Grâce', lastName: 'Ndongo', gender: 'F', dateOfBirth: '2013-05-25', classIndex: 0, parentContact: 'Pierre Ndongo', parentPhone: '+243 691 200 002' },
    { firstName: 'Fabrice', lastName: 'Kamga', gender: 'M', dateOfBirth: '2013-01-08', classIndex: 0, parentContact: 'Marie Kamga', parentPhone: '+243 691 200 003' },
    { firstName: 'Dorothée', lastName: 'Simo', gender: 'F', dateOfBirth: '2013-07-30', classIndex: 0, parentContact: 'Joseph Simo', parentPhone: '+243 691 200 004' },
    { firstName: 'Blaise', lastName: 'Tchoumi', gender: 'M', dateOfBirth: '2013-09-14', classIndex: 0, parentContact: 'Thérèse Tchoumi', parentPhone: '+243 691 200 005' },
    { firstName: 'Carine', lastName: 'Ngo Biteng', gender: 'F', dateOfBirth: '2013-11-02', classIndex: 0, parentContact: 'Samuel Ngo', parentPhone: '+243 691 200 006' },
    { firstName: 'Ulrich', lastName: 'Mbock', gender: 'M', dateOfBirth: '2013-04-19', classIndex: 0, parentContact: 'Cécile Mbock', parentPhone: '+243 691 200 007' },

    // 5ème B - 6 élèves
    { firstName: 'Armand', lastName: 'Obama', gender: 'M', dateOfBirth: '2012-02-10', classIndex: 1, parentContact: 'Jeanne Obama', parentPhone: '+243 692 300 001' },
    { firstName: 'Béatrice', lastName: 'Nkoulou', gender: 'F', dateOfBirth: '2012-06-22', classIndex: 1, parentContact: 'François Nkoulou', parentPhone: '+243 692 300 002' },
    { firstName: 'Clément', lastName: 'Eyenga', gender: 'M', dateOfBirth: '2012-08-04', classIndex: 1, parentContact: 'Marguerite Eyenga', parentPhone: '+243 692 300 003' },
    { firstName: 'Dina', lastName: 'Tchaptchet', gender: 'F', dateOfBirth: '2012-12-17', classIndex: 1, parentContact: 'Alain Tchaptchet', parentPhone: '+243 692 300 004' },
    { firstName: 'Eric', lastName: 'Ze', gender: 'M', dateOfBirth: '2012-04-05', classIndex: 1, parentContact: 'Pascaline Ze', parentPhone: '+243 692 300 005' },
    { firstName: 'Flore', lastName: 'Bikay', gender: 'F', dateOfBirth: '2012-10-28', classIndex: 1, parentContact: 'Rigobert Bikay', parentPhone: '+243 692 300 006' },

    // 4ème C - 6 élèves
    { firstName: 'Gédéon', lastName: 'Mvogo', gender: 'M', dateOfBirth: '2011-01-15', classIndex: 2, parentContact: 'Solange Mvogo', parentPhone: '+243 693 400 001' },
    { firstName: 'Hortense', lastName: 'Nganou', gender: 'F', dateOfBirth: '2011-05-03', classIndex: 2, parentContact: 'Emmanuel Nganou', parentPhone: '+243 693 400 002' },
    { firstName: 'Ivan', lastName: 'Soh', gender: 'M', dateOfBirth: '2011-09-21', classIndex: 2, parentContact: 'Philomène Soh', parentPhone: '+243 693 400 003' },
    { firstName: 'Josiane', lastName: 'Metogo', gender: 'F', dateOfBirth: '2011-03-08', classIndex: 2, parentContact: 'Hubert Metogo', parentPhone: '+243 693 400 004' },
    { firstName: 'Kevin', lastName: 'Ndoumbe', gender: 'M', dateOfBirth: '2011-07-14', classIndex: 2, parentContact: 'Annick Ndoumbe', parentPhone: '+243 693 400 005' },
    { firstName: 'Léonie', lastName: 'Ewane', gender: 'F', dateOfBirth: '2011-11-30', classIndex: 2, parentContact: 'Thomas Ewane', parentPhone: '+243 693 400 006' },

    // 3ème D - 6 élèves
    { firstName: 'Martial', lastName: 'Ondoa', gender: 'M', dateOfBirth: '2010-04-22', classIndex: 3, parentContact: 'Juliette Ondoa', parentPhone: '+243 694 500 001' },
    { firstName: 'Nadège', lastName: 'Balla', gender: 'F', dateOfBirth: '2010-08-09', classIndex: 3, parentContact: 'Serge Balla', parentPhone: '+243 694 500 002' },
    { firstName: 'Olivier', lastName: 'Tchinda', gender: 'M', dateOfBirth: '2010-02-14', classIndex: 3, parentContact: 'Véronique Tchinda', parentPhone: '+243 694 500 003' },
    { firstName: 'Prisca', lastName: 'Nguidi', gender: 'F', dateOfBirth: '2010-06-27', classIndex: 3, parentContact: 'Dieudonné Nguidi', parentPhone: '+243 694 500 004' },
    { firstName: 'Quentin', lastName: 'Mengue', gender: 'M', dateOfBirth: '2010-10-05', classIndex: 3, parentContact: 'Irène Mengue', parentPhone: '+243 694 500 005' },
    { firstName: 'Raïssa', lastName: 'Eyebé', gender: 'F', dateOfBirth: '2010-12-19', classIndex: 3, parentContact: 'Georges Eyebé', parentPhone: '+243 694 500 006' },

    // 2nde A - 5 élèves
    { firstName: 'Stéphane', lastName: 'Assembe', gender: 'M', dateOfBirth: '2009-03-11', classIndex: 4, parentContact: 'Noëlle Assembe', parentPhone: '+243 695 600 001' },
    { firstName: 'Tabitha', lastName: 'Fotso', gender: 'F', dateOfBirth: '2009-07-24', classIndex: 4, parentContact: 'Michel Fotso', parentPhone: '+243 695 600 002' },
    { firstName: 'Ulysse', lastName: 'Kamgaing', gender: 'M', dateOfBirth: '2009-01-30', classIndex: 4, parentContact: 'Berthe Kamgaing', parentPhone: '+243 695 600 003' },
    { firstName: 'Vanessa', lastName: 'Nkotti', gender: 'F', dateOfBirth: '2009-09-16', classIndex: 4, parentContact: 'Charles Nkotti', parentPhone: '+243 695 600 004' },
    { firstName: 'Wilfried', lastName: 'Tchouankeu', gender: 'M', dateOfBirth: '2009-05-08', classIndex: 4, parentContact: 'Élodie Tchouankeu', parentPhone: '+243 695 600 005' },

    // 1ère D - 5 élèves
    { firstName: 'Xavier', lastName: 'Biwole', gender: 'M', dateOfBirth: '2008-02-07', classIndex: 5, parentContact: 'Jacqueline Biwole', parentPhone: '+243 696 700 001' },
    { firstName: 'Yolande', lastName: 'Mbang', gender: 'F', dateOfBirth: '2008-06-19', classIndex: 5, parentContact: 'Théophile Mbang', parentPhone: '+243 696 700 002' },
    { firstName: 'Zacharie', lastName: ' Owona', gender: 'M', dateOfBirth: '2008-10-03', classIndex: 5, parentContact: 'Clémentine Owona', parentPhone: '+243 696 700 003' },
    { firstName: 'Astrid', lastName: 'Ngo Mballa', gender: 'F', dateOfBirth: '2008-04-25', classIndex: 5, parentContact: 'Roger Ngo', parentPhone: '+243 696 700 004' },
    { firstName: 'Brice', lastName: 'Tchakounte', gender: 'M', dateOfBirth: '2008-08-11', classIndex: 5, parentContact: 'Dorothée Tchakounte', parentPhone: '+243 696 700 005' },
  ];

  const students = [];
  for (let i = 0; i < studentsData.length; i++) {
    const s = studentsData[i];
    const classObj = classes[s.classIndex];
    const emailBase = `${s.firstName.toLowerCase().replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e').replace(/ï/g, 'i').replace(/ç/g, 'c').replace(/ô/g, 'o').replace(/â/g, 'a').replace(/û/g, 'u').replace(/î/g, 'i')}.${s.lastName.toLowerCase().trim().replace(/é/g, 'e').replace(/è/g, 'e').replace(/ /g, '')}@college-yaounde.edu`;

    counters.student++;
    const user = await db.user.create({
      data: {
        userCode: generateUserCode('student', counters.student),
        email: emailBase,
        password: 'eleve123',
        name: `${s.firstName} ${s.lastName.trim()}`,
        role: 'student',
        phone: `+243 600 ${String(i + 1).padStart(6, '0')}`,
        active: true,
        institutionId: INST_ID,
      },
    });

    const student = await db.student.create({
      data: {
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName.trim(),
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        address: 'Yaoundé, Cameroun',
        enrollmentDate: '2024-09-02',
        parentContact: s.parentContact,
        parentPhone: s.parentPhone,
        classId: classObj.id,
      },
    });
    students.push(student);

    // Create enrollment
    await db.studentEnrollment.create({
      data: {
        studentId: student.id,
        classId: classObj.id,
        schoolYear: '2024-2025',
      },
    });
  }
  console.log(`Created ${students.length} students`);

  // ============ CREATE PARENTS ============
  const parentsData = [
    // 6ème A parents
    { firstName: 'Hélène', lastName: 'Etoa', phone: '+243 691 200 001', address: 'Yaoundé, Bastos' },
    { firstName: 'Pierre', lastName: 'Ndongo', phone: '+243 691 200 002', address: 'Yaoundé, Nlongkak' },
    { firstName: 'Marie', lastName: 'Kamga', phone: '+243 691 200 003', address: 'Yaoundé, Mvog-Mbi' },
    { firstName: 'Joseph', lastName: 'Simo', phone: '+243 691 200 004', address: 'Yaoundé, Briqueterie' },
    { firstName: 'Thérèse', lastName: 'Tchoumi', phone: '+243 691 200 005', address: 'Yaoundé, Tsinga' },
    { firstName: 'Samuel', lastName: 'Ngo', phone: '+243 691 200 006', address: 'Yaoundé, Odza' },
    { firstName: 'Cécile', lastName: 'Mbock', phone: '+243 691 200 007', address: 'Yaoundé, Melen' },

    // 5ème B parents
    { firstName: 'Jeanne', lastName: 'Obama', phone: '+243 692 300 001', address: 'Yaoundé, Etoug-Ebe' },
    { firstName: 'François', lastName: 'Nkoulou', phone: '+243 692 300 002', address: 'Yaoundé, Nsimalen' },
    { firstName: 'Marguerite', lastName: 'Eyenga', phone: '+243 692 300 003', address: 'Yaoundé, Elig-Essono' },
    { firstName: 'Alain', lastName: 'Tchaptchet', phone: '+243 692 300 004', address: 'Yaoundé, Mvog-Ada' },
    { firstName: 'Pascaline', lastName: 'Ze', phone: '+243 692 300 005', address: 'Yaoundé, Quartier du Lac' },
    { firstName: 'Rigobert', lastName: 'Bikay', phone: '+243 692 300 006', address: 'Yaoundé, Damas' },

    // 4ème C parents
    { firstName: 'Solange', lastName: 'Mvogo', phone: '+243 693 400 001', address: 'Yaoundé, Omnisport' },
    { firstName: 'Emmanuel', lastName: 'Nganou', phone: '+243 693 400 002', address: 'Yaoundé, Nsam' },
    { firstName: 'Philomène', lastName: 'Soh', phone: '+243 693 400 003', address: 'Yaoundé, Ekounou' },
    { firstName: 'Hubert', lastName: 'Metogo', phone: '+243 693 400 004', address: 'Yaoundé, Ahala' },
    { firstName: 'Annick', lastName: 'Ndoumbe', phone: '+243 693 400 005', address: 'Yaoundé, Messa' },
    { firstName: 'Thomas', lastName: 'Ewane', phone: '+243 693 400 006', address: 'Yaoundé, Mendong' },

    // 3ème D parents
    { firstName: 'Juliette', lastName: 'Ondoa', phone: '+243 694 500 001', address: 'Yaoundé, Cité Verte' },
    { firstName: 'Serge', lastName: 'Balla', phone: '+243 694 500 002', address: 'Yaoundé, Oyomabang' },
    { firstName: 'Véronique', lastName: 'Tchinda', phone: '+243 694 500 003', address: 'Yaoundé, Biyem-Assi' },
    { firstName: 'Dieudonné', lastName: 'Nguidi', phone: '+243 694 500 004', address: 'Yaoundé, Simbok' },
    { firstName: 'Irène', lastName: 'Mengue', phone: '+243 694 500 005', address: 'Yaoundé, Ngoa-Ekellé' },
    { firstName: 'Georges', lastName: 'Eyebé', phone: '+243 694 500 006', address: 'Yaoundé, Soa' },

    // 2nde A parents
    { firstName: 'Noëlle', lastName: 'Assembe', phone: '+243 695 600 001', address: 'Yaoundé, Essos' },
    { firstName: 'Michel', lastName: 'Fotso', phone: '+243 695 600 002', address: 'Yaoundé, Bastos' },
    { firstName: 'Berthe', lastName: 'Kamgaing', phone: '+243 695 600 003', address: 'Yaoundé, Mvan' },
    { firstName: 'Charles', lastName: 'Nkotti', phone: '+243 695 600 004', address: 'Yaoundé, Mimboman' },
    { firstName: 'Élodie', lastName: 'Tchouankeu', phone: '+243 695 600 005', address: 'Yaoundé, Nkoldongo' },

    // 1ère D parents
    { firstName: 'Jacqueline', lastName: 'Biwole', phone: '+243 696 700 001', address: 'Yaoundé, Montée Jouvence' },
    { firstName: 'Théophile', lastName: 'Mbang', phone: '+243 696 700 002', address: 'Yaoundé, Elig-Edzoa' },
    { firstName: 'Clémentine', lastName: 'Owona', phone: '+243 696 700 003', address: 'Yaoundé, Quartier administratif' },
    { firstName: 'Roger', lastName: 'Ngo', phone: '+243 696 700 004', address: 'Yaoundé, Hippodrome' },
    { firstName: 'Dorothée', lastName: 'Tchakounte', phone: '+243 696 700 005', address: 'Yaoundé, Madagascar' },
  ];

  // Link students to parents
  for (let i = 0; i < parentsData.length; i++) {
    const p = parentsData[i];
    const emailBase = `${p.firstName.toLowerCase().replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e').replace(/ï/g, 'i').replace(/ç/g, 'c').replace(/ô/g, 'o').replace(/â/g, 'a').replace(/û/g, 'u').replace(/î/g, 'i').replace(/ë/g, 'e')}.${p.lastName.toLowerCase().replace(/é/g, 'e').replace(/ /g, '')}@college-yaounde.edu`;

    counters.parent++;
    const user = await db.user.create({
      data: {
        userCode: generateUserCode('parent', counters.parent),
        email: emailBase,
        password: 'parent123',
        name: `${p.firstName} ${p.lastName}`,
        role: 'parent',
        phone: p.phone,
        active: true,
        institutionId: INST_ID,
      },
    });

    const parent = await db.parent.create({
      data: {
        userId: user.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        address: p.address,
      },
    });

    // Link parent to corresponding student
    if (i < students.length) {
      await db.student.update({
        where: { id: students[i].id },
        data: { parentId: parent.id },
      });
    }
  }
  console.log(`Created ${parentsData.length} parents`);

  // ============ CREATE STAFF ============
  const staffData = [
    { firstName: 'Solange', lastName: 'Atangana', fonction: 'Secrétaire de direction', email: 'solange.atangana@college-yaounde.edu', phone: '+243 699 201 001' },
    { firstName: 'Patrice', lastName: 'Nkoulou', fonction: 'Comptable', email: 'patrice.nkoulou@college-yaounde.edu', phone: '+243 699 201 002' },
    { firstName: 'Emmanuel', lastName: 'Tchoumi', fonction: 'Surveillant général', email: 'emmanuel.tchoumi@college-yaounde.edu', phone: '+243 699 201 003' },
    { firstName: 'Agathe', lastName: 'Mballa', fonction: 'Documentaliste', email: 'agathe.mballa@college-yaounde.edu', phone: '+243 699 201 004' },
    { firstName: 'Guy', lastName: 'Ze', fonction: 'Agent d\'entretien', email: 'guy.ze@college-yaounde.edu', phone: '+243 699 201 005' },
  ];

  for (const s of staffData) {
    counters.staff++;
    const user = await db.user.create({
      data: {
        userCode: generateUserCode('staff', counters.staff),
        email: s.email,
        password: 'personnel123',
        name: `${s.firstName} ${s.lastName}`,
        role: 'staff',
        phone: s.phone,
        active: true,
        institutionId: INST_ID,
      },
    });
    await db.staff.create({
      data: {
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        phone: s.phone,
        email: s.email,
        fonction: s.fonction,
      },
    });
  }
  console.log(`Created ${staffData.length} staff`);

  // ============ CREATE GRADES ============
  const trimesters = ['1er', '2eme', '3eme'];
  const gradeTypes = ['devoir', 'examen', 'controle'];
  const dates = ['2024-10-15', '2024-11-20', '2024-12-10', '2025-01-15', '2025-02-20', '2025-03-10'];

  for (const student of students) {
    for (const subject of subjects) {
      const numGrades = Math.floor(Math.random() * 2) + 2;
      for (let g = 0; g < numGrades; g++) {
        const trimester = trimesters[Math.min(g, 2)];
        const type = gradeTypes[g % gradeTypes.length];
        const date = dates[g % dates.length];
        let minVal = 4, maxVal = 18;
        if (subject.code === 'MATH-Y' || subject.code === 'PC-Y') { minVal = 3; maxVal = 17; }
        else if (subject.code === 'FR-Y' || subject.code === 'ANG-Y') { minVal = 6; maxVal = 19; }
        const value = randomGrade(minVal, maxVal);

        await db.grade.create({
          data: {
            studentId: student.id,
            subjectId: subject.id,
            classId: student.classId,
            teacherId: teachers.find(t => t.subject === subject.name)?.id || null,
            value,
            maxValue: 20,
            type,
            trimester,
            schoolYear: '2024-2025',
            date,
            comment: value >= 14 ? 'Bon travail' : value >= 10 ? 'Peut mieux faire' : 'Effort insuffisant',
          },
        });
      }
    }
  }
  console.log('Created grades');

  // ============ CREATE SCHEDULES ============
  const timeSlots = [
    { start: '07:30', end: '08:30' },
    { start: '08:35', end: '09:35' },
    { start: '09:40', end: '10:40' },
    { start: '11:00', end: '12:00' },
    { start: '12:05', end: '13:05' },
    { start: '14:00', end: '15:00' },
    { start: '15:05', end: '16:05' },
  ];

  for (const cls of classes) {
    for (let day = 1; day <= 5; day++) {
      const numPeriods = Math.floor(Math.random() * 2) + 5;
      const shuffledSubjects = [...subjects].sort(() => Math.random() - 0.5);
      for (let p = 0; p < numPeriods && p < timeSlots.length; p++) {
        const subject = shuffledSubjects[p % shuffledSubjects.length];
        const slot = timeSlots[p];
        const teacher = teachers.find(t => t.subject === subject.name);
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
        });
      }
    }
  }
  console.log('Created schedules');

  // ============ CREATE PAYMENTS ============
  const paymentTypes = ['tuition', 'registration', 'exam_fee', 'other'];
  const paymentMethods = ['cash', 'mobile_money', 'bank_transfer'];
  const paymentStatuses = ['completed', 'pending', 'completed', 'completed'];
  const today = new Date();

  for (const student of students) {
    const numPayments = Math.floor(Math.random() * 3) + 1;
    for (let p = 0; p < numPayments; p++) {
      const type = paymentTypes[p % paymentTypes.length];
      let amount = 0;
      switch (type) {
        case 'tuition': amount = 180000 + Math.floor(Math.random() * 60000); break;
        case 'registration': amount = 30000 + Math.floor(Math.random() * 15000); break;
        case 'exam_fee': amount = 12000 + Math.floor(Math.random() * 8000); break;
        default: amount = 5000 + Math.floor(Math.random() * 15000);
      }
      const method = randomPick(paymentMethods);
      const status = randomPick(paymentStatuses);
      const paymentDate = new Date(today);
      paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 90));

      await db.payment.create({
        data: {
          studentId: student.id,
          amount,
          type,
          method,
          status,
          reference: method === 'mobile_money' ? `MM${Date.now()}${Math.floor(Math.random() * 1000)}` : null,
          description: type === 'tuition' ? 'Frais de scolarité' : type === 'registration' ? "Frais d'inscription" : type === 'exam_fee' ? "Frais d'examen" : 'Autres frais',
          schoolYear: '2024-2025',
          paymentDate: paymentDate.toISOString().split('T')[0],
        },
      });
    }
  }
  console.log('Created payments');

  // ============ CREATE ATTENDANCE ============
  const attendanceStatuses = ['present', 'present', 'present', 'present', 'absent', 'late', 'excused'];
  for (let d = 0; d < 5; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const dateStr = date.toISOString().split('T')[0];
    for (const student of students) {
      const status = randomPick(attendanceStatuses);
      await db.attendance.create({
        data: {
          studentId: student.id,
          date: dateStr,
          status,
          comment: status === 'absent' ? 'Non justifié' : status === 'excused' ? 'Certificat médical' : status === 'late' ? 'Retard de 15 min' : null,
        },
      });
    }
  }
  console.log('Created attendance records');

  // ============ CREATE HOMEWORK ============
  const homeworkData = [
    { title: 'Devoir de Mathématiques N°1', subjectIdx: 0, classIdx: 0, dueDate: '2025-01-20', type: 'homework' },
    { title: 'Rédaction en Français', subjectIdx: 1, classIdx: 1, dueDate: '2025-01-22', type: 'homework' },
    { title: 'Exercices d\'Anglais', subjectIdx: 2, classIdx: 2, dueDate: '2025-01-25', type: 'homework' },
    { title: 'Contrôle d\'Histoire', subjectIdx: 3, classIdx: 3, dueDate: '2025-02-01', type: 'controle' },
    { title: 'TP de Physique-Chimie', subjectIdx: 5, classIdx: 4, dueDate: '2025-02-05', type: 'tp' },
    { title: 'Devoir de SVT', subjectIdx: 4, classIdx: 5, dueDate: '2025-02-10', type: 'homework' },
    { title: 'Exercices de Mathématiques N°2', subjectIdx: 0, classIdx: 1, dueDate: '2025-02-15', type: 'homework' },
    { title: 'Dissertation en Français', subjectIdx: 1, classIdx: 3, dueDate: '2025-02-20', type: 'devoir' },
    { title: 'Projet Informatique', subjectIdx: 7, classIdx: 4, dueDate: '2025-03-01', type: 'project' },
    { title: 'Contrôle d\'Éducation Civique', subjectIdx: 6, classIdx: 0, dueDate: '2025-03-05', type: 'controle' },
  ];

  for (const hw of homeworkData) {
    await db.homework.create({
      data: {
        title: hw.title,
        description: `Consignes pour ${hw.title}. Merci de respecter les délais.`,
        subjectId: subjects[hw.subjectIdx]?.id || null,
        classId: classes[hw.classIdx]?.id || classes[0].id,
        teacherId: teachers.find(t => t.subject === subjects[hw.subjectIdx]?.name)?.id || null,
        dueDate: hw.dueDate,
        assignedDate: '2025-01-10',
        type: hw.type,
        status: 'active',
        schoolYear: '2024-2025',
        institutionId: INST_ID,
      },
    });
  }
  console.log(`Created ${homeworkData.length} homework`);

  // ============ CREATE EVENTS ============
  const eventsData = [
    { title: 'Rentrée scolaire', description: 'Cérémonie de rentrée pour toutes les classes', date: '2024-09-02', type: 'celebration' },
    { title: 'Vacances de Noël', description: 'Congé de fin d\'année du 20 décembre au 5 janvier', date: '2024-12-20', endDate: '2025-01-05', type: 'holiday' },
    { title: 'Examens du 1er trimestre', description: 'Session d\'examens du 9 au 20 décembre', date: '2024-12-09', endDate: '2024-12-20', type: 'exam' },
    { title: 'Examens du 2ème trimestre', description: 'Session d\'examens du 10 au 21 mars', date: '2025-03-10', endDate: '2025-03-21', type: 'exam' },
    { title: 'Réunion parents-professeurs', description: 'Rencontre annuelle parents et enseignants', date: '2025-01-25', type: 'meeting' },
    { title: 'Journée culturelle', description: 'Expositions, danses et spectacles par les élèves', date: '2025-02-15', type: 'celebration' },
    { title: 'Conseil de classe', description: 'Bilan du premier trimestre pour toutes les classes', date: '2025-01-10', type: 'meeting' },
    { title: 'Sortie pédagogique', description: 'Visite du Musée National de Yaoundé', date: '2025-03-22', type: 'other' },
    { title: 'Fête de fin d\'année', description: 'Cérémonie de clôture et remise des prix', date: '2025-06-20', type: 'celebration' },
    { title: 'Examens du BEPC', description: 'Session officielle du BEPC pour les classes de 3ème', date: '2025-06-02', endDate: '2025-06-13', type: 'exam' },
  ];

  for (const ev of eventsData) {
    await db.schoolEvent.create({
      data: {
        title: ev.title,
        description: ev.description || null,
        date: ev.date,
        endDate: ev.endDate || null,
        type: ev.type,
        schoolYear: '2024-2025',
        institutionId: INST_ID,
      },
    });
  }
  console.log(`Created ${eventsData.length} events`);

  // ============ CREATE BULLETINS ============
  for (const student of students) {
    for (const trimester of trimesters) {
      // Calculate average from grades
      const grades = await db.grade.findMany({
        where: { studentId: student.id, trimester },
        include: { subject: true },
      });
      if (grades.length === 0) continue;

      let totalWeighted = 0;
      let totalCoeff = 0;
      for (const g of grades) {
        totalWeighted += g.value * (g.subject?.coefficient || 1);
        totalCoeff += g.subject?.coefficient || 1;
      }
      const average = totalCoeff > 0 ? Math.round((totalWeighted / totalCoeff) * 100) / 100 : null;

      await db.bulletin.create({
        data: {
          studentId: student.id,
          classId: student.classId,
          trimester,
          schoolYear: '2024-2025',
          average,
          rank: Math.floor(Math.random() * 20) + 1,
          appreciation: average && average >= 14 ? 'Excellent' : average && average >= 12 ? 'Bien' : average && average >= 10 ? 'Assez bien' : 'Insuffisant',
          generatedAt: new Date().toISOString().split('T')[0],
        },
      });
    }
  }
  console.log('Created bulletins');

  // ============ CREATE MESSAGES ============
  const messagesData = [
    { senderIdx: -1, receiverIdx: 0, content: 'M. Essomba, veuillez préparer les sujets d\'examen de mathématiques pour le premier trimestre.' },
    { senderIdx: -1, receiverIdx: 1, content: 'Madame Ngassa, les résultats de la classe de 6ème A sont attendus avant vendredi.' },
    { senderIdx: 0, receiverIdx: -1, content: 'Monsieur le Directeur, les sujets sont prêts. Je vous les transmets demain matin.' },
    { senderIdx: -1, receiverIdx: 2, content: 'M. Fotso, merci de bien vouloir animer la journée portes ouvertes du mois prochain.' },
    { senderIdx: 1, receiverIdx: -1, content: 'Les copies de la classe de 5ème B sont corrigées. Je les dépose au secrétariat.' },
  ];

  for (const m of messagesData) {
    const senderId = m.senderIdx === -1 ? adminUser.id : teachers[m.senderIdx]?.userId;
    const receiverId = m.receiverIdx === -1 ? adminUser.id : teachers[m.receiverIdx]?.userId;
    if (senderId && receiverId) {
      await db.message.create({
        data: {
          senderId,
          receiverId,
          content: m.content,
          read: Math.random() > 0.5,
          institutionId: INST_ID,
        },
      });
    }
  }
  console.log('Created messages');

  // ============ FINAL COUNT ============
  const finalCounts = {
    students: await db.student.count({ where: { user: { institutionId: INST_ID } } }),
    teachers: await db.teacher.count({ where: { user: { institutionId: INST_ID } } }),
    parents: await db.parent.count({ where: { user: { institutionId: INST_ID } } }),
    staff: await db.staff.count({ where: { user: { institutionId: INST_ID } } }),
    classes: await db.class.count({ where: { institutionId: INST_ID } }),
    subjects: await db.subject.count({ where: { institutionId: INST_ID } }),
    grades: await db.grade.count({ where: { student: { user: { institutionId: INST_ID } } } }),
    schedules: await db.schedule.count({ where: { class: { institutionId: INST_ID } } }),
    payments: await db.payment.count({ where: { student: { user: { institutionId: INST_ID } } } }),
    attendances: await db.attendance.count({ where: { student: { user: { institutionId: INST_ID } } } }),
    bulletins: await db.bulletin.count({ where: { student: { user: { institutionId: INST_ID } } } }),
    homeworks: await db.homework.count({ where: { institutionId: INST_ID } }),
    events: await db.schoolEvent.count({ where: { institutionId: INST_ID } }),
    messages: await db.message.count({ where: { institutionId: INST_ID } }),
  };

  console.log('\n=== Seed terminé avec succès! ===');
  console.log('Statistiques Collège Moderne de Yaoundé:');
  for (const [key, val] of Object.entries(finalCounts)) {
    console.log(`  ${key}: ${val}`);
  }
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect());
