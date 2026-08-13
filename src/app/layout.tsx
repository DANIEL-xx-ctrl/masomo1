import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { ToastBridge } from "@/components/toast-bridge";
import ServiceWorkerRegistrar from "@/components/sw-registrar";

// Use system fonts only — `next/font/google` hangs the dev server in this
// sandbox because fonts.gstatic.com is unreachable. CSS variables are
// defined directly in globals.css (:root) so the Tailwind theme keeps working.
const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

// ---- PWA manifest + comprehensive icon set for all platforms ----
// The manifest makes MASOMO installable on Windows, macOS, Linux (Chrome/Edge),
// Android (Chrome), and iOS/iPadOS (Safari Add to Home Screen).
const APP_NAME = "MASOMO - Système de Gestion Scolaire";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Plateforme complète de gestion scolaire pour les établissements francophones",
  applicationName: "MASOMO",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "MASOMO",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/favicon.ico",
    other: [
      // Maskable icon for Android adaptive icons
      {
        rel: "mask-icon",
        url: "/icons/icon-512x512-maskable.png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* PWA meta tags for iOS Safari (Add to Home Screen) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MASOMO" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Android Chrome theme color */}
        <meta name="theme-color" content="#059669" />
        {/* Microsoft tile (Windows Start menu pin) */}
        <meta name="msapplication-TileColor" content="#059669" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <meta name="application-name" content="MASOMO" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ServiceWorkerRegistrar />
          <ToastBridge />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
