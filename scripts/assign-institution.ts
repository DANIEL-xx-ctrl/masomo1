import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Assigning existing data to default institution...')
  
  // Check if any institution exists
  let institution = await prisma.institution.findFirst()
  
  if (!institution) {
    // Create default institution from SchoolConfig
    const config = await prisma.schoolConfig.findFirst()
    institution = await prisma.institution.create({
      data: {
        name: config?.schoolName || 'École Internationale EduGest',
        address: config?.address || null,
        phone: config?.phone || null,
        email: config?.email || null,
        password: config?.institutionPassword || 'edugest2024',
        currentYear: config?.currentYear || '2024-2025',
        active: true,
      },
    })
    console.log(`Created institution: ${institution.name} (${institution.id})`)
    
    // Update SchoolConfig with institutionId
    if (config) {
      await prisma.schoolConfig.update({
        where: { id: config.id },
        data: { institutionId: institution.id },
      })
    }
  }
  
  const instId = institution.id
  
  // Update all records with institutionId = "inst_default" to the real institution id
  const result = await prisma.user.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${result.count} users`)
  
  const classResult = await prisma.class.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${classResult.count} classes`)
  
  const subjectResult = await prisma.subject.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${subjectResult.count} subjects`)
  
  const announcementResult = await prisma.announcement.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${announcementResult.count} announcements`)
  
  const eventResult = await prisma.schoolEvent.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${eventResult.count} events`)
  
  const homeworkResult = await prisma.homework.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${homeworkResult.count} homeworks`)
  
  const messageResult = await prisma.message.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${messageResult.count} messages`)
  
  const notificationResult = await prisma.notification.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${notificationResult.count} notifications`)
  
  const mediaResult = await prisma.mediaFile.updateMany({
    where: { institutionId: 'inst_default' },
    data: { institutionId: instId },
  })
  console.log(`Updated ${mediaResult.count} media files`)
  
  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
