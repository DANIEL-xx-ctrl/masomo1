// Avatar assignment script for Collège Moderne de Yaoundé
// Reads generated avatar images, stores them as MediaFile records, 
// and assigns them to users based on role and gender.
// Run: node prisma/assign-avatars-yaounde.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const db = new PrismaClient();
const INST_ID = 'cmqjgfklf0000nqc1junmtwod';
const AVATARS_DIR = path.join(__dirname, 'avatars');

// Determine gender from Cameroonian/French name
function guessGender(name) {
  const lower = name.toLowerCase();
  const femalePatterns = [
    'marie', 'chantal', 'sylvie', 'clarisse', 'grâce', 'dorothée', 'carine',
    'béatrice', 'dina', 'flore', 'hortense', 'josiane', 'léonie', 'nadège',
    'prisca', 'raïssa', 'tabitha', 'vanessa', 'yolande', 'astrid', 'hélène',
    'cécile', 'jeanne', 'marguerite', 'pascaline', 'solange', 'philomène',
    'annick', 'juliette', 'véronique', 'irène', 'noëlle', 'berthe', 'élodie',
    'jacqueline', 'clémentine', 'agathe'
  ];
  const firstNameNorm = lower.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const pattern of femalePatterns) {
    const patternNorm = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (firstNameNorm === patternNorm) return 'female';
  }
  return 'male';
}

// Map avatar files to role/gender categories
const avatarFileMap = {
  'admin_male': ['admin_male_1.png'],
  'admin_female': ['admin_male_1.png'], // reuse
  'teacher_male': ['teacher_male_1.png', 'teacher_male_2.png', 'teacher_male_3.png'],
  'teacher_female': ['teacher_female_1.png', 'teacher_female_2.png'],
  'student_male': ['student_male_1.png', 'student_male_2.png', 'student_male_3.png', 'student_male_4.png', 'student_male_5.png'],
  'student_female': ['student_female_1.png', 'student_female_2.png', 'student_female_3.png', 'student_female_4.png', 'student_female_5.png'],
  'parent_male': ['parent_male_1.png', 'parent_male_2.png', 'parent_male_3.png'],
  'parent_female': ['parent_female_1.png', 'parent_female_2.png', 'parent_female_3.png'],
  'staff_male': ['staff_male_1.png'],
  'staff_female': ['staff_female_1.png'],
};

async function main() {
  console.log('=== Avatar Assignment for Collège Moderne de Yaoundé ===\n');
  
  // First, clean up old avatar MediaFile records from previous partial runs
  const oldMedia = await db.mediaFile.findMany({
    where: { 
      institutionId: INST_ID,
      filename: { startsWith: 'avatar_' }
    }
  });
  if (oldMedia.length > 0) {
    console.log(`Cleaning up ${oldMedia.length} old avatar MediaFile records...`);
    for (const m of oldMedia) {
      await db.mediaFile.delete({ where: { id: m.id } });
    }
  }
  
  // Reset all user avatars for this institution
  await db.user.updateMany({
    where: { institutionId: INST_ID },
    data: { avatar: null }
  });
  console.log('Reset all user avatars to null.\n');
  
  // Step 1: Read avatar files and create MediaFile records
  const avatarMediaMap = {}; // key -> [mediaId, ...]
  
  for (const [key, files] of Object.entries(avatarFileMap)) {
    avatarMediaMap[key] = [];
    
    for (const filename of files) {
      const filepath = path.join(AVATARS_DIR, filename);
      
      if (!fs.existsSync(filepath)) {
        console.log(`  ⚠ File not found: ${filename}, skipping`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(filepath);
      const base64Data = fileBuffer.toString('base64');
      
      const mediaFile = await db.mediaFile.create({
        data: {
          filename: `avatar_${filename}`,
          mimeType: 'image/png',
          data: base64Data,
          size: fileBuffer.length,
          institutionId: INST_ID,
        }
      });
      
      avatarMediaMap[key].push(`/api/media/${mediaFile.id}.png`);
      console.log(`  ✓ Created MediaFile for ${filename}: ${mediaFile.id}`);
    }
  }
  
  console.log('\n--- Assigning avatars to users ---\n');
  
  // Step 2: Get all users and assign avatars
  const users = await db.user.findMany({
    where: { institutionId: INST_ID },
    include: {
      student: true,
      teacher: true,
      parent: true,
      staff: true,
    }
  });
  
  // Group users by role/gender for assignment
  const groupCounters = {};
  let assigned = 0;
  
  for (const user of users) {
    const role = user.role;
    const gender = guessGender(user.name);
    const key = `${role}_${gender}`;
    
    const pool = avatarMediaMap[key] || avatarMediaMap[`${role}_male`] || [];
    if (pool.length === 0) {
      console.log(`  ⚠ No avatar pool for ${key}, skipping ${user.name}`);
      continue;
    }
    
    // Get counter for this group (cycle through avatars)
    if (!groupCounters[key]) groupCounters[key] = 0;
    const avatarUrl = pool[groupCounters[key] % pool.length];
    groupCounters[key]++;
    
    try {
      // Update User.avatar
      await db.user.update({
        where: { id: user.id },
        data: { avatar: avatarUrl }
      });
      
      // Update role-specific image field
      if (user.student) {
        await db.student.update({
          where: { id: user.student.id },
          data: { image: avatarUrl }
        });
      } else if (user.teacher) {
        await db.teacher.update({
          where: { id: user.teacher.id },
          data: { image: avatarUrl }
        });
      } else if (user.parent) {
        await db.parent.update({
          where: { id: user.parent.id },
          data: { image: avatarUrl }
        });
      } else if (user.staff) {
        await db.staff.update({
          where: { id: user.staff.id },
          data: { image: avatarUrl }
        });
      }
      
      assigned++;
    } catch (err) {
      console.error(`  ✗ Failed to assign avatar to ${user.name}:`, err.message);
    }
  }
  
  console.log(`\n✓ Total avatars assigned: ${assigned}/${users.length}`);
  
  // Summary
  console.log('\n--- Assignment Summary ---');
  for (const [key, count] of Object.entries(groupCounters)) {
    console.log(`  ${key}: ${count} users`);
  }
  
  console.log('\n=== Avatar assignment complete! ===');
  await db.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
