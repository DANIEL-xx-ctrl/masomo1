import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const status = searchParams.get('status')
    const schoolYear = searchParams.get('schoolYear')

    const where: Record<string, unknown> = {}

    if (studentId) where.studentId = studentId
    if (status) where.status = status
    if (schoolYear) where.schoolYear = schoolYear

    const payments = await db.payment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            updatedAt: true,
            class: {
              select: { id: true, name: true, level: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paiements' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  // Only admin or super_admin can create payments
  const forbidden = checkAdminOrSuperAdmin(request)
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const {
      studentId,
      amount,
      type,
      method,
      status,
      reference,
      description,
      schoolYear,
      paymentDate,
    } = body

    if (!studentId || amount === undefined || !type || !method) {
      return NextResponse.json(
        { error: 'studentId, amount, type et method requis' },
        { status: 400 }
      )
    }

    const validMethods = ['cash', 'mobile_money', 'bank_transfer']
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Méthode invalide. Méthodes acceptées: ${validMethods.join(', ')}` },
        { status: 400 }
      )
    }

    const payment = await db.payment.create({
      data: {
        studentId,
        amount: parseFloat(String(amount)),
        type,
        method,
        status: status || 'pending',
        reference,
        description,
        schoolYear: schoolYear || '2024-2025',
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    )
  }
}
