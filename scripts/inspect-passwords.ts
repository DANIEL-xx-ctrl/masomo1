import { db } from '../src/lib/db'

async function main() {
  // Users by role with password status
  const users = await db.user.findMany({
    select: { id: true, email: true, username: true, name: true, role: true, password: true, active: true, institutionId: true },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  })

  const byRole: Record<string, { total: number; empty: number; sample: any[] }> = {}
  for (const u of users) {
    if (!byRole[u.role]) byRole[u.role] = { total: 0, empty: 0, sample: [] }
    byRole[u.role].total++
    if (!u.password || u.password.length === 0) byRole[u.role].empty++
    if (byRole[u.role].sample.length < 3) byRole[u.role].sample.push(u)
  }

  console.log('=== Users by role (password status) ===')
  for (const role of Object.keys(byRole).sort()) {
    const r = byRole[role]
    console.log(`\n[${role}] total=${r.total}, empty-password=${r.empty}`)
    r.sample.forEach(u => {
      console.log(`  - email=${u.email || '(none)'}, username=${u.username || '(none)'}, name=${u.name}, active=${u.active}, hasPassword=${!!u.password}`)
    })
  }

  // SuperAdmin
  const sa = await db.superAdmin.findMany({ select: { email: true, name: true, password: true } })
  console.log(`\n[super_admin] total=${sa.length}`)
  sa.forEach(s => console.log(`  - email=${s.email}, name=${s.name}, hasPassword=${!!s.password}`))
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
