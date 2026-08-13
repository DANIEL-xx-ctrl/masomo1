// Avatar generation seed script for Collège Moderne de Yaoundé
// Run: node prisma/seed-avatars-yaounde.js
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const INST_ID = 'cmqjgfklf0000nqc1junmtwod';

// Determine gender from Cameroonian/French name
function guessGender(name) {
  const lower = name.toLowerCase();
  // Common female name patterns
  const femalePatterns = [
    'marie', 'chantal', 'sylvie', 'clarisse', 'grâce', 'dorothée', 'carine',
    'béatrice', 'dina', 'flore', 'hortense', 'josiane', 'léonie', 'nadège',
    'prisca', 'raïssa', 'tabitha', 'vanessa', 'yolande', 'astrid', 'hélène',
    'cécile', 'jeanne', 'marguerite', 'pascaline', 'solange', 'philomène',
    'annick', 'juliette', 'véronique', 'irène', 'noëlle', 'berthe', 'élodie',
    'jacqueline', 'clémentine', 'dorothée', 'agathe', 'solange'
  ];
  const firstName = lower.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const firstNameNorm = lower.split(' ')[0];
  
  for (const pattern of femalePatterns) {
    const patternNorm = pattern.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (firstName === patternNorm || firstNameNorm === pattern) return 'female';
  }
  return 'male';
}

// Avatar prompts for different roles and genders
function getAvatarPrompt(role, gender, index) {
  const seed = `variant${index}`;
  
  if (role === 'admin') {
    return `Professional portrait photo of a distinguished African man in his 50s, wearing a dark suit and tie, warm confident expression, clean background, headshot, corporate headshot style, high quality, ${seed}`;
  }
  
  if (role === 'teacher') {
    if (gender === 'female') {
      return `Professional portrait photo of an African woman teacher in her 30s-40s, wearing smart casual attire, warm friendly expression, clean light background, headshot, professional style, high quality, ${seed}`;
    }
    return `Professional portrait photo of an African man teacher in his 30s-40s, wearing smart casual attire with glasses, warm friendly expression, clean light background, headshot, professional style, high quality, ${seed}`;
  }
  
  if (role === 'student') {
    if (gender === 'female') {
      return `Portrait photo of a young African teenage girl, wearing white school uniform blouse, natural hair styled neatly, bright smile, clean light background, school photo style, high quality, ${seed}`;
    }
    return `Portrait photo of a young African teenage boy, wearing white school uniform shirt, short neat hair, bright smile, clean light background, school photo style, high quality, ${seed}`;
  }
  
  if (role === 'parent') {
    if (gender === 'female') {
      return `Portrait photo of an African woman in her 40s-50s, motherly warm expression, wearing traditional African print clothing, clean background, headshot, high quality, ${seed}`;
    }
    return `Portrait photo of an African man in his 40s-50s, mature dignified expression, wearing casual shirt, clean background, headshot, high quality, ${seed}`;
  }
  
  if (role === 'staff') {
    if (gender === 'female') {
      return `Professional portrait photo of an African woman staff member, wearing office attire, pleasant expression, clean background, headshot, high quality, ${seed}`;
    }
    return `Professional portrait photo of an African man staff member, wearing office attire, pleasant expression, clean background, headshot, high quality, ${seed}`;
  }
  
  return `Portrait photo of an African person, clean background, headshot, high quality, ${seed}`;
}

async function generateAvatarImage(zai, prompt) {
  const response = await zai.images.generations.create({
    prompt: prompt,
    size: '1024x1024'
  });
  return response.data[0].base64;
}

async function main() {
  console.log('=== Avatar Generation for Collège Moderne de Yaoundé ===\n');
  
  // Dynamic import for ESM module
  let ZAI;
  try {
    const module = await import('z-ai-web-dev-sdk');
    ZAI = module.default;
  } catch (e) {
    console.error('Failed to import z-ai-web-dev-sdk:', e.message);
    console.error('Make sure z-ai-web-dev-sdk is installed: npm install z-ai-web-dev-sdk');
    process.exit(1);
  }
  
  const zai = await ZAI.create();
  console.log('ZAI SDK initialized.\n');
  
  // Get all users for Yaoundé institution
  const users = await db.user.findMany({
    where: { institutionId: INST_ID },
    include: {
      student: true,
      teacher: true,
      parent: true,
      staff: true,
    }
  });
  
  console.log(`Found ${users.length} users for Yaoundé institution.\n`);
  
  // Group users by role and gender
  const groups = {};
  for (const user of users) {
    const role = user.role;
    const gender = guessGender(user.name);
    const key = `${role}_${gender}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(user);
  }
  
  console.log('User groups:');
  for (const [key, list] of Object.entries(groups)) {
    console.log(`  ${key}: ${list.length} users`);
  }
  console.log('');
  
  // Generate avatar pool for each group
  // We generate a few unique avatars per group and reuse them
  const avatarPool = {}; // key -> array of { mediaId, avatarUrl }
  
  for (const [key, userList] of Object.entries(groups)) {
    const [role, gender] = key.split('_');
    
    // Generate fewer unique avatars than users (they'll be recycled)
    const numUnique = Math.min(userList.length, role === 'admin' ? 1 : role === 'student' ? 8 : role === 'teacher' ? 4 : role === 'parent' ? 5 : 3);
    
    console.log(`Generating ${numUnique} unique avatars for ${key}...`);
    avatarPool[key] = [];
    
    for (let i = 0; i < numUnique; i++) {
      const prompt = getAvatarPrompt(role, gender, i + 1);
      
      let retries = 3;
      let base64Data = null;
      
      while (retries > 0 && !base64Data) {
        try {
          console.log(`  Generating avatar ${i + 1}/${numUnique} for ${key}...`);
          base64Data = await generateAvatarImage(zai, prompt);
          console.log(`  ✓ Avatar ${i + 1}/${numUnique} generated (${Math.round(base64Data.length * 0.75 / 1024)} KB)`);
        } catch (err) {
          retries--;
          console.error(`  ✗ Failed (retries left: ${retries}):`, err.message);
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
      
      if (!base64Data) {
        console.error(`  Skipping avatar ${i + 1} for ${key} after all retries failed`);
        continue;
      }
      
      // Store in MediaFile
      const mediaFile = await db.mediaFile.create({
        data: {
          filename: `avatar_${key}_${i + 1}.jpg`,
          mimeType: 'image/jpeg',
          data: base64Data,
          size: Math.round(base64Data.length * 0.75),
          institutionId: INST_ID,
        }
      });
      
      const avatarUrl = `/api/media/${mediaFile.id}.jpg`;
      avatarPool[key].push(avatarUrl);
      console.log(`  ✓ Stored as MediaFile: ${mediaFile.id}`);
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log('\n--- Assigning avatars to users ---\n');
  
  // Assign avatars to users
  let assigned = 0;
  for (const [key, userList] of Object.entries(groups)) {
    const [role, gender] = key.split('_');
    const pool = avatarPool[key] || [];
    
    if (pool.length === 0) {
      console.log(`  No avatars for ${key}, skipping ${userList.length} users`);
      continue;
    }
    
    for (let i = 0; i < userList.length; i++) {
      const user = userList[i];
      const avatarUrl = pool[i % pool.length]; // Recycle avatars
      
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
        if ((assigned) % 10 === 0) {
          console.log(`  Assigned ${assigned} avatars so far...`);
        }
      } catch (err) {
        console.error(`  Failed to assign avatar to ${user.name}:`, err.message);
      }
    }
  }
  
  console.log(`\n✓ Total avatars assigned: ${assigned}`);
  console.log('\n=== Avatar generation complete! ===');
  
  await db.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
