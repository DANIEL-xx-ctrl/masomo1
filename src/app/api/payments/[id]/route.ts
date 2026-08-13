import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkAdminOrSuperAdmin } from '@/lib/auth-guards'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            class: {
              select: { name: true, level: true },
            },
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Get payment error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du paiement' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only admin or super_admin can edit payments
  const forbidden = checkAdminOrSuperAdmin(request)
  if (forbidden) return forbidden

  try {
    const { id } = await params
    const body = await request.json()
    const {
      amount,
      type,
      method,
      status,
      reference,
      description,
      paymentDate,
    } = body

    // Verify payment exists
    const existing = await db.payment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      )
    }

    // Validate method if provided
    if (method) {
      const validMethods = ['cash', 'mobile_money', 'bank_transfer']
      if (!validMethods.includes(method)) {
        return NextResponse.json(
          { error: `Méthode invalide. Méthodes acceptées: ${validMethods.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['pending', 'completed', 'failed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Statut invalide. Statuts acceptés: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate amount if provided
    if (amount !== undefined) {
      const numAmount = parseFloat(String(amount))
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: 'Le montant doit être supérieur à 0' },
          { status: 400 }
        )
      }
    }

    const payment = await db.payment.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount: parseFloat(String(amount)) }),
        ...(type && { type }),
        ...(method && { method }),
        ...(status && { status }),
        ...(reference !== undefined && { reference }),
        ...(description !== undefined && { description }),
        ...(paymentDate !== undefined && { paymentDate }),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Update payment error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du paiement' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only admin or super_admin can delete payments
  const forbidden = checkAdminOrSuperAdmin(request)
  if (forbidden) return forbidden

  try {
    const { id } = await params

    // Verify payment exists
    const existing = await db.payment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      )
    }

    await db.payment.delete({ where: { id } })

    return NextResponse.json({ message: 'Paiement supprimé avec succès' })
  } catch (error) {
    console.error('Delete payment error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du paiement' },
      { status: 500 }
    )
  }
}
