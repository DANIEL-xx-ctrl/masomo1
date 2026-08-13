import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function seed() {
  console.log('=== Seeding SuperAdmin ===');
  
  // Check if SuperAdmin already exists
  const existing = await db.superAdmin.findUnique({ where: { email: 'superadmin@edugest.com' } });
  
  if (existing) {
    console.log('SuperAdmin already exists:', existing.id, existing.name);
    return;
  }
  
  // Create default SuperAdmin
  const superAdmin = await db.superAdmin.create({
    data: {
      name: 'Super Administrateur',
      email: 'superadmin@edugest.com',
      password: 'superadmin2024',
      active: true,
    }
  });
  
  console.log('SuperAdmin created:', superAdmin.id, superAdmin.name);
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect());
