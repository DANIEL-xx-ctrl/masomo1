// ============================================================================
// generate-icons.mjs
//
// Generates all PWA icons required for cross-platform installability:
//   - favicon-16x16.png, favicon-32x32.png, favicon.ico (browser tab)
//   - apple-touch-icon.png (180×180 — iOS home screen)
//   - icon-72x72.png … icon-512x512.png (Android home screen + splash)
//   - icon-192x192-maskable.png, icon-512x512-maskable.png (Android adaptive icons)
//
// Source: a hand-crafted SVG (MASOMO emerald gradient + white graduation cap)
// rendered to PNG via sharp (librsvg under the hood).
//
// Usage:  bun run scripts/generate-icons.mjs
// ============================================================================
import sharp from 'sharp'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const PUBLIC_DIR = join(process.cwd(), 'public')
const ICONS_DIR = join(PUBLIC_DIR, 'icons')
mkdirSync(ICONS_DIR, { recursive: true })

// ---- Source SVG: emerald gradient rounded square + white graduation cap ----
// viewBox 0 0 512 512. The cap is centred with safe padding for maskable use.
// Background fills the full 512×512 so it works as a maskable icon too
// (the "safe zone" is the inner 80%; the cap sits well inside it).
const APP_ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <!-- Full-bleed gradient background (no rounded corners — the platform
       masks the icon itself on Android/iOS). For non-maskable contexts the
       platform shows the full square which still looks clean. -->
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- Graduation cap, centred, ~60% of the canvas -->
  <g fill="#ffffff">
    <!-- Mortarboard (the flat square top) -->
    <path d="M256 140 L426 210 L256 280 L86 210 Z"/>
    <!-- Cap base (the dome under the mortarboard) -->
    <path d="M170 248 L170 320 Q170 360 256 360 Q342 360 342 320 L342 248 L256 296 Z"/>
    <!-- Tassel -->
    <path d="M408 214 L408 300 Q408 316 396 316 Q384 316 384 300 L384 214 Z"/>
    <circle cx="390" cy="322" r="14"/>
  </g>
</svg>`

// ---- Sizes to generate ----
const SIZES = [
  { size: 16,   name: 'favicon-16x16.png' },
  { size: 32,   name: 'favicon-32x32.png' },
  { size: 72,   name: 'icon-72x72.png' },
  { size: 96,   name: 'icon-96x96.png' },
  { size: 128,  name: 'icon-128x128.png' },
  { size: 144,  name: 'icon-144x144.png' },
  { size: 152,  name: 'icon-152x152.png' },
  { size: 180,  name: 'apple-touch-icon.png' },
  { size: 192,  name: 'icon-192x192.png' },
  { size: 384,  name: 'icon-384x384.png' },
  { size: 512,  name: 'icon-512x512.png' },
]

// ---- Maskable variant: same icon but with extra padding so the "safe zone"
//      (inner 80%) contains the cap. Android masks the icon into circles,
//      squircles, etc. — without padding the corners get clipped. ----
const APP_ICON_MASKABLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- Cap scaled to 50% and centred → sits inside the 80% safe zone -->
  <g fill="#ffffff" transform="translate(128 128) scale(0.5)">
    <path d="M256 140 L426 210 L256 280 L86 210 Z"/>
    <path d="M170 248 L170 320 Q170 360 256 360 Q342 360 342 320 L342 248 L256 296 Z"/>
    <path d="M408 214 L408 300 Q408 316 396 316 Q384 316 384 300 L384 214 Z"/>
    <circle cx="390" cy="322" r="14"/>
  </g>
</svg>`

const MASKABLE_SIZES = [
  { size: 192, name: 'icon-192x192-maskable.png' },
  { size: 512, name: 'icon-512x512-maskable.png' },
]

console.log('Generating MASOMO PWA icons…')

// Generate standard icons
for (const { size, name } of SIZES) {
  const outPath = join(ICONS_DIR, name)
  await sharp(Buffer.from(APP_ICON_SVG))
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`  ✓ ${name} (${size}×${size})`)
}

// Generate maskable icons
for (const { size, name } of MASKABLE_SIZES) {
  const outPath = join(ICONS_DIR, name)
  await sharp(Buffer.from(APP_ICON_MASKABLE_SVG))
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`  ✓ ${name} (${size}×${size} maskable)`)
}

// ---- Generate favicon.ico (multi-size ICO: 16+32+48) ----
// sharp can't write .ico directly, but a 32×32 PNG renamed to .ico works in
// all modern browsers. For a true multi-res ICO we'd need ico-toys; the PNG
// approach is universally supported.
const fav32 = await sharp(Buffer.from(APP_ICON_SVG)).resize(32, 32).png().toBuffer()
writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), fav32)
console.log('  ✓ favicon.ico (32×32, copied to public/ root)')

// ---- Also save the master SVG to public/icons/ for reference ----
writeFileSync(join(ICONS_DIR, 'app-icon.svg'), APP_ICON_SVG)
console.log('  ✓ app-icon.svg (master vector)')

console.log('\n✅ All icons generated in public/icons/')
console.log('   Standard: 11 PNG sizes (16 → 512) + favicon.ico')
console.log('   Maskable: 2 PNG sizes (192, 512) for Android adaptive icons')
