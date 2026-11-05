/**
 * Bulletin Template Render — Génère un bulletin rempli à partir d'un
 * template Excel uploadé par promotion.
 *
 * Flux :
 *   1. findTemplateForStudent(studentId) → trouve le BulletinTemplate
 *      correspondant au niveau (1-12) de la classe de l'élève.
 *   2. renderBulletinFromTemplate({ studentId, classId, schoolYear })
 *      → charge le MediaFile (xlsx base64), trouve la bonne feuille LISTE,
 *      efface les lignes de données (rows 3+), insère UNE ligne avec
 *      l'identité de l'élève + ses notes placées dans les colonnes
 *      correspondant aux en-têtes de cours.
 *      → renvoie un Buffer xlsx prêt à l'export.
 *
 * Feuille LISTE (format BULLETINSENTETES.xlsx) :
 *   - Row 1 : en-têtes identité (cols 1-11) + noms matières (col 12+,
 *             une matière tous les 9 colonnes)
 *   - Row 2 : labels période/examen (1er, 2èP, EX, 3èP, 4èP, EX, 5èP, 6èP, EX)
 *   - Row 3+ : une ligne par élève
 *
 * Mapping des 9 colonnes d'une matière vers (trimester, type) :
 *   index 0 → T1, 1ère période
 *   index 1 → T1, 2ème période
 *   index 2 → T1, examen
 *   index 3 → T2, 1ère période
 *   index 4 → T2, 2ème période
 *   index 5 → T2, examen
 *   index 6 → T3, 1ère période
 *   index 7 → T3, 2ème période
 *   index 8 → T3, examen
 */

import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { db } from '@/lib/db'
import { detectLevel, levelLabel } from '@/lib/bulletin-parser'

// ---- Types ----

export interface RenderResult {
  /** Buffer du fichier xlsx modifié (prêt pour export Excel ou conversion PDF/Word). */
  buffer: Buffer
  /** Nom de feuille LISTE utilisée. */
  sheetName: string
  /** Niveau (1-12) détecté pour l'élève. */
  level: number
  /** Template utilisé. */
  templateId: string
  templateName: string
  /** Nombre de matières détectées dans la feuille LISTE. */
  subjectsCount: number
  /** Nombre de notes insérées pour l'élève. */
  gradesInserted: number
}

export interface RenderError {
  error: string
  code: 'NO_TEMPLATE' | 'NO_STUDENT' | 'NO_CLASS' | 'NO_LEVEL' | 'NO_LISTE_SHEET' | 'NO_MEDIAFILE'
}

// ---- Helpers ----

/** Post-traite un buffer xlsx pour ajouter `<calcPr fullCalcOnLoad="1"/>`
 *  dans workbook.xml. SheetJS (community) n'écrit PAS cet attribut — il faut
 *  le faire à la main en dézippant le xlsx, modifiant le XML, puis re-zippant.
 *
 *  Pourquoi c'est critique :
 *    - SheetJS ne calcule PAS les formules — il garde les valeurs cachées (.v)
 *      telles quelles.
 *    - Après modification de LISTE + BULLETIN!I3, les 247 formules VLOOKUP ont
 *      des valeurs cachées STALE (de l'ancien élève).
 *    - Sans fullCalcOnLoad, Excel peut afficher les valeurs stale jusqu'à ce
 *      que l'utilisateur appuie sur F9.
 *    - Avec fullCalcOnLoad, Excel ET LibreOffice recalculent toutes les
 *      formules à l'ouverture du fichier → valeurs correctes immédiatement.
 */
async function addFullCalcOnLoad(xlsxBuffer: Buffer): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(xlsxBuffer)
    const wbXmlFile = zip.file('xl/workbook.xml')
    if (!wbXmlFile) return xlsxBuffer

    let xml = await wbXmlFile.async('string')

    // Si calcPr est déjà présent, on le remplace
    if (/<calcPr[^>]*\/>/.test(xml)) {
      xml = xml.replace(/<calcPr[^>]*\/>/, '<calcPr fullCalcOnLoad="1" calcMode="auto"/>')
    } else if (/<calcPr[^>]*>.*?<\/calcPr>/.test(xml)) {
      xml = xml.replace(/<calcPr[^>]*>.*?<\/calcPr>/, '<calcPr fullCalcOnLoad="1" calcMode="auto"/>')
    } else {
      // Pas de calcPr — on l'insère avant </workbook>
      // On l'insère après <sheets>...</sheets> pour être sûr d'être au bon endroit
      const sheetsClose = '</sheets>'
      if (xml.includes(sheetsClose)) {
        xml = xml.replace(
          sheetsClose,
          sheetsClose + '<calcPr fullCalcOnLoad="1" calcMode="auto"/>'
        )
      } else {
        // Fallback : avant </workbook>
        xml = xml.replace(/<\/workbook>/, '<calcPr fullCalcOnLoad="1" calcMode="auto"/></workbook>')
      }
    }

    zip.file('xl/workbook.xml', xml)
    const outBuf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
    return Buffer.from(outBuf)
  } catch (err) {
    console.warn('[BULLETIN_RENDER] addFullCalcOnLoad failed:', err instanceof Error ? err.message : err)
    // En cas d'erreur, on retourne le buffer original — le fichier reste
    // utilisable, juste sans recalcul auto.
    return xlsxBuffer
  }
}

/** Convertit un numéro de colonne (1-based) en lettre Excel (A, B, ..., Z, AA, ...). */
function colNumberToLetter(num: number): string {
  let result = ''
  let n = num
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

/** Convertit une lettre de colonne Excel en numéro (1-based). */
function colLetterToNumber(letter: string): number {
  let result = 0
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64)
  }
  return result
}

/** Recalcule les formules VLOOKUP de la feuille BULLETIN en utilisant les
 *  données fraîchement insérées dans la feuille LISTE.
 *
 *  Pourquoi : ni ExcelJS ni SheetJS ne calculent les formules. Après avoir
 *  modifié LISTE + BULLETIN!I3, les valeurs cachées des 247 formules VLOOKUP
 *  sont STALE (elles reflètent l'ancien élève du template). Cette fonction
 *  parcourt chaque cellule de BULLETIN, détecte les formules VLOOKUP,
 *  recherche la valeur dans LISTE, et met à jour le `.result` de la cellule.
 *
 *  Pattern géré :
 *    =IF(I3<>"",VLOOKUP(I3,LISTE!A3:HP72,N,FALSE),"")
 *    =IF(I3<>"",VLOOKUP(I3,LISTE!$A$3:$HP$72,N,FALSE),"")
 *
 *  Sans cette fonction :
 *    - L'aperçu HTML (ExcelJS) affiche des valeurs stale
 *    - L'export Word (html-to-docx) affiche des valeurs stale
 *    - Sur Vercel (pas de LibreOffice), l'aperçu et le PDF sont cassés
 */
function recalculateBulletinFormulas(
  wb: ExcelJS.Workbook,
  listeSheetName: string,
  bulletinSheetName: string,
): void {
  const listeWs = wb.getWorksheet(listeSheetName)
  const bulletinWs = wb.getWorksheet(bulletinSheetName)
  if (!listeWs || !bulletinWs) {
    console.warn('[RECALC] LISTE or BULLETIN worksheet not found')
    return
  }

  // Récupérer la clé de recherche (BULLETIN!I3 = nom de l'élève)
  const i3Cell = bulletinWs.getCell('I3')
  let lookupValue: string
  if (i3Cell.value === null || i3Cell.value === undefined) {
    console.warn('[RECALC] BULLETIN!I3 is empty — no lookup value')
    return
  }
  if (typeof i3Cell.value === 'object' && 'formula' in i3Cell.value) {
    // I3 a une formule (ne devrait pas, on l'a remplacée par une valeur)
    lookupValue = String((i3Cell.value as { result?: unknown }).result || '')
  } else {
    lookupValue = String(i3Cell.value)
  }
  if (!lookupValue) {
    console.warn('[RECALC] BULLETIN!I3 lookup value is empty string')
    return
  }
  console.log(`[RECALC] Lookup value (I3): "${lookupValue}"`)

  // Regex pour parser VLOOKUP(I3,LISTE!A3:HP72,N,FALSE) ou avec $ absolus
  // Groupes : 1=startCol, 2=startRow, 3=endCol, 4=endRow, 5=colIndex
  const vlookupRegex = /VLOOKUP\([^,]+,\s*LISTE!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)\s*,\s*(\d+)\s*,\s*(?:FALSE|0|true|1)\s*\)/i

  let recalculated = 0
  let totalFormulas = 0

  // Parcourir chaque cellule de BULLETIN
  bulletinWs.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (
        cell.value !== null &&
        cell.value !== undefined &&
        typeof cell.value === 'object' &&
        'formula' in cell.value
      ) {
        totalFormulas++
        const formulaObj = cell.value as { formula: string; result?: unknown }
        const formula = formulaObj.formula || ''

        // Vérifier si c'est un IF avec VLOOKUP
        const match = formula.match(vlookupRegex)
        if (!match) return

        const startCol = match[1] // ex: "A"
        const startRow = parseInt(match[2], 10) // ex: 3
        const colIndex = parseInt(match[5], 10) // ex: 8 (1-based, relatif au début de la plage)

        // Calculer la colonne de retour :
        // La plage commence à startCol, le VLOOKUP retourne la colonne à
        // l'offset colIndex-1 depuis startCol.
        const startColNum = colLetterToNumber(startCol)
        const returnColNum = startColNum + colIndex - 1
        const returnColLetter = colNumberToLetter(returnColNum)

        // Chercher lookupValue dans la colonne startCol de LISTE (rows startRow → endRow)
        let result: unknown = ''
        for (let r = startRow; r <= listeWs.rowCount; r++) {
          const lookupCell = listeWs.getCell(`${startCol}${r}`)
          let cellValue: string
          if (lookupCell.value === null || lookupCell.value === undefined) {
            continue
          }
          if (typeof lookupCell.value === 'object' && 'formula' in lookupCell.value) {
            cellValue = String((lookupCell.value as { result?: unknown }).result || '')
          } else {
            cellValue = String(lookupCell.value)
          }
          if (cellValue.trim() === lookupValue.trim()) {
            // Trouvé ! Récupérer la valeur de retour
            const returnCell = listeWs.getCell(`${returnColLetter}${r}`)
            if (returnCell.value === null || returnCell.value === undefined) {
              result = ''
            } else if (typeof returnCell.value === 'object' && 'formula' in returnCell.value) {
              result = (returnCell.value as { result?: unknown }).result || ''
            } else {
              result = returnCell.value
            }
            break
          }
        }

        // Mettre à jour le résultat caché de la cellule
        formulaObj.result = result

        // ⚠ CRITIQUE : Remplacer la formule par sa valeur calculée.
        // ExcelJS ne préserve pas toujours le `.result` quand on écrit le
        // buffer — le rendu HTML (renderExcelToHtmlFragment) peut alors
        // afficher les valeurs STALE du template original au lieu des
        // valeurs recalculées.
        // En remplaçant la cellule par une valeur simple (sans formule),
        // on garantit que le preview HTML affiche les bonnes données.
        // L'utilisateur qui ouvre le fichier dans Excel verra les valeurs
        // directement (pas besoin de F9).
        cell.value = result as string | number | boolean | null

        recalculated++
      }
    })
  })

  console.log(`[RECALC] Recalculated ${recalculated} VLOOKUP formulas out of ${totalFormulas} total formulas in BULLETIN`)
}

/** Détecte le numéro de niveau (1-12) à partir du nom de classe. */
function detectClassLevel(className: string, classLevel?: string | null): number {
  // Priorité au nom de classe (ex: "4ème ANNEE")
  if (className) {
    const l = detectLevel(className)
    if (l > 0) return l
  }
  if (classLevel) {
    const l = detectLevel(classLevel)
    if (l > 0) return l
  }
  return 0
}

/** Trouve la feuille LISTE pour un niveau donné.
 *  Patterns testés (par ordre de priorité) :
 *    - "LISTE 1ère", "LISTE 2è", "LISTE 3è", "LISTE 4è", "LISTE 5è", "LISTE 6è"
 *    - "LISTE 1", "LISTE 2", ... (format alternatif)
 *    - "LISTE" (single sheet)
 *    - "BULLETIN" (fallback si le template ne contient qu'une feuille bulletin)
 *    - première feuille du classeur
 */
function findListeSheet(sheetNames: string[], level: number): string {
  // Pretty level label suffixes commonly used in BULLETINSENTETES.xlsx
  const levelSuffixes = [
    `LISTE ${level}ère`,
    `LISTE ${level}è`,
    `LISTE ${level}eme`,
    `LISTE ${level}ème`,
    `LISTE ${level}eme`,
    `LISTE ${level}`,
    `LISTE ${level}ER`,
    `LISTE ${level}ERE`,
  ]
  for (const candidate of levelSuffixes) {
    const found = sheetNames.find((n) => n.toUpperCase() === candidate.toUpperCase())
    if (found) return found
  }
  // Loose match: any sheet starting with "LISTE"
  const anyListe = sheetNames.find((n) => n.toUpperCase().startsWith('LISTE'))
  if (anyListe) return anyListe
  // Fallback BULLETIN sheet
  const bulletin = sheetNames.find((n) => n.toUpperCase() === 'BULLETIN')
  if (bulletin) return bulletin
  // Last resort: first sheet
  return sheetNames[0]
}

/** Extrait le nom de matière du header brut.
 *  Headers de LISTE 1ère : "DOMAINE DES LANGUES-LANGUES CONGOLAISES-Expression 0rale"
 *  → on garde le dernier segment après '-' comme nom de matière.
 *  Headers de LISTE 4è : "Exp. Orale & Vocabulaire" (pas de tiret) → on garde tel quel.
 */
function extractSubjectName(rawHeader: string): string {
  const s = String(rawHeader).trim()
  if (!s) return ''
  // Si la cellule contient '-' comme séparateur hiérarchique, on prend le dernier segment
  if (s.includes('-')) {
    const segments = s.split('-').map((seg) => seg.trim()).filter(Boolean)
    if (segments.length > 0) return segments[segments.length - 1]
  }
  return s
}

/** Normalise un nom pour la comparaison (minuscules, sans accents, sans espaces superflues). */
function normalizeName(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, ' ')
    .replace(/[.'',]/g, '') // strip punctuation that varies
    .trim()
}

// ---- Types internes ----

interface SubjectColumn {
  /** Nom brut du header (ex: "DOMAINE DES LANGUES-LANGUES CONGOLAISES-Expression 0rale"). */
  rawHeader: string
  /** Nom extrait (dernier segment). */
  subjectName: string
  /** Index de la première colonne (0-based) parmi les 9 colonnes de la matière. */
  startCol: number
}

/** Détecte les colonnes de matières dans la row 1 (header). */
function identifySubjectColumns(headerRow: unknown[]): SubjectColumn[] {
  const subjects: SubjectColumn[] = []
  const startCol = 11 // 0-based ; col 12 Excel = index 11
  let current: SubjectColumn | null = null
  let columnPositionInSubject = 0

  for (let col = startCol; col < headerRow.length; col++) {
    const raw = headerRow[col]
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      // Cellule vide : on continue (matière multi-colonnes — seule la 1ère colonne a le nom)
      columnPositionInSubject++
      continue
    }
    const rawHeader = String(raw).trim()
    const normalized = rawHeader.toLowerCase()
    // Terminator : "classement" ou "proclamation" → on arrête
    if (normalized.includes('classement') || normalized.includes('proclam')) {
      if (current) subjects.push(current)
      current = null
      break
    }
    // Nouvelle matière si on est à la position 9 (fin du groupe précédent)
    // ou si le header est différent du précédent ET non-vide.
    if (columnPositionInSubject >= 9 || !current || (current && rawHeader !== current.rawHeader && columnPositionInSubject > 0)) {
      if (current) subjects.push(current)
      current = {
        rawHeader,
        subjectName: extractSubjectName(rawHeader),
        startCol: col,
      }
      columnPositionInSubject = 0
    } else if (!current) {
      current = { rawHeader, subjectName: extractSubjectName(rawHeader), startCol: col }
      columnPositionInSubject = 0
    }
    columnPositionInSubject++
  }
  if (current) subjects.push(current)
  return subjects
}

/** Trouve les matières DB qui correspondent au nom extrait du header.
 *  Gère les headers composés avec "&" (ex: "Exp. Orale & Vocabulaire")
 *  en splittant et en matchant chaque sous-nom séparément.
 *  Renvoie un tableau (possiblement plusieurs matières si header composé). */
async function matchSubjectsToDb(
  subjectName: string,
  rawHeader: string,
  institutionId: string,
  subjectCache: Map<string, { id: string; name: string; title: string | null; subtitle: string | null }[]>
): Promise<{ id: string; name: string; title: string | null; subtitle: string | null }[]> {
  // Utilise le cache pour éviter de requêter la DB à chaque matière
  let subjects = subjectCache.get(institutionId)
  if (!subjects) {
    const all = await db.subject.findMany({
      where: { OR: [{ level: 'primaire' }, { level: null }, { level: 'secondaire' }] },
      select: { id: true, name: true, title: true, subtitle: true },
    })
    subjects = all as { id: string; name: string; title: string | null; subtitle: string | null }[]
    subjectCache.set(institutionId, subjects)
  }

  // Helper : normalise en remplaçant 0 → o (typo "Expression 0rale")
  const norm = (s: string | null | undefined) => {
    if (!s) return ''
    return normalizeName(s).replace(/0/g, 'o')
  }

  /** Match TOUTES les matières DB correspondantes (ex: deux "Expression Orale"). */
  const matchAll = (queryName: string): { id: string; name: string; title: string | null; subtitle: string | null }[] => {
    const target = norm(queryName)
    if (!target) return []

    // 1. Match exact sur le nom (normalisé, avec 0→o) — peut matcher plusieurs
    const exacts = subjects!.filter((s) => norm(s.name) === target)
    if (exacts.length > 0) return exacts

    // 2. Match permissif : "exp orale" ≈ "expression orale"
    //    Soit par inclusion stricte, soit par préfixe (pour "Exp." vs "Expression").
    const permissifs = subjects!.filter((s) => {
      const sName = norm(s.name)
      if (!sName || sName.length < 3) return false
      // Égalité
      if (sName === target) return true
      // Inclusion dans un sens ou l'autre
      if (sName.length >= 4 && target.includes(sName)) return true
      if (target.length >= 4 && sName.includes(target)) return true
      // Préfixe du premier mot : "exp" prefix of "expression"
      // (pour les abréviations "Exp." → "Expression", "Conjug." → "Conjugaison", "Orth." → "Orthographe")
      const targetFirstWord = target.split(' ')[0]
      const sNameFirstWord = sName.split(' ')[0]
      if (targetFirstWord.length >= 3 && sNameFirstWord.startsWith(targetFirstWord)) {
        // Et le reste du target doit être proche du reste du sName
        const targetRest = target.split(' ').slice(1).join(' ')
        const sNameRest = sName.split(' ').slice(1).join(' ')
        if (!targetRest || !sNameRest) return true
        if (sNameRest === targetRest || sNameRest.includes(targetRest) || targetRest.includes(sNameRest)) return true
      }
      // Si target est un préfixe de sName au début (ex: "conjug" prefix of "conjugaison")
      if (target.length >= 4 && sName.startsWith(target)) return true
      return false
    })
    return permissifs
  }

  // Split sur "&" et "-" pour les headers composés.
  // IMPORTANT : on utilise rawHeader (header brut complet) et non subjectName
  // (qui peut être tronqué au dernier segment par extractSubjectName, par ex.
  // "Exp. Orale - Récit - Voc." → "Voc." — ce qui ne matcherait rien).
  const splitAndMatch = (rawName: string): string[] => {
    if (rawName.includes('&')) {
      return rawName.split('&').map((s) => s.trim()).filter(Boolean)
    }
    // Pour les headers avec " - " ou "- " comme séparateur de matières,
    // on splitte aussi — mais en excluant les cas où "-" est dans un mot
    // composé (ex: "SOUS-TOTAL", "LECT-ECRIT"). On ne split que si le "-"
    // est entouré d'espaces OU si "- " est en préfixe d'un mot.
    if (rawName.includes(' - ')) {
      return rawName.split(' - ').map((s) => s.trim()).filter(Boolean)
    }
    return [rawName]
  }
  // Pour "LECT-ECRIT EN LANGUES CONGOLAISES" (pas de " - "), on ne splitte
  // pas et on essaie de matcher le header brut entier.
  const subNames = splitAndMatch(rawHeader)
  const matches: { id: string; name: string; title: string | null; subtitle: string | null }[] = []
  const seenIds = new Set<string>()

  /** Ajoute toutes les matières matchées (sans doublons par id). */
  const addMatches = (matched: { id: string; name: string; title: string | null; subtitle: string | null }[]) => {
    for (const m of matched) {
      if (!seenIds.has(m.id)) { matches.push(m); seenIds.add(m.id) }
    }
  }

  if (subNames.length === 0) {
    addMatches(matchAll(rawHeader))
  } else {
    for (const subName of subNames) {
      addMatches(matchAll(subName))
    }
  }

  // Fallback : si aucun match via sub-names, essayer le header brut entier
  if (matches.length === 0) {
    addMatches(matchAll(rawHeader))
  }

  // Fallback : si toujours rien, essayer via les segments hiérarchiques "-"
  // (ex: "DOMAINE DES LANGUES-LANGUES CONGOLAISES-Expression 0rale")
  if (matches.length === 0 && rawHeader.includes('-')) {
    const segments = rawHeader.split('-').map((s) => s.trim()).filter(Boolean)
    if (segments.length >= 2) {
      const possibleSubtitle = segments[segments.length - 2]
      const possibleName = segments[segments.length - 1]
      const subNorm = norm(possibleSubtitle)
      const nameNorm = norm(possibleName)
      const candidates = subjects!.filter((s) => {
        const sSub = norm(s.subtitle)
        const sName = norm(s.name)
        return sSub && sSub === subNorm && (sName === nameNorm || sName.includes(nameNorm) || nameNorm.includes(sName))
      })
      addMatches(candidates)
    }
  }

  return matches
}

/** Convertit une valeur cellule en nombre si possible. */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  const s = String(v).trim().replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ---- API publique ----

/**
 * Trouve le BulletinTemplate correspondant à l'élève (basé sur sa classe).
 * Renvoie null si aucun template n'est trouvé pour le niveau de l'élève.
 *
 * Note : BulletinTemplate n'a pas de relation directe avec MediaFile
 * (seulement mediaFileId). Le MediaFile doit être chargé séparément.
 */
export async function findTemplateForStudent(studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      class: { select: { id: true, name: true, level: true, promotion: true, institutionId: true } },
    },
  })
  if (!student?.class) return null
  const institutionId = student.class.institutionId
  if (!institutionId) return null
  const level = detectClassLevel(student.class.name, student.class.level)
  if (level === 0) return null
  const template = await db.bulletinTemplate.findFirst({
    where: { institutionId, level },
  })
  if (!template?.mediaFileId) return null
  // Charger le MediaFile séparément (pas de relation directe dans le schéma)
  const mediaFile = await db.mediaFile.findUnique({
    where: { id: template.mediaFileId },
  })
  if (!mediaFile) return null
  return { ...template, mediaFile }
}

/**
 * Rend un bulletin rempli pour un élève à partir du template Excel
 * de sa promotion. Retourne le buffer xlsx modifié + métadonnées.
 */
export async function renderBulletinFromTemplate(params: {
  studentId: string
  classId?: string
  schoolYear: string
}): Promise<RenderResult | RenderError> {
  const { studentId, schoolYear } = params
  console.log('[BULLETIN_RENDER] starting for student', studentId, '| year', schoolYear)

  // 1. Charger l'élève + classe
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { userCode: true } },
      class: { select: { id: true, name: true, level: true, promotion: true, institutionId: true } },
    },
  })
  if (!student) return { error: 'Élève introuvable', code: 'NO_STUDENT' }
  if (!student.class) return { error: "L'élève n'a pas de classe assignée", code: 'NO_CLASS' }

  const institutionId = student.class.institutionId
  if (!institutionId) return { error: "La classe n'a pas d'institution", code: 'NO_CLASS' }

  // 2. Détecter le niveau (1-12)
  const level = detectClassLevel(student.class.name, student.class.level)
  if (level === 0) {
    return {
      error: `Impossible de détecter le niveau à partir du nom de classe "${student.class.name}"`,
      code: 'NO_LEVEL',
    }
  }

  // 3. Trouver le template + son MediaFile (pas de relation directe dans
  //    le schéma Prisma, on charge en deux étapes)
  const template = await db.bulletinTemplate.findFirst({
    where: { institutionId, level },
  })
  if (!template) {
    return {
      error: `Aucun template bulletin uploadé pour le niveau ${levelLabel(level)} (${level}). Uploadez-le dans Paramètres → Institution → Modèles de bulletins.`,
      code: 'NO_TEMPLATE',
    }
  }
  let mediaFile: Awaited<ReturnType<typeof db.mediaFile.findUnique>> = null
  if (template.mediaFileId) {
    mediaFile = await db.mediaFile.findUnique({ where: { id: template.mediaFileId } })
  }
  if (!mediaFile?.data) {
    return { error: 'Le fichier Excel du template est introuvable', code: 'NO_MEDIAFILE' }
  }

  // 4. Décoder le xlsx
  //    cellFormula: true — PRÉSERVER les formules (VLOOKUP etc.) lors de la lecture.
  //    Sans cette option, SheetJS peut perdre les formules pendant le round-trip.
  const xlsxBuffer = Buffer.from(mediaFile.data, 'base64')
  const wb = XLSX.read(xlsxBuffer, { type: 'buffer', cellStyles: true, cellDates: true, cellFormula: true })

  // 5. Trouver la feuille LISTE pour ce niveau
  const sheetName = findListeSheet(wb.SheetNames, level)
  if (!sheetName) {
    return { error: 'Aucune feuille dans le fichier template', code: 'NO_LISTE_SHEET' }
  }
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    return { error: `Feuille "${sheetName}" introuvable dans le template`, code: 'NO_LISTE_SHEET' }
  }

  // 6. Parser les en-têtes (rows 1-2)
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
  const headerRow1 = data[0] || []
  // row 2 = labels période/examen (pas besoin de parser en détail, on connaît le pattern)

  // 7. Identifier les colonnes de matières
  const subjectColumns = identifySubjectColumns(headerRow1)
  if (subjectColumns.length === 0) {
    return { error: "Aucune matière détectée dans la feuille LISTE du template", code: 'NO_LISTE_SHEET' }
  }

  // 8. Construire un cache des matières DB pour cette institution
  const subjectCache = new Map<string, { id: string; name: string; title: string | null; subtitle: string | null }[]>()

  // 9. Pour chaque matière du template, trouver les matières DB correspondantes
  //    (un header composé comme "Exp. Orale & Vocabulaire" peut matcher
  //    plusieurs matières DB — on somme leurs notes).
  const matchedSubjects = await Promise.all(
    subjectColumns.map(async (sc) => {
      const dbSubjects = await matchSubjectsToDb(sc.subjectName, sc.rawHeader, institutionId, subjectCache)
      // DEBUG: log matching results for the first 10 subjects
      console.log('[BULLETIN_MATCH] col', sc.startCol + 1, '| rawHeader:', JSON.stringify(sc.rawHeader).substring(0, 60), '| subjectName:', JSON.stringify(sc.subjectName).substring(0, 40), '| matches:', dbSubjects.length, dbSubjects.map(s => s.name).slice(0, 3).join(','))
      return { column: sc, dbSubjects }
    })
  )

  // 10. Charger toutes les notes de l'élève pour l'année scolaire
  const grades = await db.grade.findMany({
    where: {
      studentId,
      schoolYear,
    },
    select: {
      subjectId: true,
      value: true,
      maxValue: true,
      type: true,
      trimester: true,
    },
  })
  // Index : subjectId → Map<key=`${trimester}|${type}`, number[]>
  // (plusieurs notes possibles pour le même subjectId+trimester+type — on garde tout)
  const gradesBySubject = new Map<string, Map<string, number[]>>()
  for (const g of grades) {
    if (!gradesBySubject.has(g.subjectId)) gradesBySubject.set(g.subjectId, new Map())
    const key = `${g.trimester}|${g.type}`
    if (!gradesBySubject.get(g.subjectId)!.has(key)) {
      gradesBySubject.get(g.subjectId)!.set(key, [])
    }
    gradesBySubject.get(g.subjectId)!.get(key)!.push(g.value)
  }

  // 11. Préparer la ligne de l'élève
  // Mapping des 9 colonnes par matière → (trimester, type)
  const cellTypeMap: Array<{ trimester: string; type: string }> = [
    { trimester: '1er', type: '1ère période' },
    { trimester: '1er', type: '2ème période' },
    { trimester: '1er', type: 'examen' },
    { trimester: '2eme', type: '1ère période' },
    { trimester: '2eme', type: '2ème période' },
    { trimester: '2eme', type: 'examen' },
    { trimester: '3eme', type: '1ère période' },
    { trimester: '3eme', type: '2ème période' },
    { trimester: '3eme', type: 'examen' },
  ]

  // Ligne élève : 11 colonnes identité + N×9 colonnes notes
  const studentRow: unknown[] = new Array(headerRow1.length).fill(null)
  // Identité
  studentRow[0] = `${student.lastName || ''} ${student.firstName || ''}`.trim() // NOMS
  studentRow[1] = student.user.userCode || '' // N° ID
  studentRow[2] = student.gender || '' // SEXE
  studentRow[3] = student.dateOfBirth || '' // DATE DE NAISS
  studentRow[4] = student.class.name // CLASSE
  // Cols 5-10 (N° PERM, PROVINCE, VILLE, COMMUNE, ECOLE, CODE) : laisser vide

  // Notes : pour chaque matière du template, placer les 9 valeurs
  // Pour chaque cellule (trimester, type) : somme des grades de toutes les
  // matières DB matchées (header composé "A & B" → somme des notes de A et B).
  let gradesInserted = 0
  for (const { column, dbSubjects } of matchedSubjects) {
    if (dbSubjects.length === 0) continue
    for (let i = 0; i < 9; i++) {
      const { trimester, type } = cellTypeMap[i]
      const key = `${trimester}|${type}`
      // ⚠ IMPORTANT : On prend la PREMIÈRE matière matchée qui a une note
      // pour ce (trimester, type). On NE SOMME PAS.
      //
      // Raison : "Expression Orale" existe dans la DB sous plusieurs
      // subtitles (Langues Congolaises, Français, etc.). Sommer les notes
      // de toutes ces matières donne des valeurs fausses (ex: 6+5=11 au
      // lieu de 6). Chaque colonne du template correspond à UNE seule
      // matière — on prend la première qui a des notes.
      let cellValue: number | null = null
      for (const dbSub of dbSubjects) {
        const subjGrades = gradesBySubject.get(dbSub.id)
        if (!subjGrades) continue
        const cellValues = subjGrades.get(key)
        if (cellValues && cellValues.length > 0) {
          // Prendre la dernière note (si plusieurs, la plus récente)
          cellValue = cellValues[cellValues.length - 1]
          break // ⚠ BREAK : première matière avec notes = stop
        }
      }
      if (cellValue !== null) {
        studentRow[column.startCol + i] = cellValue
        gradesInserted++
      }
    }
  }

  // 12. ⚠ CRITIQUE — Utiliser ExcelJS pour modifier le template (pas SheetJS).
  //     SheetJS community perd 89% du formatage (styles, bordures, fusions,
  //     largeurs de colonnes) pendant le round-trip lecture→écriture.
  //     ExcelJS préserve ces éléments car il modifie le XML existant au lieu
  //     de le reconstruire from scratch.
  //
  //     Approche :
  //       a. Charger le template original avec ExcelJS (préserve tout le formatage)
  //       b. Effacer les données des rows 3+ dans la feuille LISTE
  //       c. Insérer la ligne de l'élève à row 3
  //       d. Mettre à jour BULLETIN!I3 avec le nom de l'élève
  //       e. Écrire le buffer (le formatage original est préservé)
  //       f. Post-traiter avec JSZip pour ajouter fullCalcOnLoad
  console.log('[BULLETIN_RENDER] Loading template with ExcelJS for style-preserving modification...')

  const exceljsWb = new ExcelJS.Workbook()
  await exceljsWb.xlsx.load(xlsxBuffer as unknown as ArrayBuffer)

  // 12a. Trouver la feuille LISTE dans ExcelJS (par nom)
  const listeWs = exceljsWb.getWorksheet(sheetName)
  if (!listeWs) {
    return { error: `Feuille "${sheetName}" introuvable après chargement ExcelJS`, code: 'NO_LISTE_SHEET' }
  }

  // 12b. Effacer toutes les lignes à partir de row 3 (row 1 et 2 = headers).
  //      On parcourt chaque ligne de row 3 jusqu'à la dernière, et on met
  //      chaque cellule à null. On préserve les styles de la ligne (pour
  //      que la ligne élève hérite du bon formatage).
  const lastRow = listeWs.rowCount
  console.log(`[BULLETIN_RENDER] Clearing LISTE rows 3 to ${lastRow}...`)
  for (let rowNum = 3; rowNum <= lastRow; rowNum++) {
    const row = listeWs.getRow(rowNum)
    // Mettre chaque cellule à null tout en préservant le style
    const lastCol = (headerRow1 as unknown[]).length || listeWs.columnCount
    for (let colNum = 1; colNum <= lastCol; colNum++) {
      const cell = row.getCell(colNum)
      // On efface la valeur mais on garde le style (cell.style reste intact)
      cell.value = null
    }
    // Marquer la ligne comme modifiée pour qu'ExcelJS la réécrive
    row.commit()
  }

  // 12c. Insérer la ligne élève à row 3.
  //      ExcelJS utilise 1-based indexing pour les rows ET les columns.
  //      studentRow est 0-based (index 0 = colonne A), donc on décale de +1.
  console.log(`[BULLETIN_RENDER] Inserting student data at LISTE row 3...`)
  const studentRowData = listeWs.getRow(3)
  // Identité (colonnes A à E = 1 à 5)
  // A3 = NOMS, B3 = N° ID, C3 = SEXE, D3 = DATE DE NAISS, E3 = CLASSE
  studentRowData.getCell(1).value = `${student.lastName || ''} ${student.firstName || ''}`.trim() // NOMS
  studentRowData.getCell(2).value = student.user.userCode || '' // N° ID
  studentRowData.getCell(3).value = student.gender || '' // SEXE
  // dateOfBirth : ExcelJS gère les dates comme objets Date
  if (student.dateOfBirth) {
    try {
      const dob = new Date(student.dateOfBirth)
      if (!isNaN(dob.getTime())) {
        studentRowData.getCell(4).value = dob
      } else {
        studentRowData.getCell(4).value = student.dateOfBirth
      }
    } catch {
      studentRowData.getCell(4).value = student.dateOfBirth
    }
  } else {
    studentRowData.getCell(4).value = null
  }
  studentRowData.getCell(5).value = student.class.name // CLASSE

  // Notes : pour chaque matière, placer les 9 valeurs dans les colonnes correspondantes
  // studentRow était préparé avec les valeurs aux bons index (0-based)
  // On réutilise les valeurs déjà calculées dans studentRow[]
  for (let colIdx = 0; colIdx < studentRow.length; colIdx++) {
    const val = studentRow[colIdx]
    if (val === null || val === undefined) continue
    // Sauter les 5 premières colonnes (identité, déjà remplies ci-dessus)
    if (colIdx < 5) continue
    // ExcelJS : colonne = colIdx + 1 (1-based), row = 3
    const cell = studentRowData.getCell(colIdx + 1)
    if (typeof val === 'number') {
      cell.value = val
    } else {
      cell.value = String(val)
    }
  }
  studentRowData.commit()
  console.log(`[BULLETIN_RENDER] Student row inserted: ${gradesInserted} grades placed`)

  // 12d. ⚠ CRITIQUE — Mettre à jour BULLETIN!I3 avec le nom de l'élève.
  //      La feuille BULLETIN contient 247 formules VLOOKUP qui utilisent
  //      la cellule I3 comme clé de recherche pour puller les données de
  //      l'élève depuis LISTE.
  const bulletinWsExceljs = exceljsWb.getWorksheet('BULLETIN')
  if (bulletinWsExceljs) {
    const studentName = `${student.lastName || ''} ${student.firstName || ''}`.trim()
    // I3 = colonne I (9ème colonne, 1-based), row 3
    const i3Cell = bulletinWsExceljs.getCell('I3')
    i3Cell.value = studentName
    console.log('[BULLETIN_RENDER] BULLETIN!I3 mis à jour avec le nom élève:', studentName)
  } else {
    console.log('[BULLETIN_RENDER] Pas de feuille BULLETIN dans le template — skip I3 update')
  }

  // 12e. ⚠ CRITIQUE — Recalculer les formules VLOOKUP de la feuille BULLETIN
  //      en JavaScript (sans LibreOffice).
  //
  //      Ni ExcelJS ni SheetJS ne calculent les formules — ils gardent les
  //      valeurs cachées (.result) telles quelles. Après modification de
  //      LISTE + BULLETIN!I3, les 247 formules VLOOKUP ont des valeurs
  //      cachées STALE (de l'ancien élève du template original).
  //
  //      Sur Vercel, LibreOffice (soffice) n'est PAS disponible — on ne peut
  //      pas convertir le xlsx en HTML via soffice. Il faut donc recalculer
  //      les VLOOKUP nous-mêmes pour que l'aperçu ExcelJS affiche les bonnes
  //      valeurs.
  //
  //      Le pattern de formule est :
  //        =IF(I3<>"",VLOOKUP(I3,LISTE!A3:HP72,N,FALSE),"")
  //      On parse N (l'index de colonne à retourner), on cherche le nom de
  //      l'élève dans LISTE colonne A (rows 3+), et on récupère la valeur à
  //      la colonne N (offset depuis A).
  console.log('[BULLETIN_RENDER] Recalculating VLOOKUP formulas in BULLETIN sheet (no LibreOffice needed)...')
  if (bulletinWsExceljs) {
    recalculateBulletinFormulas(exceljsWb, sheetName, 'BULLETIN')

    // 12e2. ⚠ CRITIQUE — Remplacer TOUTES les formules restantes par leurs
    //       valeurs calculées (pas seulement VLOOKUP).
    //
    //       Sur Windows, Excel propose un bouton "Activer le contenu" qui
    //       recalcule les formules à l'ouverture. Mais sur Android, iOS,
    //       macOS et Ubuntu, ce bouton n'existe pas — les formules affichent
    //       leurs valeurs CACHÉES STALE (du template original).
    //
    //       En remplaçant TOUTES les cellules formule par leur valeur
    //       calculée (ou vide si pas de valeur), on garantit que le fichier
    //       Excel affiche les bonnes données sur TOUS les navigateurs
    //       (Windows, Mac, Linux, Android, iOS) — sans besoin de recalc.
    console.log('[BULLETIN_RENDER] Replacing ALL remaining formulas with their cached values...')
    let replacedCount = 0
    bulletinWsExceljs.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (
          cell.value !== null &&
          cell.value !== undefined &&
          typeof cell.value === 'object'
        ) {
          const cellVal = cell.value as unknown as Record<string, unknown>
          // Gérer les cellules avec formule propre ET les cellules avec
          // formule partagée (sharedFormula). Les deux causent l'erreur
          // "Shared Formula master must exist" si on remplace le master
          // sans aussi remplacer les cells qui le référencent.
          if ('formula' in cellVal || 'sharedFormula' in cellVal) {
            const result = cellVal.result
            // Si le résultat est null/undefined, on met une chaîne vide
            cell.value = (result === null || result === undefined ? '' : result) as string | number | boolean | null
            replacedCount++
          }
        }
      })
    })
    console.log(`[BULLETIN_RENDER] Replaced ${replacedCount} remaining formula cells (including shared formulas) with their values`)
  }

  // 12f. Écrire le workbook modifié en buffer avec ExcelJS.
  //      ExcelJS préserve les styles, bordures, fusions, largeurs de colonnes
  //      du template original — contrairement à SheetJS qui les perd.
  console.log('[BULLETIN_RENDER] Writing modified workbook with ExcelJS (preserves styles)...')
  const exceljsBuffer = await exceljsWb.xlsx.writeBuffer({
    filename: 'bulletin.xlsx',
  })
  const outBuffer = await addFullCalcOnLoad(Buffer.from(exceljsBuffer as ArrayBuffer))
  console.log('[BULLETIN_RENDER] addFullCalcOnLoad appliqué au buffer de sortie')
  console.log('[BULLETIN_RENDER] Taille du buffer final:', outBuffer.length, 'octets (template original:', xlsxBuffer.length, 'octets)')

  return {
    buffer: outBuffer,
    sheetName,
    level,
    templateId: template.id,
    templateName: template.name,
    subjectsCount: subjectColumns.length,
    gradesInserted,
  }
}
