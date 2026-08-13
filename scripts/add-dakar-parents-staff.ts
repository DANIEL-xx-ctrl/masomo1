import { db } from '../src/lib/db'
import fs from 'fs'
import path from 'path'

/**
 * Add parents and staff for the "Lycée Francophone de Dakar" institution.
 * - Creates a Parent record for each student's parentContact/parentPhone
 * - Links students to their parents via parentId
 * - Creates several Staff members with various functions
 * - Uploads avatars to MediaFile and assigns them to users
 */
async function main() {
  const dakar = await db.institution.findFirst({ where: { name: 'Lycée Francophone de Dakar' } })
  if (!dakar) {
    console.error('❌ Institution "Lycée Francophone de Dakar" not found')
    process.exit(1)
  }
  console.log(`✅ Found institution: ${dakar.name} (${dakar.id})`)

  // Get all Dakar students
  const students = await db.student.findMany({
    where: { user: { institutionId: dakar.id } },
    include: { user: { select: { email: true } }, class: { select: { name: true } } },
    orderBy: { firstName: 'asc' },
  })
  console.log(`📚 Found ${students.length} students`)

  // ---------- Helper: upload avatar to MediaFile ----------
  async function uploadAvatar(filePath: string): Promise<string | null> {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Avatar file not found: ${filePath}`)
      return null
    }
    const buffer = fs.readFileSync(filePath)
    const base64 = buffer.toString('base64')
    const filename = path.basename(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

    const media = await db.mediaFile.create({
      data: {
        filename,
        mimeType,
        data: base64,
        size: buffer.length,
        institutionId: dakar.id,
      },
    })
    return `/api/media/${media.id}.png`
  }

  // ---------- Create Parents for each student ----------
  // We cycle through the parent avatar files
  const femaleParentAvatars = Array.from({ length: 8 }, (_, i) => `/home/z/my-project/public/avatars/parent-woman-${i + 1}.png`)
  const maleParentAvatars = Array.from({ length: 8 }, (_, i) => `/home/z/my-project/public/avatars/parent-man-${i + 1}.png`)
  let femaleAvatarIdx = 0
  let maleAvatarIdx = 0

  // Determine parent gender from first name (West African names)
  const femaleNames = ['Fatou', 'Aissatou', 'Marie', 'Coumba', 'Khady', 'Awa', 'Aminata', 'Mariama', 'Awa', 'Bineta', 'Adja', 'Astou', 'Ndeye', 'Sokhna']
  function isFemaleName(firstName: string): boolean {
    return femaleNames.some(n => firstName.toLowerCase().startsWith(n.toLowerCase()))
  }

  console.log('\n--- Creating Parents ---')
  let parentCount = 0
  for (const student of students) {
    const parentName = student.parentContact?.trim()
    const parentPhone = student.parentPhone?.trim()
    if (!parentName) {
      console.warn(`⚠️  Student ${student.firstName} ${student.lastName} has no parentContact - skipping`)
      continue
    }

    // Parse "FirstName LastName"
    const parts = parentName.split(/\s+/)
    const pFirstName = parts[0] || 'Inconnu'
    const pLastName = parts.slice(1).join(' ') || '—'

    // Check if a parent with this name+phone already exists in Dakar
    const existing = await db.parent.findFirst({
      where: {
        firstName: pFirstName,
        lastName: pLastName,
        phone: parentPhone || undefined,
        user: { institutionId: dakar.id },
      },
    })

    let parentId: string
    if (existing) {
      parentId = existing.id
      console.log(`↩️  Reusing parent: ${pFirstName} ${pLastName} for ${student.firstName} ${student.lastName}`)
    } else {
      // Determine gender for avatar
      const isFemale = isFemaleName(pFirstName)
      const avatarPath = isFemale ? femaleParentAvatars[femaleAvatarIdx % femaleParentAvatars.length] : maleParentAvatars[maleAvatarIdx % maleParentAvatars.length]
      if (isFemale) femaleAvatarIdx++
      else maleAvatarIdx++

      // Upload avatar
      const avatarUrl = await uploadAvatar(avatarPath)

      // Create user
      const email = `${pFirstName.toLowerCase().replace(/[^a-z]/g, '')}.${pLastName.toLowerCase().replace(/[^a-z]/g, '')}${Math.floor(Math.random() * 9999)}@dakar.sn`
      const user = await db.user.create({
        data: {
          email,
          password: 'parent123',
          name: `${pFirstName} ${pLastName}`,
          role: 'parent',
          phone: parentPhone || null,
          avatar: avatarUrl,
          userCode: `PAR-DAK-${String(++parentCount).padStart(3, '0')}`,
          institutionId: dakar.id,
          active: true,
        },
      })

      // Create parent profile
      const parent = await db.parent.create({
        data: {
          userId: user.id,
          firstName: pFirstName,
          lastName: pLastName,
          phone: parentPhone || null,
          address: 'Dakar, Sénégal',
          image: avatarUrl,
        },
      })
      parentId = parent.id
      console.log(`✅ Created parent: ${pFirstName} ${pLastName} (${email}) → student ${student.firstName} ${student.lastName}`)
    }

    // Link student to parent
    await db.student.update({
      where: { id: student.id },
      data: { parentId },
    })
  }

  // ---------- Create Staff Members ----------
  console.log('\n--- Creating Staff ---')
  const staffData = [
    { firstName: 'Awa', lastName: 'Diop', fonction: 'Secrétaire de direction', phone: '+221 76 100 1001', email: 'awa.diop@dakar.sn', avatar: 'staff-woman-1.png', gender: 'F' },
    { firstName: 'Cheikh', lastName: 'Fall', fonction: 'Comptable', phone: '+221 76 100 1002', email: 'cheikh.fall@dakar.sn', avatar: 'staff-man-1.png', gender: 'M' },
    { firstName: 'Fatou', lastName: 'Sarr', fonction: 'Infirmier(ère)', phone: '+221 76 100 1003', email: 'fatou.sarr@dakar.sn', avatar: 'staff-woman-2.png', gender: 'F' },
    { firstName: 'Modou', lastName: 'Ba', fonction: 'Surveillant', phone: '+221 76 100 1004', email: 'modou.ba@dakar.sn', avatar: 'staff-man-2.png', gender: 'M' },
    { firstName: 'Khady', lastName: 'Mbaye', fonction: 'Bibliothécaire', phone: '+221 76 100 1005', email: 'khady.mbaye@dakar.sn', avatar: 'staff-woman-3.png', gender: 'F' },
    { firstName: 'Pape', lastName: 'Ndiaye', fonction: 'Agent d\'entretien', phone: '+221 76 100 1006', email: 'pape.ndiaye@dakar.sn', avatar: 'staff-man-3.png', gender: 'M' },
    { firstName: 'Omar', lastName: 'Sy', fonction: 'Directeur adjoint', phone: '+221 76 100 1007', email: 'omar.sy@dakar.sn', avatar: 'staff-man-4.png', gender: 'M' },
    { firstName: 'Mariama', lastName: 'Diallo', fonction: 'Chef de cuisine', phone: '+221 76 100 1008', email: 'mariama.diallo@dakar.sn', avatar: 'staff-woman-4.png', gender: 'F' },
  ]

  let staffCount = 0
  for (const s of staffData) {
    // Skip if staff already exists with this email
    const existing = await db.user.findUnique({ where: { email: s.email } })
    if (existing) {
      console.log(`↩️  Staff already exists: ${s.firstName} ${s.lastName} (${s.email})`)
      continue
    }

    // Upload avatar
    const avatarPath = `/home/z/my-project/public/avatars/${s.avatar}`
    const avatarUrl = await uploadAvatar(avatarPath)

    // Create user
    const user = await db.user.create({
      data: {
        email: s.email,
        password: 'staff123',
        name: `${s.firstName} ${s.lastName}`,
        role: 'staff',
        phone: s.phone,
        avatar: avatarUrl,
        userCode: `STF-DAK-${String(++staffCount).padStart(3, '0')}`,
        institutionId: dakar.id,
        active: true,
      },
    })

    // Create staff profile
    await db.staff.create({
      data: {
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        fonction: s.fonction,
        phone: s.phone,
        email: s.email,
        image: avatarUrl,
      },
    })
    console.log(`✅ Created staff: ${s.firstName} ${s.lastName} - ${s.fonction} (${s.email})`)
  }

  // ---------- Final summary ----------
  const finalParents = await db.parent.count({ where: { user: { institutionId: dakar.id } } })
  const finalStaff = await db.staff.count({ where: { user: { institutionId: dakar.id } } })
  const finalStudents = await db.student.count({ where: { user: { institutionId: dakar.id } } })
  const linkedStudents = await db.student.count({
    where: { user: { institutionId: dakar.id }, parentId: { not: null } },
  })

  console.log('\n=== Summary ===')
  console.log(`Institution: ${dakar.name}`)
  console.log(`Students: ${finalStudents} (linked to a parent: ${linkedStudents})`)
  console.log(`Parents: ${finalParents}`)
  console.log(`Staff: ${finalStaff}`)
  console.log('✅ Done!')
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(() => process.exit(0))
