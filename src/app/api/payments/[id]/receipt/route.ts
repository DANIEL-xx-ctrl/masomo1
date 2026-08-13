import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  tuition: 'Frais de scolarité',
  registration: "Frais d'inscription",
  exam_fee: "Frais d'examen",
  other: 'Autres',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Virement bancaire',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  completed: 'Complété',
  failed: 'Échoué',
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * GET /api/payments/[id]/receipt
 * Returns the full receipt data (institution + payment + student) needed by the
 * frontend to render print-ready receipts in any format (A4, A5, thermal 80mm).
 *
 * IMPORTANT (v1.25.1): This route previously trusted the `x-user-role` and
 * `x-institution-id` request headers blindly. On mobile / fresh browsers the
 * client-side Zustand store can momentarily be un-hydrated when the receipt
 * fetch fires, causing those headers to arrive empty. An empty `x-user-role`
 * made `isPrivileged` false, the institution fell back to "first active
 * institution", and any payment belonging to a *different* institution was
 * rejected with 404 "Paiement introuvable dans votre institution" — even for
 * logged-in admins. To make the route robust, we now resolve the requester's
 * real role + institutionId from the database via `x-user-id` whenever the
 * role header is missing, and we treat any authenticated admin/super_admin as
 * privileged regardless of the header.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID du paiement requis' },
        { status: 400 }
      )
    }

    // ---- Resolve the requester's identity robustly ----
    // Headers are the fast path. When the role header is missing/empty (e.g.
    // mobile hydration race), fall back to a DB lookup via x-user-id so we
    // never wrongly scope a privileged user to the wrong institution.
    let userRole = request.headers.get('x-user-role') || ''
    let resolvedInstitutionId = request.headers.get('x-institution-id') || ''
    const headerUserId = request.headers.get('x-user-id') || ''

    if ((!userRole || !resolvedInstitutionId) && headerUserId) {
      const dbUser = await db.user.findUnique({
        where: { id: headerUserId },
        select: { role: true, institutionId: true },
      })
      if (dbUser) {
        if (!userRole) userRole = dbUser.role
        if (!resolvedInstitutionId) resolvedInstitutionId = dbUser.institutionId || ''
      }
    }

    const isPrivileged = userRole === 'admin' || userRole === 'super_admin'

    // Final institution scope — used for non-privileged lookups and for the
    // institution header shown on the receipt.
    const institutionId =
      resolvedInstitutionId ||
      (await getInstitutionIdWithFallback(request))

    // IDOR protection: fetch the payment. For non-privileged users, only
    // return the payment if it belongs to their institution. Privileged users
    // (admin / super_admin) can view any receipt — mirrors /api/payments GET
    // which already lists all payments without an institution filter.
    const payment = await db.payment.findFirst({
      where: isPrivileged
        ? { id }
        : {
            id,
            student: { user: { institutionId } },
          },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            image: true,
            gender: true,
            classId: true,
            class: { select: { name: true } },
            user: { select: { email: true, phone: true, userCode: true, institutionId: true } },
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Paiement introuvable dans votre institution' },
        { status: 404 }
      )
    }

    // Fetch the institution info — prefer the payment's actual institution
    // (so a privileged admin viewing a receipt from another institution sees
    // the correct header), fall back to the requester's institution, then to
    // the active institution.
    const paymentInstitutionId =
      payment.student?.user?.institutionId || institutionId
    const institution = paymentInstitutionId && paymentInstitutionId !== 'inst_default'
      ? await db.institution.findUnique({
          where: { id: paymentInstitutionId },
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
            logo: true,
            currentYear: true,
          },
        })
      : null

    // Generate a human-readable receipt number from the payment id + createdAt
    const receiptNumber = `REC-${payment.id.slice(-8).toUpperCase()}`
    const generatedAt = new Date().toISOString()

    const receipt = {
      receiptNumber,
      generatedAt,
      institution: institution
        ? {
            name: institution.name,
            address: institution.address,
            phone: institution.phone,
            email: institution.email,
            logo: institution.logo,
            currentYear: institution.currentYear,
          }
        : {
            name: 'Établissement',
            address: null,
            phone: null,
            email: null,
            logo: null,
            currentYear: payment.schoolYear,
          },
      payment: {
        id: payment.id,
        amount: payment.amount,
        amountFormatted: formatCurrency(payment.amount),
        type: payment.type,
        typeLabel: PAYMENT_TYPE_LABELS[payment.type] || payment.type,
        method: payment.method,
        methodLabel: PAYMENT_METHOD_LABELS[payment.method] || payment.method,
        status: payment.status,
        statusLabel: PAYMENT_STATUS_LABELS[payment.status] || payment.status,
        reference: payment.reference,
        description: payment.description,
        schoolYear: payment.schoolYear,
        paymentDate: payment.paymentDate,
        paymentDateFormatted: payment.paymentDate
          ? formatDate(payment.paymentDate)
          : formatDate(payment.createdAt.toISOString()),
        createdAt: payment.createdAt.toISOString(),
        createdAtFormatted: formatDateTime(payment.createdAt.toISOString()),
      },
      student: {
        id: payment.student.id,
        firstName: payment.student.firstName,
        lastName: payment.student.lastName,
        fullName: `${payment.student.firstName} ${payment.student.lastName}`,
        image: payment.student.image,
        gender: payment.student.gender,
        className: payment.student.class?.name || null,
        email: payment.student.user?.email || null,
        phone: payment.student.user?.phone || null,
        userCode: payment.student.user?.userCode || null,
      },
    }

    return NextResponse.json({ receipt })
  } catch (error) {
    console.error('Get receipt error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du reçu' },
      { status: 500 }
    )
  }
}
