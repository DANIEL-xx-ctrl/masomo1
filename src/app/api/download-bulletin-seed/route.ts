import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const zipPath = join(process.cwd(), 'public', 'masomo-bulletin-seed.zip')
    if (!existsSync(zipPath)) {
      return NextResponse.json({ error: 'Fichier zip introuvable.' }, { status: 404 })
    }
    const fileBuffer = readFileSync(zipPath)
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="masomo-bulletin-seed.zip"',
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
