import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function check() {
  const sa = await db.superAdmin.findFirst();
  if (sa) {
    console.log('SuperAdmin EXISTS:');
    console.log('  ID:', sa.id);
    console.log('  Name:', sa.name);
    console.log('  Email:', sa.email);
    console.log('  Password:', sa.password);
    console.log('  Avatar:', sa.avatar);
    console.log('  Active:', sa.active);
  } else {
    console.log('SuperAdmin NOT FOUND in database!');
  }
  
  // Also count institutions
  const instCount = await db.institution.count();
  const userCount = await db.user.count();
  console.log('\nDatabase stats:');
  console.log('  Institutions:', instCount);
  console.log('  Users:', userCount);
}

check()
  .catch(console.error)
  .finally(() => db.$disconnect());
