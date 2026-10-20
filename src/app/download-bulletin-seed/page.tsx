'use client'
import { useEffect, useState } from 'react'
import { Download, FileArchive, CheckCircle2 } from 'lucide-react'

export default function DownloadPage() {
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => {
      const a = document.createElement('a')
      a.href = '/api/download-bulletin-seed'
      a.download = 'masomo-bulletin-seed.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setStarted(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <FileArchive className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-xl font-bold mb-2">Seed Bulletins — Zip</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {started ? 'Téléchargement démarré !' : 'Téléchargement automatique...'}
        </p>
        <a href="/api/download-bulletin-seed" download="masomo-bulletin-seed.zip"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg">
          <Download className="w-5 h-5" />
          Télécharger le zip
        </a>
      </div>
    </div>
  )
}

