/**
 * MASOMO Installation Guide — TTS narration generation (French)
 *
 * Generates 6 WAV narration clips using z-ai-web-dev-sdk TTS.
 * Output: /home/z/my-project/scripts-doc/video-assets/scene{1..6}.wav
 *
 * Run with: bun run scripts-doc/generate-video-audio.ts
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = '/home/z/my-project/scripts-doc/video-assets';

interface Scene {
  id: number;
  title: string;
  narration: string;
  audioPath: string;
}

const SCENES: Scene[] = [
  {
    id: 1,
    title: 'Introduction',
    narration:
      "Bienvenue dans ce guide d'installation de MASOMO, l'application de gestion scolaire construite avec Next.js 16, TypeScript et Prisma. Dans cette vidéo, nous allons voir étape par étape comment installer et démarrer le projet sur Ubuntu.",
    audioPath: path.join(ASSETS_DIR, 'scene1.wav'),
  },
  {
    id: 2,
    title: 'Prérequis système',
    narration:
      "Commençons par les prérequis. Sur Ubuntu, installez d'abord Node.js version 24 ou supérieure via NodeSource. Ensuite, installez Bun, le gestionnaire de paquets ultra-rapide utilisé par ce projet, avec la commande curl fournie sur le site officiel de Bun. Installez aussi Visual Studio Code.",
    audioPath: path.join(ASSETS_DIR, 'scene2.wav'),
  },
  {
    id: 3,
    title: 'Installation des dépendances',
    narration:
      "Ouvrez le projet dans Visual Studio Code, puis dans le terminal intégré, lancez la commande bun install. Cette commande va télécharger toutes les dépendances : Next.js, React, Prisma, les composants shadcn/ui, Tailwind CSS, Zustand, et près de quatre-vingts autres paquets. Cela prend une à trois minutes.",
    audioPath: path.join(ASSETS_DIR, 'scene3.wav'),
  },
  {
    id: 4,
    title: "Configuration de l'environnement",
    narration:
      "Configurez maintenant l'environnement. Copiez le fichier .env.example en .env. Vous devez définir trois variables : DATABASE_URL, le chemin vers la base SQLite ; JWT_SECRET, votre clé secrète d'authentification ; et PORT, le port du serveur, généralement 3000.",
    audioPath: path.join(ASSETS_DIR, 'scene4.wav'),
  },
  {
    id: 5,
    title: 'Initialisation de la base de données',
    narration:
      "Initialisez la base de données avec Prisma. Lancez d'abord bun run db generate pour générer le client TypeScript. Puis bun run db push pour créer le fichier SQLite et les vingt-deux tables du schéma : utilisateurs, élèves, enseignants, classes, paiements, et bien d'autres.",
    audioPath: path.join(ASSETS_DIR, 'scene5.wav'),
  },
  {
    id: 6,
    title: 'Démarrage du serveur',
    narration:
      "Enfin, démarrez le serveur de développement avec la commande bun run dev. Next.js 16 se lance et l'application est accessible sur localhost port 3000. Vous pouvez maintenant vous connecter et explorer MASOMO. Pour vérifier la qualité du code, utilisez bun run lint. Bon développement !",
    audioPath: path.join(ASSETS_DIR, 'scene6.wav'),
  },
];

const MAX_RETRIES = 3;
const TTS_CHAR_LIMIT = 1024;

async function generateOne(zai: any, scene: Scene): Promise<boolean> {
  // Skip if file already exists (resumability)
  if (fs.existsSync(scene.audioPath)) {
    const stat = fs.statSync(scene.audioPath);
    if (stat.size > 5000) {
      console.log(`[Scene ${scene.id}] ✓ Already exists (${stat.size} bytes), skipping`);
      return true;
    }
  }

  // Validate length
  if (scene.narration.length > TTS_CHAR_LIMIT) {
    console.error(
      `[Scene ${scene.id}] ✗ Narration too long: ${scene.narration.length} > ${TTS_CHAR_LIMIT}`
    );
    return false;
  }
  console.log(`[Scene ${scene.id}] Narration length: ${scene.narration.length} chars`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Scene ${scene.id}] Attempt ${attempt}/${MAX_RETRIES}: "${scene.title}"`);
      const response = await zai.audio.tts.create({
        input: scene.narration,
        voice: 'tongtong',
        speed: 1.0,
        response_format: 'wav',
        stream: false,
      });

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(new Uint8Array(arrayBuffer));

      if (buffer.length < 1000) {
        throw new Error(`Audio buffer too small: ${buffer.length} bytes`);
      }

      fs.writeFileSync(scene.audioPath, buffer);
      console.log(
        `[Scene ${scene.id}] ✓ Saved ${scene.audioPath} (${(buffer.length / 1024).toFixed(1)} KB)`
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
  console.log(`Generating ${SCENES.length} French narration clips (voice: tongtong)...`);

  const results: { scene: number; ok: boolean }[] = [];
  for (const scene of SCENES) {
    const ok = await generateOne(zai, scene);
    results.push({ scene: scene.id, ok });
  }

  console.log('\n=== TTS Generation Summary ===');
  for (const r of results) {
    console.log(`Scene ${r.scene}: ${r.ok ? 'OK' : 'FAILED'}`);
  }
  const succeeded = results.filter((r) => r.ok).length;
  console.log(`\n${succeeded}/${SCENES.length} audio files ready.`);

  if (succeeded < SCENES.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
