/**
 * Cleanup: fix title typo "DOMIANE" → "DOMAINE", normalize uppercase subtitles.
 */
import { db } from '../src/lib/db'

async function main() {
  // Fix typo
  const typoFix = await db.subject.updateMany({
    where: { title: { startsWith: 'DOMIANE' } },
    data: { title: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL' },
  })
  console.log(`Fixed ${typoFix.count} subjects with "DOMIANE" typo`)

  // Normalize uppercase subtitles to title case
  const subtitleMap: Record<string, string> = {
    'LANGUES CONGOLAISES': 'Langues congolaises',
    'FRANCAIS': 'Français',
    'MATHEMATIQUES': 'Mathématiques',
    'SCIENCES': 'Sciences',
    'TECHNOLOGIE': 'Technologie',
    'UNIVERS SOCIAL': 'Univers social',
    'ARTS': 'Arts',
    'DEVELOPPEMENT PERSONNEL': 'Développement personnel',
  }
  for (const [from, to] of Object.entries(subtitleMap)) {
    const r = await db.subject.updateMany({
      where: { subtitle: from },
      data: { subtitle: to },
    })
    if (r.count > 0) console.log(`Normalized ${r.count} subtitles "${from}" → "${to}"`)
  }

  // Final summary
  const summary = await db.subject.groupBy({
    by: ['title', 'subtitle'],
    _count: { id: true },
    orderBy: [{ title: 'asc' }, { subtitle: 'asc' }],
  })
  console.log(`\n=== Final hierarchy (${summary.length} groups) ===`)
  for (const g of summary) {
    console.log(`  [${g.title || 'null'}] → [${g.subtitle || 'null'}]: ${g._count.id} subjects`)
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
