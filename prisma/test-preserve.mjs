import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function test() {
  // Step 1: Modify the SuperAdmin name and password
  console.log('Step 1: Modifying SuperAdmin name and password...');
  const sa = await db.superAdmin.findFirst();
  if (!sa) { console.log('No SuperAdmin found!'); return; }
  
  await db.superAdmin.update({
    where: { id: sa.id },
    data: { name: 'Mon Admin Perso', password: 'monmotdepasse123' },
  });
  console.log('Modified to: name="Mon Admin Perso", password="monmotdepasse123"');
  
  // Step 2: Call ensure
  console.log('\nStep 2: Calling ensure endpoint...');
  const response = await fetch('http://localhost:3000/api/super-admin/ensure');
  const data = await response.json();
  console.log('Ensure response:', JSON.stringify(data, null, 2));
  console.log('Created?', data.created); // Should be false
  
  // Step 3: Verify modifications are preserved
  const saAfter = await db.superAdmin.findFirst();
  console.log('\nStep 3: After ensure:');
  console.log('  Name:', saAfter.name);
  console.log('  Password:', saAfter.password);
  console.log('  Modifications preserved?', saAfter.name === 'Mon Admin Perso' && saAfter.password === 'monmotdepasse123');
  
  // Step 4: Restore defaults for future tests
  console.log('\nStep 4: Restoring default credentials...');
  await db.superAdmin.update({
    where: { id: sa.id },
    data: { name: 'Super Administrateur', password: 'superadmin2024' },
  });
  console.log('Restored to defaults.');
}

test()
  .catch(console.error)
  .finally(() => db.$disconnect());
