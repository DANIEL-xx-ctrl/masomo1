import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Route PUBLIQUE (sans authentification) qui permet de télécharger
 * directement le fichier de base de données SQLite `db/custom.db`.
 *
 * Utile pour les développeurs qui installent le projet en local dans VSCode
 * et veulent récupérer la base de données de démonstration complète :
 *   - 9 institutions
 *   - 1 Super Admin
 *   - 99 utilisateurs (admins, enseignants, élèves, parents, personnel)
 *   - 64 élèves, 17 enseignants, 16 classes
 *   - 1080 notes, 180 paiements
 *
 * Usage :
 *   curl -o custom.db http://localhost:3000/api/download-db
 *   # ou dans le navigateur : http://localhost:3000/api/download-db
 */
export async function GET() {
  const dbPath = join(process.cwd(), 'db', 'custom.db')

  if (!existsSync(dbPath)) {
    return NextResponse.json(
      { error: 'Base de données introuvable. Exécutez `bun run db:push` puis `bun run db:seed`.' },
      { status: 404 }
    )
  }

  try {
    const fileData = await readFile(dbPath)

    // Date stamp for the filename
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
    const filename = `edugest-custom-${dateStamp}.db`
    const filenameEncoded = encodeURIComponent(filename)

    return new NextResponse(fileData, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${filenameEncoded}`,
        'Content-Length': String(fileData.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        // CORS headers pour permettre le téléchargement depuis n'importe quel origine
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('[download-db] Error:', error)
    return NextResponse.json(
      { error: 'Échec de la lecture de la base de données.' },
      { status: 500 }
    )
  }
}
