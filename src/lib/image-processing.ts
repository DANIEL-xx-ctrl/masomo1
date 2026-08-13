/**
 * Image Processing Utilities for Student Photos
 * Uses HTML5 Canvas API for client-side image enhancement
 * - Auto-crop to square (centered)
 * - Resize to optimal dimensions (400x400)
 * - Sharpening (unsharp mask) for blurry photos
 * - Auto brightness & contrast
 * - JPEG compression for smaller file size
 */

// Target size for student photos
const TARGET_SIZE = 400
const JPEG_QUALITY = 0.88

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Impossible de charger l\'image'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Calculate the best square crop region (centered)
 * Prioritizes the center of the image (where faces usually are)
 */
function calculateCenterCrop(imgWidth: number, imgHeight: number): { sx: number; sy: number; size: number } {
  // Use the smaller dimension as the crop size
  const size = Math.min(imgWidth, imgHeight)
  // Center horizontally
  const sx = Math.floor((imgWidth - size) / 2)
  // Bias toward the top vertically (faces are usually in upper portion)
  const sy = Math.floor(Math.min((imgHeight - size) / 2, (imgHeight - size) * 0.3))
  return { sx, sy, size }
}

/**
 * Apply an unsharp mask (sharpening) to canvas pixels
 * This is the key algorithm for fixing blurry photos
 */
function applyUnsharpMask(
  pixels: ImageData,
  amount: number = 0.6,   // Sharpening strength (0-1)
  threshold: number = 3    // Only sharpen if difference > threshold
): ImageData {
  const { width, height, data } = pixels
  const output = new Uint8ClampedArray(data)

  // Kernel for Gaussian blur (simplified 3x3)
  const kernel = [
    0, -1, 0,
    -1, 5 + amount * 4, -1,
    0, -1, 0
  ]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let val = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            val += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)]
          }
        }
        const idx = (y * width + x) * 4 + c
        const diff = val - data[idx]
        // Only apply sharpening where the difference is significant
        if (Math.abs(diff) > threshold) {
          output[idx] = Math.min(255, Math.max(0, data[idx] + diff * amount))
        }
      }
    }
  }

  return new ImageData(output, width, height)
}

/**
 * Auto-adjust brightness and contrast
 * Analyzes the histogram and stretches it for better visibility
 */
function autoAdjustBrightnessContrast(pixels: ImageData): ImageData {
  const { data } = pixels
  const len = data.length

  // Find min and max luminance (skip alpha channel)
  let minLum = 255
  let maxLum = 0

  for (let i = 0; i < len; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    if (lum < minLum) minLum = lum
    if (lum > maxLum) maxLum = lum
  }

  // If the image already has good contrast, skip
  if (maxLum - minLum > 200) return pixels

  // Stretch the histogram
  const range = maxLum - minLum
  if (range === 0) return pixels // All same color

  const output = new Uint8ClampedArray(data)
  // Slightly more aggressive stretch for dark/low-contrast images
  const stretchFactor = 255 / range
  const brightnessOffset = -minLum

  for (let i = 0; i < len; i += 4) {
    for (let c = 0; c < 3; c++) {
      output[i + c] = Math.min(255, Math.max(0, 
        Math.round((data[i + c] + brightnessOffset) * stretchFactor)
      ))
    }
  }

  return new ImageData(output, pixels.width, pixels.height)
}

/**
 * Process an image file: crop, resize, sharpen, enhance
 * Returns a processed File ready for upload
 */
export async function processImage(file: File): Promise<{ file: File; previewUrl: string }> {
  const img = await loadImage(file)

  // 1. Calculate center crop (square)
  const { sx, sy, size } = calculateCenterCrop(img.naturalWidth, img.naturalHeight)

  // 2. Create canvas at target size
  const canvas = document.createElement('canvas')
  canvas.width = TARGET_SIZE
  canvas.height = TARGET_SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // 3. Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 4. Draw the cropped and resized image
  ctx.drawImage(img, sx, sy, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE)

  // 5. Get pixel data for processing
  let pixels = ctx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE)

  // 6. Apply sharpening (unsharp mask) — fixes blurry photos
  pixels = applyUnsharpMask(pixels, 0.5, 2)

  // 7. Auto brightness & contrast
  pixels = autoAdjustBrightnessContrast(pixels)

  // 8. Put processed pixels back
  ctx.putImageData(pixels, 0, 0)

  // 9. Convert to blob
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b!),
      'image/jpeg',
      JPEG_QUALITY
    )
  })

  // 10. Create a new File from the blob
  const processedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  // 11. Generate preview URL
  const previewUrl = URL.createObjectURL(blob)

  // Cleanup
  URL.revokeObjectURL(img.src)

  return { file: processedFile, previewUrl }
}

/**
 * Quick check: analyze if an image likely needs enhancement
 * Returns a score from 0-100 (higher = more blurry/needs processing)
 */
export async function analyzeImageQuality(file: File): Promise<number> {
  const img = await loadImage(file)
  
  // Draw a small version for analysis
  const canvas = document.createElement('canvas')
  const analysisSize = 100
  canvas.width = analysisSize
  canvas.height = analysisSize
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, analysisSize, analysisSize)
  
  const pixels = ctx.getImageData(0, 0, analysisSize, analysisSize)
  const { data } = pixels

  // Measure contrast (standard deviation of luminance)
  let sumLum = 0
  let sumLumSq = 0
  const pixelCount = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sumLum += lum
    sumLumSq += lum * lum
  }

  const meanLum = sumLum / pixelCount
  const variance = (sumLumSq / pixelCount) - (meanLum * meanLum)
  const stdDev = Math.sqrt(Math.max(0, variance))

  // Low contrast = needs enhancement (stdDev < 50 is low contrast)
  let qualityScore = 0
  if (stdDev < 30) qualityScore += 40           // Very low contrast
  else if (stdDev < 50) qualityScore += 20       // Low contrast

  // Dark image = needs brightness boost
  if (meanLum < 80) qualityScore += 30           // Very dark
  else if (meanLum < 120) qualityScore += 15     // Somewhat dark

  // Overexposed
  if (meanLum > 220) qualityScore += 20

  // Large image that will benefit from downscaling + sharpening
  if (img.naturalWidth > 800 || img.naturalHeight > 800) qualityScore += 10

  // Cleanup
  URL.revokeObjectURL(img.src)

  return Math.min(100, qualityScore)
}
