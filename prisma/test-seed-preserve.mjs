import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function test() {
  // Step 1: Modify the SuperAdmin
  console.log('Step 1: Modifying SuperAdmin...');
  const sa = await db.superAdmin.findFirst();
  if (!sa) { console.log('No SuperAdmin found!'); return; }
  
  await db.superAdmin.update({
    where: { id: sa.id },
    data: { name: 'Admin Test Perso', password: 'password_perso_456' },
  });
  console.log('Modified to: name="Admin Test Perso", password="password_perso_456"');
  
  // Step 2: Get current user count
  const userCount = await db.user.count();
  console.log('\nCurrent user count:', userCount);
  
  // Step 3: Check that the seed GET endpoint doesn't affect SuperAdmin
  console.log('\nStep 3: Calling seed GET (status check)...');
  const response = await fetch('http://localhost:3000/api/seed');
  const data = await response.json();
  console.log('Seed status:', JSON.stringify(data));
  
  // Step 4: Verify SuperAdmin is still modified
  const saAfter = await db.superAdmin.findFirst();
  console.log('\nStep 4: After seed check:');
  console.log('  Name:', saAfter.name);
  console.log('  Password:', saAfter.password);
  console.log('  Modifications preserved?', saAfter.name === 'Admin Test Perso' && saAfter.password === 'password_perso_456');
  
  // Step 5: Restore defaults
  console.log('\nStep 5: Restoring default credentials...');
  await db.superAdmin.update({
    where: { id: sa.id },
    data: { name: 'Super Administrateur', password: 'superadmin2024' },
  });
  console.log('Restored to defaults.');
}

test()
  .catch(console.error)
  .finally(() => db.$disconnect());
