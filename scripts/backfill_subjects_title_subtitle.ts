/**
 * Backfill script: populate `title` and `subtitle` for existing Subject records
 * based on the current `domain` field value and the `name`.
 *
 * Strategy:
 *   - If `domain` starts with "DOMAINE" (case-insensitive), it's a TITLE:
 *       title = domain
 *       subtitle = first token of `name` before "—" or the whole name
 *   - Else, `domain` is a SUBTITLE (legacy data):
 *       subtitle = domain
 *       title = SUB_TO_BIG[domain] (or null if unknown)
 *   - If `domain` is null:
 *       title = null, subtitle = null
 *
 * Run with:  npx tsx scripts/backfill_subjects_title_subtitle.ts
 */
import { db } from '../src/lib/db'

/** Map subtitle → title (RDC primary school domains). */
const SUB_TO_BIG: Record<string, string> = {
  'Langues congolaises': 'DOMAINE DES LANGUES',
  'Français': 'DOMAINE DES LANGUES',
  'Mathématiques': 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
  'Sciences': 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
  'Technologie': 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
  'Univers social': "DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT",
  'Arts': 'DOMAINE DES ARTS',
  'Développement personnel': 'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
  'Autres': 'Autres',
}

/** Try to extract a subtitle from a subject name like "Français — Composition / Rédaction".
 *  Returns the part before the dash, trimmed, or null if no dash. */
function extractSubtitleFromName(name: string): string | null {
  const m = name.match(/^([^\s—–-]+)\s*[—–-]/)
  if (m && m[1].trim()) return m[1].trim()
  return null
}

async function main() {
  const subjects = await db.subject.findMany({
    select: { id: true, name: true, domain: true, title: true, subtitle: true },
  })
  console.log(`Found ${subjects.length} subjects to backfill`)

  let updated = 0
  let skipped = 0
  for (const s of subjects) {
    // Skip if both title and subtitle are already set
    if (s.title && s.subtitle) {
      skipped++
      continue
    }

    let title: string | null = s.title
    let subtitle: string | null = s.subtitle
    const domain = s.domain?.trim() || null

    if (domain) {
      if (domain.toUpperCase().startsWith('DOMAINE')) {
        // domain is a TITLE
        title = title || domain
        if (!subtitle) {
          // Try to derive subtitle from name
          subtitle = extractSubtitleFromName(s.name) || domain
        }
      } else {
        // domain is a SUBTITLE (legacy data)
        subtitle = subtitle || domain
        if (!title) {
          title = SUB_TO_BIG[domain] || null
          // If no mapping found, try to derive title from name → SUB_TO_BIG
          if (!title) {
            const fromName = extractSubtitleFromName(s.name)
            if (fromName && SUB_TO_BIG[fromName]) {
              title = SUB_TO_BIG[fromName]
            }
          }
        }
      }
    } else {
      // No domain — try to derive from name
      const fromName = extractSubtitleFromName(s.name)
      if (fromName) {
        subtitle = subtitle || fromName
        title = title || SUB_TO_BIG[fromName] || null
      }
    }

    // Only update if something changed
    if (title !== s.title || subtitle !== s.subtitle) {
      await db.subject.update({
        where: { id: s.id },
        data: { title, subtitle },
      })
      updated++
    } else {
      skipped++
    }
  }

  console.log(`\nBackfill complete:`)
  console.log(`  - Updated: ${updated}`)
  console.log(`  - Skipped (already had title+subtitle): ${skipped}`)

  // Show summary
  const summary = await db.subject.groupBy({
    by: ['title', 'subtitle'],
    _count: { id: true },
    orderBy: { title: 'asc' },
  })
  console.log(`\nHierarchy summary (${summary.length} groups):`)
  for (const g of summary.slice(0, 30)) {
    console.log(`  [${g.title || 'null'}] → [${g.subtitle || 'null'}]: ${g._count.id} subjects`)
  }
  if (summary.length > 30) {
    console.log(`  ... and ${summary.length - 30} more groups`)
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
