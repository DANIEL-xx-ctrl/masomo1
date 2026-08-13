import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function check() {
  // Find ALL superAdmin records
  const all = await db.superAdmin.findMany();
  console.log('Total SuperAdmin records:', all.length);
  for (const sa of all) {
    console.log('---');
    console.log('ID:', sa.id);
    console.log('Name:', sa.name);
    console.log('Email:', JSON.stringify(sa.email));
    console.log('Password:', JSON.stringify(sa.password));
    console.log('Active:', sa.active);
  }
  
  // Test the exact lookup the API does
  const found = await db.superAdmin.findUnique({ where: { email: 'superadmin@edugest.com' } });
  console.log('\n--- Lookup test ---');
  console.log('findUnique result:', found ? `Found (id=${found.id}, password="${found.password}")` : 'NOT FOUND');
  
  // Check if password comparison works
  if (found) {
    console.log('Password match:', found.password === 'superadmin2024');
    console.log('Password length:', found.password.length);
    console.log('Expected length:', 'superadmin2024'.length);
    console.log('Password char codes:', [...found.password].map(c => c.charCodeAt(0)));
    console.log('Expected char codes:', [...'superadmin2024'].map(c => c.charCodeAt(0)));
  }
}

check()
  .catch(console.error)
  .finally(() => db.$disconnect());
