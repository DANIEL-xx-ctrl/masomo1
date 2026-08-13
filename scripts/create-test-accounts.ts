import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existingTeacher = await prisma.user.findUnique({ where: { email: 'teacher@ecole.com' } })
  const existingStudent = await prisma.user.findUnique({ where: { email: 'student@ecole.com' } })

  if (existingTeacher) {
    console.log('teacher@ecole.com already exists, skipping...')
  } else {
    const teacherUser = await prisma.user.create({
      data: {
        email: 'teacher@ecole.com',
        password: 'teacher123',
        name: 'Enseignant Test',
        role: 'teacher',
        phone: '+237 699 999 001',
        active: true,
      },
    })
    
    await prisma.teacher.create({
      data: {
        userId: teacherUser.id,
        firstName: 'Enseignant',
        lastName: 'Test',
        subject: 'Physique-Chimie',
        phone: '+237 699 999 001',
        qualification: 'Master en Physique',
        hireDate: '2023-09-01',
      },
    })
    
    console.log('Created teacher@ecole.com (password: teacher123)')
  }

  if (existingStudent) {
    console.log('student@ecole.com already exists, skipping...')
  } else {
    const firstClass = await prisma.class.findFirst()
    
    const studentUser = await prisma.user.create({
      data: {
        email: 'student@ecole.com',
        password: 'student123',
        name: 'Élève Test',
        role: 'student',
        phone: '+237 699 999 002',
        active: true,
      },
    })
    
    await prisma.student.create({
      data: {
        userId: studentUser.id,
        firstName: 'Élève',
        lastName: 'Test',
        dateOfBirth: '2010-06-15',
        gender: 'M',
        address: 'Douala, Cameroun',
        enrollmentDate: '2024-09-01',
        parentContact: 'Parent Test',
        parentPhone: '+237 699 999 003',
        classId: firstClass?.id || null,
      },
    })
    
    console.log('Created student@ecole.com (password: student123)')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
