import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import HTMLtoDOCX from 'html-to-docx'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'

const execAsync = promisify(exec)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const schoolYear = searchParams.get('schoolYear') || '2024-2025'
    const selection = searchParams.get('selection') || 'all'
    const format = (searchParams.get('format') || 'json').toLowerCase()

    if (!classId) return NextResponse.json({ error: 'classId requis' }, { status: 400 })

    const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true, name: true } })
    if (!cls) return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 })

    const students = await db.student.findMany({
      where: { classId, status: 'active' },
      select: { id: true, lastName: true, firstName: true, user: { select: { userCode: true } } },
      orderBy: { lastName: 'asc' },
    })
    if (students.length === 0) return NextResponse.json({ error: 'Aucun élève' }, { status: 400 })

    const gf: { trimester?: string; type?: string } = {}
    let periodLabel = 'Tous les trimestres'
    const selMap: Record<string, { t?: string; ty?: string; l: string }> = {
      '1er': { t: '1er', l: '1er trimestre' }, '2eme': { t: '2eme', l: '2ème trimestre' }, '3eme': { t: '3eme', l: '3ème trimestre' },
      'p1': { t: '1er', ty: '1ère période', l: '1ère période' }, 'p2': { t: '1er', ty: '2ème période', l: '2ème période' },
      'p3': { t: '2eme', ty: '3ème période', l: '3ème période' }, 'p4': { t: '2eme', ty: '4ème période', l: '4ème période' },
      'p5': { t: '3eme', ty: '5ème période', l: '5ème période' }, 'p6': { t: '3eme', ty: '6ème période', l: '6ème période' },
      'examen': { ty: 'examen', l: 'Tous les examens' },
      'examen1': { t: '1er', ty: 'examen', l: 'Examen 1er trimestre' },
      'examen2': { t: '2eme', ty: 'examen', l: 'Examen 2ème trimestre' },
      'examen3': { t: '3eme', ty: 'examen', l: 'Examen 3ème trimestre' },
    }
    if (selMap[selection]) { const s = selMap[selection]; if (s.t) gf.trimester = s.t; if (s.ty) gf.type = s.ty; periodLabel = s.l }

    const ranking: { rank: number; lastName: string; firstName: string; userCode: string | null; total: number; maxTotal: number; percentage: number }[] = []
    for (const s of students) {
      const where: Record<string, unknown> = { studentId: s.id, schoolYear }
      if (gf.trimester) where.trimester = gf.trimester
      if (gf.type) where.type = gf.type
      const grades = await db.grade.findMany({ where, select: { value: true, maxValue: true } })
      const total = grades.reduce((sum, g) => sum + g.value, 0)
      const maxTotal = grades.reduce((sum, g) => sum + g.maxValue, 0)
      ranking.push({ rank: 0, lastName: s.lastName, firstName: s.firstName, userCode: s.user?.userCode || null, total, maxTotal, percentage: maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0 })
    }
    ranking.sort((a, b) => b.total - a.total)
    for (let i = 0; i < ranking.length; i++) ranking[i].rank = i + 1

    const baseName = `classement_${cls.name.replace(/\s+/g, '_')}_${selection}`

    if (format === 'json') {
      return NextResponse.json({ className: cls.name, schoolYear, periodLabel, selection, ranking: ranking.map(r => ({ rank: r.rank, name: `${r.lastName} ${r.firstName}`, userCode: r.userCode, total: r.total, maxTotal: r.maxTotal, percentage: r.percentage })) })
    }

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Classement')
      ws.columns = [
        { header: 'Rang', key: 'rank', width: 8 }, { header: 'N° ID', key: 'uc', width: 15 },
        { header: 'Nom', key: 'ln', width: 20 }, { header: 'Prénom', key: 'fn', width: 20 },
        { header: 'Total obtenu', key: 't', width: 14 }, { header: 'Total max', key: 'm', width: 12 },
        { header: 'Pourcentage', key: 'p', width: 14 },
      ]
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1A2E' } }
      for (const r of ranking) {
        const row = ws.addRow({ rank: `${r.rank}${r.rank === 1 ? 'er' : 'ème'}`, uc: r.userCode || '', ln: r.lastName, fn: r.firstName, t: r.total, m: r.maxTotal, p: r.percentage })
        if (r.rank <= 3) { row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.rank === 1 ? 'FFFFD700' : r.rank === 2 ? 'FFC0C0C0' : 'FFCD7F32' } } }) }
      }
      ws.insertRow(1, [`Classement — ${cls.name} — ${periodLabel} — ${schoolYear}`])
      ws.mergeCells('A1:G1'); ws.getRow(1).font = { bold: true, size: 14 }; ws.getRow(1).alignment = { horizontal: 'center' }
      const buffer = await wb.xlsx.writeBuffer()
      const h = new Headers(); h.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); h.set('Content-Disposition', `attachment; filename="${baseName}.xlsx"`)
      return new NextResponse(new Uint8Array(buffer), { headers: h })
    }

    if (format === 'word') {
      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial}h2{text-align:center}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px;text-align:center}th{background:#0B1A2E;color:#fff}.r1{background:#FFD700;font-weight:bold}.r2{background:#C0C0C0}.r3{background:#CD7F32}</style></head><body><h2>Classement — ${cls.name} — ${periodLabel} — ${schoolYear}</h2><table><tr><th>Rang</th><th>N° ID</th><th>Nom</th><th>Prénom</th><th>Total</th><th>Max</th><th>%</th></tr>`
      for (const r of ranking) { const rc = r.rank <= 3 ? ` class="r${r.rank}"` : ''; html += `<tr${rc}><td>${r.rank}${r.rank === 1 ? 'er' : 'ème'}</td><td>${r.userCode || ''}</td><td>${r.lastName}</td><td>${r.firstName}</td><td>${r.total}</td><td>${r.maxTotal}</td><td>${r.percentage}%</td></tr>` }
      html += '</table></body></html>'
      const docxBuffer = await HTMLtoDOCX(html, null, { footer: false, pageNumber: false })
      const h = new Headers(); h.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); h.set('Content-Disposition', `attachment; filename="${baseName}.docx"`)
      return new NextResponse(new Uint8Array(docxBuffer), { headers: h })
    }

    if (format === 'pdf') {
      const tmpId = randomUUID(); const tmpDir = `/tmp/class-ranking-${tmpId}`; await mkdir(tmpDir, { recursive: true })
      try {
        const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Classement')
        ws.columns = [{ header: 'Rang', key: 'r', width: 8 }, { header: 'N° ID', key: 'uc', width: 15 }, { header: 'Nom', key: 'ln', width: 20 }, { header: 'Prénom', key: 'fn', width: 20 }, { header: 'Total', key: 't', width: 12 }, { header: 'Max', key: 'm', width: 10 }, { header: '%', key: 'p', width: 10 }]
        for (const r of ranking) ws.addRow({ r: `${r.rank}${r.rank === 1 ? 'er' : 'ème'}`, uc: r.userCode || '', ln: r.lastName, fn: r.firstName, t: r.total, m: r.maxTotal, p: r.percentage })
        ws.insertRow(1, [`Classement — ${cls.name} — ${periodLabel}`]); ws.mergeCells('A1:G1'); ws.getRow(1).font = { bold: true, size: 14 }
        const xlsxPath = join(tmpDir, 'c.xlsx'); await writeFile(xlsxPath, Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer))
        try {
          await execAsync(`soffice --headless --convert-to pdf --outdir ${tmpDir} ${xlsxPath}`, { timeout: 60000 })
          const pdfBuffer = await readFile(join(tmpDir, 'c.pdf'))
          const h = new Headers(); h.set('Content-Type', 'application/pdf'); h.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
          return new NextResponse(new Uint8Array(pdfBuffer), { headers: h })
        } catch {
          const { default: jsPDF } = await import('jspdf'); const autoTable = (await import('jspdf-autotable')).default
          const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
          doc.setFontSize(14); doc.text(`Classement — ${cls.name} — ${periodLabel}`, 14, 15)
          autoTable(doc, { head: [['Rang', 'N° ID', 'Nom', 'Prénom', 'Total', 'Max', '%']], body: ranking.map(r => [`${r.rank}${r.rank === 1 ? 'er' : 'ème'}`, r.userCode || '', r.lastName, r.firstName, r.total, r.maxTotal, r.percentage]), startY: 22, styles: { fontSize: 8 }, headStyles: { fillColor: [11, 26, 46], textColor: 255 } })
          const pdfBuffer = Buffer.from(doc.output('arraybuffer') as ArrayBuffer)
          const h = new Headers(); h.set('Content-Type', 'application/pdf'); h.set('Content-Disposition', `attachment; filename="${baseName}.pdf"`)
          return new NextResponse(new Uint8Array(pdfBuffer), { headers: h })
        }
      } finally { await rm(tmpDir, { recursive: true, force: true }).catch(() => {}) }
    }

    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
  } catch (error) {
    console.error('Class ranking error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur' }, { status: 500 })
  }
}

