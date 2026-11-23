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
  // ⚠ CASE-SENSITIVE : ne PAS lowercaser. On normalise seulement les
  // accents et la ponctuation. Ainsi "Expression orale" (o minuscule)
  // et "Expression Orale" (O majuscule) sont traités comme DIFFÉRENTS.
  const norm = (s: string | null | undefined) => {
    if (!s) return ''
    return String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/\s+/g, ' ')
      .replace(/[.'',]/g, '') // strip punctuation
      .replace(/0/g, 'o') // typo fix
      .trim()
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
 * Remplit les pourcentages pour chaque colonne quand selection=all.
 * ⚠ IMPORTANT : On calcule les pourcentages depuis les notes DB de l'élève,
 * PAS depuis les cellules du BULLETIN (qui peuvent contenir les valeurs
 * du template au lieu des vraies notes).
 */
async function fillPourcentagePerColumn(
  bulletinWs: ExcelJS.Worksheet,
  rankRowNum: number,
  startCol: number,
  student: { id: string },
  schoolYear: string,
  db: typeof import('@/lib/db').db,
): Promise<void> {
  // Mapping colonne → (trimester, type) pour calculer le total depuis la DB
  const colToGrade: { col: number; trimester: string; type: string | null }[] = [
    { col: 3, trimester: '1er', type: '1ère période' },    // C
    { col: 4, trimester: '1er', type: '2ème période' },    // D
    { col: 6, trimester: '1er', type: 'examen' },          // F
    { col: 8, trimester: '1er', type: null },              // H = trim T1 (somme)
    { col: 9, trimester: '2eme', type: '3ème période' },   // I
    { col: 10, trimester: '2eme', type: '4ème période' },  // J
    { col: 12, trimester: '2eme', type: 'examen' },        // L
    { col: 14, trimester: '2eme', type: null },             // N = trim T2
    { col: 15, trimester: '3eme', type: '5ème période' },  // O
    { col: 16, trimester: '3eme', type: '6ème période' },  // P
    { col: 18, trimester: '3eme', type: 'examen' },        // R
    { col: 20, trimester: '3eme', type: null },             // T = trim T3
    { col: 22, trimester: null, type: null },              // V = annuel
  ]

  for (const cm of colToGrade) {
    if (cm.col <= startCol) continue

    let studentTotal = 0
    let maxTotal = 0

    if (cm.type === null && cm.trimester !== null) {
      // Trim = somme des 3 types du trimestre
      const types = ['1ère période', '2ème période', 'examen']
      const trim = cm.trimester
      const trimTypes = trim === '1er' ? ['1ère période', '2ème période', 'examen']
        : trim === '2eme' ? ['3ème période', '4ème période', 'examen']
        : ['5ème période', '6ème période', 'examen']
      for (const t of trimTypes) {
        const grades = await db.grade.findMany({
          where: { studentId: student.id, schoolYear, trimester: trim, type: t },
          select: { value: true, maxValue: true },
        })
        for (const g of grades) {
          studentTotal += g.value
          maxTotal += g.maxValue
        }
      }
    } else if (cm.trimester === null) {
      // Annuel = toutes les notes
      const grades = await db.grade.findMany({
        where: { studentId: student.id, schoolYear },
        select: { value: true, maxValue: true },
      })
      for (const g of grades) {
        studentTotal += g.value
        maxTotal += g.maxValue
      }
    } else {
      // Une seule période/examen
      const grades = await db.grade.findMany({
        where: { studentId: student.id, schoolYear, trimester: cm.trimester, type: cm.type },
        select: { value: true, maxValue: true },
      })
      for (const g of grades) {
        studentTotal += g.value
        maxTotal += g.maxValue
      }
    }

    if (maxTotal > 0) {
      const pct = Math.round((studentTotal / maxTotal) * 1000) / 10
      const cell = bulletinWs.getRow(rankRowNum).getCell(cm.col)
      cell.value = pct
      // ⚠ Police réduite (size 6) pour que le pourcentage tienne dans la cellule
      // ⚠ PAS de signe % — juste le nombre
      cell.font = { size: 6, bold: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 0, wrapText: false }
      cell.numFmt = '0.0'  // Affiche juste le nombre, sans %
    } else {
      bulletinWs.getRow(rankRowNum).getCell(cm.col).value = null
    }
  }
}

/**
 * Remplit les rangs pour chaque colonne quand selection=all.
 * Pour chaque colonne (C=1èP, D=2èP, F=EX T1, H=TRIM T1, etc.),
 * calcule le rang de l'élève parmi ses camarades basé sur les notes
 * de cette colonne.
 */
async function fillRankPerColumn(
  bulletinWs: ExcelJS.Worksheet,
  rankRowNum: number,
  startCol: number,
  student: { id: string },
  classmates: { id: string }[],
  schoolYear: string,
  db: typeof import('@/lib/db').db,
  gradeColMap: { type: string; trimester: string; col: number; isExam: boolean }[],
): Promise<void> {
  // Pour chaque colonne de note (C, D, F, H, I, J, L, N, O, P, R, T, V)
  const colToGradeMap: { col: number; trimester: string; type: string }[] = []
  for (const entry of gradeColMap) {
    colToGradeMap.push({ col: entry.col, trimester: entry.trimester, type: entry.type })
  }
  // Ajouter les colonnes TRIM (H=8, N=14, T=20) et ANNUEL (V=22)
  colToGradeMap.push({ col: 8, trimester: '1er', type: '__trim__' })
  colToGradeMap.push({ col: 14, trimester: '2eme', type: '__trim__' })
  colToGradeMap.push({ col: 20, trimester: '3eme', type: '__trim__' })
  colToGradeMap.push({ col: 22, trimester: '__all__', type: '__annuel__' })

  for (const cm of colToGradeMap) {
    if (cm.col <= startCol) continue // Skip B

    try {
      // Calculer le total de chaque camarade pour cette colonne
      const totals: { studentId: string; total: number }[] = []
      for (const m of classmates) {
        let total = 0
        if (cm.type === '__trim__') {
          // Trim = somme des 3 colonnes (périodes + examen) du trimestre
          const periodCols = cm.trimester === '1er' ? [3, 4, 6] : cm.trimester === '2eme' ? [9, 10, 12] : [15, 16, 18]
          for (const pc of periodCols) {
            const entry = gradeColMap.find(e => e.col === pc)
            if (entry) {
              const g = await db.grade.findFirst({
                where: { studentId: m.id, schoolYear, trimester: entry.trimester, type: entry.type },
                select: { value: true },
              })
              total += g?.value || 0
            }
          }
        } else if (cm.type === '__annuel__') {
          // Annuel = toutes les notes
          const grades = await db.grade.findMany({
            where: { studentId: m.id, schoolYear },
            select: { value: true },
          })
          total = grades.reduce((s, g) => s + g.value, 0)
        } else {
          // Une seule période/examen
          const g = await db.grade.findFirst({
            where: { studentId: m.id, schoolYear, trimester: cm.trimester, type: cm.type },
            select: { value: true },
          })
          total = g?.value || 0
        }
        totals.push({ studentId: m.id, total })
      }
      totals.sort((a, b) => b.total - a.total)
      const colRank = totals.findIndex(t => t.studentId === student.id) + 1
      if (colRank > 0) {
        const cell = bulletinWs.getRow(rankRowNum).getCell(cm.col)
        cell.value = `${colRank}${colRank === 1 ? 'er' : 'ème'}`
        // ⚠ Réduire la police pour que le rang tienne dans la cellule
        // (les cellules sont étroites, "1er"/"2ème" doit tenir)
        cell.font = { size: 7, bold: true }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    } catch {
      // Skip cette colonne en cas d'erreur
    }
  }
}

/**
 * Remplit DIRECTEMENT la feuille BULLETIN avec les notes de l'élève.
 *
 * On parcourt chaque ligne du BULLETIN à partir de la row 11 (après les
 * headers en rows 8-10). Pour chaque ligne :
 *   - Si col A contient un nom de matière → on remplit les notes
 *   - Si col A = "Sous-Total" → on calcule la somme des lignes au-dessus
 *   - Si col A = "MAXIMA" ou similaire → on calcule le total général
 *
 * Colonnes du BULLETIN (layout standard) :
 *   A = matière | B = MAX per | C = 1èP | D = 2èP | E = MAX EX | F = PTS OBT EX
 *   G = MAX TRIM | H = PTS OBT TRIM | I = 3èP | J = 4èP | K = MAX EX | L = PTS OBT EX
 *   M = MAX TRIM | N = PTS OBT TRIM | O = 5èP | P = 6èP | Q = MAX EX | R = PTS OBT EX
 *   S = MAX TRIM | T = PTS OBT TRIM | U = MAX ANNUEL | V = PTS OBT ANNUEL
 *
 * La sélection détermine quelles colonnes sont remplies :
 *   "all" → toutes les colonnes
 *   "1er" → T1 seulement (C, D, F, H)
 *   "2eme" → T2 seulement (I, J, L, N)
 *   "3eme" → T3 seulement (O, P, R, T)
 *   "p1".."p6" → une seule période
 *   "examen" → examens seulement
 */
async function fillBulletinSheetDirectly(
  bulletinWs: ExcelJS.Worksheet,
  listeWs: ExcelJS.Worksheet,
  matchedSubjects: unknown[],
  gradesBySubject: Map<string, Map<string, number[]>>,
  student: { id: string; lastName: string; firstName: string; gender: string | null; dateOfBirth: string | null; user: { userCode: string | null }; class: { id: string; name: string; level: string; promotion: string | null; institutionId: string } | null },
  selection: string,
  db: typeof import('@/lib/db').db,
  schoolYear: string,
): Promise<void> {
  console.log(`[BULLETIN_FILL] Starting direct fill, selection: ${selection}`)

  // Mapping des types DB → colonnes BULLETIN (1-based)
  // T1: C=1èP(3), D=2èP(4), F=EX(6), H=TRIM(8)
  // T2: I=3èP(9), J=4èP(10), L=EX(12), N=TRIM(14)
  // T3: O=5èP(15), P=6èP(16), R=EX(18), T=TRIM(20)
  // Annuel: V=PTS(22)
  const gradeColMap: { type: string; trimester: string; col: number; isExam: boolean }[] = [
    { type: '1ère période', trimester: '1er', col: 3, isExam: false },   // C
    { type: '2ème période', trimester: '1er', col: 4, isExam: false },   // D
    { type: 'examen', trimester: '1er', col: 6, isExam: true },          // F
    { type: '3ème période', trimester: '2eme', col: 9, isExam: false },  // I
    { type: '4ème période', trimester: '2eme', col: 10, isExam: false }, // J
    { type: 'examen', trimester: '2eme', col: 12, isExam: true },        // L
    { type: '5ème période', trimester: '3eme', col: 15, isExam: false }, // O
    { type: '6ème période', trimester: '3eme', col: 16, isExam: false }, // P
    { type: 'examen', trimester: '3eme', col: 18, isExam: true },        // R
  ]

  // Déterminer quelles colonnes remplir selon la sélection
  const shouldFill = (entry: { type: string; trimester: string; isExam: boolean }): boolean => {
    if (selection === 'all') return true
    if (selection === '1er' && entry.trimester === '1er') return true
    if (selection === '2eme' && entry.trimester === '2eme') return true
    if (selection === '3eme' && entry.trimester === '3eme') return true
    if (selection === 'examen' && entry.isExam) return true
    if (selection === 'p1' && entry.type === '1ère période') return true
    if (selection === 'p2' && entry.type === '2ème période') return true
    if (selection === 'p3' && entry.type === '3ème période') return true
    if (selection === 'p4' && entry.type === '4ème période') return true
    if (selection === 'p5' && entry.type === '5ème période') return true
    if (selection === 'p6' && entry.type === '6ème période') return true
    return false
  }

  // Colonnes PTS OBT TRIM à calculer selon la sélection
  const trimColMap = [
    { trim: '1er', ptsCol: 8, periodCols: [3, 4], examCol: 6 },  // H = C + D + F
    { trim: '2eme', ptsCol: 14, periodCols: [9, 10], examCol: 12 }, // N = I + J + L
    { trim: '3eme', ptsCol: 20, periodCols: [15, 16], examCol: 18 }, // T = O + P + R
  ]
  const shouldCalcTrim = (trim: string): boolean => {
    if (selection === 'all') return true
    if (selection === '1er' && trim === '1er') return true
    if (selection === '2eme' && trim === '2eme') return true
    if (selection === '3eme' && trim === '3eme') return true
    if (selection.startsWith('p') || selection === 'examen') return false // Single period/exam → no trim calc
    return false
  }

  // Préparer le cache des matières DB pour le matching
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').replace(/[.'',]/g, '').trim()
  const allDbSubjects = await db.subject.findMany({
    where: { OR: [{ level: 'primaire' }, { level: null }] },
    select: { id: true, name: true, title: true, subtitle: true, maxTJ: true, maxEX: true, maxTRIM: true, maxAnnuel: true },
  })

  // Tracker les matières déjà utilisées (évite duplication)
  const usedSubjectIds = new Set<string>()
  // Tracker les noms de matières déjà vus (évite les doublons de VLOOKUP cachés)
  const seenCourseNames = new Set<string>()
  // Stocker les valeurs calculées (H, N, T, V) pour application différée
  const cellOverrides: { rowNum: number; col: number; value: number }[] = []
  // Stocker les sous-totaux pour recalcul après application différée
  const sousTotalsToRecalc: { rowNum: number; courseRows: number[] }[] = []
  // Stocker les cours isolés (sans Sous-Total) pour le calcul MAXIMA
  const isolatedCourseRows: number[] = []
  // Flag : la ligne précédente était un sous-titre LECT → le cours qui suit
  // est un cours ISOLÉ (pas de Sous-Total propre)
  let isAfterLECTSubTitle = false

  // Parcourir les lignes du BULLETIN à partir de row 11
  let currentDomain = ''
  let sousTotalStartRow = -1 // première ligne cours du sous-total en cours
  const courseRowsForSousTotal: number[] = [] // lignes cours depuis le dernier sous-total/domaine

  for (let rowNum = 11; rowNum <= bulletinWs.rowCount; rowNum++) {
    const row = bulletinWs.getRow(rowNum)
    const colA = row.getCell(1).value
    let colAStr = ''
    if (colA !== null && colA !== undefined) {
      if (typeof colA === 'object' && 'formula' in colA) {
        colAStr = String((colA as { result?: unknown }).result ?? '')
      } else if (typeof colA === 'object' && 'richText' in colA) {
        colAStr = (colA as { richText: { text: string }[] }).richText.map(rt => rt.text).join('')
      } else {
        colAStr = String(colA)
      }
    }
    colAStr = colAStr.trim()

    // Debug: log Row 20-22 pour diagnostiquer LECT
    if (rowNum >= 20 && rowNum <= 22) {
      console.log(`[BULLETIN_FILL] Row ${rowNum}: colAStr="${colAStr.substring(0, 40)}", isAfterLECT=${isAfterLECTSubTitle}`)
    }

    // NOTE : On NE skip PAS les lignes vides ici — la détection de
    // continuation ci-dessous peut récupérer le nom de la matière depuis
    // la row précédente. Le skip se fait après la détection de continuation.

    // Détecter "Sous-Total"
    if (colAStr.toLowerCase().includes('sous-total') || colAStr.toLowerCase().includes('sous total')) {
      // Stocker pour recalcul APRÈS l'application différée des H, N, T, V
      // (sinon on lirait les anciennes valeurs de H avant qu'elles soient mises à jour)
      if (courseRowsForSousTotal.length > 0) {
        sousTotalsToRecalc.push({ rowNum, courseRows: [...courseRowsForSousTotal] })
      }
      courseRowsForSousTotal.length = 0
      continue
    }

    // Détecter "MAXIMA" ou "TOTAL GENERAL"
    if (colAStr.toUpperCase().includes('MAXIMA') || colAStr.toUpperCase().includes('TOTAL')) {
      // Avant le MAXIMA, vérifier s'il reste des cours sans Sous-Total
      if (courseRowsForSousTotal.length > 0) {
        isolatedCourseRows.push(...courseRowsForSousTotal)
        console.log(`[BULLETIN_FILL] ${courseRowsForSousTotal.length} isolated courses before MAXIMA: rows ${courseRowsForSousTotal.join(',')}`)
      }
      courseRowsForSousTotal.length = 0
      continue
    }

    // Détecter les en-têtes de domaine (DOMAINE DES LANGUES, MATHEMATIQUES, etc.)
    // ⚠ IMPORTANT : Ne PAS clear courseRowsForSousTotal sur les sous-domaines
    // (MATHEMATIQUES, SCIENCES, TECHNOLOGIE, FRANCAIS, LANGUES CONGOLAISES)
    // car plusieurs sous-domaines peuvent partager un même Sous-Total.
    // On clear SEULEMENT sur "DOMAINE" (changement de domaine principal).
    // ⚠ CORRECTION TYPO : Le template contient "DOMIANE" (typo) au lieu de
    // "DOMAINE" pour la section "DEVELOPPEMENT PERSONNEL". On accepte les deux.
    const upperColA = colAStr.toUpperCase()
    if (upperColA.includes('DOMAINE') || upperColA.includes('DOMIANE')) {
      // Changement de domaine principal — avant de clear, vérifier s'il reste
      // des cours sans Sous-Total (cours isolés)
      if (courseRowsForSousTotal.length > 0) {
        isolatedCourseRows.push(...courseRowsForSousTotal)
        console.log(`[BULLETIN_FILL] ${courseRowsForSousTotal.length} isolated courses before DOMAINE: rows ${courseRowsForSousTotal.join(',')}`)
      }
      courseRowsForSousTotal.length = 0
      currentDomain = colAStr
      continue
    }
    // Sous-domaines (FRANCAIS, LANGUES CONGOLAISES, MATHEMATIQUES, etc.)
    // → on ne clear PAS, on continue juste
    // ⚠ IMPORTANT : Les sous-domaines sont en MAJUSCULES dans le template
    // (ex: "TECHNOLOGIE" à la row 30), tandis que les cours sont en casse
    // titre (ex: "Technologie" à la row 31). On ne skip QUE si le texte
    // original est en MAJUSCULES — sinon on traiterait "Technologie" (cours)
    // comme un sous-domaine, et il serait ignoré.
    const isAllCapsHeader = colAStr === colAStr.toUpperCase() && /[A-Z]/.test(colAStr) && colAStr.length > 3
    const isShortHeader = colAStr.length < 20
    if (isAllCapsHeader && (upperColA === 'FRANCAIS' || upperColA === 'FRANCAIS ' ||
         upperColA === 'LANGUES CONGOLAISES' ||
         upperColA === 'MATHEMATIQUES' ||
         upperColA === 'SCIENCES' ||
         upperColA === 'TECHNOLOGIE')) {
      currentDomain = colAStr
      continue
    }
    if ((upperColA.includes('ART') && isShortHeader && !upperColA.includes('DRAMATIQUE') && !upperColA.includes('PLASTIQUE') && !upperColA.includes('PHYS')) ||
        (upperColA.includes('DEVELOPPEMENT') && isShortHeader) ||
        (upperColA.includes('UNIVERS') && isShortHeader)) {
      currentDomain = colAStr
      continue
    }

    // ⚠ "LECT. - ECRITURE..." est un SOUS-TITRE (comme "FRANCAIS"), pas un
    // cours. Les données du cours sont sur la ligne EN-DESSOUS (Row 21).
    // Ce cours n'a pas de Sous-Total propre — il doit être traité comme
    // un cours ISOLÉ pour le calcul du MAXIMA GENERAUX.
    // ⚠ MAIS : si isAfterLECTSubTitle est déjà true, on NE re-détecte PAS
    // LECT — la ligne suivante contient les données du cours (même si col A
    // a le même nom via une formule VLOOKUP).
    if (!isAfterLECTSubTitle && upperColA.includes('LECT') && upperColA.includes('ECRIT') && upperColA.includes('CONGOLAISE')) {
      isAfterLECTSubTitle = true
      continue
    }

    // ⚠ Si col A est vide, vérifier si la ligne précédente était un sous-titre
    // (comme "LECT. - ECRITURE EN LANGUES CONGOLAISES"). Si oui, cette ligne
    // contient les données du cours — on utilise le nom de la ligne précédente.
    if (!colAStr) {
      // Si on était après un sous-titre LECT, utiliser directement "LECT..."
      // comme nom de matière (sans vérifier la row précédente)
      if (isAfterLECTSubTitle) {
        colAStr = 'LECT. - ECRITURE EN LANGUES CONGOLAISES'
      } else {
        const prevRow = bulletinWs.getRow(rowNum - 1)
        const prevColA = prevRow.getCell(1).value
        let prevName = ''
        if (prevColA !== null && prevColA !== undefined) {
          if (typeof prevColA === 'object' && 'result' in prevColA) prevName = String((prevColA as { result?: unknown }).result ?? '')
          else if (typeof prevColA === 'object' && 'richText' in prevColA) prevName = (prevColA as { richText: { text: string }[] }).richText.map(rt => rt.text).join('')
          else prevName = String(prevColA)
        }
        if (prevName.trim() && !prevName.toLowerCase().includes('sous-total') &&
            !prevName.toUpperCase().includes('DOMAINE') &&
            !prevName.toUpperCase().includes('MAXIMA') &&
            !prevName.toUpperCase().includes('TOTAUX') &&
            !prevName.toUpperCase().includes('POURC') &&
            !prevName.toUpperCase().includes('PLACE') &&
            prevName.length > 3) {
          colAStr = prevName.trim()
        } else {
          for (let c = 2; c <= 22; c++) { row.getCell(c).value = null }
          continue
        }
      }
    }

    // C'est une ligne de matière (course row)
    const normColA = normalize(colAStr)
    // ⚠ Skip si le nom de matière a déjà été traité (doublon — Row 21 peut
    // avoir le même nom que Row 20 à cause d'une formule VLOOKUP cachée)
    if (seenCourseNames.has(normColA)) {
      // ⚠ VIDER les colonnes B-V de cette ligne en doublon
      for (let c = 2; c <= 22; c++) {
        row.getCell(c).value = null
      }
      row.commit()
      continue
    }
    seenCourseNames.add(normColA)
    // Essayer de matcher avec une matière DB
    // Trouver la matière DB correspondante (non encore utilisée, avec notes)
    // ⚠ IMPORTANT : Préférer les matières avec maxTJ NON-NULL (sinon on tombe
    // sur des duplicates "Ed. phys. & sportive" avec maxTJ=null qui donnent
    // une valeur par défaut de 20 au lieu de la vraie valeur 10).
    let bestSubj = allDbSubjects.find(s => {
      const ns = normalize(s.name)
      return !usedSubjectIds.has(s.id) && ns === normColA && gradesBySubject.has(s.id) && s.maxTJ !== null && s.maxTJ !== undefined
    })
    if (!bestSubj) {
      // Second try : exact match mais sans exiger maxTJ non-null (fallback)
      bestSubj = allDbSubjects.find(s => {
        const ns = normalize(s.name)
        return !usedSubjectIds.has(s.id) && ns === normColA && gradesBySubject.has(s.id)
      })
    }
    if (!bestSubj) {
      // Fuzzy match : préfixe ou inclusion — préférer maxTJ non-null
      bestSubj = allDbSubjects.find(s => {
        const ns = normalize(s.name)
        return !usedSubjectIds.has(s.id) && ns.length > 3 && (normColA.includes(ns) || ns.includes(normColA)) && gradesBySubject.has(s.id) && s.maxTJ !== null && s.maxTJ !== undefined
      })
    }
    if (!bestSubj) {
      // Fuzzy match sans condition maxTJ
      bestSubj = allDbSubjects.find(s => {
        const ns = normalize(s.name)
        return !usedSubjectIds.has(s.id) && ns.length > 3 && (normColA.includes(ns) || ns.includes(normColA)) && gradesBySubject.has(s.id)
      })
    }
    if (!bestSubj) {
      // Dernier fallback : première matière avec notes non utilisée (préférer maxTJ non-null)
      bestSubj = allDbSubjects.find(s => !usedSubjectIds.has(s.id) && gradesBySubject.has(s.id) && s.maxTJ !== null && s.maxTJ !== undefined)
      if (!bestSubj) {
        bestSubj = allDbSubjects.find(s => !usedSubjectIds.has(s.id) && gradesBySubject.has(s.id))
      }
    }

    if (bestSubj) {
      usedSubjectIds.add(bestSubj.id)
      const subjGrades = gradesBySubject.get(bestSubj.id)
      const maxTJ = bestSubj.maxTJ || 20
      const maxEX = bestSubj.maxEX || 40
      const maxTRIM = bestSubj.maxTRIM || (maxTJ * 2 + maxEX)
      const maxAnnuel = bestSubj.maxAnnuel || (maxTRIM * 3)

      // Remplir les colonnes MAX selon la sélection
      // B (MAX per) = toujours (c'est le max par période)
      row.getCell(2).value = maxTJ
      // T1 MAX (E, G) — seulement si T1 est sélectionné
      if (selection === 'all' || selection === '1er' || selection.startsWith('p1') || selection.startsWith('p2') || (selection === 'examen' && true)) {
        row.getCell(5).value = maxEX    // E = MAX EX T1
        row.getCell(7).value = maxTRIM  // G = MAX TRIM T1
      } else {
        row.getCell(5).value = null
        row.getCell(7).value = null
      }
      // T2 MAX (K, M)
      if (selection === 'all' || selection === '2eme' || selection.startsWith('p3') || selection.startsWith('p4')) {
        row.getCell(11).value = maxEX   // K
        row.getCell(13).value = maxTRIM // M
      } else {
        row.getCell(11).value = null
        row.getCell(13).value = null
      }
      // T3 MAX (Q, S)
      if (selection === 'all' || selection === '3eme' || selection.startsWith('p5') || selection.startsWith('p6')) {
        row.getCell(17).value = maxEX   // Q
        row.getCell(19).value = maxTRIM // S
      } else {
        row.getCell(17).value = null
        row.getCell(19).value = null
      }
      // U (MAX ANNUEL) — seulement si all
      if (selection === 'all') {
        row.getCell(21).value = maxAnnuel
      } else {
        row.getCell(21).value = null
      }

      // Remplir les notes selon la sélection
      const trimValues: { [key: string]: number } = { '1er': 0, '2eme': 0, '3eme': 0 }
      for (const entry of gradeColMap) {
        const key = `${entry.trimester}|${entry.type}`.normalize('NFC').trim()
        if (shouldFill(entry)) {
          // Remplir la cellule sélectionnée
          const cellValues = subjGrades?.get(key)
          if (cellValues && cellValues.length > 0) {
            const val = cellValues[cellValues.length - 1]
            row.getCell(entry.col).value = val
            trimValues[entry.trimester] += val
          }
        } else {
          // ⚠ VIDER la cellule non-sélectionnée (sinon elle garde la
          // valeur du template original)
          row.getCell(entry.col).value = null
        }
      }

      // Calculer PTS OBT TRIM (H, N, T) selon la sélection
      // ⚠ IMPORTANT : On utilise trimValues (déjà calculé ci-dessus).
      // On stocke les valeurs dans cellOverrides pour les appliquer après
      // avoir nettoyé les sharedFormula (qui empêchent la modification
      // directe des cellules).
      let totalAnnuel = 0
      const ptsColMap: { [key: string]: number } = { '1er': 8, '2eme': 14, '3eme': 20 }
      for (const tc of trimColMap) {
        if (shouldCalcTrim(tc.trim)) {
          const trimSum = trimValues[tc.trim] || 0
          const col = ptsColMap[tc.trim]
          cellOverrides.push({ rowNum, col, value: trimSum })
          totalAnnuel += trimSum
        } else {
          // Vider le PTS OBT TRIM non-sélectionné
          row.getCell(ptsColMap[tc.trim]).value = null
        }
      }

      // Calculer PTS OBT ANNUEL (V)
      if (selection === 'all') {
        cellOverrides.push({ rowNum, col: 22, value: totalAnnuel })
      } else if (selection === '1er') {
        cellOverrides.push({ rowNum, col: 22, value: trimValues['1er'] })
      } else if (selection === '2eme') {
        cellOverrides.push({ rowNum, col: 22, value: trimValues['2eme'] })
      } else if (selection === '3eme') {
        cellOverrides.push({ rowNum, col: 22, value: trimValues['3eme'] })
      } else {
        // Sélection d'une seule période ou examen → vider V
        row.getCell(22).value = null
      }

      row.commit()
      // Si ce cours vient après un sous-titre LECT, c'est un cours isolé
      // (pas de Sous-Total propre) → ajouter à isolatedCourseRows
      if (isAfterLECTSubTitle) {
        isolatedCourseRows.push(rowNum)
        isAfterLECTSubTitle = false
        console.log(`[BULLETIN_FILL] LECT isolated course: row ${rowNum}`)
      } else {
        courseRowsForSousTotal.push(rowNum)
      }
      console.log(`[BULLETIN_FILL] Row ${rowNum}: "${colAStr}" → matched "${bestSubj.name}"`)
    } else {
      // Si on était après LECT mais que la matière n'est pas matchée,
      // on reset quand même le flag pour ne pas affecter la prochaine matière
      if (isAfterLECTSubTitle) {
        isAfterLECTSubTitle = false
      }
      console.log(`[BULLETIN_FILL] Row ${rowNum}: "${colAStr}" → NO MATCH`)
    }
  }

  // ⚠ CRITIQUE — Appliquer les valeurs différées (H, N, T, V) après avoir
  // nettoyé les sharedFormula. Les cellules avec sharedFormula résistent à
  // la modification directe — on doit d'abord remplacer TOUTES les formules
  // par leurs valeurs, PUIS écrire nos valeurs calculées.
  console.log(`[BULLETIN_FILL] Applying ${cellOverrides.length} deferred cell values...`)

  // 1. D'abord, remplacer toutes les formules par leurs valeurs cachées
  bulletinWs.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined && typeof cell.value === 'object') {
        const cv = cell.value as unknown as Record<string, unknown>
        if ('formula' in cv || 'sharedFormula' in cv) {
          const result = cv.result
          cell.value = (result === null || result === undefined ? '' : result) as string | number | boolean | null
        }
      }
    })
  })

  // 2. PUIS écrire nos valeurs calculées (maintenant que les sharedFormula
  //    sont nettoyées, les cellules acceptent les nouvelles valeurs)
  for (const override of cellOverrides) {
    const row = bulletinWs.getRow(override.rowNum)
    row.getCell(override.col).value = override.value
  }
  console.log('[BULLETIN_FILL] Deferred values applied')

  // 3. PUIS recalculer les sous-totaux (maintenant que les H, N, T, V des
  //    lignes cours ont leurs valeurs finales)
  // ⚠ IMPORTANT : Si aucune ligne cours n'a de valeur NUMÉRIQUE pour une
  //    colonne, on VIDE la cellule sous-total (null) — pas 0.
  for (const st of sousTotalsToRecalc) {
    const row = bulletinWs.getRow(st.rowNum)
    for (let col = 2; col <= 22; col++) {
      let sum = 0
      let hasValue = false // true si au moins une cellule a une valeur numérique
      for (const courseRowNum of st.courseRows) {
        const cell = bulletinWs.getRow(courseRowNum).getCell(col)
        const cellVal = cell.value
        let numVal = 0
        if (typeof cellVal === 'number') {
          numVal = cellVal
          hasValue = true // Une vraie valeur numérique
        } else if (typeof cellVal === 'string') {
          numVal = parseFloat(cellVal) || 0
          if (numVal !== 0) hasValue = true
        } else if (cellVal !== null && cellVal !== undefined && typeof cellVal === 'object') {
          if ('result' in cellVal) {
            numVal = Number((cellVal as { result?: unknown }).result) || 0
            if (numVal !== 0) hasValue = true
          }
        }
        sum += numVal
      }
      // Si au moins une valeur numérique → écrire la somme
      // Sinon → null (cellule vide, pas 0)
      row.getCell(col).value = hasValue ? sum : null
    }
    row.commit()
    console.log(`[BULLETIN_FILL] Sous-Total row ${st.rowNum}: recalculated with ${st.courseRows.length} course rows`)
  }

  // ⚠ CRITIQUE — Recalculer la ligne MAXIMA GENERAUX.
  //   Cette ligne doit être la SOMME de toutes les lignes Sous-Total + les
  //   cours qui n'ont pas de Sous-Total (comme LECT-ECRITURE).
  //   On parcourt TOUTES les lignes entre 11 et MAXIMA, et on somme les
  //   Sous-Total + les cours isolés.
  let maximaRowNum = -1
  let totauxRowNum = -1
  for (let r = 11; r <= bulletinWs.rowCount; r++) {
    const aVal = bulletinWs.getRow(r).getCell(1).value
    let aStr = ''
    if (aVal !== null && aVal !== undefined) {
      if (typeof aVal === 'object' && 'result' in aVal) aStr = String((aVal as { result?: unknown }).result ?? '')
      else aStr = String(aVal)
    }
    if (aStr.toUpperCase().includes('MAXIMA') && (aStr.toUpperCase().includes('GENERAL') || aStr.toUpperCase().includes('GENERAUX'))) maximaRowNum = r
    if (aStr.toUpperCase() === 'TOTAUX' || (aStr.toUpperCase().includes('TOTAUX') && !aStr.toUpperCase().includes('MAXIMA'))) totauxRowNum = r
  }

  if (maximaRowNum > 0) {
    // ⚠ CRITIQUE — MAXIMA GENERAUX = somme des MAX (pas des notes réelles).
    //
    // Pour chaque cours, on a 4 types de MAX :
    //   maxTJ    → max par période (1èP, 2èP, 3èP, 4èP, 5èP, 6èP)
    //   maxEX    → max par examen (EX T1, EX T2, EX T3)
    //   maxTRIM  → max par trimestre (PTS OBT TRIM T1, T2, T3)
    //   maxAnnuel→ max annuel (PTS OBT ANNUEL)
    //
    // Donc MAXIMA GENERAUX doit avoir :
    //   - Col B (MAX per), C/D (périodes T1), I/J (périodes T2), O/P (périodes T3)
    //     → tous égaux à SOMME des maxTJ de tous les cours
    //   - Col E (MAX EX T1), F (Examen T1), K/L (T2), Q/R (T3)
    //     → tous égaux à SOMME des maxEX
    //   - Col G (MAX TRIM T1), H (PTS TRIM T1), M/N (T2), S/T (T3)
    //     → tous égaux à SOMME des maxTRIM
    //   - Col U (MAX ANNUEL), V (PTS ANNUEL)
    //     → tous égaux à SOMME des maxAnnuel
    //
    // On calcule ces 4 sommes DEPUIS LA DB (usedSubjectIds), ce qui est
    // indépendant de la sélection de période — le MAXIMA est toujours
    // le maximum possible, quelle que soit la période affichée.

    let totalMaxTJ = 0
    let totalMaxEX = 0
    let totalMaxTRIM = 0
    let totalMaxAnnuel = 0
    let hasAnyMatchedSubject = false

    for (const subj of allDbSubjects) {
      if (!usedSubjectIds.has(subj.id)) continue
      hasAnyMatchedSubject = true
      const maxTJ = subj.maxTJ || 20
      const maxEX = subj.maxEX || 40
      const maxTRIM = subj.maxTRIM || (maxTJ * 2 + maxEX)
      const maxAnnuel = subj.maxAnnuel || (maxTRIM * 3)
      totalMaxTJ += maxTJ
      totalMaxEX += maxEX
      totalMaxTRIM += maxTRIM
      totalMaxAnnuel += maxAnnuel
    }
    console.log(`[BULLETIN_FILL] MAXIMA from DB: maxTJ=${totalMaxTJ}, maxEX=${totalMaxEX}, maxTRIM=${totalMaxTRIM}, maxAnnuel=${totalMaxAnnuel}`)

    // Si aucun sujet matché, fallback : sommer depuis les sous-totaux + isolés
    if (!hasAnyMatchedSubject) {
      const rowsToSum = [...sousTotalsToRecalc.map(st => st.rowNum), ...isolatedCourseRows]
      for (const rowNum of rowsToSum) {
        const getNum = (col: number): number => {
          const v = bulletinWs.getRow(rowNum).getCell(col).value
          if (typeof v === 'number') return v
          if (typeof v === 'string') return parseFloat(v) || 0
          if (v && typeof v === 'object' && 'result' in v) return Number((v as { result?: unknown }).result) || 0
          return 0
        }
        totalMaxTJ += getNum(2)   // B
        totalMaxEX += getNum(5)   // E
        totalMaxTRIM += getNum(7) // G
        totalMaxAnnuel += getNum(21) // U
      }
      console.log(`[BULLETIN_FILL] MAXIMA fallback from ${rowsToSum.length} rows: maxTJ=${totalMaxTJ}, maxEX=${totalMaxEX}, maxTRIM=${totalMaxTRIM}, maxAnnuel=${totalMaxAnnuel}`)
    }

    const maximaRow = bulletinWs.getRow(maximaRowNum)

    // Map : chaque colonne → quelle somme MAX utiliser
    // Périodes (max = maxTJ) : B, C, D, I, J, O, P
    // Examens (max = maxEX)  : E, F, K, L, Q, R
    // Trimestres (max = maxTRIM): G, H, M, N, S, T
    // Annuel (max = maxAnnuel): U, V
    const colToMax: { [col: number]: number } = {
      2: totalMaxTJ, 3: totalMaxTJ, 4: totalMaxTJ, 9: totalMaxTJ, 10: totalMaxTJ, 15: totalMaxTJ, 16: totalMaxTJ,
      5: totalMaxEX, 6: totalMaxEX, 11: totalMaxEX, 12: totalMaxEX, 17: totalMaxEX, 18: totalMaxEX,
      7: totalMaxTRIM, 8: totalMaxTRIM, 13: totalMaxTRIM, 14: totalMaxTRIM, 19: totalMaxTRIM, 20: totalMaxTRIM,
      21: totalMaxAnnuel, 22: totalMaxAnnuel,
    }

    for (const colStr of Object.keys(colToMax)) {
      const col = Number(colStr)
      const val = colToMax[col]
      const cell = maximaRow.getCell(col)
      cell.value = val > 0 ? val : null
      // ⚠ Réduire la police pour MAXIMA (les valeurs sont grandes)
      cell.font = { size: 7, bold: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    maximaRow.commit()
    console.log(`[BULLETIN_FILL] MAXIMA GENERAUX row ${maximaRowNum}: maxTJ=${totalMaxTJ} → B,C,D,I,J,O,P; maxEX=${totalMaxEX} → E,F,K,L,Q,R; maxTRIM=${totalMaxTRIM} → G,H,M,N,S,T; maxAnnuel=${totalMaxAnnuel} → U,V`)

    // ⚠ TOTAUX = somme des NOTES RÉELLES (pas des MAX).
    // Pour chaque colonne de notes (C, D, F, H, I, J, L, N, O, P, R, T, V),
    // on somme les valeurs des lignes cours.
    // Les colonnes MAX (B, E, G, K, M, Q, S, U) restent vides pour TOTAUX.
    if (totauxRowNum > 0 && totauxRowNum !== maximaRowNum) {
      const totauxRow = bulletinWs.getRow(totauxRowNum)
      
      // Collecter toutes les lignes cours (depuis sous-totaux + isolés)
      const allCourseRows = new Set<number>()
      for (const st of sousTotalsToRecalc) {
        for (const cr of st.courseRows) allCourseRows.add(cr)
      }
      for (const ir of isolatedCourseRows) allCourseRows.add(ir)
      
      // Colonnes de notes à sommer
      const gradeColsToSum = [3, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22]
      
      for (const col of gradeColsToSum) {
        let sum = 0
        let hasValue = false
        for (const rowNum of allCourseRows) {
          const cellVal = bulletinWs.getRow(rowNum).getCell(col).value
          let numVal = 0
          if (typeof cellVal === 'number') { numVal = cellVal; hasValue = true }
          else if (typeof cellVal === 'string') { numVal = parseFloat(cellVal) || 0; if (numVal !== 0) hasValue = true }
          else if (cellVal !== null && cellVal !== undefined && typeof cellVal === 'object' && 'result' in cellVal) {
            numVal = Number((cellVal as { result?: unknown }).result) || 0; if (numVal !== 0) hasValue = true
          }
          sum += numVal
        }
        const tCell = totauxRow.getCell(col)
        tCell.value = hasValue ? sum : null
        // ⚠ Réduire la police pour TOTAUX (les valeurs sont grandes)
        tCell.font = { size: 7, bold: true }
        tCell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
      
      // Vider les colonnes MAX (B, E, G, K, M, Q, S, U) pour TOTAUX
      // (TOTAUX ne contient que les notes réelles, pas les MAX)
      for (const col of [2, 5, 7, 11, 13, 17, 19, 21]) {
        totauxRow.getCell(col).value = null
      }
      
      totauxRow.commit()
      console.log(`[BULLETIN_FILL] TOTAUX row ${totauxRowNum}: summed actual grades from ${allCourseRows.size} course rows`)
    }
  }
  try {
    // ⚠ IMPORTANT : Le rang et le pourcentage sont calculés sur la PÉRIODE
    // SÉLECTIONNÉE, pas sur toutes les notes.
    const gradeFilter: { trimester?: string; type?: string } = {}
    if (selection === '1er') gradeFilter.trimester = '1er'
    else if (selection === '2eme') gradeFilter.trimester = '2eme'
    else if (selection === '3eme') gradeFilter.trimester = '3eme'
    else if (selection === 'p1') { gradeFilter.trimester = '1er'; gradeFilter.type = '1ère période' }
    else if (selection === 'p2') { gradeFilter.trimester = '1er'; gradeFilter.type = '2ème période' }
    else if (selection === 'p3') { gradeFilter.trimester = '2eme'; gradeFilter.type = '3ème période' }
    else if (selection === 'p4') { gradeFilter.trimester = '2eme'; gradeFilter.type = '4ème période' }
    else if (selection === 'p5') { gradeFilter.trimester = '3eme'; gradeFilter.type = '5ème période' }
    else if (selection === 'p6') { gradeFilter.trimester = '3eme'; gradeFilter.type = '6ème période' }
    else if (selection === 'examen') { gradeFilter.type = 'examen' }

    const classmates = await db.student.findMany({
      where: { classId: student.class?.id || '' },
      select: { id: true },
    })

    const totals: { studentId: string; total: number }[] = []
    for (const cm of classmates) {
      const where: Record<string, unknown> = { studentId: cm.id, schoolYear }
      if (gradeFilter.trimester) where.trimester = gradeFilter.trimester
      if (gradeFilter.type) where.type = gradeFilter.type
      const cmGrades = await db.grade.findMany({ where, select: { value: true } })
      const total = cmGrades.reduce((sum, g) => sum + g.value, 0)
      totals.push({ studentId: cm.id, total })
    }
    totals.sort((a, b) => b.total - a.total)
    const studentTotal = totals.find(t => t.studentId === student.id)?.total || 0
    const rank = totals.findIndex(t => t.studentId === student.id) + 1

    // Pourcentage = total élève / max possible pour la période sélectionnée
    const maxWhere: Record<string, unknown> = { studentId: student.id, schoolYear }
    if (gradeFilter.trimester) maxWhere.trimester = gradeFilter.trimester
    if (gradeFilter.type) maxWhere.type = gradeFilter.type
    const maxGrades = await db.grade.findMany({ where: maxWhere, select: { maxValue: true } })
    const maxTotal = maxGrades.reduce((sum, g) => sum + g.maxValue, 0)
    const pourcentage = maxTotal > 0 ? Math.round((studentTotal / maxTotal) * 1000) / 10 : 0

    console.log(`[BULLETIN_FILL] Rank: ${rank}/${totals.length} | total: ${studentTotal}/${maxTotal} | ${pourcentage}% | sel: ${selection}`)

    // Trouver et remplir RANG et POURCENTAGE dans le BULLETIN
    // ⚠ IMPORTANT : Le rang et le pourcentage vont dans les colonnes de NOTES
    // (C, D, F, H, I, J, L, N, O, P, R, T, V) — PAS dans la colonne B (MAX per).
    // La colonne B reste vide pour les lignes POURCETAGE et PLACE.
    // ⚠ Pour TOUTES les sélections (all, 1er, 2eme, p1, etc.), on calcule
    // le rang/pourcentage pour chaque colonne via fillRankPerColumn /
    // fillPourcentagePerColumn, puis on vide les colonnes non-sélectionnées.
    for (let rowNum = 1; rowNum <= bulletinWs.rowCount; rowNum++) {
      const prow = bulletinWs.getRow(rowNum)
      for (let colNum = 1; colNum <= 25; colNum++) {
        const cell = prow.getCell(colNum)
        const val = cell.value
        let valStr = ''
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && 'result' in val) valStr = String((val as { result?: unknown }).result ?? '')
          else valStr = String(val)
        }
        if (valStr.toUpperCase().includes('RANG') || valStr.toUpperCase().includes('PLACE') || valStr.toUpperCase().includes('RANK')) {
          // ⚠ NE PAS mettre le rang dans la colonne B (MAX per).
          // La colonne B doit rester vide pour PLACE.
          prow.getCell(colNum + 1).value = null  // Vider B
          
          // Calculer le rang pour chaque colonne de notes (C-V)
          // fillRankPerColumn remplit C(3) à V(22) en sautant B
          await fillRankPerColumn(bulletinWs, rowNum, colNum + 1, student, classmates, schoolYear, db, gradeColMap)
          
          // Vider les colonnes non-sélectionnées
          for (const entry of gradeColMap) {
            if (!shouldFill(entry)) {
              prow.getCell(entry.col).value = null
            }
          }
          // Vider les colonnes TRIM non-calculées
          for (const tc of trimColMap) {
            if (!shouldCalcTrim(tc.trim)) {
              prow.getCell(tc.ptsCol).value = null
            }
          }
          // Vider V (annuel) si pas all
          if (selection !== 'all') {
            prow.getCell(22).value = null
          }
          // Vider les colonnes MAX (B déjà vidé, E, G, K, M, Q, S, U)
          for (const c of [5, 7, 11, 13, 17, 19, 21]) {
            prow.getCell(c).value = null
          }
          console.log(`[BULLETIN_FILL] Rang at row ${rowNum}: filled per-column (B empty)`)
        }
        if (valStr.toUpperCase().includes('POURC') || valStr === '%') {
          // ⚠ NE PAS mettre le pourcentage dans la colonne B (MAX per).
          prow.getCell(colNum + 1).value = null  // Vider B
          
          // Calculer le pourcentage pour chaque colonne de notes (C-V)
          await fillPourcentagePerColumn(bulletinWs, rowNum, colNum + 1, student, schoolYear, db)
          
          // Vider les colonnes non-sélectionnées
          for (const entry of gradeColMap) {
            if (!shouldFill(entry)) {
              prow.getCell(entry.col).value = null
            }
          }
          // Vider les colonnes TRIM non-calculées
          for (const tc of trimColMap) {
            if (!shouldCalcTrim(tc.trim)) {
              prow.getCell(tc.ptsCol).value = null
            }
          }
          // Vider V (annuel) si pas all
          if (selection !== 'all') {
            prow.getCell(22).value = null
          }
          // Vider les colonnes MAX (B déjà vidé, E, G, K, M, Q, S, U)
          for (const c of [5, 7, 11, 13, 17, 19, 21]) {
            prow.getCell(c).value = null
          }
          console.log(`[BULLETIN_FILL] Pourcentage at row ${rowNum}: filled per-column (B empty)`)
        }
      }
    }
  } catch (rankErr) {
    console.warn('[BULLETIN_FILL] Rank calculation failed:', rankErr instanceof Error ? rankErr.message : rankErr)
  }

  // Remplacer TOUTES les formules restantes par leurs valeurs (déjà fait
  // dans l'étape 12e2, mais on le refait ici pour être sûr)
  bulletinWs.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined && typeof cell.value === 'object') {
        const cv = cell.value as unknown as Record<string, unknown>
        if ('formula' in cv || 'sharedFormula' in cv) {
          const result = cv.result
          cell.value = (result === null || result === undefined ? '' : result) as string | number | boolean | null
        }
      }
    })
  })

  // ⚠ CRITIQUE — Nettoyage final : vider TOUTES les colonnes non-sélectionnées
  // dans TOUTES les lignes du BULLETIN (pas seulement les lignes cours).
  // Sans cette étape, les lignes MAXIMA GENERAUX, POURCETAGE, PLACE,
  // les lignes sans nom (Row 21), et les matières non-matchées gardent
  // les anciennes valeurs du template pour les périodes non-sélectionnées.
  //
  // Colonnes à vider selon la sélection :
  //   C(3)=1èP, D(4)=2èP, F(6)=EX T1, H(8)=TRIM T1
  //   I(9)=3èP, J(10)=4èP, L(12)=EX T2, N(14)=TRIM T2
  //   O(15)=5èP, P(16)=6èP, R(18)=EX T3, T(20)=TRIM T3
  //   V(22)=ANNUEL
  // Et les MAX: E(5)=MAX EX T1, G(7)=MAX TRIM T1, K(11), M(13), Q(17), S(19), U(21)
  const colsToClear = new Set<number>()
  for (const entry of gradeColMap) {
    if (!shouldFill(entry)) {
      colsToClear.add(entry.col) // Vider la colonne grade
    }
  }
  // Vider les colonnes TRIM non-calculées
  for (const tc of trimColMap) {
    if (!shouldCalcTrim(tc.trim)) {
      colsToClear.add(tc.ptsCol) // H, N, ou T
    }
  }
  // Vider les colonnes MAX pour les trimestres non-sélectionnés
  if (!(selection === 'all' || selection === '1er' || selection.startsWith('p1') || selection.startsWith('p2') || selection === 'examen')) {
    colsToClear.add(5); colsToClear.add(7) // E, G (T1 MAX)
  }
  if (!(selection === 'all' || selection === '2eme' || selection.startsWith('p3') || selection.startsWith('p4'))) {
    colsToClear.add(11); colsToClear.add(13) // K, M (T2 MAX)
  }
  if (!(selection === 'all' || selection === '3eme' || selection.startsWith('p5') || selection.startsWith('p6'))) {
    colsToClear.add(17); colsToClear.add(19) // Q, S (T3 MAX)
  }
  // Vider U (MAX ANNUEL) si pas all
  if (selection !== 'all') {
    colsToClear.add(21)
  }
  // Vider V (PTS ANNUEL) si pas all/trimester
  if (selection !== 'all' && selection !== '1er' && selection !== '2eme' && selection !== '3eme') {
    colsToClear.add(22)
  }

  // Track les cellules déjà définies par cellOverrides (ne pas les vider)
  const overrideKeys = new Set(cellOverrides.map(o => `${o.rowNum}_${o.col}`))

  console.log(`[BULLETIN_FILL] Final cleanup: clearing ${colsToClear.size} columns in all rows`)
  bulletinWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
    if (rowNum < 11) return // Skip headers (rows 1-10)
    for (const col of colsToClear) {
      // Ne pas vider les cellules qui ont été explicitement définies
      if (overrideKeys.has(`${rowNum}_${col}`)) continue
      const cell = row.getCell(col)
      if (cell.value !== null && cell.value !== undefined) {
        cell.value = null
      }
    }
  })

  console.log('[BULLETIN_FILL] Done')
}

/**
 * Rend un bulletin rempli pour un élève à partir du template Excel
 * de sa promotion. Retourne le buffer xlsx modifié + métadonnées.
 */
export async function renderBulletinFromTemplate(params: {
  studentId: string
  classId?: string
  schoolYear: string
  selection?: string // 'all' | '1er' | '2eme' | '3eme' | 'p1'..'p6' | 'examen'
}): Promise<RenderResult | RenderError> {
  const { studentId, schoolYear } = params
  const selection = params.selection || 'all'
  console.log('[BULLETIN_RENDER] starting for student', studentId, '| year', schoolYear, '| selection:', selection)

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
  // ⚠ IMPORTANT : On normalise les clés en NFC (composed Unicode form) pour
  // éviter les problèmes de matching entre '3ème période' (composed) et
  // '3ème période' (decomposed). Sans cette normalisation, les notes de
  // T2 et T3 peuvent ne pas être trouvées si la DB stocke les types avec
  // une forme Unicode différente du cellTypeMap.
  const gradesBySubject = new Map<string, Map<string, number[]>>()
  for (const g of grades) {
    if (!gradesBySubject.has(g.subjectId)) gradesBySubject.set(g.subjectId, new Map())
    const key = `${g.trimester}|${g.type}`.normalize('NFC').trim()
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
    { trimester: '2eme', type: '3ème période' },
    { trimester: '2eme', type: '4ème période' },
    { trimester: '2eme', type: 'examen' },
    { trimester: '3eme', type: '5ème période' },
    { trimester: '3eme', type: '6ème période' },
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
  // ⚠ IMPORTANT : On suit les matières déjà utilisées pour éviter que
  // deux colonnes "Exp. Orale" (une pour Français, une pour Langues
  // congolaises) ne pointent vers la MÊME matière DB. Chaque colonne
  // doit utiliser une matière DIFFÉRENTE.
  let gradesInserted = 0
  const usedSubjectIds = new Set<string>() // Track les matières déjà assignées
  for (const { column, dbSubjects } of matchedSubjects) {
    if (dbSubjects.length === 0) continue

    // ⚠ Trouver la première matière NON ENCORE UTILISÉE qui A DES NOTES.
    // On ne prend pas juste la première non-utilisée — on veut celle qui
    // a des grades pour cet élève, sinon la colonne sera vide.
    let bestDbSub = dbSubjects.find(s =>
      !usedSubjectIds.has(s.id) && gradesBySubject.has(s.id)
    )
    // Si aucune non-utilisée avec notes, fallback : première avec notes
    if (!bestDbSub) {
      bestDbSub = dbSubjects.find(s => gradesBySubject.has(s.id)) || dbSubjects[0]
    }
    // Marquer cette matière comme utilisée
    usedSubjectIds.add(bestDbSub.id)

    for (let i = 0; i < 9; i++) {
      const { trimester, type } = cellTypeMap[i]
      const key = `${trimester}|${type}`.normalize('NFC').trim()
      // ⚠ IMPORTANT : On utilise UNIQUEMENT la matière choisie (bestDbSub).
      let cellValue: number | null = null
      const subjGrades = gradesBySubject.get(bestDbSub.id)
      if (subjGrades) {
        const cellValues = subjGrades.get(key)
        if (cellValues && cellValues.length > 0) {
          cellValue = cellValues[cellValues.length - 1]
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

  // ⚠ NOUVEAU — Insérer ville, commune, N° élève, N° PERM dans LISTE
  // LISTE headers: F=N° PERM, G=PROVINCE, H=VILLE, I=COMMUNE, J=ECOLE, K=CODE
  // On utilise K (CODE) pour le N° élève (9 chiffres) et F pour N° PERM (13 chiffres)
  const studentAny = student as unknown as Record<string, unknown>
  studentRowData.getCell(6).value = (studentAny.numeroPerm as string) || ''  // F = N° PERM
  studentRowData.getCell(8).value = (studentAny.ville as string) || ''       // H = VILLE
  studentRowData.getCell(9).value = (studentAny.commune as string) || ''     // I = COMMUNE
  studentRowData.getCell(11).value = (studentAny.numeroEleve as string) || '' // K = CODE (N° élève)

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
    // ⚠ Nom de l'élève en MAJUSCULES
    const studentName = `${student.lastName || ''} ${student.firstName || ''}`.trim().toUpperCase()
    // I3 = colonne I (9ème colonne, 1-based), row 3
    const i3Cell = bulletinWsExceljs.getCell('I3')
    i3Cell.value = studentName
    console.log('[BULLETIN_RENDER] BULLETIN!I3 mis à jour avec le nom élève (MAJ):', studentName)

    // ⚠ Insérer l'année scolaire automatiquement dans le titre (row 7)
    // Le template contient "ANNEE SCOLAIRE 20….. - 20….." → remplacer par l'année réelle
    const r7cell = bulletinWsExceljs.getRow(7).getCell(1)
    let r7val: string
    if (r7cell.value) {
      if (typeof r7cell.value === 'object' && 'result' in r7cell.value) {
        r7val = String((r7cell.value as { result?: unknown }).result ?? '')
      } else if (typeof r7cell.value === 'string') {
        r7val = r7cell.value
      } else {
        r7val = String(r7cell.value)
      }
    } else {
      r7val = ''
    }
    // Remplacer "20….. - 20….." ou "20..... - 20....." par l'année scolaire
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const schoolYearStr = `${currentYear} - ${nextYear}`
    const updatedR7 = r7val.replace(/20[….]+\s*-\s*20[….]+/g, schoolYearStr)
      .replace(/20\.{2,}\s*-\s*20\.{2,}/g, schoolYearStr)
      .replace(/ANNEE SCOLAIRE\s*20[^\d]*-\s*20[^\d]*/g, `ANNEE SCOLAIRE ${schoolYearStr}`)
    if (updatedR7 !== r7val) {
      bulletinWsExceljs.getRow(7).getCell(1).value = updatedR7
      console.log('[BULLETIN_RENDER] Année scolaire insérée:', schoolYearStr)
    }

    // ⚠ NOUVEAU — Écrire directement ville, commune, N° élève, N° PERM
    // dans l'en-tête du BULLETIN (rows 3-6) AVEC LES ÉTIQUETTES.
    // On préserve le formatage du template (font, fill, border) et on
    // ajuste l'alignment pour que le texte avec étiquette tienne dans la cellule.
    const sAny = student as unknown as Record<string, unknown>
    const ville = (sAny.ville as string) || ''
    const commune = (sAny.commune as string) || ''
    const numeroEleve = (sAny.numeroEleve as string) || ''
    const numeroPerm = (sAny.numeroPerm as string) || ''

    // Helper : écrire une valeur avec étiquette en préservant le format du template
    const writeWithLabel = (rowNum: number, col: number, label: string, value: string) => {
      if (!value) return
      const cell = bulletinWsExceljs.getRow(rowNum).getCell(col)
      // Préserver le font existant (size, bold, color) du template
      const existingFont = cell.font
      cell.value = `${label} ${value}`
      // Ajuster l'alignment : réduire l'indent pour que le texte avec étiquette tienne
      cell.alignment = {
        horizontal: 'left',
        vertical: 'middle',
        indent: 1,  // indent réduit (le template utilise 13, trop grand avec étiquette)
        wrapText: false,
      }
      // Préserver le font du template
      if (existingFont) {
        cell.font = existingFont
      }
    }

    // Helper : écrire avec étiquette en alignment center (pour col I)
    const writeWithLabelCenter = (rowNum: number, col: number, label: string, value: string) => {
      if (!value) return
      const cell = bulletinWsExceljs.getRow(rowNum).getCell(col)
      const existingFont = cell.font
      cell.value = `${label} ${value}`
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: false,
      }
      if (existingFont) {
        cell.font = existingFont
      }
    }

    // Col A (rows 3-5) — étiquettes gauche
    writeWithLabel(3, 1, 'Ville :', ville)
    writeWithLabel(4, 1, 'Commune :', commune)
    // Row 5 col A = École (garde la valeur du template, ajoute étiquette si pas déjà présente)
    const ecoleVal = bulletinWsExceljs.getRow(5).getCell(1).value
    let ecoleStr = ''
    if (ecoleVal) {
      if (typeof ecoleVal === 'object' && 'result' in ecoleVal) ecoleStr = String((ecoleVal as { result?: unknown }).result ?? '')
      else if (typeof ecoleVal === 'string') ecoleStr = ecoleVal
      else ecoleStr = String(ecoleVal)
    }
    if (ecoleStr && !ecoleStr.toLowerCase().startsWith('école') && !ecoleStr.toLowerCase().startsWith('ecole')) {
      writeWithLabel(5, 1, 'École :', ecoleStr)
    }

    // ⚠ N° élève subdivisé en 9 cases individuelles (row 6, cols A-I)
    // Chaque cellule contient UN chiffre, avec bordure = case
    if (numeroEleve) {
      // Unmerge A6:H6 pour libérer les cellules individuelles
      bulletinWsExceljs.unMergeCells('A6:H6')
      // Écrire "N° élève" comme étiquette dans A5 (row 5, à côté de l'école)
      // Non — on met l'étiquette directement en A6 avec petit texte, puis les 9 chiffres
      // A6 = étiquette "N° élève", B6-I6 = ... non, seulement 8 colonnes (B à I)
      // Solution: A6-I6 = 9 cellules (colonnes 1 à 9), chaque cellule = 1 chiffre
      // Pas d'étiquette séparée — l'étiquette est dans la cellule A6 avec le 1er chiffre
      
      // Vider d'abord toutes les cellules A6-I6
      for (let c = 1; c <= 9; c++) {
        bulletinWsExceljs.getRow(6).getCell(c).value = null
      }
      
      // Écrire chaque chiffre du N° élève dans une cellule séparée
      const paddedEleve = numeroEleve.padStart(9, '0').slice(0, 9)
      for (let i = 0; i < 9; i++) {
        const cell = bulletinWsExceljs.getRow(6).getCell(i + 1)  // cols 1-9 (A-I)
        cell.value = paddedEleve[i]
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        // Bordure pour créer l'effet "case"
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        }
        const existingFont = cell.font || {}
        cell.font = { ...existingFont, size: 9, bold: true }
      }
      console.log('[BULLETIN_RENDER] N° élève subdivisé en 9 cases:', paddedEleve)
    }

    // Col I (rows 3-5) — étiquettes droite
    writeWithLabelCenter(3, 9, 'Nom :', studentName)
    // Row 4 col I = Date de naissance
    let dobStr = ''
    if (student.dateOfBirth) {
      try {
        const dob = new Date(student.dateOfBirth)
        if (!isNaN(dob.getTime())) {
          dobStr = dob.toLocaleDateString('fr-FR')
        } else {
          dobStr = String(student.dateOfBirth)
        }
      } catch {
        dobStr = String(student.dateOfBirth)
      }
    }
    if (dobStr) {
      writeWithLabel(4, 9, 'Date de naissance :', dobStr)
    }
    // Row 5 col I = Classe
    const className = student.class?.name || ''
    if (className) {
      writeWithLabel(5, 9, 'Classe :', className)
    }

    // ⚠ N° PERM subdivisé en 13 cases individuelles (row 6, cols J-V)
    // En dessous de Classe (row 5 col I), sur la même row 6 à droite
    if (numeroPerm) {
      // Unmerge I6:V6 pour libérer les cellules individuelles
      bulletinWsExceljs.unMergeCells('I6:V6')
      
      // Vider d'abord toutes les cellules I6-V6
      for (let c = 9; c <= 22; c++) {
        bulletinWsExceljs.getRow(6).getCell(c).value = null
      }
      
      // Écrire chaque chiffre du N° PERM dans une cellule séparée
      // 13 chiffres → colonnes J(10) à V(22) = 13 colonnes
      const paddedPerm = numeroPerm.padStart(13, '0').slice(0, 13)
      for (let i = 0; i < 13; i++) {
        const col = 10 + i  // J=10 à V=22
        const cell = bulletinWsExceljs.getRow(6).getCell(col)
        cell.value = paddedPerm[i]
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        }
        const existingFont = cell.font || {}
        cell.font = { ...existingFont, size: 9, bold: true }
      }
      console.log('[BULLETIN_RENDER] N° PERM subdivisé en 13 cases:', paddedPerm)
    }

    // ⚠ Configurer la mise en page pour impression Excel
    // Le bulletin doit REMPLIR toute la page A4 portrait sans être coupé.
    // 
    // Le template original a ~50 lignes. A4 portrait = ~813 points imprimables
    // (avec marges 0.2"). On calcule la hauteur exacte pour remplir la page.
    //
    // Hauteur totale disponible: ~813 points
    // Header rows 1-10: ~235 points (row 1 = 64.5, autres = ~15-22)
    // Data rows 11-46: 36 rows
    // Footer rows 47-50: 4 rows
    // Total data+footer rows: 40
    // Available: 813 - 235 = 578 points pour 40 rows = ~14.5 par row
    //
    // Pour REMPLIR la page, on augmente légèrement et laisse fitToHeight=1
    // faire l'ajustement exact.

    // 1. Hauteur des lignes de données (rows 11-46) — 16 pour remplir
    for (let r = 11; r <= 46; r++) {
      bulletinWsExceljs.getRow(r).height = 16
    }
    // Footer rows (47-50) — plus hautes pour combler l'espace restant
    for (let r = 47; r <= 49; r++) {
      bulletinWsExceljs.getRow(r).height = 25
    }
    // Row 50 (footer text) — grande hauteur pour le texte long
    bulletinWsExceljs.getRow(50).height = 50
    
    // 2. Augmenter la taille de police pour les données (rows 11-46)
    for (let r = 11; r <= 46; r++) {
      const row = bulletinWsExceljs.getRow(r)
      for (let c = 1; c <= 22; c++) {
        const cell = row.getCell(c)
        if (cell.value !== null && cell.value !== undefined) {
          const existingFont = cell.font || {}
          // Garder la taille existante si >= 9, sinon mettre à 9
          if (!existingFont.size || existingFont.size < 9) {
            cell.font = {
              ...existingFont,
              size: 9,
            }
          }
        }
      }
    }
    
    // 3. Configurer la mise en page — fitToHeight=1 pour ajuster exactement
    bulletinWsExceljs.pageSetup = {
      paperSize: 9,        // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,       // Toutes les colonnes sur 1 page de large
      fitToHeight: 1,      // Toutes les lignes sur 1 page de haut (auto-scale)
      scale: 100,
      horizontalDpi: 300,
      verticalDpi: 300,
    }
    bulletinWsExceljs.pageMargins = {
      top: 0.15,
      bottom: 0.15,
      left: 0.15,
      right: 0.15,
      header: 0,
      footer: 0,
    }
    // Zone d'impression : A1 à V50 (tout le bulletin)
    bulletinWsExceljs.printArea = 'A1:V50'
    
    console.log('[BULLETIN_RENDER] Page setup: row height 16, footer 25-50, font 9, margins 0.15, fitToHeight=1')
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

  // 12e3. ⚠ CRITIQUE — Remplir DIRECTEMENT la feuille BULLETIN avec les notes
  //       de l'élève, les PTS OBT calculés, les sous-totaux et le rang.
  //       On ne depend plus des VLOOKUP — on remplit chaque ligne du BULLETIN
  //       ligne par ligne, en respectant la sélection (trimestre/période).
  if (bulletinWsExceljs) {
    // ⚠ Réduire la largeur des colonnes PTS OBT (H, N, T, V) qui sont trop larges
    // par défaut dans le template. On les met à la même largeur que les autres
    // colonnes de notes (C, D, F, etc.)
    const narrowWidth = 5.5  // largeur réduite pour les colonnes PTS OBT
    for (const col of [8, 14, 20, 22]) {  // H, N, T, V
      bulletinWsExceljs.getColumn(col).width = narrowWidth
    }

    await fillBulletinSheetDirectly(
      bulletinWsExceljs,
      listeWs,
      matchedSubjects,
      gradesBySubject,
      student as unknown as { id: string; lastName: string; firstName: string; gender: string | null; dateOfBirth: string | null; user: { userCode: string | null }; class: { id: string; name: string; level: string; promotion: string | null; institutionId: string } | null },
      selection,
      db,
      schoolYear,
    )
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
