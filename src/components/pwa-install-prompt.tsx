'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show prompt after a small delay so it doesn't appear immediately
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowManualInstructions(true)
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (isInstalled) return null

  return (
    <>
      {/* Floating install button - always visible when PWA is available */}
      {deferredPrompt && !showPrompt && (
        <button
          onClick={() => setShowPrompt(true)}
          className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:scale-105 transition-all cursor-pointer"
          title="Installer MASOMO"
        >
          <Download className="w-5 h-5" />
        </button>
      )}

      {/* Install prompt banner */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-emerald-200 dark:border-emerald-800/50 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">Installer MASOMO</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Installez l&apos;application sur votre appareil pour un accès rapide, même hors connexion.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={handleInstallClick}
                      className="h-7 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 cursor-pointer"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Installer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowManualInstructions(!showManualInstructions)}
                      className="h-7 text-xs cursor-pointer"
                    >
                      Autres options
                    </Button>
                  </div>

                  {/* Manual instructions */}
                  <AnimatePresence>
                    {showManualInstructions && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 p-3 bg-muted/50 rounded-lg text-xs space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <Monitor className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Windows / Mac / Linux</p>
                            <p className="text-muted-foreground">
                              Ouvrez le menu du navigateur (⋮ ou ⋯) → &quot;Installer MASOMO&quot; ou &quot;Ajouter à l&apos;écran d&apos;accueil&quot;
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">Android / iOS</p>
                            <p className="text-muted-foreground">
                              Appuyez sur le menu du navigateur (⋮) → &quot;Ajouter à l&apos;écran d&apos;accueil&quot; ou &quot;Partager&quot; → &quot;Sur l&apos;écran d&apos;accueil&quot;
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="p-1 rounded-md hover:bg-muted transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
