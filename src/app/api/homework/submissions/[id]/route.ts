import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getInstitutionIdWithFallback } from '@/lib/api-auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const institutionId = await getInstitutionIdWithFallback(request)
    const userRole = request.headers.get('x-user-role')
    // Super admin has full CRUD power on every page; admin & teacher can grade submissions
    if (userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { grade, comment, status, maxGrade } = body

    const existing = await db.homeworkSubmission.findFirst({ where: { id, homework: { institutionId } } })
    if (!existing) {
      return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 })
    }

    const submission = await db.homeworkSubmission.update({
      where: { id },
      data: {
        ...(grade !== undefined && { grade }),
        ...(comment !== undefined && { comment: comment || null }),
        ...(status !== undefined && { status }),
        ...(maxGrade !== undefined && { maxGrade }),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Update submission error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
