import { db } from '../src/lib/db'

async function main() {
  const dakar = await db.institution.findFirst({ where: { name: 'Lycée Francophone de Dakar' } })
  console.log('Dakar institution:', dakar?.id)
  
  if (!dakar) {
    console.log('No Dakar institution found')
    return
  }
  
  // Count existing parents and staff
  const parents = await db.parent.count({
    where: { user: { institutionId: dakar.id } }
  })
  const staff = await db.staff.count({
    where: { user: { institutionId: dakar.id } }
  })
  const students = await db.student.count({
    where: { user: { institutionId: dakar.id } }
  })
  
  console.log(`Dakar - Parents: ${parents}, Staff: ${staff}, Students: ${students}`)
  
  // List students with their parentContact info
  const studentList = await db.student.findMany({
    where: { user: { institutionId: dakar.id } },
    include: { user: { select: { email: true } }, class: { select: { name: true } } },
    take: 20,
  })
  
  console.log('\nStudents in Dakar:')
  for (const s of studentList) {
    console.log(`- ${s.firstName} ${s.lastName} (${s.class?.name || 'no class'}) - parent: ${s.parentContact || 'none'} - ${s.parentPhone || 'no phone'} - parentId: ${s.parentId || 'null'}`)
  }
  
  // List existing parents and staff
  const parentList = await db.parent.findMany({
    where: { user: { institutionId: dakar.id } },
    include: { user: { select: { email: true } } }
  })
  console.log('\nParents in Dakar:')
  for (const p of parentList) {
    console.log(`- ${p.firstName} ${p.lastName} - ${p.user?.email} - ${p.phone}`)
  }
  
  const staffList = await db.staff.findMany({
    where: { user: { institutionId: dakar.id } },
    include: { user: { select: { email: true } } }
  })
  console.log('\nStaff in Dakar:')
  for (const s of staffList) {
    console.log(`- ${s.firstName} ${s.lastName} - ${s.fonction} - ${s.user?.email}`)
  }
}

main().catch(console.error).finally(() => process.exit(0))
