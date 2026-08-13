/**
 * seed-parents-staff.ts
 * ----------------------------------------------------------------------------
 * Crée les enregistrements pour les PARENTS et le PERSONNEL avec leurs avatars.
 *
 * - Parents : crée un parent pour chaque élève n'ayant pas de parent (45 élèves),
 *   avec un compte User (role=parent), un enregistrement Parent, un avatar
 *   (parent-man-*.png / parent-woman-*.png), et relie l'élève à son parent
 *   (Student.parentId, parentContact, parentPhone).
 * - Personnel : crée 2 membres du personnel supplémentaires par institution
 *   (6 au total), avec compte User (role=staff), enregistrement Staff, et
 *   avatar (staff-man-*.png / staff-woman-*.png).
 *
 * Idempotent : si un parent/staff avec le même email existe déjà, il est ignoré.
 * ----------------------------------------------------------------------------
 */
import { db } from '../src/lib/db'

// ============================================================================
// Pools d'avatars disponibles
// ============================================================================
const PARENT_MAN_AVATARS = Array.from({ length: 8 }, (_, i) => `/avatars/parent-man-${i + 1}.png`)
const PARENT_WOMAN_AVATARS = Array.from({ length: 8 }, (_, i) => `/avatars/parent-woman-${i + 1}.png`)
const STAFF_MAN_AVATARS = Array.from({ length: 4 }, (_, i) => `/avatars/staff-man-${i + 1}.png`)
const STAFF_WOMAN_AVATARS = Array.from({ length: 4 }, (_, i) => `/avatars/staff-woman-${i + 1}.png`)

// ============================================================================
// Pools de prénoms (parents) par origine culturelle
// ============================================================================
// École Internationale EduGest (noms ouest-africains)
const ECOLE_PARENT_MALE = ['Ibrahim', 'Moussa', 'Ousmane', 'Cheikh', 'Modibo', 'Seydou', 'Abdou', 'Alassane', 'Boubacar', 'Souleymane', 'Mahamadou', 'Bakary', 'Drissa', 'Lassana', 'Karim', 'Issa', 'Youssouf', 'Adama']
const ECOLE_PARENT_FEMALE = ['Mariam', 'Aminata', 'Fatoumata', 'Aïssatou', 'Kadiatou', 'Oumou', 'Djénéba', 'Bineta', 'Coumba', 'Néné', 'Adja', 'Rokia', 'Salimata', 'Hawa', 'Maimouna', 'Bintou', 'Fanta', 'Kesso']

// Lycée Technique de Douala (noms camerounais)
const LYCEE_PARENT_MALE = ['Paul', 'Robert', 'Jean', 'Pierre', 'Emmanuel', 'Daniel', 'Samuel', 'Joseph', 'Marc', 'David', 'Thomas', 'Jacques', 'André', 'Henri', 'Luc']
const LYCEE_PARENT_FEMALE = ['Marie', 'Thérèse', 'Estelle', 'Christelle', 'Brigitte', 'Solange', 'Madeleine', 'Cécile', 'Hélène', 'Suzanne', 'Pauline', 'Juliette', 'Georgette', 'Léa', 'Sylvie']

// Institut Polytechnique de Yaoundé (noms camerounais)
const POLY_PARENT_MALE = ['Daniel', 'Georges', 'Augustin', 'Bertrand', 'Hervé', 'Olivier', 'Patrice', 'Rodrigue', 'Serge', 'Théodore', 'Vincent', 'Wilfried', 'Alain', 'Blaise', 'Cyrille']
const POLY_PARENT_FEMALE = ['Solange', 'Brigitte', 'Caroline', 'Danielle', 'Émilie', 'Florence', 'Gisèle', 'Hortense', 'Irène', 'Julie', 'Karin', 'Lucie', 'Marguerite', 'Nadège', 'Olive']

// ============================================================================
// Config personnel supplémentaire par institution
// ============================================================================
interface StaffSeed {
  firstName: string
  lastName: string
  gender: 'M' | 'F'
  fonction: string
  phone: string
  address: string
  email: string
}

const STAFF_TO_CREATE: Record<string, StaffSeed[]> = {
  // École Internationale EduGest (institution #1)
  'cmr4nvhhl0007r1tz9s7992ew': [
    { firstName: 'Olivier', lastName: 'Nkomo', gender: 'M', fonction: 'Censeur', phone: '+237 677 111 111', address: 'Bonanjo, Douala', email: 'olivier.nkomo@ecole.com' },
    { firstName: 'Sylvie', lastName: 'Bekolo', gender: 'F', fonction: 'Documentaliste', phone: '+237 677 111 222', address: 'Akwa, Douala', email: 'sylvie.bekolo@ecole.com' },
  ],
  // Lycée Technique de Douala (institution #2)
  'cmr4nvi3i013or1tzdimfskjd': [
    { firstName: 'Bertrand', lastName: 'Ngono', gender: 'M', fonction: 'Intendant', phone: '+237 677 222 333', address: 'Bonapriso, Douala', email: 'bertrand.ngono@lycee.com' },
    { firstName: 'Caroline', lastName: 'Atangana', gender: 'F', fonction: 'Conseillère d\'orientation', phone: '+237 677 222 444', address: 'Bonaliso, Douala', email: 'caroline.atangana@lycee.com' },
  ],
  // Institut Polytechnique de Yaoundé (institution #3)
  'cmr4nvig501sdr1tzsu25rad2': [
    { firstName: 'Augustin', lastName: 'Foka', gender: 'M', fonction: 'Responsable pédagogique', phone: '+237 677 333 555', address: 'Ngoa-Ekélé, Yaoundé', email: 'augustin.foka@polytech.com' },
    { firstName: 'Danielle', lastName: 'Mballa', gender: 'F', fonction: 'Secrétaire de direction', phone: '+237 677 333 666', address: 'Mvan, Yaoundé', email: 'danielle.mballa@polytech.com' },
  ],
}

// ============================================================================
// Helpers
// ============================================================================
function pickName(pool: string[], index: number): string {
  return pool[index % pool.length]
}

function buildEmail(firstName: string, lastName: string, domain: string): string {
  const clean = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')
  const base = `${clean(firstName)}.${clean(lastName)}`
  return `${base}@${domain}`
}

function getInstitutionDomain(institutionId: string): string {
  switch (institutionId) {
    case 'cmr4nvhhl0007r1tz9s7992ew': return 'ecole.com'
    case 'cmr4nvi3i013or1tzdimfskjd': return 'lycee.com'
    case 'cmr4nvig501sdr1tzsu25rad2': return 'polytech.com'
    default: return 'edugest.com'
  }
}

function getInstitutionAddress(institutionId: string): string {
  switch (institutionId) {
    case 'cmr4nvhhl0007r1tz9s7992ew': return 'Douala, Cameroun'
    case 'cmr4nvi3i013or1tzdimfskjd': return 'Akwa, Douala, Cameroun'
    case 'cmr4nvig501sdr1tzsu25rad2': return 'Ngoa-Ekélé, Yaoundé, Cameroun'
    default: return 'Cameroun'
  }
}

function getParentNamePools(institutionId: string): { male: string[]; female: string[] } {
  switch (institutionId) {
    case 'cmr4nvhhl0007r1tz9s7992ew': return { male: ECOLE_PARENT_MALE, female: ECOLE_PARENT_FEMALE }
    case 'cmr4nvi3i013or1tzdimfskjd': return { male: LYCEE_PARENT_MALE, female: LYCEE_PARENT_FEMALE }
    case 'cmr4nvig501sdr1tzsu25rad2': return { male: POLY_PARENT_MALE, female: POLY_PARENT_FEMALE }
    default: return { male: ECOLE_PARENT_MALE, female: ECOLE_PARENT_FEMALE }
  }
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Seed Parents & Personnel (avec avatars)')
  console.log('═══════════════════════════════════════════════════════════════')

  // ──────────────────────────────────────────────────────────────────────
  // PART 1 : PARENTS — un parent par élève sans parent
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n━━━ PARTIE 1 : Création des parents ━━━')

  const studentsWithoutParent = await db.student.findMany({
    where: { parentId: null },
    include: { user: true },
    orderBy: [{ user: { institutionId: 'asc' } }, { lastName: 'asc' }],
  })
  console.log(`  Élèves sans parent : ${studentsWithoutParent.length}`)

  let parentsCreated = 0
  let parentsSkipped = 0
  let manAvatarIdx = 0
  let womanAvatarIdx = 0
  let parentCounter = 300 // userCode base pour nouveaux parents (PAR-3xx, PAR-1xx déjà pris, etc.)

  // Compteurs par institution pour des userCodes uniques
  const instCounters: Record<string, number> = {}
  for (const s of studentsWithoutParent) {
    const instId = s.user?.institutionId ?? 'unknown'
    instCounters[instId] = (instCounters[instId] || 0) + 1
  }

  for (const student of studentsWithoutParent) {
    const institutionId = student.user?.institutionId
    if (!institutionId) {
      console.warn(`  ⚠️  Élève ${student.firstName} ${student.lastName} sans institution — ignoré`)
      parentsSkipped++
      continue
    }

    const domain = getInstitutionDomain(institutionId)
    const pools = getParentNamePools(institutionId)

    // Alterner genre du parent (père / mère) pour la diversité
    const parentIsMale = instCounters[institutionId] % 2 === 1
    const parentFirstName = pickName(parentIsMale ? pools.male : pools.female, instCounters[institutionId] - 1)
    const parentLastName = student.lastName // même nom de famille que l'élève
    const parentEmail = buildEmail(parentFirstName, parentLastName, domain)
    instCounters[institutionId]++

    // Vérifier si un user avec cet email existe déjà
    const existingUser = await db.user.findUnique({ where: { email: parentEmail } })
    if (existingUser) {
      // Lier l'élève à ce parent existant si nécessaire
      const existingParent = await db.parent.findUnique({ where: { userId: existingUser.id } })
      if (existingParent && !student.parentId) {
        await db.student.update({
          where: { id: student.id },
          data: {
            parentId: existingParent.id,
            parentContact: `${parentFirstName} ${parentLastName}`,
            parentPhone: existingParent.phone,
          },
        })
        parentsSkipped++
      }
      continue
    }

    // Avatar : cycle dans le pool approprié
    const avatar = parentIsMale
      ? PARENT_MAN_AVATARS[manAvatarIdx++ % PARENT_MAN_AVATARS.length]
      : PARENT_WOMAN_AVATARS[womanAvatarIdx++ % PARENT_WOMAN_AVATARS.length]

    // userCode unique par institution
    const instPrefix = institutionId === 'cmr4nvhhl0007r1tz9s7992ew' ? 'PAR-1'
      : institutionId === 'cmr4nvi3i013or1tzdimfskjd' ? 'PAR-2'
      : 'PAR-3'
    const userCode = `${instPrefix}${String(parentCounter).padStart(2, '0')}`
    parentCounter++

    // Numéro de téléphone fictif mais cohérent
    const phone = `+237 6${String(90 + (parentCounter % 9))} ${String(100 + parentCounter).slice(-3)} ${String(200 + parentCounter).slice(-3)}`

    // Créer le User (role=parent)
    const user = await db.user.create({
      data: {
        email: parentEmail,
        password: 'parent123',
        name: `${parentFirstName} ${parentLastName}`,
        role: 'parent',
        avatar,
        phone,
        userCode,
        institutionId,
        active: true,
      },
    })

    // Créer le Parent
    const parent = await db.parent.create({
      data: {
        userId: user.id,
        firstName: parentFirstName,
        lastName: parentLastName,
        phone,
        address: getInstitutionAddress(institutionId),
      },
    })

    // Relier l'élève à son parent
    await db.student.update({
      where: { id: student.id },
      data: {
        parentId: parent.id,
        parentContact: `${parentFirstName} ${parentLastName}`,
        parentPhone: phone,
      },
    })

    parentsCreated++
  }

  console.log(`  ✓ Parents créés : ${parentsCreated}`)
  console.log(`  ℹ️  Parents ignorés (déjà existants) : ${parentsSkipped}`)

  // ──────────────────────────────────────────────────────────────────────
  // PART 2 : PERSONNEL — 2 membres supplémentaires par institution
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n━━━ PARTIE 2 : Création du personnel supplémentaire ━━━')

  let staffCreated = 0
  let staffSkipped = 0
  let staffManIdx = 0
  let staffWomanIdx = 0

  for (const [institutionId, staffList] of Object.entries(STAFF_TO_CREATE)) {
    for (const s of staffList) {
      // Vérifier si le staff existe déjà (par email)
      const existingUser = await db.user.findUnique({ where: { email: s.email } })
      if (existingUser) {
        staffSkipped++
        continue
      }

      const avatar = s.gender === 'M'
        ? STAFF_MAN_AVATARS[staffManIdx++ % STAFF_MAN_AVATARS.length]
        : STAFF_WOMAN_AVATARS[staffWomanIdx++ % STAFF_WOMAN_AVATARS.length]

      // userCode : STF-1xx / STF-2xx / STF-3xx (pour éviter collisions avec 001/101/201 existants)
      const instPrefix = institutionId === 'cmr4nvhhl0007r1tz9s7992ew' ? 'STF-1'
        : institutionId === 'cmr4nvi3i013or1tzdimfskjd' ? 'STF-2'
        : 'STF-3'
      const codeNum = 50 + staffCreated // 050, 051, ...
      const userCode = `${instPrefix}${String(codeNum).padStart(2, '0')}`

      const user = await db.user.create({
        data: {
          email: s.email,
          password: 'staff123',
          name: `${s.firstName} ${s.lastName}`,
          role: 'staff',
          avatar,
          phone: s.phone,
          userCode,
          institutionId,
          active: true,
        },
      })

      await db.staff.create({
        data: {
          userId: user.id,
          firstName: s.firstName,
          lastName: s.lastName,
          fonction: s.fonction,
          phone: s.phone,
          email: s.email,
          image: avatar,
        },
      })

      console.log(`  + ${s.firstName} ${s.lastName} — ${s.fonction} (${getInstitutionDomain(institutionId)})`)
      staffCreated++
    }
  }

  console.log(`  ✓ Personnel créé : ${staffCreated}`)
  console.log(`  ℹ️  Personnel ignoré (déjà existant) : ${staffSkipped}`)

  // ──────────────────────────────────────────────────────────────────────
  // Récapitulatif
  // ──────────────────────────────────────────────────────────────────────
  const finalCounts = {
    parents: await db.parent.count(),
    staff: await db.staff.count(),
    studentsWithParent: await db.student.count({ where: { NOT: { parentId: null } } }),
    studentsTotal: await db.student.count(),
    usersParent: await db.user.count({ where: { role: 'parent' } }),
    usersStaff: await db.user.count({ where: { role: 'staff' } }),
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  Récapitulatif final')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(JSON.stringify(finalCounts, null, 2))
  console.log(`  Élèves avec parent : ${finalCounts.studentsWithParent} / ${finalCounts.studentsTotal}`)
}

main()
  .then(() => {
    console.log('\n✓ Seed parents & personnel terminé avec succès !')
    process.exit(0)
  })
  .catch((e) => {
    console.error('\n✗ Erreur seed parents & personnel :', e)
    process.exit(1)
  })
