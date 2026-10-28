// Migrate subjects with title=null/subtitle=null to have proper (title, subtitle)
// based on their `domain` field, using the same mapping as settings.tsx
// (subToBig) and primary-subjects.ts (T.LANGUES, T.MATH_SCI_TECH, etc.).
//
// Before: name="Expression orale"  domain="Langues congolaises"  title=null  subtitle=null
// After:  name="Expression orale"  domain="Langues congolaises"  title="DOMAINE DES LANGUES"  subtitle="Langues congolaises"

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Mapping from `domain` (the legacy field) to (title, subtitle)
// Matches the subToBig mapping in src/components/modules/settings.tsx
const DOMAIN_TO_TITLE_SUBTITLE = {
  'Langues congolaises': {
    title: 'DOMAINE DES LANGUES',
    subtitle: 'Langues congolaises',
  },
  'Français': {
    title: 'DOMAINE DES LANGUES',
    subtitle: 'Français',
  },
  'Mathématiques': {
    title: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
    subtitle: 'Mathématiques',
  },
  'Sciences': {
    title: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
    subtitle: 'Sciences',
  },
  'Technologie': {
    title: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
    subtitle: 'Technologie',
  },
  'Univers social': {
    title: "DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT",
    subtitle: 'Univers social',
  },
  'Arts': {
    title: 'DOMAINE DES ARTS',
    subtitle: 'Arts',
  },
  'Développement personnel': {
    title: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
    subtitle: 'Développement personnel',
  },
};

const DEFAULT_TITLE_SUBTITLE = {
  title: 'Autres',
  subtitle: 'Autres',
};

(async () => {
  try {
    console.log('=== MIGRATION: add (title, subtitle) to subjects with null ===');
    const nullSubjects = await db.subject.findMany({
      where: { OR: [{ title: null }, { subtitle: null }] },
      select: { id: true, name: true, code: true, degree: true, level: true, title: true, subtitle: true, domain: true }
    });
    console.log(`Found ${nullSubjects.length} subjects with null title/subtitle\n`);

    let updated = 0;
    let defaulted = 0;
    for (const s of nullSubjects) {
      const mapping = (s.domain && DOMAIN_TO_TITLE_SUBTITLE[s.domain]) || DEFAULT_TITLE_SUBTITLE;
      console.log(`Updating: "${s.name}" (code=${s.code}, domain=${JSON.stringify(s.domain)})`);
      console.log(`  → title="${mapping.title}", subtitle="${mapping.subtitle}"`);

      await db.subject.update({
        where: { id: s.id },
        data: {
          title: mapping.title,
          subtitle: mapping.subtitle,
          // Ensure level is set for primary subjects (legacy had level=null sometimes)
          level: s.level || 'primaire',
        },
      });
      if (mapping.title === 'Autres') defaulted++;
      else updated++;
    }

    console.log(`\n=== Migration complete ===`);
    console.log(`Subjects mapped to a structured domain: ${updated}`);
    console.log(`Subjects defaulted to "Autres"/"Autres": ${defaulted}`);
    console.log(`Total updated: ${updated + defaulted}`);

    // Verify
    const remainingNull = await db.subject.count({
      where: { OR: [{ title: null }, { subtitle: null }] }
    });
    console.log(`\nSubjects still with null title/subtitle: ${remainingNull}`);

    // Final summary
    const totalSubjects = await db.subject.count();
    console.log(`Total subjects in DB: ${totalSubjects}`);

    // Show distribution by title
    const distribution = await db.subject.groupBy({
      by: ['title'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    console.log(`\n=== Subjects grouped by title ===`);
    for (const d of distribution) {
      console.log(`  "${d.title}": ${d._count.id} subjects`);
    }
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e);
  } finally {
    await db.$disconnect();
  }
})();
