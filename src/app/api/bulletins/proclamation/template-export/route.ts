import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { renderExcelToHtml } from '@/lib/bulletin-excel-renderer'
import HTMLtoDOCX from 'html-to-docx'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'

const execAsync = promisify(exec)

/** Convertit un numéro de colonne (1-based) en lettre Excel. */
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

/**
 * GET /api/bulletins/proclamation/template-export
 *
 * Génère une proclamation à partir du template Excel uploadé (feuille LISTE).
 * Tous les élèves sélectionnés sont insérés sur des lignes différentes (rows 3+).
 * Les colonnes périodes/examens (9 par matière) sont CACHÉES.
 *
 * Colonnes VISIBLES :
 *   - Nom de l'élève (col A)
 *   - Promotion / Classe (col E)
 *   - Total par matière (une colonne par matière, formule SUM)
 *   - Total des points obtenus (formule SUM des totaux par matière)
 *   - Total général maximum (constante = somme des maxAnnuel)
 *   - Rang (formule RANK)
 *
 * Query params :
 *   - schoolYear (requis)
 *   - classId    (requis)
 *   - studentIds (optionnel, séparé par virgules)
 *   - format     (requis) : "xlsx" | "pdf" | "word"
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const classId = searchParams.get('classId')
    const studentIdsParam = searchParams.get('studentIds')
    const format = (searchParams.get('format') || 'xlsx').toLowerCase() as 'xlsx' | 'pdf' | 'word'

    if (!classId) {
      return NextResponse.json({ error: 'Paramètre classId requis' }, { status: 400 })
    }
    if (!['xlsx', 'pdf', 'word'].includes(format)) {
      return NextResponse.json({ error: 'format doit être "xlsx", "pdf" ou "word"' }, { status: 400 })
    }

    // 1. Charger la classe
    const cls = await db.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, level: true, promotion: true, institutionId: true },
    })
    if (!cls) return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 })
    if (!cls.institutionId) return NextResponse.json({ error: "Classe sans institution" }, { status: 400 })

    // 2. Détecter le niveau (1-12)
    const detectLevel = (s: string): number => {
      const m = s.toLowerCase().match(/(\d)[èe]me/) || s.toLowerCase().match(/(\d)/)
      return m ? parseInt(m[1], 10) : 0
    }
    const level = detectLevel(cls.name) || detectLevel(cls.level || '')
    if (level === 0) {
      return NextResponse.json({ error: `Niveau indétectable depuis "${cls.name}"` }, { status: 400 })
    }

    // 3. Trouver le template + MediaFile
    const template = await db.bulletinTemplate.findFirst({
      where: { institutionId: cls.institutionId, level },
    })
    if (!template?.mediaFileId) {
      return NextResponse.json({ error: `Aucun template pour le niveau ${level}` }, { status: 404 })
    }
    const mediaFile = await db.mediaFile.findUnique({ where: { id: template.mediaFileId } })
    if (!mediaFile?.data) {
      return NextResponse.json({ error: 'Fichier Excel du template introuvable' }, { status: 404 })
    }

    // 4. Récupérer les élèves à proclamer
    type StudentData = { id: string; lastName: string; firstName: string; gender: string | null; dateOfBirth: string | null; userCode: string | null }
    let students: StudentData[]
    if (studentIdsParam) {
      const ids = studentIdsParam.split(',').filter(Boolean)
      const found = await db.student.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, lastName: true, firstName: true, gender: true, dateOfBirth: true,
          user: { select: { userCode: true } },
        },
      })
      // Mapper vers StudentData (flatten user.userCode → userCode)
      students = found
        .map(s => ({ id: s.id, lastName: s.lastName, firstName: s.firstName, gender: s.gender, dateOfBirth: s.dateOfBirth, userCode: s.user?.userCode || null }))
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    } else {
      const found = await db.student.findMany({
        where: { classId, status: 'active' },
        select: {
          id: true, lastName: true, firstName: true, gender: true, dateOfBirth: true,
          user: { select: { userCode: true } },
        },
        orderBy: { lastName: 'asc' },
      })
      students = found.map(s => ({ id: s.id, lastName: s.lastName, firstName: s.firstName, gender: s.gender, dateOfBirth: s.dateOfBirth, userCode: s.user?.userCode || null }))
    }

    if (students.length === 0) {
      return NextResponse.json({ error: 'Aucun élève à proclamer' }, { status: 400 })
    }
    console.log(`[PROC_TEMPLATE] ${students.length} élèves pour ${cls.name}`)

    // 5. Charger le template avec ExcelJS
    const xlsxBuffer = Buffer.from(mediaFile.data, 'base64')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(xlsxBuffer as unknown as ArrayBuffer)

    // 6. Trouver la feuille LISTE correspondant au niveau de la classe
    //    Le template peut contenir plusieurs feuilles LISTE (une par niveau) :
    //    "LISTE 1ère", "LISTE 2è", "LISTE 3è", "LISTE 4è", "LISTE 5è", "LISTE 6è"
    //    On cherche celle qui correspond au niveau détecté.
    const sheetNames = wb.worksheets.map(ws => ws.name)
    // Patterns pour matcher "LISTE 4è", "LISTE 4ème", "LISTE 4ere", etc.
    const levelPatterns = [
      `LISTE ${level}ère`,
      `LISTE ${level}è`,
      `LISTE ${level}eme`,
      `LISTE ${level}ème`,
      `LISTE ${level}ere`,
      `LISTE ${level}ER`,
      `LISTE ${level}ERE`,
      `LISTE ${level}`,
    ]
    let listeSheetName: string | undefined
    for (const pattern of levelPatterns) {
      const found = sheetNames.find(n => n.toUpperCase() === pattern.toUpperCase())
      if (found) { listeSheetName = found; break }
    }
    // Fallback : n'importe quelle feuille contenant "LISTE"
    if (!listeSheetName) {
      listeSheetName = sheetNames.find(n => n.toUpperCase().includes('LISTE'))
    }
    // Dernier fallback : première feuille
    if (!listeSheetName) {
      listeSheetName = sheetNames[0]
    }
    console.log(`[PROC_TEMPLATE] Feuille sélectionnée: "${listeSheetName}" (niveau ${level})`)
    const ws = wb.getWorksheet(listeSheetName)
    if (!ws) {
      return NextResponse.json({ error: `Feuille LISTE introuvable` }, { status: 422 })
    }

    // 7. Parser les en-têtes de cours (row 1, à partir de la colonne 12)
    const headerRow = ws.getRow(1)
    const subjectHeaders: { name: string; startCol: number }[] = []
    for (let colNum = 12; colNum <= ws.columnCount; colNum++) {
      const cell = headerRow.getCell(colNum)
      const val = cell.value
      let headerStr = ''
      if (val !== null && val !== undefined) {
        if (typeof val === 'object' && 'formula' in val) {
          headerStr = String((val as { result?: unknown }).result ?? '')
        } else if (typeof val === 'object' && 'richText' in val) {
          headerStr = (val as { richText: { text: string }[] }).richText.map(rt => rt.text).join('')
        } else {
          headerStr = String(val)
        }
      }
      const offset = colNum - 12
      if (offset % 9 === 0 && headerStr.trim()) {
        subjectHeaders.push({ name: headerStr.trim(), startCol: colNum })
      }
    }
    console.log(`[PROC_TEMPLATE] ${subjectHeaders.length} matières détectées`)

    // 8. Match matières template → matières DB
    //    Les matières sont globales (pas par institution), filtrées par level.
    const dbSubjects = await db.subject.findMany({
      where: { OR: [{ level: 'primaire' }, { level: null }, { level: 'secondaire' }] },
      select: { id: true, name: true, title: true, subtitle: true, maxAnnuel: true },
    })
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
    const subjectMatches: { templateSubject: { name: string; startCol: number }; dbSubject: typeof dbSubjects[0] | null }[] = []
    for (const ts of subjectHeaders) {
      const normTs = normalize(ts.name)
      let match = dbSubjects.find(s => normalize(s.name) === normTs)
        || dbSubjects.find(s => s.subtitle && normalize(s.subtitle) === normTs)
        || dbSubjects.find(s => {
          const ns = normalize(s.name)
          return ns.length > 3 && (normTs.includes(ns) || ns.includes(normTs))
        })
      subjectMatches.push({ templateSubject: ts, dbSubject: match || null })
    }

    // 9. Récupérer toutes les notes
    const studentIds = students.map(s => s.id)
    const grades = await db.grade.findMany({
      where: { studentId: { in: studentIds }, schoolYear },
      select: { studentId: true, subjectId: true, value: true },
    })
    const gradesByStudent = new Map<string, Map<string, number[]>>()
    for (const g of grades) {
      if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, new Map())
      if (!gradesByStudent.get(g.studentId)!.has(g.subjectId)) {
        gradesByStudent.get(g.studentId)!.set(g.subjectId, [])
      }
      gradesByStudent.get(g.studentId)!.get(g.subjectId)!.push(g.value)
    }

    // 10. Effacer les anciennes données (rows 3+)
    const lastRow = ws.rowCount
    for (let rowNum = 3; rowNum <= lastRow; rowNum++) {
      const row = ws.getRow(rowNum)
      for (let colNum = 1; colNum <= ws.columnCount; colNum++) {
        row.getCell(colNum).value = null
      }
      row.commit()
    }

    // 11. Insérer chaque élève à partir de row 3
    for (let stuIdx = 0; stuIdx < students.length; stuIdx++) {
      const student = students[stuIdx]
      const rowNum = 3 + stuIdx
      const row = ws.getRow(rowNum)

      // Identité
      row.getCell(1).value = `${student.lastName || ''} ${student.firstName || ''}`.trim() // NOMS
      row.getCell(2).value = student.userCode || '' // N° ID (caché)
      row.getCell(3).value = student.gender || '' // SEXE (caché)
      if (student.dateOfBirth) {
        try { row.getCell(4).value = new Date(student.dateOfBirth) } catch { row.getCell(4).value = student.dateOfBirth }
      }
      row.getCell(5).value = cls.name // CLASSE (visible)

      // Notes : 9 colonnes par matière
      for (const { templateSubject, dbSubject } of subjectMatches) {
        if (!dbSubject) continue
        const subjGrades = gradesByStudent.get(student.id)?.get(dbSubject.id) || []
        for (let i = 0; i < 9 && i < subjGrades.length; i++) {
          row.getCell(templateSubject.startCol + i).value = subjGrades[i]
        }
      }
      row.commit()
    }

    // 12. Ajouter les colonnes de totaux à la FIN de la feuille
    //     On ajoute 3 colonnes après la dernière colonne existante :
    //       - Total obtenu (somme de toutes les notes de l'élève)
    //       - Total max (somme des maxAnnuel des matières)
    //       - Rang (formule RANK)
    //
    //     On calcule les valeurs directement depuis la DB (plus fiable que
    //     les formules Excel qui dépendent de la détection des colonnes
    //     matières — qui peut être incomplète à cause d'espacements irréguliers
    //     dans le template). On met quand même des formules Excel pour que
    //     l'utilisateur puisse les voir et les modifier dans Excel.
    const totalCol = Math.max(ws.columnCount, 250) + 1 // Après toutes les colonnes existantes
    const totalObtenuCol = totalCol
    const totalMaxCol = totalCol + 1
    const pourcentageCol = totalCol + 2
    const rangCol = totalCol + 3

    // Headers (row 1)
    ws.getRow(1).getCell(totalObtenuCol).value = 'TOTAL OBTENU'
    ws.getRow(1).getCell(totalMaxCol).value = 'TOTAL MAX'
    ws.getRow(1).getCell(pourcentageCol).value = 'POURCENTAGE'
    ws.getRow(1).getCell(rangCol).value = 'RANG'

    // Calculer les totaux pour chaque élève
    const studentTotals: number[] = []
    const maxTotal = subjectMatches.reduce((sum, m) => sum + (m.dbSubject?.maxAnnuel || 0), 0)

    for (let stuIdx = 0; stuIdx < students.length; stuIdx++) {
      const student = students[stuIdx]
      const rowNum = 3 + stuIdx
      // Somme de toutes les notes de cet élève
      const allGrades = gradesByStudent.get(student.id)
      let grandTotal = 0
      if (allGrades) {
        for (const [, vals] of allGrades) {
          grandTotal += vals.reduce((a, b) => a + b, 0)
        }
      }
      studentTotals.push(grandTotal)

      // Écrire les valeurs + formules
      ws.getRow(rowNum).getCell(totalObtenuCol).value = grandTotal
      ws.getRow(rowNum).getCell(totalMaxCol).value = maxTotal
      // POURCENTAGE = (total obtenu / total max) × 100, arrondi à 1 décimale
      const pourcentage = maxTotal > 0 ? Math.round((grandTotal / maxTotal) * 1000) / 10 : 0
      ws.getRow(rowNum).getCell(pourcentageCol).value = pourcentage
    }

    // Calculer les rangs (tri décroissant, le plus grand = rang 1)
    const sortedTotals = [...studentTotals].sort((a, b) => b - a)
    for (let stuIdx = 0; stuIdx < students.length; stuIdx++) {
      const rowNum = 3 + stuIdx
      const rank = sortedTotals.indexOf(studentTotals[stuIdx]) + 1
      // Formule RANK pour Excel + valeur calculée pour l'affichage
      const totalObtenuLetter = colNumberToLetter(totalObtenuCol)
      const totalObtenuRange = `${totalObtenuLetter}3:${totalObtenuLetter}${3 + students.length - 1}`
      ws.getRow(rowNum).getCell(rangCol).value = {
        formula: `RANK(${totalObtenuLetter}${rowNum},${totalObtenuRange},0)`,
        result: rank,
      }
    }

    console.log(`[PROC_TEMPLATE] Totaux calculés: max=${maxTotal}, élèves=${students.length}, rangs attribués`)

    // 13. S'assurer que les colonnes de totaux sont VISIBLES et ont une largeur correcte
    ws.getColumn(totalObtenuCol).hidden = false
    ws.getColumn(totalMaxCol).hidden = false
    ws.getColumn(pourcentageCol).hidden = false
    ws.getColumn(rangCol).hidden = false
    ws.getColumn(totalObtenuCol).width = 15
    ws.getColumn(totalMaxCol).width = 12
    ws.getColumn(pourcentageCol).width = 14
    ws.getColumn(rangCol).width = 8

    // 15. Écrire le buffer
    const exceljsBuffer = await wb.xlsx.writeBuffer()
    const outBuffer = Buffer.from(exceljsBuffer as ArrayBuffer)

    // 16. Retourner selon le format
    const baseName = `proclamation_${cls.name.replace(/\s+/g, '_')}_${schoolYear}`

    if (format === 'xlsx') {
      const headers = new Headers()
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      headers.set('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
      return new NextResponse(new Uint8Array(outBuffer), { headers })
    }

    if (format === 'word') {
      const fullHtml = await renderExcelToHtml(outBuffer, listeSheetName)
      const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false,
      })
      const headers = new Headers()
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      headers.set('Content-Disposition', `attachment; filename="${baseName}.docx"`)
      return new NextResponse(new Uint8Array(docxBuffer), { headers })
    }

    // format === 'pdf'
    const tmpId = randomUUID()
    const tmpDir = `/tmp/proc-render-${tmpId}`
    await mkdir(tmpDir, { recursive: true })
    try {
      const inputPath = join(tmpDir, `${baseName}.xlsx`)
      await writeFile(inputPath, outBuffer)
      try {
        await execAsync(`soffice --headless --convert-to pdf --outdir ${tmpDir} ${inputPath}`, { timeout: 60000 })
        const outputBuffer = await readFile(join(tmpDir, `${baseName}.pdf`))
        const headers = new Headers()
        headers.set('Content-Type', 'application/pdf')
        headers.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
        return new NextResponse(new Uint8Array(outputBuffer), { headers })
      } catch {
        // Fallback jsPDF
        console.warn('[PROC_TEMPLATE] soffice not available, jsPDF fallback')
        const { default: jsPDF } = await import('jspdf')
        const autoTable = (await import('jspdf-autotable')).default
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
        doc.setFontSize(14)
        doc.text(`Proclamation — ${cls.name} — ${schoolYear}`, 14, 15)

        const head = ['Nom', 'Classe', 'Total obtenu', 'Total max', 'Pourcentage', 'Rang']
        const body: (string | number)[][] = []
        for (let stuIdx = 0; stuIdx < students.length; stuIdx++) {
          const row: (string | number)[] = []
          row.push(`${students[stuIdx].lastName} ${students[stuIdx].firstName}`.trim())
          row.push(cls.name)
          row.push(studentTotals[stuIdx])
          row.push(maxTotal)
          row.push(maxTotal > 0 ? Math.round((studentTotals[stuIdx] / maxTotal) * 1000) / 10 : 0)
          const rc = ws.getRow(3 + stuIdx).getCell(rangCol)
          row.push(Number((rc.value as { result?: unknown })?.result ?? 0))
          body.push(row)
        }
        autoTable(doc, {
          head: [head], body, startY: 22,
          styles: { fontSize: 5, cellPadding: 0.5 },
          headStyles: { fillColor: [11, 26, 46], textColor: 255 },
        })
        const pdfBuffer = Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
        const headers = new Headers()
        headers.set('Content-Type', 'application/pdf')
        headers.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
        return new NextResponse(new Uint8Array(pdfBuffer), { headers })
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error) {
    console.error('Proclamation template export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la génération de la proclamation' },
      { status: 500 }
    )
  }
}

