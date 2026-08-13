import { db } from '../src/lib/db'

async function main() {
  const dakar = await db.institution.findFirst({ where: { name: 'Lycée Francophone de Dakar' } })
  if (!dakar) { console.log('No Dakar'); return }
  
  const parents = await db.parent.findMany({
    where: { user: { institutionId: dakar.id } },
    take: 3,
    select: { id: true, firstName: true, lastName: true, image: true }
  })
  
  console.log('Parent records with image field:')
  for (const p of parents) {
    console.log(`- ${p.firstName} ${p.lastName}: image=${p.image || 'null'}`)
  }
}

main().catch(console.error).finally(() => process.exit(0))
