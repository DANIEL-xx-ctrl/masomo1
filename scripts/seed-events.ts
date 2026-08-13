import { db } from '@/lib/db'

const SCHOOL_YEAR = '2024-2025'

// Typical school calendar events for a West African school
const EVENTS = [
  // === SEPTEMBER 2024 — Rentrée ===
  { title: 'Rentrée scolaire', description: 'Premier jour de cours', date: '2024-09-02', type: 'celebration', schoolYear: SCHOOL_YEAR },
  { title: 'Réunion parents-professeurs', description: 'Présentation du programme annuel', date: '2024-09-14', type: 'meeting', schoolYear: SCHOOL_YEAR },

  // === OCTOBER 2024 ===
  { title: 'Devoir commun 1er trimestre', description: 'Évaluations continues', date: '2024-10-15', type: 'exam', schoolYear: SCHOOL_YEAR },
  { title: 'Journée de l\'indépendance', description: 'Célébration nationale', date: '2024-10-01', type: 'celebration', schoolYear: SCHOOL_YEAR },

  // === NOVEMBER 2024 ===
  { title: 'Examen mi-trimestre', description: 'Contrôles continus', date: '2024-11-11', endDate: '2024-11-15', type: 'exam', schoolYear: SCHOOL_YEAR },
  { title: 'Conseil de classe', description: 'Bilan mi-trimestre', date: '2024-11-22', type: 'meeting', schoolYear: SCHOOL_YEAR },

  // === DECEMBER 2024 — Congés Noël ===
  { title: 'Fête de fin d\'année', description: 'Spectacle et remise de prix', date: '2024-12-20', type: 'celebration', schoolYear: SCHOOL_YEAR },
  { title: 'Vacances de Noël', description: 'Congés de fin d\'année', date: '2024-12-21', endDate: '2025-01-05', type: 'holiday', schoolYear: SCHOOL_YEAR },

  // === JANUARY 2025 ===
  { title: 'Reprise des cours', description: 'Début 2ème trimestre', date: '2025-01-06', type: 'celebration', schoolYear: SCHOOL_YEAR },
  { title: 'Journée de la jeunesse', description: 'Célébration et activités sportives', date: '2025-01-11', type: 'celebration', schoolYear: SCHOOL_YEAR },
  { title: 'Devoir commun 2ème trimestre', description: 'Évaluations continues', date: '2025-01-27', type: 'exam', schoolYear: SCHOOL_YEAR },

  // === FEBRUARY 2025 ===
  { title: 'Examen mi-2ème trimestre', description: 'Contrôles continus', date: '2025-02-17', endDate: '2025-02-21', type: 'exam', schoolYear: SCHOOL_YEAR },
  { title: 'Conseil de classe', description: 'Bilan 2ème trimestre', date: '2025-02-28', type: 'meeting', schoolYear: SCHOOL_YEAR },

  // === MARCH 2025 ===
  { title: 'Journée de la femme', description: 'Célébration et activités', date: '2025-03-08', type: 'celebration', schoolYear: SCHOOL_YEAR },
  { title: 'Vacances de Pâques', description: 'Congés de mi-année', date: '2025-03-22', endDate: '2025-04-06', type: 'holiday', schoolYear: SCHOOL_YEAR },

  // === APRIL 2025 ===
  { title: 'Reprise des cours', description: 'Début 3ème trimestre', date: '2025-04-07', type: 'celebration', schoolYear: SCHOOL_YEAR },
  { title: 'Examen blanc', description: 'Préparation aux examens nationaux', date: '2025-04-21', endDate: '2025-04-25', type: 'exam', schoolYear: SCHOOL_YEAR },
  { title: 'Journée portes ouvertes', description: 'Visite de l\'école par les futurs élèves', date: '2025-04-12', type: 'meeting', schoolYear: SCHOOL_YEAR },

  // === MAY 2025 ===
  { title: 'Fête du travail', description: 'Jour férié', date: '2025-05-01', type: 'holiday', schoolYear: SCHOOL_YEAR },
  { title: 'Examen final', description: 'Évaluations de fin d\'année', date: '2025-05-12', endDate: '2025-05-20', type: 'exam', schoolYear: SCHOOL_YEAR },
  { title: 'Ascension', description: 'Jour férié', date: '2025-05-29', type: 'holiday', schoolYear: SCHOOL_YEAR },

  // === JUNE 2025 ===
  { title: 'Conseil de classe final', description: 'Délibération des résultats', date: '2025-06-02', type: 'meeting', schoolYear: SCHOOL_YEAR },
  { title: 'Examens nationaux (BFEM/BAC)', description: 'Examens officiels', date: '2025-06-09', endDate: '2025-06-20', type: 'exam', schoolYear: SCHOOL_YEAR },
  { title: 'Fête de fin d\'année scolaire', description: 'Remise des prix et diplômes', date: '2025-06-27', type: 'celebration', schoolYear: SCHOOL_YEAR },

  // === JULY 2025 ===
  { title: 'Grandes vacances', description: 'Fin de l\'année scolaire', date: '2025-07-01', endDate: '2025-09-01', type: 'holiday', schoolYear: SCHOOL_YEAR },
]

async function main() {
  console.log('Seeding school events...')

  // Delete existing events for this school year
  await db.schoolEvent.deleteMany({ where: { schoolYear: SCHOOL_YEAR } })

  // Insert new events
  for (const event of EVENTS) {
    await db.schoolEvent.create({ data: event })
  }

  console.log(`✅ Seeded ${EVENTS.length} school events for ${SCHOOL_YEAR}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
