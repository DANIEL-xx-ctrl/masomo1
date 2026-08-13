import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function test() {
  // Step 1: Delete the SuperAdmin
  console.log('Step 1: Deleting SuperAdmin...');
  await db.superAdmin.deleteMany();
  const count1 = await db.superAdmin.count();
  console.log('SuperAdmin count after delete:', count1);
  
  // Step 2: Call the ensure endpoint
  console.log('\nStep 2: Calling ensure endpoint...');
  const response = await fetch('http://localhost:3000/api/super-admin/ensure');
  const data = await response.json();
  console.log('Ensure response:', JSON.stringify(data, null, 2));
  
  // Step 3: Verify it was created
  const count2 = await db.superAdmin.count();
  console.log('\nSuperAdmin count after ensure:', count2);
  
  const sa = await db.superAdmin.findFirst();
  if (sa) {
    console.log('SuperAdmin record:');
    console.log('  ID:', sa.id);
    console.log('  Name:', sa.name);
    console.log('  Email:', sa.email);
    console.log('  Password:', sa.password);
    console.log('  Active:', sa.active);
  }
  
  // Step 4: Test login with recreated credentials
  console.log('\nStep 4: Testing login...');
  const loginRes = await fetch('http://localhost:3000/api/super-admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@edugest.com', password: 'superadmin2024' }),
  });
  const loginData = await loginRes.json();
  console.log('Login result:', loginRes.status === 200 ? 'SUCCESS' : 'FAILED', loginData);
}

test()
  .catch(console.error)
  .finally(() => db.$disconnect());
