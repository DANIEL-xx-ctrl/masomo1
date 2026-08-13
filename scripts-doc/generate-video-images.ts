/**
 * MASOMO Installation Guide — Image generation
 *
 * Generates 6 PNG illustrations (one per scene) using z-ai-web-dev-sdk.
 * Output: /home/z/my-project/scripts-doc/video-assets/scene{1..6}.png
 *
 * Run with: bun run scripts-doc/generate-video-images.ts
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = '/home/z/my-project/scripts-doc/video-assets';

interface Scene {
  id: number;
  title: string;
  prompt: string;
  imagePath: string;
}

const SCENES: Scene[] = [
  {
    id: 1,
    title: 'Introduction',
    prompt:
      'Modern flat illustration of a school management software dashboard on a laptop screen, showing students, classes and charts, teal and slate color palette, clean professional tech illustration, 16:9 landscape, high quality',
    imagePath: path.join(ASSETS_DIR, 'scene1.png'),
  },
  {
    id: 2,
    title: 'Prérequis système',
    prompt:
      'Ubuntu terminal window showing installation of Node.js and Bun package manager, green and teal code on dark background, developer workspace, flat design tech illustration, 16:9 landscape, high quality',
    imagePath: path.join(ASSETS_DIR, 'scene2.png'),
  },
  {
    id: 3,
    title: 'Installation des dépendances',
    prompt:
      'Visual Studio Code editor open on a Next.js project folder, terminal running bun install command, package.json file visible, teal accent color, clean modern developer setup, 16:9 landscape, high quality',
    imagePath: path.join(ASSETS_DIR, 'scene3.png'),
  },
  {
    id: 4,
    title: "Configuration de l'environnement",
    prompt:
      'Code editor showing a .env file with environment variables DATABASE_URL and JWT_SECRET, teal highlight on important lines, security and configuration concept, flat design tech illustration, 16:9 landscape, high quality',
    imagePath: path.join(ASSETS_DIR, 'scene4.png'),
  },
  {
    id: 5,
    title: 'Initialisation de la base de données',
    prompt:
      'Database schema diagram with multiple connected tables like Students, Teachers, Classes, Payments, prisma ORM logo concept, teal and slate colors, modern data model visualization, 16:9 landscape, high quality',
    imagePath: path.join(ASSETS_DIR, 'scene5.png'),
  },
  {
    id: 6,
    title: 'Démarrage du serveur',
    prompt:
      'Browser window showing a successful Next.js application loading on localhost 3000, green success indicator, modern web application dashboard with teal theme, clean professional, 16:9 landscape, high quality',
    imagePath: path.join(ASSETS_DIR, 'scene6.png'),
  },
];

const SIZE = '1344x768';
const MAX_RETRIES = 3;

async function generateOne(zai: any, scene: Scene): Promise<boolean> {
  // Skip if file already exists (resumability)
  if (fs.existsSync(scene.imagePath)) {
    const stat = fs.statSync(scene.imagePath);
    if (stat.size > 10000) {
      console.log(`[Scene ${scene.id}] ✓ Already exists (${stat.size} bytes), skipping`);
      return true;
    }
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Scene ${scene.id}] Attempt ${attempt}/${MAX_RETRIES}: "${scene.title}"`);
      const response = await zai.images.generations.create({
        prompt: scene.prompt,
        size: SIZE,
      });

      if (!response?.data?.[0]?.base64) {
        throw new Error('Invalid response: missing base64 in response.data[0]');
      }

      const imageBase64 = response.data[0].base64;
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(scene.imagePath, buffer);

      console.log(
        `[Scene ${scene.id}] ✓ Saved ${scene.imagePath} (${(buffer.length / 1024).toFixed(1)} KB)`
      );
      return true;
    } catch (err: any) {
      console.error(`[Scene ${scene.id}] ✗ Attempt ${attempt} failed: ${err?.message || err}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  return false;
}

async function main() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  console.log('Initializing ZAI SDK...');
  const zai = await ZAI.create();
  console.log(`Generating ${SCENES.length} images at size ${SIZE}...`);

  const results: { scene: number; ok: boolean }[] = [];
  for (const scene of SCENES) {
    const ok = await generateOne(zai, scene);
    results.push({ scene: scene.id, ok });
  }

  console.log('\n=== Image Generation Summary ===');
  for (const r of results) {
    console.log(`Scene ${r.scene}: ${r.ok ? 'OK' : 'FAILED'}`);
  }
  const succeeded = results.filter((r) => r.ok).length;
  console.log(`\n${succeeded}/${SCENES.length} images ready.`);

  if (succeeded < SCENES.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
