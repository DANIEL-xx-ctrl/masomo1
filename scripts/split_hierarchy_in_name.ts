/**
 * Fix subjects whose name encodes the full hierarchy:
 *   "DOMAINE DES LANGUES-LANGUES CONGOLAISES-Expression orale"
 *   → title="DOMAINE DES LANGUES"
 *     subtitle="Langues congolaises"
 *     name="Expression orale"
 */
import { db } from '../src/lib/db'

const TITLE_PREFIXES = [
  'DOMAINE DES LANGUES',
  'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
  'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT',
  'DOMAINE DES ARTS',
  'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
  'DOMAINE DE DEVELOPPEMENT PERSONNEL', // common typo
  'DOMIANE DE DEVELOPPEMENT PERSONNEL', // typo variant
  'DOMAINE DES MATHÉMATIQUES',
  'DOMAINE DES SCIENCES',
]

/** Normalize a string: uppercase, no accents, single spaces. */
function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  // Find subjects whose name starts with "DOMAINE" or "DOMIANE"
  const candidates = await db.subject.findMany({
    where: {
      OR: [
        { name: { startsWith: 'DOMAINE' } },
        { name: { startsWith: 'DOMIANE' } },
      ],
    },
    select: { id: true, name: true, title: true, subtitle: true },
  })

  console.log(`Found ${candidates.length} candidates with hierarchy in name`)

  for (const s of candidates) {
    console.log(`\n  Original: "${s.name}"`)

    // Try to split on dash separators (—, –, -, —)
    // Pattern: "TITLE-SUBTITLE-MATIERE" or "TITLE-SUBTITLE—MATIERE" etc.
    // Split on any dash followed by uppercase OR followed by anything
    const parts = s.name.split(/\s*[-—–]\s*/).filter((p) => p.trim().length > 0)
    console.log(`  Parts (${parts.length}): ${JSON.stringify(parts)}`)

    if (parts.length >= 3) {
      // First part is title, second is subtitle, rest joined is matière
      const title = parts[0].trim()
      const subtitle = parts[1].trim()
      const matiere = parts.slice(2).join(' — ').trim()
      console.log(`  → title="${title}", subtitle="${subtitle}", name="${matiere}"`)
      await db.subject.update({
        where: { id: s.id },
        data: { title, subtitle, name: matiere },
      })
    } else if (parts.length === 2) {
      // "TITLE-SUBTITLE/MATIERE" — second part is the matière, title is first
      // Try to match the title against known titles
      const firstNorm = normalize(parts[0])
      const matchedTitle = TITLE_PREFIXES.find((t) => normalize(t) === firstNorm)
      if (matchedTitle) {
        // The second part is "SUBTITLE-MATIERE" or just "MATIERE"
        // Check if it matches a known subtitle pattern
        const secondPart = parts[1].trim()
        const knownSubtitles = ['Langues congolaises', 'Français', 'Mathématiques', 'Sciences', 'Technologie', 'Univers social', 'Arts', 'Développement personnel']
        const matchedSubtitle = knownSubtitles.find((sub) => normalize(secondPart).startsWith(normalize(sub)))
        if (matchedSubtitle) {
          const matiere = secondPart.slice(matchedSubtitle.length).replace(/^[-—–\s]+/, '').trim() || matchedSubtitle
          console.log(`  → title="${matchedTitle}", subtitle="${matchedSubtitle}", name="${matiere}"`)
          await db.subject.update({
            where: { id: s.id },
            data: { title: matchedTitle, subtitle: matchedSubtitle, name: matiere },
          })
        } else {
          // No subtitle match — treat second part as matière, leave title
          console.log(`  → title="${matchedTitle}", subtitle=null, name="${secondPart}"`)
          await db.subject.update({
            where: { id: s.id },
            data: { title: matchedTitle, name: secondPart },
          })
        }
      } else {
        console.log(`  → No title match, skipping`)
      }
    } else {
      console.log(`  → Not enough parts, skipping`)
    }
  }

  // Final summary
  const finalCount = await db.subject.count({ where: { OR: [{ title: null }, { subtitle: null }] } })
  console.log(`\n=== Final null count: ${finalCount} ===`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
