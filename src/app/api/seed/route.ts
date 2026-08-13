import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import {
  seedInstitutionData,
  buildStudentEmail,
  type InstitutionSeedConfig,
  type StudentInfo,
  type SubjectRow,
} from '@/lib/seed-institution'

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
  { firstName: 'Élie', lastName: 'Ekambi', gender: 'M', dateOfBirth: '2005-03-12', classIndex: 0, parentContact: 'Thérèse Ekambi', parentPhone: '+243 611 300 001', image: '/avatars/boy-1.png', userCode: 'ELV-301', email: buildStudentEmail('Élie', 'Ekambi', 'polytech.com'), phone: '+243 600 300 001' },
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
// Main POST handler
// ============================================================================

export async function POST(request: Request) {
  // Auth guard: only super_admin can perform a GLOBAL wipe + reseed.
  // This is destructive — wiping ALL institutions, ALL users, ALL data — so
  // we require the request to come from an authenticated super admin. The
  // `x-user-role` header is injected by the fetch-interceptor for browser
  // requests from authenticated sessions.
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'super_admin') {
    return NextResponse.json(
      {
        error:
          'Accès refusé. Seul un Super Administrateur peut réinitialiser toute la base de données.',
      },
      { status: 403 }
    )
  }

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
    await db.schoolYear.deleteMany()

    // ---- Create SuperAdmin (once) ----
    await db.superAdmin.create({
      data: {
        name: 'Super Administrateur',
        email: 'superadmin@edugest.com',
        password: 'super123',
        active: true,
      },
    })

    // ---- Create default SchoolYear records ----
    // Ces années sont globales (institutionId null) pour être partagées entre
    // toutes les institutions. Une seule est active par défaut (2024-2025).
    // Note: on ne passe pas `skipDuplicates` car la table est déjà vidée au-dessus
    // (deleteMany) et le client Prisma 6.19 ne l'expose pas dans les types SQLite.
    await db.schoolYear.createMany({
      data: [
        { label: '2023-2024', startDate: '2023-09-01', endDate: '2024-07-31', isActive: false },
        { label: '2024-2025', startDate: '2024-09-01', endDate: '2025-07-31', isActive: true },
        { label: '2025-2026', startDate: '2025-09-01', endDate: '2026-07-31', isActive: false },
      ],
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
    // Each call: create the Institution row first (the shared seedInstitutionData
    // function expects an EXISTING institution), then seed all per-institution
    // demo data (admin, staff, parent, teachers, classes, students, grades,
    // schedules, payments, attendance, announcements, messages, schoolConfig).
    for (const cfg of [ecoleConfig, lyceeConfig, polytechConfig]) {
      const inst = await db.institution.create({
        data: {
          name: cfg.institution.name,
          password: cfg.institution.password,
          address: cfg.institution.address,
          phone: cfg.institution.phone,
          email: cfg.institution.email,
          currentYear: cfg.institution.currentYear,
          active: true,
        },
      })
      await seedInstitutionData(
        {
          id: inst.id,
          name: inst.name,
          password: inst.password,
          address: inst.address,
          phone: inst.phone,
          email: inst.email,
          currentYear: inst.currentYear,
        },
        cfg,
        subjects,
        today
      )
    }

    // ---- Cas particuliers : marquer quelques élèves/enseignants comme non-actifs ----
    // (abandonné, migré, décédé) pour démontrer la section "Suivi des cas particuliers".
    try {
      const sampleStudents = await db.student.findMany({ take: 3, orderBy: { createdAt: 'asc' } })
      const sampleTeachers = await db.teacher.findMany({ take: 3, orderBy: { createdAt: 'asc' } })
      if (sampleStudents[0]) await db.student.update({ where: { id: sampleStudents[0].id }, data: { status: 'abandoned' } })
      if (sampleStudents[1]) await db.student.update({ where: { id: sampleStudents[1].id }, data: { status: 'migrated' } })
      if (sampleStudents[2]) await db.student.update({ where: { id: sampleStudents[2].id }, data: { status: 'deceased' } })
      if (sampleTeachers[0]) await db.teacher.update({ where: { id: sampleTeachers[0].id }, data: { status: 'abandoned' } })
      if (sampleTeachers[1]) await db.teacher.update({ where: { id: sampleTeachers[1].id }, data: { status: 'migrated' } })
      if (sampleTeachers[2]) await db.teacher.update({ where: { id: sampleTeachers[2].id }, data: { status: 'deceased' } })
    } catch {
      // Si la colonne status n'existe pas (base non synchronisée), on ignore — predev la créera.
    }

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

    return NextResponse.json({
      message: 'Base de données peuplée avec succès avec 3 institutions',
      stats,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      {
        error: 'Erreur lors du peuplement de la base de données',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
