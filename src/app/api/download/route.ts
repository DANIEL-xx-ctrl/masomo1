import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const userRole = request.headers.get('x-user-role')
    const institutionId = request.headers.get('x-institution-id')

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { format, dataType, filters } = body

    if (!format || !dataType) {
      return NextResponse.json(
        { error: 'Format et type de données requis' },
        { status: 400 }
      )
    }

    let data: Record<string, unknown>[] = []

    switch (dataType) {
      case 'students': {
        const where: Record<string, unknown> = {}
        if (userRole === 'admin' && institutionId) {
          where.user = { institutionId }
        }
        if (filters?.classId) where.classId = filters.classId

        const students = await db.student.findMany({
          where,
          include: {
            user: { select: { email: true, phone: true, active: true } },
            class: { select: { name: true, level: true } },
          },
          orderBy: { lastName: 'asc' },
        })

        data = students.map((s) => ({
          'Prénom': s.firstName,
          'Nom': s.lastName,
          'Email': s.user.email,
          'Téléphone': s.user.phone || s.phone || '',
          'Genre': s.gender || '',
          'Date de naissance': s.dateOfBirth || '',
          'Classe': s.class?.name || '',
          'Niveau': s.class?.level || '',
          'Contact parent': s.parentContact || '',
          'Téléphone parent': s.parentPhone || '',
          'Date inscription': s.enrollmentDate,
          'Actif': s.user.active ? 'Oui' : 'Non',
        }))
        break
      }

      case 'teachers': {
        const teachers = await db.teacher.findMany({
          include: {
            user: { select: { email: true, phone: true, active: true } },
          },
          orderBy: { lastName: 'asc' },
        })

        data = teachers.map((t) => ({
          'Prénom': t.firstName,
          'Nom': t.lastName,
          'Email': t.user.email,
          'Téléphone': t.phone || t.user.phone || '',
          'Matière': t.subject,
          'Qualification': t.qualification || '',
          'Date embauche': t.hireDate,
          'Actif': t.user.active ? 'Oui' : 'Non',
        }))
        break
      }

      case 'grades': {
        const where: Record<string, unknown> = {}
        if (filters?.classId) where.classId = filters.classId
        if (filters?.trimester) where.trimester = filters.trimester
        if (filters?.subjectId) where.subjectId = filters.subjectId

        const grades = await db.grade.findMany({
          where,
          include: {
            student: { select: { firstName: true, lastName: true } },
            subject: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })

        data = grades.map((g) => ({
          'Élève': `${g.student.firstName} ${g.student.lastName}`,
          'Matière': g.subject.name,
          'Note': g.value,
          'Note max': g.maxValue,
          'Type': g.type,
          'Trimestre': g.trimester,
          'Date': g.date,
          'Commentaire': g.comment || '',
        }))
        break
      }

      case 'payments': {
        const where: Record<string, unknown> = {}
        if (filters?.status) where.status = filters.status

        const payments = await db.payment.findMany({
          where,
          include: {
            student: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })

        data = payments.map((p) => ({
          'Élève': `${p.student.firstName} ${p.student.lastName}`,
          'Montant': p.amount,
          'Type': p.type,
          'Méthode': p.method,
          'Statut': p.status,
          'Référence': p.reference || '',
          'Description': p.description || '',
          'Année scolaire': p.schoolYear,
          'Date paiement': p.paymentDate || '',
        }))
        break
      }

      case 'attendance': {
        const where: Record<string, unknown> = {}
        if (filters?.date) where.date = filters.date

        const attendance = await db.attendance.findMany({
          where,
          include: {
            student: { select: { firstName: true, lastName: true } },
          },
          orderBy: { date: 'desc' },
          take: 500,
        })

        data = attendance.map((a) => ({
          'Élève': `${a.student.firstName} ${a.student.lastName}`,
          'Date': a.date,
          'Statut': a.status,
          'Commentaire': a.comment || '',
        }))
        break
      }

      default:
        return NextResponse.json(
          { error: 'Type de données non supporté' },
          { status: 400 }
        )
    }

    if (format === 'json') {
      return NextResponse.json({ data, dataType, count: data.length })
    }

    // For CSV/Excel format, return as JSON with a flag indicating format
    // The frontend will handle the actual file generation
    return NextResponse.json({
      data,
      dataType,
      format,
      count: data.length,
    })
  } catch (error) {
    console.error('Download/export error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'export des données' },
      { status: 500 }
    )
  }
}
