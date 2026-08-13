// ============================================================================
// fix-institution-name.ts
// ============================================================================
// Corrige les institutions créées AVANT le correctif v1.20.0 qui s'appellent
// encore "Mon Établissement" (placeholder codé en dur dans l'ancien formulaire
// d'inscription).
//
// AVANT le correctif : le formulaire d'inscription ne demandait que le
//   "Nom complet" de l'admin. L'institution était créée avec le nom codé en dur
//   "Mon Établissement". Donc si vous aviez tapé "ECOLE PRIMAIRE 1" dans le
//   champ "Nom complet", ce nom est allé dans le profil admin, PAS dans
//   l'institution.
// APRÈS le correctif (v1.20.0) : le formulaire demande séparément le
//   "Nom de l'établissement" et le "Nom complet", et l'API utilise le bon.
//
// Ce script est IDEMPOTENT : il peut être lancé plusieurs fois sans danger.
//
// Usage :
//   1) Mode automatique (recommandé) — renomme chaque "Mon Établissement"
//      en utilisant le nom de l'admin lié (puisque c'est là que le nom de
//      l'école avait été tapé) :
//
//         bun run scripts/fix-institution-name.ts
//
//   2) Mode explicite — force un nom précis pour un email admin précis :
//
//         bun run scripts/fix-institution-name.ts --email=danitresm@gmail.com --name="ECOLE PRIMAIRE 1"
//
//   3) Mode liste — affiche juste ce qui serait renommé (dry-run) :
//
//         bun run scripts/fix-institution-name.ts --dry-run
//
// ============================================================================

import { db } from '../src/lib/db'

interface Args {
  email?: string
  name?: string
  dryRun: boolean
}

function parseArgs(): Args {
  const args: Args = { dryRun: false }
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run' || a === '-n') {
      args.dryRun = true
    } else if (a.startsWith('--email=')) {
      args.email = a.slice('--email='.length).trim().toLowerCase()
    } else if (a.startsWith('--name=')) {
      args.name = a.slice('--name='.length).trim()
    }
  }
  return args
}

async function main() {
  const args = parseArgs()

  console.log('═'.repeat(70))
  console.log('  Correction des institutions "Mon Établissement"')
  console.log('═'.repeat(70))

  if (args.dryRun) {
    console.log('  MODE : DRY-RUN (aucune modification ne sera effectuée)\n')
  } else if (args.email && args.name) {
    console.log(`  MODE : explicite`)
    console.log(`  Email admin : ${args.email}`)
    console.log(`  Nouveau nom : "${args.name}"\n`)
  } else {
    console.log('  MODE : automatique (utilise le nom de l\'admin)\n')
  }

  // ----------------------------------------------------------------
  // Cas 1 : mode explicite (--email + --name)
  // ----------------------------------------------------------------
  if (args.email && args.name && !args.dryRun) {
    const user = await db.user.findUnique({
      where: { email: args.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        institutionId: true,
        institution: { select: { id: true, name: true } },
      },
    })

    if (!user) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email : ${args.email}`)
      process.exit(1)
    }
    if (!user.institutionId || !user.institution) {
      console.error(`❌ L'utilisateur ${args.email} n'est lié à aucune institution.`)
      process.exit(1)
    }

    const oldName = user.institution.name
    console.log(`Institution trouvée :`)
    console.log(`  ID         : ${user.institution.id}`)
    console.log(`  Ancien nom : "${oldName}"`)
    console.log(`  Nouveau nom : "${args.name}"`)

    if (oldName === args.name) {
      console.log('\n✓ Le nom est déjà correct. Aucune modification nécessaire.')
      return
    }

    // Update Institution
    const updated = await db.institution.update({
      where: { id: user.institution.id },
      data: { name: args.name },
    })

    // Mirror into SchoolConfig (garde l'affichage cohérent partout)
    await db.schoolConfig.updateMany({
      where: { institutionId: user.institution.id },
      data: { schoolName: args.name },
    })

    console.log(`\n✅ Institution renommée : "${oldName}" → "${updated.name}"`)
    console.log('   La modification est visible immédiatement dans :')
    console.log('   - Dashboard admin')
    console.log('   - Liste du Super Admin')
    console.log('   - Bulletins, paramètres, etc.')
    return
  }

  // ----------------------------------------------------------------
  // Cas 2 : mode automatique ou dry-run
  // ----------------------------------------------------------------
  const broken = await db.institution.findMany({
    where: { name: 'Mon Établissement' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      users: {
        where: { role: 'admin' },
        select: { id: true, name: true, email: true, userCode: true },
        take: 1,
      },
      _count: { select: { classes: true, users: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (broken.length === 0) {
    console.log('✅ Aucune institution "Mon Établissement" trouvée. Tout est OK !')
    return
  }

  console.log(`Institutions "Mon Établissement" trouvées : ${broken.length}\n`)
  console.log('─'.repeat(70))

  let fixed = 0
  let skipped = 0

  for (let i = 0; i < broken.length; i++) {
    const inst = broken[i]
    const admin = inst.users[0]

    console.log(`\n#${i + 1}`)
    console.log(`  ID         : ${inst.id}`)
    console.log(`  Créée le   : ${inst.createdAt.toISOString()}`)
    console.log(`  Admin      : ${admin?.name || '(aucun)'} <${admin?.email || '(aucun)'}>`)
    console.log(`  Stats      : ${inst._count.classes} classe(s), ${inst._count.users} utilisateur(s)`)

    // Si on a un email filter et que ça ne correspond pas, on skip
    if (args.email && admin?.email.toLowerCase() !== args.email) {
      console.log(`  → IGNORÉ (ne correspond pas à --email=${args.email})`)
      skipped++
      continue
    }

    // Déterminer le nouveau nom
    let newName: string | undefined
    if (args.name) {
      newName = args.name
    } else if (admin?.name && admin.name.trim() && admin.name !== 'Mon Établissement') {
      // Utiliser le nom de l'admin (c'est là que le nom de l'école a été tapé)
      newName = admin.name.trim()
    } else {
      console.log('  → IGNORÉ (aucun nom d\'admin pour déduire le nom de l\'institution)')
      skipped++
      continue
    }

    console.log(`  Nouveau nom : "${newName}"`)

    if (args.dryRun) {
      console.log('  → [DRY-RUN] serait renommé')
      continue
    }

    // Update Institution
    await db.institution.update({
      where: { id: inst.id },
      data: { name: newName },
    })

    // Mirror into SchoolConfig
    await db.schoolConfig.updateMany({
      where: { institutionId: inst.id },
      data: { schoolName: newName },
    })

    console.log(`  → ✅ RENOMMÉ`)
    fixed++
  }

  console.log('\n' + '═'.repeat(70))
  console.log('  RÉCAPITULATIF')
  console.log('═'.repeat(70))
  console.log(`  Total "Mon Établissement" trouvées : ${broken.length}`)
  if (args.dryRun) {
    console.log(`  Mode dry-run                        : aucune modification`)
  } else {
    console.log(`  Renommées                           : ${fixed}`)
    console.log(`  Ignorées                            : ${skipped}`)
  }
  console.log()

  if (!args.dryRun && fixed > 0) {
    // Vérification finale
    const remaining = await db.institution.count({ where: { name: 'Mon Établissement' } })
    if (remaining === 0) {
      console.log('✅ Plus aucune institution "Mon Établissement" dans la base. Tout est corrigé !')
    } else {
      console.log(`⚠️  Il reste encore ${remaining} institution(s) "Mon Établissement".`)
      console.log('   Relancez le script en mode explicite pour les corriger :')
      console.log('   bun run scripts/fix-institution-name.ts --email=EMAIL --name="NOM"')
    }
  }
}

main()
  .catch((e) => {
    console.error('Erreur fatale :', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
