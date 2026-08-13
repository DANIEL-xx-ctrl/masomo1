'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { UserPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ---------- Types ----------

interface Enrollment {
  id: string
  studentId: string
  firstName: string
  lastName: string
  gender: string | null
  dateOfBirth: string | null
  className: string
  enrolledAt: string
}

// ---------- Animation variants ----------

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

// ---------- Component ----------

export default function EnrollmentsTable({
  recentEnrollments,
  schoolYear,
}: {
  recentEnrollments: Enrollment[]
  schoolYear: string
}) {
  const [enrollPage, setEnrollPage] = useState(1)
  const ENROLLMENTS_PER_PAGE = 10

  const safeEnroll = Array.isArray(recentEnrollments) ? recentEnrollments : []
  if (safeEnroll.length === 0) return null

  const totalPages = Math.max(1, Math.ceil(safeEnroll.length / ENROLLMENTS_PER_PAGE))
  const startIdx = (enrollPage - 1) * ENROLLMENTS_PER_PAGE
  const pageData = safeEnroll.slice(startIdx, startIdx + ENROLLMENTS_PER_PAGE)

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Nouveaux inscrits — {schoolYear}
            <Badge variant="secondary" className="ml-auto text-xs">
              {safeEnroll.length} élève{safeEnroll.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">#</th>
                  <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Nom complet</th>
                  <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Genre</th>
                  <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Classe</th>
                  <th className="pb-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Naissance</th>
                  <th className="pb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((student, idx) => (
                  <tr key={student.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">{startIdx + idx + 1}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${student.gender === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-sky-100 text-sky-600'}`}>
                          {student.firstName?.[0] || '?'}{student.lastName?.[0] || '?'}
                        </div>
                        <span className="text-sm font-medium">{student.firstName} {student.lastName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs ${student.gender === 'F' ? 'text-pink-600' : 'text-sky-600'}`}>
                        {student.gender === 'F' ? 'F' : student.gender === 'M' ? 'M' : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{student.className}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                      {student.dateOfBirth ? new Date(student.dateOfBirth + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {new Date(student.enrolledAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 mt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {startIdx + 1}–{Math.min(startIdx + ENROLLMENTS_PER_PAGE, safeEnroll.length)} / {safeEnroll.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEnrollPage(enrollPage - 1)} disabled={enrollPage === 1}>
                  <ChevronLeft className="w-3 h-3" /> Préc.
                </Button>
                <span className="text-xs font-medium px-2">{enrollPage} / {totalPages}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEnrollPage(enrollPage + 1)} disabled={enrollPage === totalPages}>
                  Suiv. <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
