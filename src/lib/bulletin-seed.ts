// ============================================================================
// Bulletin Seed — Import massif d'élèves + notes depuis fichiers Excel
// ----------------------------------------------------------------------------
// Spécificités du format Excel MASOMO (RDC primaire) :
//
// Feuille "LISTE" :
//   - Ligne 1 : nom de la matière (répété 9 fois pour chaque matière)
//   - Ligne 2 : type de note (1er, 2èP, EX, 3èP, 4èP, EX, 5èP, 6èP, EX)
//   - Lignes 3+ : un élève par ligne
//
// Colonnes identité (0-10) :
//   0 = NOMS, 1 = N° ID, 2 = SEXE, 3 = DATE DE NAISS, 4 = CLASSE,
//   5 = N° PERM, 6 = PROVINCE, 7 = VILLE, 8 = COMMUNE, 9 = ECOLE, 10 = CODE
//
// Colonnes notes (11+) : chaque matière occupe 9 colonnes
//   Mapping trimestres :
//     1er, 2èP + EX      → trimestre 1er (devoir / examen)
//     3èP, 4èP + EX      → trimestre 2eme
//     5èP, 6èP + EX      → trimestre 3eme
// ============================================================================

import { db } from '@/lib/db'

// ---------- Types ----------

export interface SeedResult {
  studentsCreated: number
  studentsUpdated: number
  gradesCreated: number
  gradesUpdated: number
  avatarsUploaded: number
  classesCreated: number
  subjectsCreated: number
  filesProcessed: number
  errors: Array<{ file?: string; student?: string; subject?: string; error: string }>
}

export interface SeedOptions {
  institutionId: string
  schoolYear?: string // défaut: '2024-2025'
  force?: boolean // force la ré-exécution même si déjà fait
  /**
   * Classe cible optionnelle. Si fournie, TOUS les élèves des fichiers Excel
   * seront insérés dans cette classe (ignore la colonne CLASSE de l'Excel).
   * Si non fournie (ou vide), la classe est auto-détectée depuis la colonne
   * CLASSE de chaque fichier Excel.
   * Exemple : "2ème ANNEE" pour forcer tous les élèves en 2ème ANNEE.
   */
  targetClassName?: string
}

// ---------- Parsing Excel ----------

interface ParsedStudent {
  fullName: string // "KALALA MUSANGU Chris"
  idNumber: string // "CO1111"
  gender: string // "M" ou "F"
  dateOfBirth: string | null
  className: string // "1ère ANNEE"
  permNumber: string
  province: string
  ville: string
  commune: string
  ecole: string
  code: string
  avatarFileName: string | null
}

interface ParsedGrade {
  studentIdNumber: string
  subjectName: string
  trimester: '1er' | '2eme' | '3eme'
  type: string
  value: number
  maxValue: number
}

interface ParsedFile {
  fileName: string
  students: ParsedStudent[]
  grades: ParsedGrade[]
}

// Map des maxValues par matière : { "Mesures des grandeurs" => { maxPer: 10, maxEx: 20 }, ... }
type MaxValuesMap = Map<string, { maxPer: number; maxEx: number }>

/**
 * Extrait une chaîne d'une valeur Excel (gère les objets avec formules, richText, etc.)
 */
function getStringFromValue(v: any): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    if (v.result !== undefined && v.result !== null) return String(v.result).trim()
    if (v.text !== undefined && v.text !== null) return String(v.text).trim()
    if (Array.isArray(v.richText)) return v.richText.map((rt: any) => rt.text || '').join('').trim()
    if (v.error !== undefined) return ''
    return ''
  }
  return String(v).trim()
}

/**
 * Extrait un nombre d'une valeur Excel (gère les objets avec formules, richText, etc.)
 */
function getNumberFromValue(value: any): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return isNaN(value) ? null : value
  if (typeof value === 'object') {
    if (typeof value.result === 'number') return isNaN(value.result) ? null : value.result
    if (typeof value.result === 'string') {
      const n = parseFloat(value.result.replace(',', '.').replace(/[^\d.-]/g, ''))
      return isNaN(n) ? null : n
    }
    if (typeof value.text === 'string') {
      const n = parseFloat(value.text.replace(',', '.').replace(/[^\d.-]/g, ''))
      return isNaN(n) ? null : n
    }
    if (Array.isArray(value.richText)) {
      const text = value.richText.map((rt: any) => rt.text || '').join('')
      const n = parseFloat(text.replace(',', '.').replace(/[^\d.-]/g, ''))
      return isNaN(n) ? null : n
    }
    return null
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '')
    if (!cleaned) return null
    const n = parseFloat(cleaned)
    return isNaN(n) ? null : n
  }
  return null
}

/**
 * Parse la feuille BULLETIN pour extraire les maxValues (MAX per, MAX EX.) par matière.
 * Ces valeurs sont utilisées pour déterminer le maxValue correct de chaque note.
 *
 * Structure de la feuille BULLETIN :
 *   Col A = nom matière
 *   Col B = MAX per (max pour chaque période/devoir)
 *   Col C = 1è P (note élève)
 *   Col D = 2è P (note élève)
 *   Col E = MAX EX. (max pour l'examen)
 *   ...
 */
async function extractMaxValuesFromBulletin(workbook: any): Promise<MaxValuesMap> {
  const maxValuesMap: MaxValuesMap = new Map()

  const sheet =
    workbook.getWorksheet('BULLETIN') ||
    workbook.getWorksheet('Bulletin') ||
    workbook.getWorksheet('bulletin') ||
    workbook.worksheets.find((w: any) => w.name.toLowerCase() === 'bulletin')

  if (!sheet) return maxValuesMap

  // Parcourir les lignes à partir de la ligne 9 (après les en-têtes)
  for (let r = 9; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r).values
    const subjectRaw = row[1]
    if (!subjectRaw) continue

    const subjectName = getStringFromValue(subjectRaw).trim()
    if (!subjectName) continue

    // Ignorer les lignes de domaine, sous-total, totaux, etc.
    const upper = subjectName.toUpperCase()
    if (
      upper.includes('DOMAINE') ||
      subjectName.includes('Sous-Total') ||
      subjectName.includes('Sous Total') ||
      upper.includes('MAXIMA') ||
      upper.includes('TOTAUX') ||
      upper.includes('POURCETAGE') ||
      upper.includes('PLACE') ||
      upper.includes('LANGUES CONGOLAISES') ||
      upper.includes('FRANCAIS') ||
      upper.includes('MATHEMATIQUES') ||
      upper.includes('SCIENCES') ||
      upper.includes('TECHNOLOGIE') ||
      upper.includes('ARTS') ||
      upper.includes('DEVELOPPEMENT') ||
      upper.includes('UNIVERS SOCIAL') ||
      upper.includes('DEVELOPPEMENT PERSONNEL')
    ) {
      continue
    }

    // Extraire MAX per (Col B = index 2) et MAX EX. (Col E = index 5)
    const maxPer = getNumberFromValue(row[2])
    const maxEx = getNumberFromValue(row[5])

    if (maxPer !== null && maxEx !== null) {
      maxValuesMap.set(subjectName, { maxPer, maxEx })
    }
  }

  return maxValuesMap
}

/**
 * Parse un fichier Excel (.xlsx) au format MASOMO RDC.
 * Voir la doc en haut du fichier pour la structure exacte.
 */
export async function parseBulletinExcel(
  fileBuffer: Buffer,
  fileName: string
): Promise<ParsedFile> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(fileBuffer)

  // 1. Extraire les maxValues depuis la feuille BULLETIN
  const maxValuesMap = await extractMaxValuesFromBulletin(workbook)
  console.log(`[bulletin-seed] ${maxValuesMap.size} maxValues extraites depuis BULLETIN`)
  for (const [name, mv] of maxValuesMap) {
    console.log(`  • ${name}: maxPer=${mv.maxPer}, maxEx=${mv.maxEx}`)
  }

  // 2. Trouver la feuille LISTE
  const sheet =
    workbook.getWorksheet('LISTE') ||
    workbook.getWorksheet('Liste') ||
    workbook.getWorksheet('liste') ||
    workbook.worksheets.find(w => w.name.toLowerCase() === 'liste')

  if (!sheet) {
    throw new Error(
      `Feuille "LISTE" introuvable dans ${fileName}. Feuilles disponibles: ${workbook.worksheets.map(w => w.name).join(', ')}`
    )
  }

  // Ligne 1 = matières, Ligne 2 = types, Lignes 3+ = élèves
  const headerRow1 = sheet.getRow(1).values
  const headerRow2 = sheet.getRow(2).values

  // Identifier les matières et leur mappage de colonnes
  const subjects = identifySubjects(headerRow1, headerRow2)

  const students: ParsedStudent[] = []
  const grades: ParsedGrade[] = []

  // Parcourir les élèves à partir de la ligne 3
  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r).values
    const fullName = getString(row, 1)
    if (!fullName) continue

    const student: ParsedStudent = {
      fullName,
      idNumber: getString(row, 2),
      gender: normalizeGender(getString(row, 3)),
      dateOfBirth: parseDate(row[4]),
      className: getString(row, 5),
      permNumber: getString(row, 6),
      province: getString(row, 7),
      ville: getString(row, 8),
      commune: getString(row, 9),
      ecole: getString(row, 10),
      code: getString(row, 11),
      avatarFileName: null,
    }
    students.push(student)

    // Extraire les notes pour cet élève
    for (const subject of subjects) {
      // Récupérer les maxValues pour cette matière
      // Chercher par nom exact, puis par nom normalisé
      let maxPer = 20 // défaut
      let maxEx = 20 // défaut
      for (const [mapName, mv] of maxValuesMap) {
        if (mapName.toLowerCase().replace(/\s+/g, ' ').trim() === subject.name.toLowerCase().replace(/\s+/g, ' ').trim()) {
          maxPer = mv.maxPer
          maxEx = mv.maxEx
          break
        }
      }

      for (const col of subject.columns) {
        const value = getNumber(row[col.index])
        if (value === null || isNaN(value)) continue

        // Déterminer le maxValue selon le type de note
        const maxValue = col.type === 'examen' ? maxEx : maxPer

        // Filtrer les valeurs aberrantes : la note ne doit pas dépasser le maxValue
        if (value < 0 || value > maxValue) {
          // Ignorer cette valeur — c'est probablement un total ou une formule
          continue
        }

        const type = col.type
        const trimester = col.trimester

        grades.push({
          studentIdNumber: student.idNumber,
          subjectName: subject.name,
          trimester,
          type,
          value,
          maxValue,
        })
      }
    }
  }

  return { fileName, students, grades }
}

// ---------- Helpers de parsing ----------

interface SubjectMapping {
  name: string
  columns: Array<{ index: number; trimester: '1er' | '2eme' | '3eme'; type: string }>
}

function identifySubjects(headerRow1: any[], headerRow2: any[]): SubjectMapping[] {
  const subjects: SubjectMapping[] = []
  const startCol = 12 // colonne 12 = première matière (après colonnes identité 1-11)

  // Groupement par matière (nom identique sur 9 colonnes consécutives)
  // IMPORTANT : on normalise la casse pour éviter les doublons
  // (ex: "Expression orale" et "Expression Orale" → même matière)
  let currentSubject: SubjectMapping | null = null
  let currentSubjectNormalized = ''
  let columnPositionInSubject = 0 // 0-8 : position dans le groupe de 9 colonnes

  for (let col = startCol; col < headerRow1.length; col++) {
    const matiereRaw = headerRow1[col]
    if (!matiereRaw) continue

    const matiere = String(matiereRaw).trim()
    const matiereNormalized = matiere.toLowerCase().replace(/\s+/g, ' ').trim()

    // Ignorer les colonnes "classement ou proclammation" et "T.G" (totaux)
    if (matiereNormalized.includes('classement') || matiereNormalized.includes('proclam')) {
      if (currentSubject) subjects.push(currentSubject)
      currentSubject = null
      currentSubjectNormalized = ''
      columnPositionInSubject = 0
      continue
    }

    const type = headerRow2[col] ? String(headerRow2[col]).trim() : ''

    // Nouvelle matière si le nom normalisé change OU si on a déjà 9 colonnes
    // (gère le cas où deux matières ont le même nom normalisé mais sont
    // des matières différentes, ex: "Expression orale" Langues congolaises
    // vs "Expression Orale" Français)
    if (matiereNormalized && (matiereNormalized !== currentSubjectNormalized || columnPositionInSubject >= 9)) {
      if (currentSubject) subjects.push(currentSubject)

      // Extraire le nom de la matière depuis l'en-tête hiérarchique.
      // L'en-tête peut être :
      //   "DOMAINE DES LANGUES-LANGUES CONGOLAISES-Expression orale"
      //   → nom = "Expression orale"
      //   ou simplement "Expression orale" (sans hiérarchie)
      //   → nom = "Expression orale"
      let subjectName = matiere
      if (matiere.includes('-')) {
        const parts = matiere.split('-')
        subjectName = parts[parts.length - 1].trim()
      }

      currentSubject = { name: subjectName, columns: [] }
      currentSubjectNormalized = matiereNormalized
      columnPositionInSubject = 0
    }

    if (currentSubject && type) {
      // Utiliser la position dans le groupe de 9 colonnes pour déterminer
      // le trimestre et le type de note précis.
      // Les types sont basés sur les labels du bulletin Excel :
      //   1er  → "1ère période"   (T1)
      //   2èP  → "2ème période"   (T1)
      //   EX   → "examen"         (T1)
      //   3èP  → "1ère période"   (T2)
      //   4èP  → "2ème période"   (T2)
      //   EX   → "examen"         (T2)
      //   5èP  → "1ère période"   (T3)
      //   6èP  → "2ème période"   (T3)
      //   EX   → "examen"         (T3)
      const pos = columnPositionInSubject % 9
      const trimesterMap: Array<'1er' | '2eme' | '3eme'> = ['1er', '1er', '1er', '2eme', '2eme', '2eme', '3eme', '3eme', '3eme']
      const typeMap: Array<string> = [
        '1ère période', '2ème période', 'examen',   // T1
        '1ère période', '2ème période', 'examen',   // T2
        '1ère période', '2ème période', 'examen',   // T3
      ]

      currentSubject.columns.push({
        index: col,
        trimester: trimesterMap[pos],
        type: typeMap[pos],
      })
      columnPositionInSubject++
    }
  }
  if (currentSubject) subjects.push(currentSubject)

  return subjects
}

function mapNoteType(typeLabel: string): {
  trimester: '1er' | '2eme' | '3eme'
  type: string
} | null {
  const t = typeLabel.toLowerCase().trim()

  // Trimestre 1
  if (t === '1er' || t === '1er p' || t === '1ère p' || t === '1ep') {
    return { trimester: '1er', type: 'devoir' }
  }
  if (t === '2èp' || t === '2ep' || t === '2è p' || t === '2e p') {
    return { trimester: '1er', type: 'devoir' }
  }
  if (t === 'ex' || t === 'ex 1er tr' || t === 'examen 1er tr' || t.includes('ex 1er') || (t === 'ex' && typeLabel.toLowerCase().includes('1er'))) {
    return { trimester: '1er', type: 'examen' }
  }

  // Trimestre 2
  if (t === '3èp' || t === '3ep' || t === '3è p' || t === '3e p') {
    return { trimester: '2eme', type: 'devoir' }
  }
  if (t === '4èp' || t === '4ep' || t === '4è p' || t === '4e p') {
    return { trimester: '2eme', type: 'devoir' }
  }
  if (t === 'ex 2è tr' || t === 'ex 2e tr' || t.includes('ex 2')) {
    return { trimester: '2eme', type: 'examen' }
  }

  // Trimestre 3
  if (t === '5èp' || t === '5ep' || t === '5è p' || t === '5e p') {
    return { trimester: '3eme', type: 'devoir' }
  }
  if (t === '6èp' || t === '6ep' || t === '6è p' || t === '6e p') {
    return { trimester: '3eme', type: 'devoir' }
  }
  if (t === 'ex 3è tr' || t === 'ex 3e tr' || t.includes('ex 3')) {
    return { trimester: '3eme', type: 'examen' }
  }

  // Cas générique : juste "EX" seul → on assume trimestre 1
  if (t === 'ex') {
    return { trimester: '1er', type: 'examen' }
  }

  // Totaux à ignorer
  if (t.includes('tot') || t.includes('t.g') || t.includes('classement') || t.includes('proclam')) {
    return null
  }

  return null
}

function getString(row: any[], index: number): string {
  if (index < 0 || index >= row.length) return ''
  const v = row[index]
  if (v === null || v === undefined) return ''

  // Gestion des objets ExcelJS (cellules avec formules, texte enrichi, liens)
  if (typeof v === 'object') {
    // Cellule avec formule : { formula: "...", result: "..." } ou { sharedFormula: "...", result: "..." }
    if (v.result !== undefined && v.result !== null) {
      return String(v.result).trim()
    }
    // Cellule avec texte simple : { text: "..." }
    if (v.text !== undefined && v.text !== null) {
      return String(v.text).trim()
    }
    // Cellule avec texte enrichi : { richText: [{ text: "..." }, ...] }
    if (Array.isArray(v.richText)) {
      return v.richText.map((rt: any) => rt.text || '').join('').trim()
    }
    // Cellule avec lien hypertexte : { text: "...", hyperlink: "..." }
    if (v.hyperlink !== undefined && v.text !== undefined) {
      return String(v.text).trim()
    }
    // Cellule avec erreur : { error: "..." }
    if (v.error !== undefined) {
      return ''
    }
    // Si l'objet a une propriété toString personnalisée, l'utiliser
    // Sinon retourner chaîne vide (évite "[object Object]")
    return ''
  }

  return String(v).trim()
}

/**
 * Extrait un nombre d'une valeur de cellule Excel.
 * Retourne null si la valeur n'est pas un nombre valide.
 * IMPORTANT : ignore les valeurs qui sont des résultats de formules aberrantes
 * (ex: totaux > 20 qui ne sont pas des notes valides sur 20).
 */
function getNumber(value: any): number | null {
  if (value === null || value === undefined) return null

  // Nombre direct
  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }

  // Objet ExcelJS (cellule avec formule)
  if (typeof value === 'object') {
    // Résultat de formule
    if (typeof value.result === 'number') {
      return isNaN(value.result) ? null : value.result
    }
    if (typeof value.result === 'string') {
      const n = parseFloat(value.result.replace(',', '.').replace(/[^\d.-]/g, ''))
      return isNaN(n) ? null : n
    }
    // Texte dans objet
    if (typeof value.text === 'string') {
      const n = parseFloat(value.text.replace(',', '.').replace(/[^\d.-]/g, ''))
      return isNaN(n) ? null : n
    }
    // Texte enrichi
    if (Array.isArray(value.richText)) {
      const text = value.richText.map((rt: any) => rt.text || '').join('')
      const n = parseFloat(text.replace(',', '.').replace(/[^\d.-]/g, ''))
      return isNaN(n) ? null : n
    }
    return null
  }

  // Chaîne
  if (typeof value === 'string') {
    const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '')
    if (!cleaned) return null
    const n = parseFloat(cleaned)
    return isNaN(n) ? null : n
  }

  return null
}

function parseDate(value: any): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'object' && value.result) {
    const d = new Date(value.result)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  if (typeof value === 'string') {
    // Enlever les guillemets
    const cleaned = value.replace(/^"|"$/g, '')
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return null
}

function normalizeGender(g: string): string {
  const lower = g.toLowerCase()
  if (lower === 'm' || lower === 'masculin' || lower === 'male') return 'M'
  if (lower === 'f' || lower === 'féminin' || lower === 'feminin' || lower === 'female') return 'F'
  return g
}

// ---------- Seed principal ----------

/**
 * Exécute le seed à partir d'un ou plusieurs fichiers Excel + optionnellement
 * un zip d'avatars.
 */
export async function runBulletinSeed(
  files: Array<{ name: string; buffer: Buffer }>,
  avatarsZipBuffer: Buffer | null,
  options: SeedOptions
): Promise<SeedResult> {
  const result: SeedResult = {
    studentsCreated: 0,
    studentsUpdated: 0,
    gradesCreated: 0,
    gradesUpdated: 0,
    avatarsUploaded: 0,
    classesCreated: 0,
    subjectsCreated: 0,
    filesProcessed: 0,
    errors: [],
  }

  const schoolYear = options.schoolYear || '2024-2025'

  // ──────────────────────────────────────────────────────────────
  // NOTE : Le seed est totalement idempotent — il peut être ré-exécuté
  // sans risque. Les élèves et notes existants sont mis à jour (upsert),
  // pas dupliqués. Plus de blocage "une seule fois" : on peut ré-importer
  // un fichier individuel à tout moment.
  // ──────────────────────────────────────────────────────────────

  // 1. Extraire les avatars du zip (si fourni)
  const avatarsMap = new Map<string, Buffer>()
  if (avatarsZipBuffer) {
    const avatars = await extractAvatarsFromZip(avatarsZipBuffer)
    for (const av of avatars) {
      avatarsMap.set(av.fileName.toLowerCase(), av.buffer)
    }
  }

  // 2. Parser tous les fichiers Excel
  const allParsedFiles: ParsedFile[] = []
  for (const file of files) {
    try {
      const parsed = await parseBulletinExcel(file.buffer, file.name)
      allParsedFiles.push(parsed)
      result.filesProcessed++

      // Assigner l'avatar à chaque élève si trouvé
      for (const student of parsed.students) {
        // Essaye plusieurs conventions de nommage
        const possibleNames = [
          `${student.idNumber}.jpg`,
          `${student.idNumber}.png`,
          `${student.fullName.toLowerCase()}.jpg`,
          `${student.fullName.toLowerCase()}.png`,
        ]
        for (const name of possibleNames) {
          if (avatarsMap.has(name.toLowerCase())) {
            student.avatarFileName = name
            break
          }
        }
      }
    } catch (e) {
      result.errors.push({
        file: file.name,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  if (allParsedFiles.length === 0) {
    throw new Error('Aucun fichier Excel valide n\'a pu être traité.')
  }

  // 3. Pour chaque fichier → upsert élèves + notes
  const studentIdToUserId = new Map<string, string>()

  for (const parsedFile of allParsedFiles) {
    // Auto-détection de la classe depuis le nom du fichier (si pas de targetClassName explicite)
    // Exemple : "2_me PRIMAIRE _ jour.xlsx" → "2ème ANNEE"
    //           "3_me PRIMAIRE _ jour.xlsx" → "3ème ANNEE"
    //           "5_me PRIMAIRE (1).xlsx"    → "5ème ANNEE"
    //           "6ème PRIMAIRE (1).xlsx"    → "6ème ANNEE"
    //           "1_re PRIMAIRE _ jour.xlsx" → "1ère ANNEE"
    const detectedClassName = detectClassNameFromFileName(parsedFile.fileName)
    if (detectedClassName) {
      console.log(`[bulletin-seed] Fichier "${parsedFile.fileName}" → classe détectée : "${detectedClassName}"`)
    }

    for (const student of parsedFile.students) {
      try {
        // Résolution de la classe cible (par ordre de priorité) :
        //   1. targetClassName explicite (override manuel) → utilise cette classe
        //   2. detectClassNameFromFileName (nom du fichier) → utilise la classe détectée
        //   3. student.className (colonne CLASSE de l'Excel) → fallback
        const effectiveClassName = options.targetClassName?.trim()
          ? options.targetClassName.trim()
          : (detectedClassName || student.className)

        const classId = await findOrCreateClass(
          effectiveClassName,
          options.institutionId,
          schoolYear,
          result
        )

        // Email déduit si manquant
        const email = generateEmail(student, options.institutionId)

        // Upsert user
        const existingUser = await db.user.findFirst({
          where: {
            OR: [
              { email },
              ...(student.idNumber ? [{ userCode: student.idNumber }] : []),
            ],
          },
        })

        let userId: string

        if (existingUser) {
          await db.user.update({
            where: { id: existingUser.id },
            data: {
              name: student.fullName,
              role: 'student',
              institutionId: options.institutionId,
              ...(student.permNumber && { phone: student.permNumber }),
              ...(student.idNumber && { userCode: student.idNumber }),
            },
          })
          userId = existingUser.id
          result.studentsUpdated++
        } else {
          const newUser = await db.user.create({
            data: {
              email,
              password: 'eleve123',
              name: student.fullName,
              role: 'student',
              institutionId: options.institutionId,
              ...(student.permNumber && { phone: student.permNumber }),
              ...(student.idNumber && { userCode: student.idNumber }),
              active: true,
            },
          })
          userId = newUser.id
          result.studentsCreated++
        }

        // Upsert student (profile)
        const existingStudentProfile = await db.student.findUnique({
          where: { userId },
        })
        let studentId: string

        const studentData = {
          firstName: extractFirstName(student.fullName),
          lastName: extractLastName(student.fullName),
          ...(student.gender && { gender: student.gender }),
          ...(student.dateOfBirth && { dateOfBirth: student.dateOfBirth }),
          ...(student.commune && { address: `${student.commune}, ${student.ville}, ${student.province}` }),
          ...(student.permNumber && { parentContact: student.permNumber }),
          classId,
          status: 'active' as const,
        }

        if (existingStudentProfile) {
          const updated = await db.student.update({
            where: { userId },
            data: studentData,
          })
          studentId = updated.id
        } else {
          const newStudent = await db.student.create({
            data: {
              userId,
              ...studentData,
            },
          })
          studentId = newStudent.id
        }

        // Avatar ?
        if (student.avatarFileName) {
          const avatarBuffer = avatarsMap.get(student.avatarFileName.toLowerCase())
          if (avatarBuffer) {
            const mediaFile = await db.mediaFile.create({
              data: {
                filename: student.avatarFileName,
                mimeType: student.avatarFileName.toLowerCase().endsWith('.png')
                  ? 'image/png'
                  : 'image/jpeg',
                data: avatarBuffer.toString('base64'),
                size: avatarBuffer.byteLength,
                institutionId: options.institutionId,
              },
            })
            await db.student.update({
              where: { id: studentId },
              data: { image: `/api/media/${mediaFile.id}` },
            })
            result.avatarsUploaded++
          }
        }

        studentIdToUserId.set(student.idNumber, studentId)
      } catch (e) {
        result.errors.push({
          file: parsedFile.fileName,
          student: student.fullName,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    // 4. Nettoyage des anciennes notes pour ces élèves (année scolaire cible)
    // IMPORTANT : on supprime TOUTES les notes existantes des élèves importés
    // pour l'année scolaire, puis on les recrée proprement depuis l'Excel.
    // Cela évite d'avoir des notes aberrantes résiduelles (> 20) d'anciens seeds.
    const studentIdsToClean = Array.from(studentIdToUserId.values())
    if (studentIdsToClean.length > 0) {
      console.log(`[bulletin-seed] Nettoyage des anciennes notes pour ${studentIdsToClean.length} élève(s)...`)
      const deleteResult = await db.grade.deleteMany({
        where: {
          studentId: { in: studentIdsToClean },
          schoolYear,
        },
      })
      console.log(`[bulletin-seed] ${deleteResult.count} ancienne(s) note(s) supprimée(s)`)
    }

    // 5. Pour chaque note : créer (plus d'upsert nécessaire, on a tout supprimé)
    for (const grade of parsedFile.grades) {
      try {
        const studentId = studentIdToUserId.get(grade.studentIdNumber)
        if (!studentId) {
          result.errors.push({
            file: parsedFile.fileName,
            student: grade.studentIdNumber,
            subject: grade.subjectName,
            error: 'Élève non trouvé dans la feuille "LISTE"',
          })
          continue
        }

        // Trouver ou créer la matière
        const subject = await findOrCreateSubject(grade.subjectName, result)

        // Trouver la classe de l'élève
        const studentRecord = await db.student.findUnique({
          where: { id: studentId },
          select: { classId: true },
        })

        const date = new Date().toISOString().split('T')[0]

        // Upsert grade
        const existingGrade = await db.grade.findFirst({
          where: {
            studentId,
            subjectId: subject.id,
            trimester: grade.trimester,
            type: grade.type,
            schoolYear,
          },
        })

        if (existingGrade) {
          await db.grade.update({
            where: { id: existingGrade.id },
            data: {
              value: grade.value,
              maxValue: grade.maxValue,
              classId: studentRecord?.classId,
              date,
            },
          })
          result.gradesUpdated++
        } else {
          await db.grade.create({
            data: {
              studentId,
              subjectId: subject.id,
              classId: studentRecord?.classId,
              value: grade.value,
              maxValue: grade.maxValue,
              type: grade.type,
              trimester: grade.trimester,
              schoolYear,
              date,
            },
          })
          result.gradesCreated++
        }
      } catch (e) {
        result.errors.push({
          file: parsedFile.fileName,
          student: grade.studentIdNumber,
          subject: grade.subjectName,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  // 5. Marquer le seed comme exécuté
  await db.notification.create({
    data: {
      userId: null,
      title: 'Seed Bulletins exécuté',
      message: `SEED_${schoolYear} — ${result.studentsCreated + result.studentsUpdated} élèves, ${result.gradesCreated + result.gradesUpdated} notes, ${result.filesProcessed} fichiers`,
      type: 'info',
      category: 'bulletin_seed',
      institutionId: options.institutionId,
      schoolYear,
    },
  })

  return result
}

// ---------- Helpers de seed ----------

async function findOrCreateClass(
  className: string,
  institutionId: string,
  schoolYear: string,
  result: SeedResult
): Promise<string | null> {
  if (!className) return null

  let cls = await db.class.findFirst({
    where: { name: className, institutionId },
  })

  if (!cls) {
    cls = await db.class.findFirst({
      where: {
        institutionId,
        name: { contains: className, mode: 'insensitive' },
      },
    })
  }

  if (cls) return cls.id

  const newClass = await db.class.create({
    data: {
      name: className,
      level: extractLevel(className),
      schoolYear,
      institutionId,
      capacity: 50,
    },
  })
  result.classesCreated++
  return newClass.id
}

async function findOrCreateSubject(subjectName: string, result: SeedResult) {
  const code = generateSubjectCode(subjectName)
  const domain = getSubjectDomain(subjectName)

  // 1. Chercher par nom EXACT (sensible à la casse) en premier
  //    On utilise le nom exact car "Expression orale" (Langues congolaises)
  //    et "Expression Orale" (Français) sont des matières DIFFÉRENTES
  let subject = await db.subject.findFirst({
    where: { name: subjectName },
  })

  // 2. Si pas trouvé par nom exact, chercher par code
  if (!subject) {
    subject = await db.subject.findUnique({ where: { code } })
  }

  // 3. Mettre à jour le domaine si manquant
  if (subject && !subject.domain && domain) {
    subject = await db.subject.update({
      where: { id: subject.id },
      data: { domain }
    })
  }

  // 4. Si toujours pas trouvé, créer
  if (!subject) {
    subject = await db.subject.create({
      data: {
        name: subjectName,
        code,
        coefficient: 1,
        level: 'primaire',
        ...(domain ? { domain } : {}),
      },
    })
    result.subjectsCreated++
  }
  return subject
}

/**
 * Retourne le sous-domaine (en-tête) d'une matière basé sur la structure
 * du bulletin RDC primaire.
 * Ex: "Expression orale" → "Langues congolaises"
 *     "Mesures des grandeurs" → "Mathématiques"
 */
function getSubjectDomain(subjectName: string): string | null {
  const map: Record<string, string> = {
    'Expression orale': 'Langues congolaises',
    'Expression Ecrite': 'Langues congolaises',
    'Vocabulaire': 'Français',
    'Expression Orale': 'Français',
    'LECT. - ECRITURE EN LANGUES CONGOLAISES': 'Langues congolaises',
    'Mesures des grandeurs': 'Mathématiques',
    'Formes géométriques': 'Mathématiques',
    'Numération': 'Mathématiques',
    'Opérations': 'Mathématiques',
    'Problèmes': 'Mathématiques',
    "Sciences d'éveil": 'Sciences',
    'Technologie': 'Technologie',
    'Ed. Civ. & Morale': 'Univers social',
    'Ed. Santé & Env.': 'Univers social',
    'Art plastique': 'Arts',
    'Art dramatique': 'Arts',
    'Ed. phys. & sportive': 'Développement personnel',
    'Init. Trav. Prod.': 'Développement personnel',
    'Religion': 'Développement personnel',
  }
  return map[subjectName] || null
}

async function extractAvatarsFromZip(
  zipBuffer: Buffer
): Promise<Array<{ fileName: string; buffer: Buffer }>> {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipBuffer)
    const result: Array<{ fileName: string; buffer: Buffer }> = []

    const files = Object.values(zip.files)
    for (const file of files) {
      if (file.dir) continue
      if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) continue
      const buffer = await file.async('nodebuffer')
      result.push({
        fileName: file.name.split('/').pop() || file.name,
        buffer,
      })
    }
    return result
  } catch (e) {
    console.error('[bulletin-seed] extractAvatarsFromZip error:', e)
    return []
  }
}

function generateEmail(student: ParsedStudent, institutionId: string): string {
  // Utilise l'ID comme partie locale de l'email (ex: CO1111 → CO1111@import.local)
  if (student.idNumber) {
    return `${student.idNumber.toLowerCase()}@import.local`
  }
  // Fallback : nom
  const base = student.fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]/g, '.')
    .replace(/\.+/g, '.')
  return `${base}@import.local`
}

function extractFirstName(fullName: string): string {
  // "KALALA MUSANGU Chris" → "Chris" (dernier mot)
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : fullName
}

function extractLastName(fullName: string): string {
  // "KALALA MUSANGU Chris" → "KALALA MUSANGU" (tout sauf le dernier)
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(0, -1).join(' ') : fullName
}

function extractLevel(className: string): string {
  const match = className.match(/^([^\d]*\d[^\s]*)/i)
  return match ? match[1] : className
}

function generateSubjectCode(name: string): string {
  // Génère un code unique à partir du nom complet de la matière.
  // On utilise les initiales + les premiers caractères pour éviter les
  // collisions (ex: "Expression orale" et "Expression Ecrite" qui
  // généraient le même code "EXPRESSI" avec l'ancien algorithme).
  const normalized = name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()

  const words = normalized.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return 'SUBJ'
  if (words.length === 1) return words[0].substring(0, 12)

  // Pour les matières multi-mots: initiale du premier mot + mots complets
  // Ex: "Expression orale" → "EXPRORALE" (au lieu de "EXPRESSI")
  //     "Expression Ecrite" → "EXPRECRITE" (différent de "EXPRORALE")
  const code = words.map((w) => w.substring(0, 4)).join('')
  return code.substring(0, 16) || 'SUBJ'
}

/**
 * Détecte automatiquement le nom de la classe MASOMO depuis le nom d'un
 * fichier Excel.
 *
 * Formats reconnus (insensible à la casse) :
 *   - "1_re PRIMAIRE..."  → "1ère ANNEE"
 *   - "1ere PRIMAIRE..."  → "1ère ANNEE"
 *   - "2_me PRIMAIRE..."  → "2ème ANNEE"
 *   - "2eme PRIMAIRE..."  → "2ème ANNEE"
 *   - "3_me PRIMAIRE..."  → "3ème ANNEE"
 *   - "4_me PRIMAIRE..."  → "4ème ANNEE"
 *   - "5_me PRIMAIRE..."  → "5ème ANNEE"
 *   - "6_me PRIMAIRE..."  → "6ème ANNEE"
 *   - "6ème PRIMAIRE..."  → "6ème ANNEE"
 *
 * Retourne null si aucun niveau n'a pu être détecté.
 */
export function detectClassNameFromFileName(fileName: string): string | null {
  if (!fileName) return null

  const lower = fileName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Patterns pour les 6 niveaux de primaire (format MASOMO RDC)
  // On accepte plusieurs variantes d'écriture du numéro
  const patterns: Array<{ regex: RegExp; className: string }> = [
    { regex: /\b1[_\s-]*re\b|\b1[_\s-]*ere\b|\bpremiere\b/, className: '1ère ANNEE' },
    { regex: /\b2[_\s-]*me\b|\b2[_\s-]*eme\b|\bdeuxieme\b/, className: '2ème ANNEE' },
    { regex: /\b3[_\s-]*me\b|\b3[_\s-]*eme\b|\btroisieme\b/, className: '3ème ANNEE' },
    { regex: /\b4[_\s-]*me\b|\b4[_\s-]*eme\b|\bquatrieme\b/, className: '4ème ANNEE' },
    { regex: /\b5[_\s-]*me\b|\b5[_\s-]*eme\b|\bcinquieme\b/, className: '5ème ANNEE' },
    { regex: /\b6[_\s-]*me\b|\b6[_\s-]*eme\b|\bsixieme\b/, className: '6ème ANNEE' },
  ]

  for (const { regex, className } of patterns) {
    if (regex.test(lower)) {
      return className
    }
  }

  return null
}

