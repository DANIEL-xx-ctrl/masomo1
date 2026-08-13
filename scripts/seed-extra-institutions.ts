// ============================================================================
// EduGest — Seed : 5 nouvelles institutions avec données complètes
// ----------------------------------------------------------------------------
// Ce script crée 5 nouvelles institutions de démonstration avec :
//   - 1 admin par institution
//   - 5 à 8 enseignants par institution
//   - 3 à 6 classes par institution
//   - 15 à 30 élèves par institution
//   - 1 parent par élève
//   - 1 membre du personnel par institution
//   - 8 matières par institution
//   - 4 notes par élève (2 matières × 2 trimestres)
//   - 1 paiement par élève
//   - Emplois du temps (schedules) pour chaque classe
//
// UTILISATION :
//   bun run scripts/seed-extra-institutions.ts
//
// Le script est IDEMPOTENT : il peut être relancé sans risque.
// Si une institution existe déjà (même mot de passe), elle est ignorée.
//
// À la fin, le script affiche un récapitulatif clair de toutes les
// institutions créées avec leurs identifiants de connexion.
// ============================================================================

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// =========================================================================
// Helpers
// =========================================================================

function randGrade(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 4) / 4
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pad(n: number, len = 3): string {
  return String(n).padStart(len, '0')
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

// =========================================================================
// Counter manager — to generate unique userCodes (ADM-XXX, ENS-XXX, ...)
// =========================================================================

let counters: Record<string, number> = {
  ADM: 0,
  ENS: 0,
  ELV: 0,
  PAR: 0,
  STF: 0,
}

async function loadCounters(): Promise<void> {
  const users = await db.user.findMany({ select: { userCode: true } })
  for (const u of users) {
    if (!u.userCode) continue
    const m = u.userCode.match(/^(ADM|ENS|ELV|PAR|STF)-(\d+)$/)
    if (m) {
      const n = parseInt(m[2], 10)
      if (n > counters[m[1]]) counters[m[1]] = n
    }
  }
  console.log(
    `[counters] Démarrage à ADM=${counters.ADM}, ENS=${counters.ENS}, ELV=${counters.ELV}, PAR=${counters.PAR}, STF=${counters.STF}`
  )
}

function nextCode(role: 'admin' | 'teacher' | 'student' | 'parent' | 'staff'): string {
  const map: Record<string, string> = {
    admin: 'ADM',
    teacher: 'ENS',
    student: 'ELV',
    parent: 'PAR',
    staff: 'STF',
  }
  const prefix = map[role]
  counters[prefix]++
  return `${prefix}-${pad(counters[prefix])}`
}

// =========================================================================
// Institution definitions — 5 new schools
// =========================================================================

interface NewInstitutionDef {
  name: string
  password: string
  address: string
  phone: string
  email: string
  adminEmail: string
  adminPassword: string
  subjects: { name: string; code: string; coefficient: number }[]
  teachers: {
    firstName: string
    lastName: string
    subject: string
    phone: string
    qualification: string
  }[]
  classes: {
    name: string
    level: string
    section: string
    capacity: number
    room: string
  }[]
  students: {
    firstName: string
    lastName: string
    gender: string
    dateOfBirth: string
    classIndex: number
    parentName: string
    parentPhone: string
  }[]
  staff: { firstName: string; lastName: string; fonction: string; phone: string }[]
}

const INSTITUTIONS: NewInstitutionDef[] = [
  // =====================================================================
  // 1. Institut Saint-Joseph (Douala) — Catholique
  // =====================================================================
  {
    name: 'Institut Saint-Joseph de Douala',
    password: 'saintjoseph2024',
    address: 'Akwa, Douala, Cameroun',
    phone: '+237 699 110 100',
    email: 'contact@saintjoseph-douala.cm',
    adminEmail: 'admin@saintjoseph.cm',
    adminPassword: 'admin123',
    subjects: [
      { name: 'Mathématiques', code: 'MATH-SJ', coefficient: 5 },
      { name: 'Français', code: 'FR-SJ', coefficient: 5 },
      { name: 'Anglais', code: 'ANG-SJ', coefficient: 4 },
      { name: 'Histoire-Géographie', code: 'HG-SJ', coefficient: 3 },
      { name: 'Sciences de la Vie et de la Terre', code: 'SVT-SJ', coefficient: 3 },
      { name: 'Physique-Chimie', code: 'PC-SJ', coefficient: 4 },
      { name: 'Éducation Religieuse', code: 'ER-SJ', coefficient: 2 },
      { name: 'Informatique', code: 'INFO-SJ', coefficient: 2 },
    ],
    teachers: [
      { firstName: 'Augustin', lastName: 'Mballa', subject: 'Mathématiques', phone: '+237 699 110 101', qualification: 'Doctorat en Mathématiques' },
      { firstName: 'Béatrice', lastName: 'Ngo Bell', subject: 'Français', phone: '+237 699 110 102', qualification: 'Maîtrise en Lettres Modernes' },
      { firstName: 'Christian', lastName: 'Eyenga', subject: 'Anglais', phone: '+237 699 110 103', qualification: 'Master en Langues Étrangères' },
      { firstName: 'Delphine', lastName: 'Mbarga', subject: 'Histoire-Géographie', phone: '+237 699 110 104', qualification: 'Licence en Histoire' },
      { firstName: 'Emmanuel', lastName: 'Nkongo', subject: 'Sciences de la Vie et de la Terre', phone: '+237 699 110 105', qualification: 'Master en Biologie' },
      { firstName: 'Florence', lastName: 'Tchoumi', subject: 'Physique-Chimie', phone: '+237 699 110 106', qualification: 'Ingénieur en Chimie' },
      { firstName: 'Gilbert', lastName: 'Atangana', subject: 'Éducation Religieuse', phone: '+237 699 110 107', qualification: 'Théologie' },
      { firstName: 'Hélène', lastName: 'Bessala', subject: 'Informatique', phone: '+237 699 110 108', qualification: 'Licence en Informatique' },
    ],
    classes: [
      { name: '6ème A', level: '6ème', section: 'A', capacity: 40, room: 'Salle 101' },
      { name: '5ème B', level: '5ème', section: 'B', capacity: 35, room: 'Salle 201' },
      { name: '4ème C', level: '4ème', section: 'C', capacity: 30, room: 'Salle 301' },
      { name: '3ème D', level: '3ème', section: 'D', capacity: 30, room: 'Salle 401' },
    ],
    students: [
      // 6ème A
      { firstName: 'Aurélien', lastName: 'Mvondo', gender: 'M', dateOfBirth: '2013-03-12', classIndex: 0, parentName: 'Bernard Mvondo', parentPhone: '+237 691 200 101' },
      { firstName: 'Bénédicte', lastName: 'Ngo Mballa', gender: 'F', dateOfBirth: '2013-05-25', classIndex: 0, parentName: 'Catherine Ngo', parentPhone: '+237 691 200 102' },
      { firstName: 'Cédric', lastName: 'Kamga', gender: 'M', dateOfBirth: '2013-01-08', classIndex: 0, parentName: 'Daniel Kamga', parentPhone: '+237 691 200 103' },
      { firstName: 'Danielle', lastName: 'Simo', gender: 'F', dateOfBirth: '2013-07-30', classIndex: 0, parentName: 'Estelle Simo', parentPhone: '+237 691 200 104' },
      { firstName: 'Éric', lastName: 'Tchoumi', gender: 'M', dateOfBirth: '2013-09-14', classIndex: 0, parentName: 'Françoise Tchoumi', parentPhone: '+237 691 200 105' },
      // 5ème B
      { firstName: 'Fabrice', lastName: 'Obama', gender: 'M', dateOfBirth: '2012-02-10', classIndex: 1, parentName: 'Grace Obama', parentPhone: '+237 692 300 101' },
      { firstName: 'Gisèle', lastName: 'Nkoulou', gender: 'F', dateOfBirth: '2012-06-22', classIndex: 1, parentName: 'Henri Nkoulou', parentPhone: '+237 692 300 102' },
      { firstName: 'Hervé', lastName: 'Eyenga', gender: 'M', dateOfBirth: '2012-08-04', classIndex: 1, parentName: 'Irène Eyenga', parentPhone: '+237 692 300 103' },
      { firstName: 'Inès', lastName: 'Tchaptchet', gender: 'F', dateOfBirth: '2012-12-17', classIndex: 1, parentName: 'Joseph Tchaptchet', parentPhone: '+237 692 300 104' },
      { firstName: 'Joël', lastName: 'Ze', gender: 'M', dateOfBirth: '2012-04-05', classIndex: 1, parentName: 'Karine Ze', parentPhone: '+237 692 300 105' },
      // 4ème C
      { firstName: 'Karin', lastName: 'Mvogo', gender: 'F', dateOfBirth: '2011-01-15', classIndex: 2, parentName: 'Laurent Mvogo', parentPhone: '+237 693 400 101' },
      { firstName: 'Lionel', lastName: 'Nganou', gender: 'M', dateOfBirth: '2011-05-03', classIndex: 2, parentName: 'Marie Nganou', parentPhone: '+237 693 400 102' },
      { firstName: 'Marta', lastName: 'Soh', gender: 'F', dateOfBirth: '2011-09-21', classIndex: 2, parentName: 'Norbert Soh', parentPhone: '+237 693 400 103' },
      { firstName: 'Norris', lastName: 'Metogo', gender: 'M', dateOfBirth: '2011-03-08', classIndex: 2, parentName: 'Olive Metogo', parentPhone: '+237 693 400 104' },
      { firstName: 'Ophélie', lastName: 'Ndoumbe', gender: 'F', dateOfBirth: '2011-07-14', classIndex: 2, parentName: 'Pierre Ndoumbe', parentPhone: '+237 693 400 105' },
      // 3ème D
      { firstName: 'Patrick', lastName: 'Ondoa', gender: 'M', dateOfBirth: '2010-04-22', classIndex: 3, parentName: 'Quitterie Ondoa', parentPhone: '+237 694 500 101' },
      { firstName: 'Quitterie', lastName: 'Balla', gender: 'F', dateOfBirth: '2010-08-09', classIndex: 3, parentName: 'Robert Balla', parentPhone: '+237 694 500 102' },
      { firstName: 'Rodrigue', lastName: 'Tchinda', gender: 'M', dateOfBirth: '2010-02-14', classIndex: 3, parentName: 'Suzanne Tchinda', parentPhone: '+237 694 500 103' },
      { firstName: 'Sylvie', lastName: 'Nguidi', gender: 'F', dateOfBirth: '2010-06-27', classIndex: 3, parentName: 'Théodore Nguidi', parentPhone: '+237 694 500 104' },
      { firstName: 'Thierry', lastName: 'Mengue', gender: 'M', dateOfBirth: '2010-10-05', classIndex: 3, parentName: 'Ursule Mengue', parentPhone: '+237 694 500 105' },
    ],
    staff: [
      { firstName: 'Albertine', lastName: 'Foko', fonction: 'Comptable', phone: '+237 699 110 200' },
    ],
  },

  // =====================================================================
  // 2. École Laïque de Garoua
  // =====================================================================
  {
    name: 'École Laïque de Garoua',
    password: 'garoua2024',
    address: 'Plateau, Garoua, Cameroun',
    phone: '+237 699 220 200',
    email: 'contact@garoua.ecole.cm',
    adminEmail: 'admin@garoua.cm',
    adminPassword: 'admin123',
    subjects: [
      { name: 'Mathématiques', code: 'MATH-GA', coefficient: 5 },
      { name: 'Français', code: 'FR-GA', coefficient: 5 },
      { name: 'Anglais', code: 'ANG-GA', coefficient: 4 },
      { name: 'Histoire-Géographie', code: 'HG-GA', coefficient: 3 },
      { name: 'Sciences de la Vie et de la Terre', code: 'SVT-GA', coefficient: 3 },
      { name: 'Physique-Chimie', code: 'PC-GA', coefficient: 4 },
      { name: 'Éducation Physique', code: 'EPS-GA', coefficient: 2 },
      { name: 'Informatique', code: 'INFO-GA', coefficient: 2 },
    ],
    teachers: [
      { firstName: 'Abdoulaye', lastName: 'Bello', subject: 'Mathématiques', phone: '+237 699 220 201', qualification: 'Maîtrise en Mathématiques' },
      { firstName: 'Fatou', lastName: 'Hamadou', subject: 'Français', phone: '+237 699 220 202', qualification: 'Licence en Lettres Modernes' },
      { firstName: 'Ibrahim', lastName: 'Moussa', subject: 'Anglais', phone: '+237 699 220 203', qualification: 'Master en Anglais' },
      { firstName: 'Aïcha', lastName: 'Oumarou', subject: 'Histoire-Géographie', phone: '+237 699 220 204', qualification: 'Licence en Histoire' },
      { firstName: 'Moussa', lastName: 'Souley', subject: 'Sciences de la Vie et de la Terre', phone: '+237 699 220 205', qualification: 'Maîtrise en Biologie' },
      { firstName: 'Zara', lastName: 'Abba', subject: 'Physique-Chimie', phone: '+237 699 220 206', qualification: 'Master en Physique' },
      { firstName: 'Boukar', lastName: 'Mahamat', subject: 'Éducation Physique', phone: '+237 699 220 207', qualification: 'Licence STAPS' },
      { firstName: 'Hadjé', lastName: 'Yaya', subject: 'Informatique', phone: '+237 699 220 208', qualification: 'Licence en Informatique' },
    ],
    classes: [
      { name: '6ème A', level: '6ème', section: 'A', capacity: 40, room: 'Salle 1' },
      { name: '5ème B', level: '5ème', section: 'B', capacity: 35, room: 'Salle 2' },
      { name: '4ème C', level: '4ème', section: 'C', capacity: 30, room: 'Salle 3' },
    ],
    students: [
      { firstName: 'Aboubakar', lastName: 'Sanda', gender: 'M', dateOfBirth: '2013-04-10', classIndex: 0, parentName: 'Abba Sanda', parentPhone: '+237 691 220 101' },
      { firstName: 'Aminatou', lastName: 'Boukar', gender: 'F', dateOfBirth: '2013-07-22', classIndex: 0, parentName: 'Boukar Aminou', parentPhone: '+237 691 220 102' },
      { firstName: 'Bachir', lastName: 'Lamido', gender: 'M', dateOfBirth: '2013-02-15', classIndex: 0, parentName: 'Lamido Ousmanou', parentPhone: '+237 691 220 103' },
      { firstName: 'Djamilatou', lastName: 'Sali', gender: 'F', dateOfBirth: '2013-11-30', classIndex: 0, parentName: 'Sali Mahamat', parentPhone: '+237 691 220 104' },
      { firstName: 'Issa', lastName: 'Wakilou', gender: 'M', dateOfBirth: '2013-09-05', classIndex: 0, parentName: 'Wakilou Issa', parentPhone: '+237 691 220 105' },
      { firstName: 'Fadimatou', lastName: 'Tchiombou', gender: 'F', dateOfBirth: '2012-03-18', classIndex: 1, parentName: 'Tchiombou Moussa', parentPhone: '+237 692 320 101' },
      { firstName: 'Hamadou', lastName: 'Bappa', gender: 'M', dateOfBirth: '2012-06-25', classIndex: 1, parentName: 'Bappa Hamadou', parentPhone: '+237 692 320 102' },
      { firstName: 'Kadiatou', lastName: 'Yacoubou', gender: 'F', dateOfBirth: '2012-10-12', classIndex: 1, parentName: 'Yacoubou Aboubakar', parentPhone: '+237 692 320 103' },
      { firstName: 'Mahamat', lastName: 'Adoum', gender: 'M', dateOfBirth: '2012-08-08', classIndex: 1, parentName: 'Adoum Mahamat', parentPhone: '+237 692 320 104' },
      { firstName: 'Malamine', lastName: 'Ndongo', gender: 'M', dateOfBirth: '2012-12-21', classIndex: 1, parentName: 'Ndongo Malamine', parentPhone: '+237 692 320 105' },
      { firstName: 'Oumatou', lastName: 'Ngaba', gender: 'F', dateOfBirth: '2011-01-14', classIndex: 2, parentName: 'Ngaba Oumarou', parentPhone: '+237 693 420 101' },
      { firstName: 'Salomon', lastName: 'Tchindji', gender: 'M', dateOfBirth: '2011-05-09', classIndex: 2, parentName: 'Tchindji Salomon', parentPhone: '+237 693 420 102' },
      { firstName: 'Véronique', lastName: 'Mbaïla', gender: 'F', dateOfBirth: '2011-09-03', classIndex: 2, parentName: 'Mbaïla Robert', parentPhone: '+237 693 420 103' },
      { firstName: 'Yves', lastName: 'Ganwa', gender: 'M', dateOfBirth: '2011-03-27', classIndex: 2, parentName: 'Ganwa Yves', parentPhone: '+237 693 420 104' },
      { firstName: 'Zoé', lastName: 'Mbouro', gender: 'F', dateOfBirth: '2011-07-19', classIndex: 2, parentName: 'Mbouro Zoé', parentPhone: '+237 693 420 105' },
    ],
    staff: [
      { firstName: 'Rachidatou', lastName: 'Wahyou', fonction: 'Secrétaire', phone: '+237 699 220 300' },
    ],
  },

  // =====================================================================
  // 3. Lycée Bilingue de Bafoussam
  // =====================================================================
  {
    name: 'Lycée Bilingue de Bafoussam',
    password: 'bafoussam2024',
    address: 'Quartier Banengo, Bafoussam, Cameroun',
    phone: '+237 699 330 300',
    email: 'contact@lyceebafoussam.cm',
    adminEmail: 'admin@bafoussam.cm',
    adminPassword: 'admin123',
    subjects: [
      { name: 'Mathématiques', code: 'MATH-BF', coefficient: 5 },
      { name: 'Français', code: 'FR-BF', coefficient: 5 },
      { name: 'English Language', code: 'ENG-BF', coefficient: 4 },
      { name: 'Histoire-Géographie', code: 'HG-BF', coefficient: 3 },
      { name: 'Sciences de la Vie et de la Terre', code: 'SVT-BF', coefficient: 3 },
      { name: 'Physique-Chimie', code: 'PC-BF', coefficient: 4 },
      { name: 'Économie', code: 'ECO-BF', coefficient: 3 },
      { name: 'Philosophie', code: 'PHILO-BF', coefficient: 2 },
      { name: 'Informatique', code: 'INFO-BF', coefficient: 2 },
    ],
    teachers: [
      { firstName: 'Clément', lastName: 'Tchoumbou', subject: 'Mathématiques', phone: '+237 699 330 301', qualification: 'Doctorat en Mathématiques' },
      { firstName: 'Dorothée', lastName: 'Kamgain', subject: 'Français', phone: '+237 699 330 302', qualification: 'Maîtrise en Lettres Modernes' },
      { firstName: 'Eric', lastName: 'Foka', subject: 'English Language', phone: '+237 699 330 303', qualification: 'Master in English' },
      { firstName: 'Florence', lastName: 'Nguepi', subject: 'Histoire-Géographie', phone: '+237 699 330 304', qualification: 'Licence en Histoire' },
      { firstName: 'Gérard', lastName: 'Tchoupo', subject: 'Sciences de la Vie et de la Terre', phone: '+237 699 330 305', qualification: 'Maîtrise en Biologie' },
      { firstName: 'Hortense', lastName: 'Mbiandji', subject: 'Physique-Chimie', phone: '+237 699 330 306', qualification: 'Ingénieur en Physique' },
      { firstName: 'Irène', lastName: 'Simeu', subject: 'Économie', phone: '+237 699 330 307', qualification: 'Master en Économie' },
      { firstName: 'Jean', lastName: 'Tchatcheu', subject: 'Philosophie', phone: '+237 699 330 308', qualification: 'Doctorat en Philosophie' },
      { firstName: 'Karen', lastName: 'Noumbissie', subject: 'Informatique', phone: '+237 699 330 309', qualification: 'Licence en Informatique' },
    ],
    classes: [
      { name: '6ème A', level: '6ème', section: 'A', capacity: 40, room: 'Salle 1' },
      { name: '5ème B', level: '5ème', section: 'B', capacity: 35, room: 'Salle 2' },
      { name: '4ème C', level: '4ème', section: 'C', capacity: 30, room: 'Salle 3' },
      { name: '3ème D', level: '3ème', section: 'D', capacity: 30, room: 'Salle 4' },
      { name: '2nde A', level: '2nde', section: 'A', capacity: 35, room: 'Salle 5' },
    ],
    students: [
      // 6ème A
      { firstName: 'Arnold', lastName: 'Tagne', gender: 'M', dateOfBirth: '2013-05-12', classIndex: 0, parentName: 'Bernard Tagne', parentPhone: '+237 691 230 101' },
      { firstName: 'Béatrice', lastName: 'Kaptso', gender: 'F', dateOfBirth: '2013-08-23', classIndex: 0, parentName: 'Catherine Kaptso', parentPhone: '+237 691 230 102' },
      { firstName: 'Calvin', lastName: 'Kamdem', gender: 'M', dateOfBirth: '2013-02-17', classIndex: 0, parentName: 'David Kamdem', parentPhone: '+237 691 230 103' },
      { firstName: 'Diana', lastName: 'Fotsing', gender: 'F', dateOfBirth: '2013-10-30', classIndex: 0, parentName: 'Esther Fotsing', parentPhone: '+237 691 230 104' },
      { firstName: 'Edwin', lastName: 'Nji', gender: 'M', dateOfBirth: '2013-12-05', classIndex: 0, parentName: 'Francis Nji', parentPhone: '+237 691 230 105' },
      // 5ème B
      { firstName: 'Flora', lastName: 'Ngo', gender: 'F', dateOfBirth: '2012-03-14', classIndex: 1, parentName: 'Gisèle Ngo', parentPhone: '+237 692 330 101' },
      { firstName: 'Gabin', lastName: 'Tchomgo', gender: 'M', dateOfBirth: '2012-07-22', classIndex: 1, parentName: 'Henri Tchomgo', parentPhone: '+237 692 330 102' },
      { firstName: 'Hélène', lastName: 'Ngaha', gender: 'F', dateOfBirth: '2012-11-08', classIndex: 1, parentName: 'Irène Ngaha', parentPhone: '+237 692 330 103' },
      { firstName: 'Ivan', lastName: 'Sigha', gender: 'M', dateOfBirth: '2012-04-19', classIndex: 1, parentName: 'Joséphine Sigha', parentPhone: '+237 692 330 104' },
      { firstName: 'Jessica', lastName: 'Bekolo', gender: 'F', dateOfBirth: '2012-09-12', classIndex: 1, parentName: 'Karl Bekolo', parentPhone: '+237 692 330 105' },
      // 4ème C
      { firstName: 'Kevin', lastName: 'Tchatchou', gender: 'M', dateOfBirth: '2011-01-25', classIndex: 2, parentName: 'Léa Tchatchou', parentPhone: '+237 693 430 101' },
      { firstName: 'Linda', lastName: 'Mfoumou', gender: 'F', dateOfBirth: '2011-06-13', classIndex: 2, parentName: 'Marc Mfoumou', parentPhone: '+237 693 430 102' },
      { firstName: 'Morgan', lastName: 'Foko', gender: 'M', dateOfBirth: '2011-10-02', classIndex: 2, parentName: 'Nathalie Foko', parentPhone: '+237 693 430 103' },
      { firstName: 'Natacha', lastName: 'Wabo', gender: 'F', dateOfBirth: '2011-03-21', classIndex: 2, parentName: 'Olivier Wabo', parentPhone: '+237 693 430 104' },
      { firstName: 'Oscar', lastName: 'Etogo', gender: 'M', dateOfBirth: '2011-08-17', classIndex: 2, parentName: 'Pauline Etogo', parentPhone: '+237 693 430 105' },
      // 3ème D
      { firstName: 'Prisca', lastName: 'Mengue', gender: 'F', dateOfBirth: '2010-04-08', classIndex: 3, parentName: 'Quentin Mengue', parentPhone: '+237 694 530 101' },
      { firstName: 'Quentin', lastName: 'Ngo', gender: 'M', dateOfBirth: '2010-09-15', classIndex: 3, parentName: 'Rachel Ngo', parentPhone: '+237 694 530 102' },
      { firstName: 'Rosine', lastName: 'Balla', gender: 'F', dateOfBirth: '2010-02-23', classIndex: 3, parentName: 'Serge Balla', parentPhone: '+237 694 530 103' },
      { firstName: 'Sylvain', lastName: 'Kouam', gender: 'M', dateOfBirth: '2010-07-11', classIndex: 3, parentName: 'Thérèse Kouam', parentPhone: '+237 694 530 104' },
      { firstName: 'Théa', lastName: 'Ngomeni', gender: 'F', dateOfBirth: '2010-12-28', classIndex: 3, parentName: 'Urbain Ngomeni', parentPhone: '+237 694 530 105' },
      // 2nde A
      { firstName: 'Ulrich', lastName: 'Tchoumi', gender: 'M', dateOfBirth: '2009-03-09', classIndex: 4, parentName: 'Valérie Tchoumi', parentPhone: '+237 695 630 101' },
      { firstName: 'Vanessa', lastName: 'Mballa', gender: 'F', dateOfBirth: '2009-07-26', classIndex: 4, parentName: 'Willy Mballa', parentPhone: '+237 695 630 102' },
      { firstName: 'Willy', lastName: 'Ngono', gender: 'M', dateOfBirth: '2009-11-14', classIndex: 4, parentName: 'Xavière Ngono', parentPhone: '+237 695 630 103' },
      { firstName: 'Xavière', lastName: 'Abe', gender: 'F', dateOfBirth: '2009-05-03', classIndex: 4, parentName: 'Yves Abe', parentPhone: '+237 695 630 104' },
      { firstName: 'Yann', lastName: 'Bekolo', gender: 'M', dateOfBirth: '2009-10-19', classIndex: 4, parentName: 'Zoé Bekolo', parentPhone: '+237 695 630 105' },
    ],
    staff: [
      { firstName: 'Lambert', lastName: 'Sighom', fonction: 'Surveillant Général', phone: '+237 699 330 400' },
    ],
  },

  // =====================================================================
  // 4. Collège Protestant de Maroua
  // =====================================================================
  {
    name: 'Collège Protestant de Maroua',
    password: 'maroua2024',
    address: 'Domayo, Maroua, Cameroun',
    phone: '+237 699 440 400',
    email: 'contact@protestant-maroua.cm',
    adminEmail: 'admin@maroua.cm',
    adminPassword: 'admin123',
    subjects: [
      { name: 'Mathématiques', code: 'MATH-MA', coefficient: 5 },
      { name: 'Français', code: 'FR-MA', coefficient: 5 },
      { name: 'Anglais', code: 'ANG-MA', coefficient: 4 },
      { name: 'Histoire-Géographie', code: 'HG-MA', coefficient: 3 },
      { name: 'Sciences de la Vie et de la Terre', code: 'SVT-MA', coefficient: 3 },
      { name: 'Physique-Chimie', code: 'PC-MA', coefficient: 4 },
      { name: 'Éducation Chrétienne', code: 'EC-MA', coefficient: 2 },
      { name: 'Informatique', code: 'INFO-MA', coefficient: 2 },
    ],
    teachers: [
      { firstName: 'Pasteur', lastName: 'Ndjoukou', subject: 'Éducation Chrétienne', phone: '+237 699 440 401', qualification: 'Théologie' },
      { firstName: 'André', lastName: 'Wakili', subject: 'Mathématiques', phone: '+237 699 440 402', qualification: 'Maîtrise en Mathématiques' },
      { firstName: 'Bernadette', lastName: 'Mbatchou', subject: 'Français', phone: '+237 699 440 403', qualification: 'Licence en Lettres Modernes' },
      { firstName: 'Camille', lastName: 'Boukar', subject: 'Anglais', phone: '+237 699 440 404', qualification: 'Master en Anglais' },
      { firstName: 'David', lastName: 'Mbairo', subject: 'Histoire-Géographie', phone: '+237 699 440 405', qualification: 'Licence en Histoire' },
      { firstName: 'Esther', lastName: 'Yaya', subject: 'Sciences de la Vie et de la Terre', phone: '+237 699 440 406', qualification: 'Maîtrise en Biologie' },
      { firstName: 'François', lastName: 'Hamadou', subject: 'Physique-Chimie', phone: '+237 699 440 407', qualification: 'Ingénieur en Physique' },
      { firstName: 'Gilbert', lastName: 'Moussa', subject: 'Informatique', phone: '+237 699 440 408', qualification: 'Licence en Informatique' },
    ],
    classes: [
      { name: '6ème A', level: '6ème', section: 'A', capacity: 40, room: 'Salle 1' },
      { name: '5ème B', level: '5ème', section: 'B', capacity: 35, room: 'Salle 2' },
      { name: '4ème C', level: '4ème', section: 'C', capacity: 30, room: 'Salle 3' },
      { name: '3ème D', level: '3ème', section: 'D', capacity: 30, room: 'Salle 4' },
    ],
    students: [
      { firstName: 'Abel', lastName: 'Kalia', gender: 'M', dateOfBirth: '2013-03-15', classIndex: 0, parentName: 'Barnabé Kalia', parentPhone: '+237 691 240 101' },
      { firstName: 'Bethel', lastName: 'Ngarba', gender: 'F', dateOfBirth: '2013-06-28', classIndex: 0, parentName: 'Catherine Ngarba', parentPhone: '+237 691 240 102' },
      { firstName: 'Caleb', lastName: 'Ndongo', gender: 'M', dateOfBirth: '2013-01-19', classIndex: 0, parentName: 'Daniel Ndongo', parentPhone: '+237 691 240 103' },
      { firstName: 'Debora', lastName: 'Wakili', gender: 'F', dateOfBirth: '2013-10-04', classIndex: 0, parentName: 'Esther Wakili', parentPhone: '+237 691 240 104' },
      { firstName: 'Eli', lastName: 'Moussa', gender: 'M', dateOfBirth: '2013-12-21', classIndex: 0, parentName: 'François Moussa', parentPhone: '+237 691 240 105' },
      { firstName: 'Faith', lastName: 'Abba', gender: 'F', dateOfBirth: '2012-02-11', classIndex: 1, parentName: 'Gédéon Abba', parentPhone: '+237 692 340 101' },
      { firstName: 'Gédéon', lastName: 'Boukar', gender: 'M', dateOfBirth: '2012-05-23', classIndex: 1, parentName: 'Hélène Boukar', parentPhone: '+237 692 340 102' },
      { firstName: 'Hanna', lastName: 'Hamadou', gender: 'F', dateOfBirth: '2012-09-17', classIndex: 1, parentName: 'Isaac Hamadou', parentPhone: '+237 692 340 103' },
      { firstName: 'Isaac', lastName: 'Mbatchou', gender: 'M', dateOfBirth: '2012-04-09', classIndex: 1, parentName: 'Julie Mbatchou', parentPhone: '+237 692 340 104' },
      { firstName: 'Joy', lastName: 'Ndjoukou', gender: 'F', dateOfBirth: '2012-11-25', classIndex: 1, parentName: 'Kevin Ndjoukou', parentPhone: '+237 692 340 105' },
      { firstName: 'Kévin', lastName: 'Mbairo', gender: 'M', dateOfBirth: '2011-01-08', classIndex: 2, parentName: 'Léa Mbairo', parentPhone: '+237 693 440 101' },
      { firstName: 'Léa', lastName: 'Yaya', gender: 'F', dateOfBirth: '2011-07-14', classIndex: 2, parentName: 'Marc Yaya', parentPhone: '+237 693 440 102' },
      { firstName: 'Marc', lastName: 'Sanda', gender: 'M', dateOfBirth: '2011-10-29', classIndex: 2, parentName: 'Naomi Sanda', parentPhone: '+237 693 440 103' },
      { firstName: 'Naomi', lastName: 'Tcholliré', gender: 'F', dateOfBirth: '2011-03-02', classIndex: 2, parentName: 'Oscar Tcholliré', parentPhone: '+237 693 440 104' },
      { firstName: 'Oscar', lastName: 'Moussa', gender: 'M', dateOfBirth: '2011-08-19', classIndex: 2, parentName: 'Pascale Moussa', parentPhone: '+237 693 440 105' },
      { firstName: 'Pascale', lastName: 'Boukar', gender: 'F', dateOfBirth: '2010-04-13', classIndex: 3, parentName: 'Quentin Boukar', parentPhone: '+237 694 540 101' },
      { firstName: 'Quentin', lastName: 'Ndongo', gender: 'M', dateOfBirth: '2010-09-28', classIndex: 3, parentName: 'Rachelle Ndongo', parentPhone: '+237 694 540 102' },
      { firstName: 'Rachelle', lastName: 'Hamadou', gender: 'F', dateOfBirth: '2010-02-16', classIndex: 3, parentName: 'Samuel Hamadou', parentPhone: '+237 694 540 103' },
      { firstName: 'Samuel', lastName: 'Abba', gender: 'M', dateOfBirth: '2010-07-04', classIndex: 3, parentName: 'Thérèse Abba', parentPhone: '+237 694 540 104' },
      { firstName: 'Thérèse', lastName: 'Mbatchou', gender: 'F', dateOfBirth: '2010-12-22', classIndex: 3, parentName: 'Ulrich Mbatchou', parentPhone: '+237 694 540 105' },
    ],
    staff: [
      { firstName: 'Pasteur', lastName: 'Daniel', fonction: 'Aumônier', phone: '+237 699 440 500' },
    ],
  },

  // =====================================================================
  // 5. Institut Technique de Bamenda
  // =====================================================================
  {
    name: 'Institut Technique de Bamenda',
    password: 'bamenda2024',
    address: 'Commercial Avenue, Bamenda, Cameroun',
    phone: '+237 699 550 500',
    email: 'contact@bamenda-tech.cm',
    adminEmail: 'admin@bamenda.cm',
    adminPassword: 'admin123',
    subjects: [
      { name: 'Mathématiques', code: 'MATH-BA', coefficient: 5 },
      { name: 'English Language', code: 'ENG-BA', coefficient: 5 },
      { name: 'French', code: 'FR-BA', coefficient: 4 },
      { name: 'Physics', code: 'PHY-BA', coefficient: 4 },
      { name: 'Chemistry', code: 'CHM-BA', coefficient: 4 },
      { name: 'Computer Science', code: 'CS-BA', coefficient: 4 },
      { name: 'Engineering Drawing', code: 'ED-BA', coefficient: 3 },
      { name: 'Workshop Practice', code: 'WP-BA', coefficient: 3 },
      { name: 'Technical Drawing', code: 'TD-BA', coefficient: 3 },
      { name: 'Economics', code: 'ECO-BA', coefficient: 2 },
    ],
    teachers: [
      { firstName: 'John', lastName: 'Nformi', subject: 'Mathématiques', phone: '+237 699 550 501', qualification: 'MSc in Mathematics' },
      { firstName: 'Mary', lastName: 'Nkwi', subject: 'English Language', phone: '+237 699 550 502', qualification: 'MA in English' },
      { firstName: 'Peter', lastName: 'Tatah', subject: 'French', phone: '+237 699 550 503', qualification: 'Maîtrise en Français' },
      { firstName: 'Grace', lastName: 'Fombu', subject: 'Physics', phone: '+237 699 550 504', qualification: 'MSc in Physics' },
      { firstName: 'Samuel', lastName: 'Shu', subject: 'Chemistry', phone: '+237 699 550 505', qualification: 'MSc in Chemistry' },
      { firstName: 'Janet', lastName: 'Ngeh', subject: 'Computer Science', phone: '+237 699 550 506', qualification: 'BSc in Computer Science' },
      { firstName: 'Paul', lastName: 'Nyam', subject: 'Engineering Drawing', phone: '+237 699 550 507', qualification: 'BEng Mechanical' },
      { firstName: 'Rose', lastName: 'Fon', subject: 'Workshop Practice', phone: '+237 699 550 508', qualification: 'HND Engineering' },
      { firstName: 'James', lastName: 'Tanjang', subject: 'Technical Drawing', phone: '+237 699 550 509', qualification: 'BEng Civil' },
      { firstName: 'Janet', lastName: 'Nkeng', subject: 'Economics', phone: '+237 699 550 510', qualification: 'MSc in Economics' },
    ],
    classes: [
      { name: 'Form 1 A', level: 'Form 1', section: 'A', capacity: 40, room: 'Room 1' },
      { name: 'Form 2 B', level: 'Form 2', section: 'B', capacity: 35, room: 'Room 2' },
      { name: 'Form 3 C', level: 'Form 3', section: 'C', capacity: 30, room: 'Room 3' },
      { name: 'Form 4 D', level: 'Form 4', section: 'D', capacity: 30, room: 'Room 4' },
      { name: 'Form 5 E', level: 'Form 5', section: 'E', capacity: 25, room: 'Room 5' },
      { name: 'Upper Sixth F', level: 'Upper Sixth', section: 'F', capacity: 20, room: 'Room 6' },
    ],
    students: [
      // Form 1 A
      { firstName: 'Aaron', lastName: 'Nyam', gender: 'M', dateOfBirth: '2013-02-12', classIndex: 0, parentName: 'Bernard Nyam', parentPhone: '+237 691 250 101' },
      { firstName: 'Bridget', lastName: 'Fon', gender: 'F', dateOfBirth: '2013-05-24', classIndex: 0, parentName: 'Catherine Fon', parentPhone: '+237 691 250 102' },
      { firstName: 'Carl', lastName: 'Shu', gender: 'M', dateOfBirth: '2013-09-08', classIndex: 0, parentName: 'Daniel Shu', parentPhone: '+237 691 250 103' },
      { firstName: 'Diana', lastName: 'Nkwi', gender: 'F', dateOfBirth: '2013-11-30', classIndex: 0, parentName: 'Eric Nkwi', parentPhone: '+237 691 250 104' },
      { firstName: 'Edward', lastName: 'Tanjang', gender: 'M', dateOfBirth: '2013-03-18', classIndex: 0, parentName: 'Felicity Tanjang', parentPhone: '+237 691 250 105' },
      // Form 2 B
      { firstName: 'Faith', lastName: 'Nformi', gender: 'F', dateOfBirth: '2012-04-15', classIndex: 1, parentName: 'George Nformi', parentPhone: '+237 692 350 101' },
      { firstName: 'George', lastName: 'Tatah', gender: 'M', dateOfBirth: '2012-08-22', classIndex: 1, parentName: 'Helen Tatah', parentPhone: '+237 692 350 102' },
      { firstName: 'Helen', lastName: 'Fombu', gender: 'F', dateOfBirth: '2012-12-09', classIndex: 1, parentName: 'Isaac Fombu', parentPhone: '+237 692 350 103' },
      { firstName: 'Isaac', lastName: 'Ngeh', gender: 'M', dateOfBirth: '2012-06-17', classIndex: 1, parentName: 'Janet Ngeh', parentPhone: '+237 692 350 104' },
      { firstName: 'Joy', lastName: 'Nkeng', gender: 'F', dateOfBirth: '2012-10-04', classIndex: 1, parentName: 'Kevin Nkeng', parentPhone: '+237 692 350 105' },
      // Form 3 C
      { firstName: 'Kevin', lastName: 'Nformi', gender: 'M', dateOfBirth: '2011-01-25', classIndex: 2, parentName: 'Lillian Nformi', parentPhone: '+237 693 450 101' },
      { firstName: 'Lillian', lastName: 'Nkwi', gender: 'F', dateOfBirth: '2011-05-13', classIndex: 2, parentName: 'Martin Nkwi', parentPhone: '+237 693 450 102' },
      { firstName: 'Martin', lastName: 'Shu', gender: 'M', dateOfBirth: '2011-09-30', classIndex: 2, parentName: 'Nancy Shu', parentPhone: '+237 693 450 103' },
      { firstName: 'Nancy', lastName: 'Fon', gender: 'F', dateOfBirth: '2011-03-08', classIndex: 2, parentName: 'Oscar Fon', parentPhone: '+237 693 450 104' },
      { firstName: 'Oscar', lastName: 'Fombu', gender: 'M', dateOfBirth: '2011-07-26', classIndex: 2, parentName: 'Patricia Fombu', parentPhone: '+237 693 450 105' },
      // Form 4 D
      { firstName: 'Patricia', lastName: 'Tanjang', gender: 'F', dateOfBirth: '2010-04-11', classIndex: 3, parentName: 'Quentin Tanjang', parentPhone: '+237 694 550 101' },
      { firstName: 'Quentin', lastName: 'Ngeh', gender: 'M', dateOfBirth: '2010-09-28', classIndex: 3, parentName: 'Rachel Ngeh', parentPhone: '+237 694 550 102' },
      { firstName: 'Rachel', lastName: 'Nkeng', gender: 'F', dateOfBirth: '2010-02-15', classIndex: 3, parentName: 'Samuel Nkeng', parentPhone: '+237 694 550 103' },
      { firstName: 'Samuel', lastName: 'Nyam', gender: 'M', dateOfBirth: '2010-07-03', classIndex: 3, parentName: 'Theresa Nyam', parentPhone: '+237 694 550 104' },
      { firstName: 'Theresa', lastName: 'Fon', gender: 'F', dateOfBirth: '2010-12-20', classIndex: 3, parentName: 'Ulrich Fon', parentPhone: '+237 694 550 105' },
      // Form 5 E
      { firstName: 'Ulrich', lastName: 'Shu', gender: 'M', dateOfBirth: '2009-03-07', classIndex: 4, parentName: 'Victoria Shu', parentPhone: '+237 695 650 101' },
      { firstName: 'Victoria', lastName: 'Fombu', gender: 'F', dateOfBirth: '2009-08-24', classIndex: 4, parentName: 'William Fombu', parentPhone: '+237 695 650 102' },
      { firstName: 'William', lastName: 'Tatah', gender: 'M', dateOfBirth: '2009-12-11', classIndex: 4, parentName: 'Xavier Tatah', parentPhone: '+237 695 650 103' },
      { firstName: 'Xavier', lastName: 'Nkwi', gender: 'M', dateOfBirth: '2009-05-29', classIndex: 4, parentName: 'Yvonne Nkwi', parentPhone: '+237 695 650 104' },
      { firstName: 'Yvonne', lastName: 'Ngeh', gender: 'F', dateOfBirth: '2009-10-16', classIndex: 4, parentName: 'Zachariah Ngeh', parentPhone: '+237 695 650 105' },
      // Upper Sixth F
      { firstName: 'Zachariah', lastName: 'Tanjang', gender: 'M', dateOfBirth: '2008-02-03', classIndex: 5, parentName: 'Abigail Tanjang', parentPhone: '+237 696 750 101' },
      { firstName: 'Abigail', lastName: 'Nkeng', gender: 'F', dateOfBirth: '2008-06-21', classIndex: 5, parentName: 'Brian Nkeng', parentPhone: '+237 696 750 102' },
      { firstName: 'Brian', lastName: 'Nyam', gender: 'M', dateOfBirth: '2008-10-08', classIndex: 5, parentName: 'Cynthia Nyam', parentPhone: '+237 696 750 103' },
      { firstName: 'Cynthia', lastName: 'Fon', gender: 'F', dateOfBirth: '2008-04-26', classIndex: 5, parentName: 'David Fon', parentPhone: '+237 696 750 104' },
      { firstName: 'David', lastName: 'Shu', gender: 'M', dateOfBirth: '2008-09-13', classIndex: 5, parentName: 'Esther Shu', parentPhone: '+237 696 750 105' },
    ],
    staff: [
      { firstName: 'Cornelius', lastName: 'Njumbeng', fonction: 'Registrar', phone: '+237 699 550 600' },
    ],
  },
]

// =========================================================================
// Seed one institution (idempotent)
// =========================================================================

async function seedInstitution(def: NewInstitutionDef): Promise<{
  created: boolean
  institutionId: string
  stats: {
    subjects: number
    teachers: number
    classes: number
    students: number
    parents: number
    staff: number
    grades: number
    payments: number
    schedules: number
  }
}> {
  // Check if institution already exists (by password — unique field)
  const existing = await db.institution.findUnique({
    where: { password: def.password },
  })

  if (existing) {
    console.log(
      `[skip] Institution « ${def.name} » existe déjà (password: ${def.password}) — ignorée.`
    )
    return {
      created: false,
      institutionId: existing.id,
      stats: {
        subjects: 0,
        teachers: 0,
        classes: 0,
        students: 0,
        parents: 0,
        staff: 0,
        grades: 0,
        payments: 0,
        schedules: 0,
      },
    }
  }

  console.log(`\n[seed] Création de « ${def.name} »...`)
  const stats = {
    subjects: 0,
    teachers: 0,
    classes: 0,
    students: 0,
    parents: 0,
    staff: 0,
    grades: 0,
    payments: 0,
    schedules: 0,
  }

  // ---- Create institution ----
  const institution = await db.institution.create({
    data: {
      name: def.name,
      password: def.password,
      address: def.address,
      phone: def.phone,
      email: def.email,
      currentYear: '2024-2025',
      active: true,
    },
  })

  // ---- Create admin user ----
  counters.ADM++
  const adminUser = await db.user.create({
    data: {
      userCode: `ADM-${pad(counters.ADM)}`,
      email: def.adminEmail,
      password: def.adminPassword,
      name: `Administrateur ${def.name}`,
      role: 'admin',
      phone: def.phone,
      active: true,
      institutionId: institution.id,
    },
  })
  console.log(`  ✓ Admin : ${adminUser.email} / ${def.adminPassword}`)

  // ---- Create subjects ----
  const subjectMap: Record<string, { id: string }> = {}
  for (const s of def.subjects) {
    const subject = await db.subject.create({
      data: {
        name: s.name,
        code: s.code,
        coefficient: s.coefficient,
      },
    })
    subjectMap[s.name] = subject
    stats.subjects++
  }
  console.log(`  ✓ ${stats.subjects} matières`)

  // ---- Create teachers ----
  const teachers: { id: string; subject: string; userId: string }[] = []
  for (const t of def.teachers) {
    counters.ENS++
    const emailBase = `${slugify(t.firstName)}.${slugify(t.lastName)}@${slugify(def.name.split(' ')[0])}.cm`
    const user = await db.user.create({
      data: {
        userCode: `ENS-${pad(counters.ENS)}`,
        email: emailBase,
        password: 'enseignant123',
        name: `${t.firstName} ${t.lastName}`,
        role: 'teacher',
        phone: t.phone,
        active: true,
        institutionId: institution.id,
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
        hireDate: '2021-09-01',
      },
    })
    teachers.push({ id: teacher.id, subject: t.subject, userId: user.id })
    stats.teachers++
  }
  console.log(`  ✓ ${stats.teachers} enseignants (mot de passe: enseignant123)`)

  // ---- Create classes ----
  const classes: { id: string; name: string; level: string }[] = []
  for (const c of def.classes) {
    const cls = await db.class.create({
      data: {
        name: c.name,
        level: c.level,
        section: c.section,
        capacity: c.capacity,
        room: c.room,
        schoolYear: '2024-2025',
        institutionId: institution.id,
      },
    })
    classes.push({ id: cls.id, name: cls.name, level: cls.level })
    stats.classes++
  }
  console.log(`  ✓ ${stats.classes} classes`)

  // ---- Assign teachers to classes ----
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

  // ---- Create schedules (5 days × 8h-15h per class, 1h slots) ----
  const days = [1, 2, 3, 4, 5]
  const slots = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:15', end: '11:15' },
    { start: '11:15', end: '12:15' },
    { start: '15:00', end: '16:00' },
  ]
  for (const cls of classes) {
    for (const day of days) {
      for (const slot of slots) {
        const teacher = pick(teachers)
        await db.schedule.create({
          data: {
            classId: cls.id,
            teacherId: teacher.id,
            subject: teacher.subject,
            dayOfWeek: day,
            startTime: slot.start,
            endTime: slot.end,
            room: cls.name,
          },
        })
        stats.schedules++
      }
    }
  }
  console.log(`  ✓ ${stats.schedules} créneaux d'emploi du temps`)

  // ---- Create students + parents + grades + payments ----
  const parentPassword = 'parent123'
  for (let i = 0; i < def.students.length; i++) {
    const s = def.students[i]
    const cls = classes[s.classIndex]
    const emailBase = `${slugify(s.firstName)}.${slugify(s.lastName)}@${slugify(def.name.split(' ')[0])}.cm`

    // Student user
    counters.ELV++
    const studentUser = await db.user.create({
      data: {
        userCode: `ELV-${pad(counters.ELV)}`,
        email: emailBase,
        password: 'eleve123',
        name: `${s.firstName} ${s.lastName}`,
        role: 'student',
        phone: `+237 600 ${String(i + 1).padStart(6, '0')}`,
        active: true,
        institutionId: institution.id,
      },
    })

    const student = await db.student.create({
      data: {
        userId: studentUser.id,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        address: def.address,
        enrollmentDate: '2024-09-02',
        parentContact: s.parentName,
        parentPhone: s.parentPhone,
        classId: cls.id,
      },
    })
    stats.students++

    // Parent
    counters.PAR++
    const parentEmail = `${slugify(s.parentName)}@${slugify(def.name.split(' ')[0])}.cm`
    const parentUser = await db.user.create({
      data: {
        userCode: `PAR-${pad(counters.PAR)}`,
        email: parentEmail,
        password: parentPassword,
        name: s.parentName,
        role: 'parent',
        phone: s.parentPhone,
        active: true,
        institutionId: institution.id,
      },
    })
    await db.parent.create({
      data: {
        userId: parentUser.id,
        firstName: s.parentName.split(' ')[0],
        lastName: s.parentName.split(' ').slice(1).join(' '),
        phone: s.parentPhone,
        address: def.address,
      },
    })
    stats.parents++

    // Grades — 4 grades per student (2 subjects × 2 trimesters)
    const subjectNames = def.subjects.slice(0, 2).map((s) => s.name)
    const trimesters = ['1er', '2eme']
    for (const subjectName of subjectNames) {
      const subject = subjectMap[subjectName]
      if (!subject) continue
      // Find teacher for this subject
      const teacher = teachers.find((t) => t.subject === subjectName) || teachers[0]
      for (const trimester of trimesters) {
        await db.grade.create({
          data: {
            studentId: student.id,
            subjectId: subject.id,
            classId: cls.id,
            teacherId: teacher.id,
            value: randGrade(8, 18),
            maxValue: 20,
            type: pick(['devoir', 'examen', 'controle']),
            trimester,
            schoolYear: '2024-2025',
            date: trimester === '1er' ? '2024-11-15' : '2025-03-15',
          },
        })
        stats.grades++
      }
    }

    // Payment
    await db.payment.create({
      data: {
        studentId: student.id,
        amount: pick([50000, 75000, 100000, 150000, 200000]),
        type: pick(['tuition', 'registration', 'exam_fee']),
        method: pick(['cash', 'mobile_money', 'bank_transfer']),
        status: 'completed',
        reference: `PAY-${def.password.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        description: 'Frais de scolarité 2024-2025',
        schoolYear: '2024-2025',
        paymentDate: '2024-09-15',
      },
    })
    stats.payments++
  }
  console.log(
    `  ✓ ${stats.students} élèves (mot de passe: eleve123), ${stats.parents} parents (mot de passe: parent123)`
  )
  console.log(`  ✓ ${stats.grades} notes, ${stats.payments} paiements`)

  // ---- Create staff ----
  for (const st of def.staff) {
    counters.STF++
    const staffEmail = `${slugify(st.firstName)}.${slugify(st.lastName)}@${slugify(def.name.split(' ')[0])}.cm`
    const staffUser = await db.user.create({
      data: {
        userCode: `STF-${pad(counters.STF)}`,
        email: staffEmail,
        password: 'staff123',
        name: `${st.firstName} ${st.lastName}`,
        role: 'staff',
        phone: st.phone,
        active: true,
        institutionId: institution.id,
      },
    })
    await db.staff.create({
      data: {
        userId: staffUser.id,
        firstName: st.firstName,
        lastName: st.lastName,
        fonction: st.fonction,
        phone: st.phone,
        email: staffEmail,
      },
    })
    stats.staff++
  }
  console.log(`  ✓ ${stats.staff} personnel (mot de passe: staff123)`)

  return { created: true, institutionId: institution.id, stats }
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  console.log('════════════════════════════════════════════════════════════════')
  console.log('  EduGest — Seed : 5 nouvelles institutions de démonstration')
  console.log('════════════════════════════════════════════════════════════════\n')

  await loadCounters()

  const results: {
    name: string
    password: string
    adminEmail: string
    adminPassword: string
    created: boolean
    stats: { [k: string]: number }
  }[] = []

  for (const def of INSTITUTIONS) {
    const result = await seedInstitution(def)
    results.push({
      name: def.name,
      password: def.password,
      adminEmail: def.adminEmail,
      adminPassword: def.adminPassword,
      created: result.created,
      stats: result.stats,
    })
  }

  // ---- Summary ----
  console.log('\n════════════════════════════════════════════════════════════════')
  console.log('  RÉCAPITULATIF')
  console.log('════════════════════════════════════════════════════════════════\n')

  const totals = {
    subjects: 0,
    teachers: 0,
    classes: 0,
    students: 0,
    parents: 0,
    staff: 0,
    grades: 0,
    payments: 0,
    schedules: 0,
  }
  let createdCount = 0

  for (const r of results) {
    const status = r.created ? '✓ CRÉÉE' : '⟳ EXISTANTE'
    console.log(`● ${r.name}`)
    console.log(`    ${status}`)
    console.log(`    Mot de passe institution : ${r.password}`)
    console.log(`    Admin : ${r.adminEmail} / ${r.adminPassword}`)
    if (r.created) {
      console.log(
        `    Détails : ${r.stats.teachers} enseignants, ${r.stats.classes} classes, ${r.stats.students} élèves, ${r.stats.parents} parents, ${r.stats.staff} personnel, ${r.stats.grades} notes, ${r.stats.payments} paiements`
      )
      createdCount++
      for (const k of Object.keys(totals)) {
        totals[k as keyof typeof totals] += r.stats[k as keyof typeof totals] || 0
      }
    }
    console.log('')
  }

  console.log('────────────────────────────────────────────────────────────────')
  console.log(`Institutions créées lors de ce run : ${createdCount} / ${INSTITUTIONS.length}`)
  if (createdCount > 0) {
    console.log(`Totaux ajoutés :`)
    console.log(`  - Matières     : ${totals.subjects}`)
    console.log(`  - Enseignants  : ${totals.teachers}    (mot de passe : enseignant123)`)
    console.log(`  - Classes      : ${totals.classes}`)
    console.log(`  - Élèves       : ${totals.students}    (mot de passe : eleve123)`)
    console.log(`  - Parents      : ${totals.parents}    (mot de passe : parent123)`)
    console.log(`  - Personnel    : ${totals.staff}    (mot de passe : staff123)`)
    console.log(`  - Notes        : ${totals.grades}`)
    console.log(`  - Paiements    : ${totals.payments}`)
    console.log(`  - Cours (EDT)  : ${totals.schedules}`)
  }
  console.log('────────────────────────────────────────────────────────────────')
  console.log('\n✓ Seed terminé avec succès !\n')
}

main()
  .catch((e) => {
    console.error('\n✗ Erreur pendant le seed :', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
