import path from 'node:path'
import { defineConfig } from '@prisma/config'
import dotenv from 'dotenv'

// CRITIQUE (Prisma 6.19+) : prisma.config.ts désactive le chargement
// automatique du .env. Il faut appeler dotenv.config() explicitement,
// sinon on obtient "Environment variable not found: DATABASE_URL" (P1012).
dotenv.config()

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),

  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'bun run prisma/seed.ts',
  },
})
