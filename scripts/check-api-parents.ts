import { db } from '../src/lib/db'

async function main() {
  const dakar = await db.institution.findFirst({ where: { name: 'Lycée Francophone de Dakar' } })
  if (!dakar) { console.log('No Dakar'); return }
  
  // Simulate the exact query from the parents route
  const parents = await db.parent.findMany({
    where: { user: { institutionId: dakar.id } },
    include: {
      user: {
        select: { id: true, email: true, phone: true, active: true, institutionId: true, avatar: true },
      },
      children: {
        include: {
          class: { select: { id: true, name: true, schoolYear: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  })
  
  console.log('First parent from DB query:')
  console.log(JSON.stringify(parents[0], null, 2))
}

main().catch(console.error).finally(() => process.exit(0))
