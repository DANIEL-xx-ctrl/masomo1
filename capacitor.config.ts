import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.masomo.app',
  appName: 'MASOMO',
  webDir: 'out', // Next.js static export output (non utilisé en mode server.url)
  server: {
    // Pour une app Next.js SSR, on pointe vers le serveur en cours d'exécution
    // plutôt que vers les fichiers statiques. L'utilisateur lance `bun run start`
    // (port 3000) et l'app native charge cette URL.
    url: 'http://localhost:3000',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#10b981',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
    },
  },
}

export default config
