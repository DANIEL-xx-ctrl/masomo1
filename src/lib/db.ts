import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ---- Force DATABASE_URL from .env ----
// The shell environment may have a leftover DATABASE_URL (e.g. an SQLite
// URL from the sandbox) that doesn't match the project's Prisma provider.
// Reading .env directly and overriding process.env ensures the correct
// PostgreSQL URL is always used, regardless of the shell environment.
if (typeof process !== 'undefined' && process.env.DATABASE_URL?.startsWith('file:')) {
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    try {
      for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
        if (key === 'DATABASE_URL' && !val.startsWith('file:')) {
          process.env.DATABASE_URL = val
          break
        }
      }
    } catch {
      // silent
    }
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
