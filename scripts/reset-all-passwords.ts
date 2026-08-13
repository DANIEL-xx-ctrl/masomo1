/**
 * Reset ALL users' passwords to known role-based defaults so every account
 * can log in. This is an admin operation for the demo deployment.
 *
 * Password scheme (role → password):
 *   super_admin → super123
 *   admin       → admin123
 *   teacher     → teacher123
 *   student     → student123
 *   parent      → parent123
 *   staff       → staff123
 *
 * Usage:
 *   bun run scripts/reset-all-passwords.ts            # reset everyone
 *   bun run scripts/reset-all-passwords.ts --dry-run  # preview only
 */
import { db } from '../src/lib/db'

const ROLE_PASSWORDS: Record<string, string> = {
  super_admin: 'super123',
  admin: 'admin123',
  teacher: 'teacher123',
  student: 'student123',
  parent: 'parent123',
  staff: 'staff123',
}

const dryRun = process.argv.includes('--dry-run')

async function main() {
  console.log(`=== Reset all passwords to role-based defaults ===`)
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes)' : 'APPLY'}`)
  console.log('')

  // 1. Reset all regular users
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, institution: { select: { name: true } } },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  })

  const stats: Record<string, { total: number; changed: number }> = {}
  for (const u of users) {
    if (!stats[u.role]) stats[u.role] = { total: 0, changed: 0 }
    stats[u.role].total++
  }

  if (dryRun) {
    console.log('=== DRY RUN — would reset these users ===')
    let count = 0
    for (const role of Object.keys(ROLE_PASSWORDS).filter(r => r !== 'super_admin')) {
      const roleUsers = users.filter(u => u.role === role)
      if (roleUsers.length === 0) continue
      console.log(`\n[${role}] → password "${ROLE_PASSWORDS[role]}" (${roleUsers.length} users)`)
      roleUsers.slice(0, 5).forEach(u => {
        const inst = (u.institution as any)?.name || '(no institution)'
        console.log(`  - ${u.email}  (${u.name})  [${inst}]`)
      })
      if (roleUsers.length > 5) console.log(`  ... and ${roleUsers.length - 5} more`)
      count += roleUsers.length
    }
    console.log(`\nTotal users that would be reset: ${count}`)
    return
  }

  // Apply: batch update by role for efficiency
  console.log('=== Resetting regular users ===')
  for (const role of Object.keys(ROLE_PASSWORDS)) {
    if (role === 'super_admin') continue
    const newPassword = ROLE_PASSWORDS[role]
    const result = await db.user.updateMany({
      where: { role },
      data: { password: newPassword },
    })
    stats[role].changed = result.count
    console.log(`  [${role}] → "${newPassword}": ${result.count} users updated`)
  }

  // 2. Reset SuperAdmin
  console.log('\n=== Resetting SuperAdmin ===')
  const saResult = await db.superAdmin.updateMany({
    where: {},
    data: { password: ROLE_PASSWORDS.super_admin },
  })
  console.log(`  [super_admin] → "super123": ${saResult.count} super admin updated`)

  // 3. Summary
  console.log('\n=== SUMMARY ===')
  console.log('Role         | Password    | Users updated')
  console.log('-------------|-------------|---------------')
  for (const role of Object.keys(ROLE_PASSWORDS)) {
    const pw = ROLE_PASSWORDS[role]
    const count = role === 'super_admin' ? saResult.count : (stats[role]?.changed ?? 0)
    console.log(`${role.padEnd(12)} | ${pw.padEnd(11)} | ${count}`)
  }
  const totalReset = Object.values(stats).reduce((s, r) => s + r.changed, 0) + saResult.count
  console.log(`\nTotal passwords reset: ${totalReset}`)
  console.log('\n=== LOGIN CREDENTIALS (role → password) ===')
  console.log('  super_admin → super123')
  console.log('  admin       → admin123')
  console.log('  teacher     → teacher123')
  console.log('  student     → student123')
  console.log('  parent      → parent123')
  console.log('  staff       → staff123')
  console.log('\nUsers log in with their EMAIL + the role password above.')
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e); process.exit(1) })
