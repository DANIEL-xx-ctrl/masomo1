const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  try {
    const institutions = await db.institution.count();
    const superadmins = await db.superAdmin.count();
    const users = await db.user.count();
    const students = await db.student.count();
    console.log('=== Database content ===');
    console.log('Institutions:', institutions);
    console.log('SuperAdmins:', superadmins);
    console.log('Users:', users);
    console.log('Students:', students);
    
    const sa = await db.superAdmin.findFirst();
    console.log('\n=== SuperAdmin record ===');
    console.log('  email:', sa?.email);
    console.log('  password:', sa?.password);
    console.log('  active:', sa?.active);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await db.$disconnect();
  }
})();
