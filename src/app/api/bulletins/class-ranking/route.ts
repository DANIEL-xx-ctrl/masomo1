import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import HTMLtoDOCX from 'html-to-docx'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { detectLevel } from '@/lib/bulletin-parser'

const execAsync = promisify(exec)

const ANNUAL_MAX_TOTAL = 3600

interface RankingItem {
  rank: number
  studentId: string
  lastName: string
  firstName: string
  userCode: string | null
  total: number
  maxTotal: number
  percentage: number
}

function normalizeText(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.'',]/g, '')
    .trim()
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'object' && v !== null && 'result' in v) {
    const r = Number((v as { result?: unknown }).result)
    return Number.isFinite(r) ? r : 0
  }
  const n = parseFloat(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function getCellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if ('result' in obj && obj.result !== undefined && obj.result !== null) {
      return String(obj.result).trim()
    }
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return (obj.richText as { text?: string }[])
        .map((rt) => rt.text || '')
        .join('')
        .trim()
    }
  }
  return String(v).trim()
}

function findListeSheetName(sheetNames: string[], level: number): string {
  const candidates = [
    `LISTE ${level}ère`,
    `LISTE ${level}è`,
    `LISTE ${level}eme`,
    `LISTE ${level}ème`,
    `LISTE ${level}`,
    `LISTE ${level}ER`,
    `LISTE ${level}ERE`,
  ]
  for (const cand of candidates) {
    const found = sheetNames.find((n) => n.toUpperCase() === cand.toUpperCase())
    if (found) return found
  }
  const anyListe = sheetNames.find((n) => n.toUpperCase().startsWith('LISTE'))
  if (anyListe) return anyListe
  const bulletin = sheetNames.find((n) => n.toUpperCase() === 'BULLETIN')
  if (bulletin) return bulletin
  return sheetNames[0]
}

/**
 * Reproduit la logique de calcul du bulletin (`fillBulletinSheetDirectly`)
 * pour obtenir le total annuel (colonne V = 22 de la ligne TOTAUX) d'un élève.
 */
async function computeBulletinAnnualTotalForStudent(params: {
  studentId: string
  schoolYear: string
  level: number
  templateWs: ExcelJS.Worksheet | undefined
  allDbSubjects: Array<{
    id: string
    name: string
    maxTJ: number | null
    maxEX: number | null
    maxTRIM: number | null
    maxAnnuel: number | null
  }>
}): Promise<number> {
  const { studentId, schoolYear, level, templateWs, allDbSubjects } = params

  const grades = await db.grade.findMany({
    where: { studentId, schoolYear },
    select: {
      subjectId: true,
      value: true,
      maxValue: true,
      type: true,
      trimester: true,
    },
  })

  const gradesBySubject = new Map<string, Map<string, number[]>>()
  for (const g of grades) {
    if (!gradesBySubject.has(g.subjectId)) {
      gradesBySubject.set(g.subjectId, new Map())
    }
    const key = `${g.trimester}|${g.type}`.normalize('NFC').trim()
    const subMap = gradesBySubject.get(g.subjectId)!
    if (!subMap.has(key)) subMap.set(key, [])
    subMap.get(key)!.push(Number(g.value) || 0)
  }

  // Fallback si la feuille BULLETIN du modèle n'est pas présente
  if (!templateWs) {
    let sum = 0
    for (const subMap of gradesBySubject.values()) {
      for (const vals of subMap.values()) {
        if (vals.length > 0) sum += vals[vals.length - 1]
      }
    }
    return Math.round(sum * 100) / 100
  }

  const gradeColMap: { type: string; trimester: string; col: number }[] = [
    { type: '1ère période', trimester: '1er', col: 3 },
    { type: '2ème période', trimester: '1er', col: 4 },
    { type: 'examen', trimester: '1er', col: 6 },
    { type: '3ème période', trimester: '2eme', col: 9 },
    { type: '4ème période', trimester: '2eme', col: 10 },
    { type: 'examen', trimester: '2eme', col: 12 },
    { type: '5ème période', trimester: '3eme', col: 15 },
    { type: '6ème période', trimester: '3eme', col: 16 },
    { type: 'examen', trimester: '3eme', col: 18 },
  ]

  const trimColMap = [
    { trim: '1er', ptsCol: 8 },
    { trim: '2eme', ptsCol: 14 },
    { trim: '3eme', ptsCol: 20 },
  ]

  const usedSubjectIds = new Set<string>()
  const seenCourseNames = new Set<string>()
  const rowValues = new Map<number, Map<number, number | null>>()
  const sousTotalsToRecalc: { rowNum: number; courseRows: number[] }[] = []
  const isolatedCourseRows: number[] = []
  const courseRowsForSousTotal: number[] = []
  let isAfterLECTSubTitle = false

  const setCellVal = (r: number, c: number, val: number | null) => {
    if (!rowValues.has(r)) rowValues.set(r, new Map())
    rowValues.get(r)!.set(c, val)
  }

  const getCellVal = (r: number, c: number): number | null => {
    const map = rowValues.get(r)
    if (map && map.has(c)) return map.get(c) ?? null
    const raw = templateWs.getRow(r).getCell(c).value
    if (raw === null || raw === undefined || raw === '') return null
    return toNum(raw)
  }

  for (let rowNum = 11; rowNum <= templateWs.rowCount; rowNum++) {
    const row = templateWs.getRow(rowNum)
    let colAStr = getCellText(row.getCell(1).value)

    const lowerA = colAStr.toLowerCase()
    if (lowerA.includes('sous-total') || lowerA.includes('sous total')) {
      if (courseRowsForSousTotal.length > 0) {
        sousTotalsToRecalc.push({ rowNum, courseRows: [...courseRowsForSousTotal] })
      }
      courseRowsForSousTotal.length = 0
      continue
    }

    const upperA = colAStr.toUpperCase()
    if (upperA.includes('MAXIMA') || upperA.includes('TOTAL')) {
      if (courseRowsForSousTotal.length > 0) {
        isolatedCourseRows.push(...courseRowsForSousTotal)
      }
      courseRowsForSousTotal.length = 0
      continue
    }

    const upperFooter = upperA.trim()
    if (
      upperFooter.startsWith('POURC') ||
      upperFooter.startsWith('PLACE') ||
      upperFooter.startsWith('RANG') ||
      upperFooter === 'APPLICATION' ||
      upperFooter === 'CONDUITE' ||
      upperFooter === 'SIGNATURE' ||
      upperFooter.includes('CLASSE SUP') ||
      upperFooter.includes('DOUBLE LA CLASSE') ||
      upperFooter.includes('BULLETIN EST SANS VALEUR') ||
      upperFooter.includes('CHEF D') ||
      upperFooter.includes('SCEAU DE L')
    ) {
      break
    }

    if (upperA.includes('DOMAINE') || upperA.includes('DOMIANE')) {
      if (courseRowsForSousTotal.length > 0) {
        isolatedCourseRows.push(...courseRowsForSousTotal)
      }
      courseRowsForSousTotal.length = 0
      continue
    }

    const isAllCapsHeader =
      colAStr === colAStr.toUpperCase() && /[A-Z]/.test(colAStr) && colAStr.length > 3
    const isShortHeader = colAStr.length < 20
    if (
      isAllCapsHeader &&
      (upperA === 'FRANCAIS' ||
        upperA === 'LANGUES CONGOLAISES' ||
        upperA === 'MATHEMATIQUES' ||
        upperA === 'SCIENCES' ||
        upperA === 'TECHNOLOGIE' ||
        upperA === 'EDUCATION ARTISTIQUE' ||
        upperA.includes('EDUCATION ARTIST'))
    ) {
      continue
    }

    if (
      upperA.includes('EDUCATION ARTIST') &&
      !upperA.includes('DRAMATIQUE') &&
      !upperA.includes('PLASTIQUE')
    ) {
      continue
    }

    if (
      (upperA.includes('ART') &&
        isShortHeader &&
        !upperA.includes('DRAMATIQUE') &&
        !upperA.includes('PLASTIQUE') &&
        !upperA.includes('PHYS') &&
        !upperA.includes('EDUCATION')) ||
      (upperA.includes('DEVELOPPEMENT') && isShortHeader) ||
      (upperA.includes('UNIVERS') && isShortHeader)
    ) {
      continue
    }

    const bVal = row.getCell(2).value
    const bIsNumeric =
      typeof bVal === 'number' ||
      (typeof bVal === 'object' &&
        bVal !== null &&
        'result' in bVal &&
        !Number.isNaN(Number((bVal as { result?: unknown }).result)))

    if (
      !isAfterLECTSubTitle &&
      !bIsNumeric &&
      upperA.includes('LECT') &&
      upperA.includes('ECRIT') &&
      upperA.includes('CONGOLAISE')
    ) {
      isAfterLECTSubTitle = true
      continue
    }

    if (!colAStr) {
      if (isAfterLECTSubTitle) {
        colAStr = 'LECT. - ECRITURE EN LANGUES CONGOLAISES'
      } else {
        const prevName = getCellText(templateWs.getRow(rowNum - 1).getCell(1).value)
        if (
          prevName &&
          !prevName.toLowerCase().includes('sous-total') &&
          !prevName.toUpperCase().includes('DOMAINE') &&
          !prevName.toUpperCase().includes('MAXIMA') &&
          !prevName.toUpperCase().includes('TOTAUX') &&
          !prevName.toUpperCase().includes('POURC') &&
          !prevName.toUpperCase().includes('PLACE') &&
          prevName.length > 3
        ) {
          colAStr = prevName
        } else {
          continue
        }
      }
    }

    const normColA = normalizeText(colAStr)
    if (seenCourseNames.has(normColA)) {
      continue
    }
    seenCourseNames.add(normColA)

    let bestSubj =
      allDbSubjects.find(
        (s) =>
          !usedSubjectIds.has(s.id) &&
          normalizeText(s.name) === normColA &&
          gradesBySubject.has(s.id) &&
          s.maxTJ !== null &&
          s.maxTJ !== undefined
      ) ||
      allDbSubjects.find(
        (s) =>
          !usedSubjectIds.has(s.id) &&
          normalizeText(s.name) === normColA &&
          gradesBySubject.has(s.id)
      ) ||
      allDbSubjects.find((s) => {
        const ns = normalizeText(s.name)
        return (
          !usedSubjectIds.has(s.id) &&
          ns.length > 3 &&
          (normColA.includes(ns) || ns.includes(normColA)) &&
          gradesBySubject.has(s.id) &&
          s.maxTJ !== null &&
          s.maxTJ !== undefined
        )
      }) ||
      allDbSubjects.find((s) => {
        const ns = normalizeText(s.name)
        return (
          !usedSubjectIds.has(s.id) &&
          ns.length > 3 &&
          (normColA.includes(ns) || ns.includes(normColA)) &&
          gradesBySubject.has(s.id)
        )
      }) ||
      allDbSubjects.find(
        (s) =>
          !usedSubjectIds.has(s.id) &&
          gradesBySubject.has(s.id) &&
          s.maxTJ !== null &&
          s.maxTJ !== undefined
      ) ||
      allDbSubjects.find(
        (s) => !usedSubjectIds.has(s.id) && gradesBySubject.has(s.id)
      )

    if (bestSubj) {
      usedSubjectIds.add(bestSubj.id)
      const subjGrades = gradesBySubject.get(bestSubj.id)
      const trimValues: Record<string, number> = { '1er': 0, '2eme': 0, '3eme': 0 }

      for (const entry of gradeColMap) {
        const key = `${entry.trimester}|${entry.type}`.normalize('NFC').trim()
        const cellValues = subjGrades?.get(key)
        if (cellValues && cellValues.length > 0) {
          const val = cellValues[cellValues.length - 1]
          setCellVal(rowNum, entry.col, val)
          trimValues[entry.trimester] += val
        } else {
          setCellVal(rowNum, entry.col, null)
        }
      }

      let totalAnnuel = 0
      for (const tc of trimColMap) {
        const trimSum = trimValues[tc.trim] || 0
        setCellVal(rowNum, tc.ptsCol, trimSum)
        totalAnnuel += trimSum
      }
      setCellVal(rowNum, 22, totalAnnuel)

      if (isAfterLECTSubTitle) {
        isolatedCourseRows.push(rowNum)
        isAfterLECTSubTitle = false
      } else {
        courseRowsForSousTotal.push(rowNum)
      }
    } else if (isAfterLECTSubTitle) {
      isAfterLECTSubTitle = false
    }
  }

  for (const st of sousTotalsToRecalc) {
    for (let col = 2; col <= 22; col++) {
      let sum = 0
      let hasValue = false
      for (const courseRowNum of st.courseRows) {
        const v = getCellVal(courseRowNum, col)
        if (v !== null && v !== undefined) {
          sum += v
          if (v !== 0) hasValue = true
        }
      }
      setCellVal(st.rowNum, col, hasValue ? sum : null)
    }
  }

  let totauxRowNum = -1
  for (let r = 11; r <= templateWs.rowCount; r++) {
    const aStr = getCellText(templateWs.getRow(r).getCell(1).value).toUpperCase()
    if (aStr === 'TOTAUX' || (aStr.includes('TOTAUX') && !aStr.includes('MAXIMA'))) {
      totauxRowNum = r
      break
    }
  }

  const rowsToSumForTotaux = [
    ...sousTotalsToRecalc.map((st) => st.rowNum),
    ...isolatedCourseRows,
  ]

  let annualTotal = 0
  let hasAnnualValue = false
  for (const rNum of rowsToSumForTotaux) {
    const v = getCellVal(rNum, 22)
    if (v !== null && v !== undefined) {
      annualTotal += v
      if (v !== 0) hasAnnualValue = true
    }
  }

  if (totauxRowNum > 0) {
    setCellVal(totauxRowNum, 22, hasAnnualValue ? Math.round(annualTotal * 10) / 10 : null)
  }

  if (!hasAnnualValue && level > 0) {
    let fallbackSum = 0
    for (const subMap of gradesBySubject.values()) {
      for (const vals of subMap.values()) {
        if (vals.length > 0) fallbackSum += vals[vals.length - 1]
      }
    }
    return Math.round(fallbackSum * 10) / 10
  }

  return Math.round(annualTotal * 10) / 10
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const selection = searchParams.get('selection') || 'all'
    const format = (searchParams.get('format') || 'json').toLowerCase()

    if (!classId) {
      return NextResponse.json({ error: 'classId requis' }, { status: 400 })
    }

    const cls = await db.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, level: true, institutionId: true },
    })
    if (!cls) {
      return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 })
    }

    const students = await db.student.findMany({
      where: { classId, status: 'active' },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        user: { select: { userCode: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    if (students.length === 0) {
      return NextResponse.json({ error: 'Aucun élève' }, { status: 400 })
    }

    const isAnnual = selection === 'all' || selection === 'annual'
    const level =
      (cls.name ? detectLevel(cls.name) : 0) ||
      (cls.level ? detectLevel(cls.level) : 0)

    let bulletinWs: ExcelJS.Worksheet | undefined
    if (isAnnual && cls.institutionId && level > 0) {
      const template = await db.bulletinTemplate.findFirst({
        where: { institutionId: cls.institutionId, level },
      })
      if (template?.mediaFileId) {
        const mediaFile = await db.mediaFile.findUnique({
          where: { id: template.mediaFileId },
        })
        if (mediaFile?.data) {
          const xlsxBuffer = Buffer.from(mediaFile.data, 'base64')
          const sheetJsWb = XLSX.read(xlsxBuffer, { type: 'buffer' })
          const listeName = findListeSheetName(sheetJsWb.SheetNames, level)
          const exceljsWb = new ExcelJS.Workbook()
          await exceljsWb.xlsx.load(xlsxBuffer as unknown as ArrayBuffer)
          bulletinWs =
            exceljsWb.getWorksheet('BULLETIN') ||
            exceljsWb.getWorksheet(listeName) ||
            exceljsWb.worksheets[0]
        }
      }
    }

    const allDbSubjects = await db.subject.findMany({
      where: { OR: [{ level: 'primaire' }, { level: null }, { level: 'secondaire' }] },
      select: {
        id: true,
        name: true,
        maxTJ: true,
        maxEX: true,
        maxTRIM: true,
        maxAnnuel: true,
      },
    })

    const gf: { trimester?: string; type?: string } = {}
    let periodLabel = 'Total Annuel (3600)'
    const selMap: Record<string, { t?: string; ty?: string; l: string }> = {
      '1er': { t: '1er', l: '1er trimestre' },
      '2eme': { t: '2eme', l: '2ème trimestre' },
      '3eme': { t: '3eme', l: '3ème trimestre' },
      'p1': { t: '1er', ty: '1ère période', l: '1ère période' },
      'p2': { t: '1er', ty: '2ème période', l: '2ème période' },
      'p3': { t: '2eme', ty: '3ème période', l: '3ème période' },
      'p4': { t: '2eme', ty: '4ème période', l: '4ème période' },
      'p5': { t: '3eme', ty: '5ème période', l: '5ème période' },
      'p6': { t: '3eme', ty: '6ème période', l: '6ème période' },
      'examen': { ty: 'examen', l: 'Tous les examens' },
      'examen1': { t: '1er', ty: 'examen', l: 'Examen 1er trimestre' },
      'examen2': { t: '2eme', ty: 'examen', l: 'Examen 2ème trimestre' },
      'examen3': { t: '3eme', ty: 'examen', l: 'Examen 3ème trimestre' },
    }
    if (!isAnnual && selMap[selection]) {
      const s = selMap[selection]
      if (s.t) gf.trimester = s.t
      if (s.ty) gf.type = s.ty
      periodLabel = s.l
    }

    const ranking: RankingItem[] = []
    for (const s of students) {
      if (isAnnual) {
        const total = await computeBulletinAnnualTotalForStudent({
          studentId: s.id,
          schoolYear,
          level,
          templateWs: bulletinWs,
          allDbSubjects,
        })
        const maxTotal = ANNUAL_MAX_TOTAL
        const percentage =
          maxTotal > 0 ? Math.round(((total / maxTotal) * 100) * 10) / 10 : 0
        ranking.push({
          rank: 0,
          studentId: s.id,
          lastName: s.lastName,
          firstName: s.firstName,
          userCode: s.user?.userCode || null,
          total,
          maxTotal,
          percentage,
        })
      } else {
        const where: Record<string, unknown> = { studentId: s.id, schoolYear }
        if (gf.trimester) where.trimester = gf.trimester
        if (gf.type) where.type = gf.type
        const grades = await db.grade.findMany({
          where,
          select: { value: true, maxValue: true },
        })
        const total =
          Math.round(grades.reduce((sum, g) => sum + (Number(g.value) || 0), 0) * 10) / 10
        const maxTotal = grades.reduce((sum, g) => sum + (Number(g.maxValue) || 0), 0)
        const percentage =
          maxTotal > 0 ? Math.round(((total / maxTotal) * 100) * 10) / 10 : 0
        ranking.push({
          rank: 0,
          studentId: s.id,
          lastName: s.lastName,
          firstName: s.firstName,
          userCode: s.user?.userCode || null,
          total,
          maxTotal,
          percentage,
        })
      }
    }

    ranking.sort((a, b) =>
      b.total !== a.total
        ? b.total - a.total
        : `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    )

    for (let i = 0; i < ranking.length; i++) {
      if (i > 0 && ranking[i].total === ranking[i - 1].total) {
        ranking[i].rank = ranking[i - 1].rank
      } else {
        ranking[i].rank = i + 1
      }
    }

    const baseName = `classement_${cls.name.replace(/\s+/g, '_')}_${selection}`

    if (format === 'json') {
      return NextResponse.json({
        className: cls.name,
        schoolYear,
        periodLabel,
        selection,
        annualMaxTotal: isAnnual ? ANNUAL_MAX_TOTAL : undefined,
        ranking: ranking.map((r) => ({
          rank: r.rank,
          studentId: r.studentId,
          name: `${r.lastName} ${r.firstName}`.trim(),
          userCode: r.userCode,
          total: r.total,
          pointsObtenus: r.total,
          maxTotal: r.maxTotal,
          percentage: r.percentage,
        })),
      })
    }

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Classement')
      ws.columns = [
        { header: 'Rang', key: 'rank', width: 8 },
        { header: 'N° ID', key: 'uc', width: 15 },
        { header: 'Nom', key: 'ln', width: 20 },
        { header: 'Prénom', key: 'fn', width: 20 },
        { header: 'Total obtenu', key: 't', width: 14 },
        { header: 'Total max', key: 'm', width: 12 },
        { header: 'Pourcentage', key: 'p', width: 14 },
      ]
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B1A2E' },
      }
      for (const r of ranking) {
        const row = ws.addRow({
          rank: `${r.rank}${r.rank === 1 ? 'er' : 'ème'}`,
          uc: r.userCode || '',
          ln: r.lastName,
          fn: r.firstName,
          t: r.total,
          m: r.maxTotal,
          p: r.percentage,
        })
        if (r.rank <= 3) {
          row.eachCell((c) => {
            c.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: {
                argb: r.rank === 1 ? 'FFFFD700' : r.rank === 2 ? 'FFC0C0C0' : 'FFCD7F32',
              },
            }
          })
        }
      }
      ws.insertRow(1, [`Classement — ${cls.name} — ${periodLabel} — ${schoolYear}`])
      ws.mergeCells('A1:G1')
      ws.getRow(1).font = { bold: true, size: 14 }
      ws.getRow(1).alignment = { horizontal: 'center' }
      const buffer = await wb.xlsx.writeBuffer()
      const h = new Headers()
      h.set(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      h.set('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
      return new NextResponse(new Uint8Array(buffer), { headers: h })
    }

    if (format === 'word') {
      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial}h2{text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px;text-align:center}th{background:#0B1A2E;color:#fff}.r1{background:#FFD700;font-weight:bold}.r2{background:#C0C0C0}.r3{background:#CD7F32}</style></head><body><h2>Classement — ${cls.name} — ${periodLabel} — ${schoolYear}</h2><table><tr><th>Rang</th><th>N° ID</th><th>Nom</th><th>Prénom</th><th>Total</th><th>Max</th><th>%</th></tr>`
      for (const r of ranking) {
        const rc = r.rank <= 3 ? ` class="r${r.rank}"` : ''
        html += `<tr${rc}><td>${r.rank}${r.rank === 1 ? 'er' : 'ème'}</td><td>${r.userCode || ''}</td><td>${r.lastName}</td><td>${r.firstName}</td><td>${r.total}</td><td>${r.maxTotal}</td><td>${r.percentage}%</td></tr>`
      }
      html += '</table></body></html>'
      const docxBuffer = await HTMLtoDOCX(html, null, { footer: false, pageNumber: false })
      const h = new Headers()
      h.set(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      h.set('Content-Disposition', `attachment; filename="${baseName}.docx"`)
      return new NextResponse(new Uint8Array(docxBuffer), { headers: h })
    }

    if (format === 'pdf') {
      const tmpId = randomUUID()
      const tmpDir = `/tmp/class-ranking-${tmpId}`
      await mkdir(tmpDir, { recursive: true })
      try {
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet('Classement')
        ws.columns = [
          { header: 'Rang', key: 'r', width: 8 },
          { header: 'N° ID', key: 'uc', width: 15 },
          { header: 'Nom', key: 'ln', width: 20 },
          { header: 'Prénom', key: 'fn', width: 20 },
          { header: 'Total', key: 't', width: 12 },
          { header: 'Max', key: 'm', width: 10 },
          { header: '%', key: 'p', width: 10 },
        ]
        for (const r of ranking) {
          ws.addRow({
            r: `${r.rank}${r.rank === 1 ? 'er' : 'ème'}`,
            uc: r.userCode || '',
            ln: r.lastName,
            fn: r.firstName,
            t: r.total,
            m: r.maxTotal,
            p: r.percentage,
          })
        }
        ws.insertRow(1, [`Classement — ${cls.name} — ${periodLabel}`])
        ws.mergeCells('A1:G1')
        ws.getRow(1).font = { bold: true, size: 14 }
        const xlsxPath = join(tmpDir, 'c.xlsx')
        await writeFile(
          xlsxPath,
          Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
        )
        try {
          await execAsync(
            `soffice --headless --convert-to pdf --outdir ${tmpDir} ${xlsxPath}`,
            { timeout: 60000 }
          )
          const pdfBuffer = await readFile(join(tmpDir, 'c.pdf'))
          const h = new Headers()
          h.set('Content-Type', 'application/pdf')
          h.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
          return new NextResponse(new Uint8Array(pdfBuffer), { headers: h })
        } catch {
          const { default: jsPDF } = await import('jspdf')
          const autoTable = (await import('jspdf-autotable')).default
          const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
          doc.setFontSize(14)
          doc.text(`Classement — ${cls.name} — ${periodLabel}`, 14, 15)
          autoTable(doc, {
            head: [['Rang', 'N° ID', 'Nom', 'Prénom', 'Total', 'Max', '%']],
            body: ranking.map((r) => [
              `${r.rank}${r.rank === 1 ? 'er' : 'ème'}`,
              r.userCode || '',
              r.lastName,
              r.firstName,
              r.total,
              r.maxTotal,
              r.percentage,
            ]),
            startY: 22,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [11, 26, 46], textColor: 255 },
          })
          const pdfBuffer = Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
          const h = new Headers()
          h.set('Content-Type', 'application/pdf')
          h.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
          return new NextResponse(new Uint8Array(pdfBuffer), { headers: h })
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      }
    }

    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
  } catch (error) {
    console.error('Class ranking error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur' },
      { status: 500 }
    )
  }
}
