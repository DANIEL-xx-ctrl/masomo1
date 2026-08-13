/**
 * Generate AI avatars for students.
 *
 * For each student:
 *  1. Builds a prompt based on the student's name and gender.
 *  2. Generates a PNG avatar using z-ai-web-dev-sdk image generation.
 *  3. Stores the base64 PNG in the MediaFile table.
 *  4. Updates Student.image to `/api/media/{mediaFileId}.png`.
 *
 * The script is resumable: students whose `image` already starts with
 * `/api/media/` are skipped, so re-running the script will only process
 * students that still need a real avatar.
 *
 * Usage:
 *   timeout 540 bun run scripts/generate-student-avatars.ts
 */
import ZAI from 'z-ai-web-dev-sdk';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  image: string | null;
}

/**
 * Map a student to an image-generation prompt.
 * We keep the prompts simple, friendly and "school photo" style so the
 * generated avatars look like real student ID photos.
 */
function buildPrompt(s: StudentRow): string {
  const gender = (s.gender || '').toUpperCase() === 'F' ? 'girl' : 'boy';
  const genderTerm =
    (s.gender || '').toUpperCase() === 'F'
      ? 'young African girl'
      : 'young African boy';

  // Mali / West-African names dominate the seed data, so we lean into that
  // while keeping the prompt generic enough to be respectful.
  const prompt = [
    `Avatar portrait of a ${genderTerm} named ${s.firstName} ${s.lastName}`,
    'friendly smile, looking at camera',
    'school ID photo style, head and shoulders',
    'simple neutral solid-color background',
    'natural soft studio lighting',
    'photorealistic, sharp focus, high quality, detailed face',
  ].join(', ');

  // Suppress unused-var warning for `gender` (kept for future debugging).
  void gender;
  return prompt;
}

async function generateAvatarBase64(prompt: string): Promise<string> {
  const zai = await ZAI.create();
  const response = await zai.images.generations.create({
    prompt,
    size: '1024x1024',
  });

  const base64 = response?.data?.[0]?.base64;
  if (!base64) {
    throw new Error('Image generation API returned no data');
  }
  return base64 as string;
}

async function main() {
  console.log('[avatars] starting student avatar generation');

  const institution = await db.institution.findFirst();
  if (!institution) {
    throw new Error('No institution found in database');
  }
  const institutionId = institution.id;
  console.log(`[avatars] using institutionId=${institutionId}`);

  const students: StudentRow[] = await db.student.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      image: true,
    },
    orderBy: { id: 'asc' },
  });
  console.log(`[avatars] total students: ${students.length}`);

  // Students that need a new AI avatar: either no image at all, or the
  // image is one of the legacy `/avatars/...` seed placeholders.
  const needsAvatar = students.filter((s) => {
    if (!s.image) return true;
    // Resumable: skip students that already have a real MediaFile-backed avatar.
    if (s.image.startsWith('/api/media/')) return false;
    return true;
  });
  console.log(`[avatars] students needing avatar: ${needsAvatar.length}`);

  if (needsAvatar.length === 0) {
    console.log('[avatars] nothing to do, exiting');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  const failed: { id: string; name: string; error: string }[] = [];

  for (let i = 0; i < needsAvatar.length; i++) {
    const s = needsAvatar[i];
    const label = `${s.firstName} ${s.lastName} (${s.gender || '?'})`;
    console.log(
      `[avatars] (${i + 1}/${needsAvatar.length}) generating for ${label} (id=${s.id})`
    );

    // 5 attempts with longer backoff; 429 rate-limit errors get an
    // especially long wait so we don't hammer the API.
    const MAX_ATTEMPTS = 5;
    let attempt = 0;
    let done = false;
    while (attempt < MAX_ATTEMPTS && !done) {
      attempt++;
      try {
        const prompt = buildPrompt(s);
        const base64 = await generateAvatarBase64(prompt);
        const buffer = Buffer.from(base64, 'base64');
        const sizeBytes = buffer.length;

        const mediaFile = await db.mediaFile.create({
          data: {
            filename: `avatar-${s.firstName}-${s.lastName}.png`
              .toLowerCase()
              .replace(/[^a-z0-9.\-]/g, '-'),
            mimeType: 'image/png',
            data: base64,
            size: sizeBytes,
            institutionId,
          },
        });

        await db.student.update({
          where: { id: s.id },
          data: { image: `/api/media/${mediaFile.id}.png` },
        });

        successCount++;
        done = true;
        console.log(
          `[avatars]   ok -> mediaFileId=${mediaFile.id} (${sizeBytes} bytes)`
        );
      } catch (err: any) {
        const msg = err?.message || String(err);
        const isRateLimit = msg.includes('429') || /too many requests/i.test(msg);
        console.error(`[avatars]   attempt ${attempt} failed: ${msg}`);
        if (attempt < MAX_ATTEMPTS) {
          // Rate-limit: wait 30s then exponential. Other errors: short backoff.
          const waitMs = isRateLimit ? 30000 * attempt : 2000 * attempt;
          console.log(`[avatars]   waiting ${waitMs}ms before retry...`);
          await new Promise((r) => setTimeout(r, waitMs));
        } else {
          failCount++;
          failed.push({ id: s.id, name: label, error: msg });
        }
      }
    }

    // Small spacing between students to reduce rate-limit pressure.
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log('---');
  console.log(`[avatars] done. success=${successCount}, failed=${failCount}`);
  if (failed.length > 0) {
    console.log('[avatars] failures:');
    for (const f of failed) {
      console.log(`  - ${f.name} (${f.id}): ${f.error}`);
    }
  }
}

main()
  .catch((err) => {
    console.error('[avatars] fatal error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
