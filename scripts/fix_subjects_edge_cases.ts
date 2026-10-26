/**
 * Fix edge cases: uppercase subtitles "FRANCAIS" / "MATHEMATIQUES" → proper
 * title + subtitle.
 */
import { db } from '../src/lib/db'

async function main() {
  // Subjects with uppercase subtitle and no title
  const fixes: Array<{ from: string; toTitle: string; toSubtitle: string }> = [
    { from: 'FRANCAIS', toTitle: 'DOMAINE DES LANGUES', toSubtitle: 'Français' },
    { from: 'MATHEMATIQUES', toTitle: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE', toSubtitle: 'Mathématiques' },
  ]

  for (const fix of fixes) {
    const result = await db.subject.updateMany({
      where: { subtitle: fix.from },
      data: { title: fix.toTitle, subtitle: fix.toSubtitle },
    })
    console.log(`Fixed ${result.count} subjects with subtitle "${fix.from}" → "${fix.toSubtitle}" (title: ${fix.toTitle})`)
  }

  // Subjects with null title and null subtitle (3 remaining) — try to derive from name
  const nullSubjects = await db.subject.findMany({
    where: { title: null, subtitle: null },
    select: { id: true, name: true, level: true, degree: true },
  })
  console.log(`\nSubjects with null title/subtitle (${nullSubjects.length}):`)
  for (const s of nullSubjects) {
    console.log(`  - id=${s.id} name="${s.name}" level=${s.level} degree=${s.degree}`)
    // Set default to "Autres" / "Autres"
    await db.subject.update({
      where: { id: s.id },
      data: { title: 'Autres', subtitle: 'Autres' },
    })
  }
  console.log(`  → Set all to "Autres" / "Autres"`)

  // Final summary
  const totalNull = await db.subject.count({ where: { OR: [{ title: null }, { subtitle: null }] } })
  console.log(`\nFinal null count: ${totalNull}`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
