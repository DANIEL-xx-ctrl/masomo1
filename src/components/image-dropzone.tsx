'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, ImagePlus, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface ImageDropZoneProps {
  /** Current image URL (for editing existing) */
  currentImage?: string | null
  /** Fallback initials for avatar */
  fallbackInitials?: string
  /** Called when an image is uploaded and processed successfully */
  onImageUploaded: (url: string) => void
  /** Called when the image is removed */
  onImageRemoved?: () => void
  /** Upload folder on server */
  folder?: string
}

/**
 * Process and enhance an image file using canvas:
 * 1. Resize to max 400x400
 * 2. Apply sharpening filter (unsharp mask) to improve blurry photos
 * 3. Convert back to Blob for upload
 */
async function processImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // Step 1: Resize
      const MAX_SIZE = 400
      let width = img.width
      let height = img.height

      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width)
          width = MAX_SIZE
        } else {
          width = Math.round((width * MAX_SIZE) / height)
          height = MAX_SIZE
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height)

      // Step 2: Apply sharpening (unsharp mask convolution)
      // Kernel:
      //  0  -1   0
      // -1   5  -1
      //  0  -1   0
      const imageData = ctx.getImageData(0, 0, width, height)
      const sharpened = applySharpenFilter(imageData, width, height)
      ctx.putImageData(sharpened, 0, 0)

      // Step 3: Apply brightness/contrast boost for dark photos
      const finalData = ctx.getImageData(0, 0, width, height)
      const enhanced = applyBrightnessContrast(finalData, 1.05, 1.1)
      ctx.putImageData(enhanced, 0, 0)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to process image'))
        },
        'image/jpeg',
        0.92
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Apply a sharpening convolution filter to image data
 */
function applySharpenFilter(
  imageData: ImageData,
  width: number,
  height: number
): ImageData {
  const src = imageData.data
  const output = new ImageData(width, height)
  const dst = output.data

  // Sharpening kernel (unsharp mask)
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0,
  ]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            val += src[idx] * kernel[(ky + 1) * 3 + (kx + 1)]
          }
        }
        dst[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, val))
      }
      dst[(y * width + x) * 4 + 3] = src[(y * width + x) * 4 + 3] // alpha
    }
  }

  // Copy edge pixels unchanged
  for (let x = 0; x < width; x++) {
    copyPixel(src, dst, x, 0, width)
    copyPixel(src, dst, x, height - 1, width)
  }
  for (let y = 0; y < height; y++) {
    copyPixel(src, dst, 0, y, width)
    copyPixel(src, dst, width - 1, y, width)
  }

  return output
}

function copyPixel(src: Uint8ClampedArray, dst: Uint8ClampedArray, x: number, y: number, width: number) {
  const i = (y * width + x) * 4
  dst[i] = src[i]
  dst[i + 1] = src[i + 1]
  dst[i + 2] = src[i + 2]
  dst[i + 3] = src[i + 3]
}

/**
 * Apply brightness and contrast adjustment
 */
function applyBrightnessContrast(
  imageData: ImageData,
  brightness: number,
  contrast: number
): ImageData {
  const data = imageData.data
  const output = new ImageData(imageData.width, imageData.height)
  const dst = output.data

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c]
      // Apply contrast
      val = ((val / 255 - 0.5) * contrast + 0.5) * 255
      // Apply brightness
      val *= brightness
      dst[i + c] = Math.min(255, Math.max(0, val))
    }
    dst[i + 3] = data[i + 3] // alpha
  }

  return output
}

export default function ImageDropZone({
  currentImage,
  fallbackInitials = '?',
  onImageUploaded,
  onImageRemoved,
  folder = 'students',
}: ImageDropZoneProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      // Validate
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        setError('Format non supporté. Utilisez JPG, PNG, WebP ou GIF.')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Fichier trop volumineux (max 5 Mo).')
        return
      }

      try {
        setUploading(true)

        // Show preview immediately
        const tempUrl = URL.createObjectURL(file)
        setPreview(tempUrl)

        // Process & enhance the image
        const processedBlob = await processImage(file)

        // Upload to server
        const formData = new FormData()
        formData.append('file', processedBlob, file.name)
        formData.append('folder', folder)

        const res = await fetch('/api/upload-media', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          // Safely parse error response — never assume JSON
          let errorMsg = 'Erreur upload'
          try {
            const ct = res.headers.get('content-type') || ''
            if (ct.includes('application/json')) {
              const err = await res.json()
              errorMsg = err.error || errorMsg
            } else {
              const txt = await res.text()
              errorMsg = txt.substring(0, 120) || `Erreur HTTP ${res.status}`
            }
          } catch {
            errorMsg = `Erreur HTTP ${res.status}`
          }
          throw new Error(errorMsg)
        }

        const data = await res.json()
        // upload-media returns { url: "/api/media/{id}.ext" } which is already a valid API URL
        URL.revokeObjectURL(tempUrl)
        const imageUrl = data.url
        setPreview(imageUrl)
        onImageUploaded(imageUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du traitement de l'image")
        // Revert preview
        setPreview(currentImage || null)
      } finally {
        setUploading(false)
      }
    },
    [currentImage, folder, onImageUploaded]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [handleFile]
  )

  const handleRemove = useCallback(() => {
    setPreview(null)
    setError(null)
    onImageRemoved?.()
  }, [onImageRemoved])

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6
          cursor-pointer transition-all duration-200
          ${dragOver
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10'
          }
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleInputChange}
          className="hidden"
        />

        {preview ? (
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-24 w-24 ring-2 ring-emerald-200 dark:ring-emerald-800">
              <AvatarImage src={preview} alt="Photo de l'élève" />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl font-bold">
                {fallbackInitials}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs text-muted-foreground">
              {uploading ? 'Traitement en cours...' : 'Cliquer ou glisser pour changer'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              {uploading ? (
                <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
              ) : (
                <ImagePlus className="h-6 w-6 text-emerald-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {uploading ? 'Traitement et amélioration...' : 'Glisser une photo ici'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ou cliquer pour parcourir — JPG, PNG, WebP (max 5 Mo)
              </p>
            </div>
          </div>
        )}

        {/* Enhancement indicator */}
        {!uploading && !preview && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-3 w-3" />
            Amélioration automatique des images floues
          </div>
        )}
        {uploading && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Amélioration de la netteté en cours...
          </div>
        )}
      </div>

      {/* Remove button */}
      {preview && !uploading && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleRemove()
          }}
          className="w-full gap-2 text-destructive hover:text-destructive"
        >
          <X className="h-3 w-3" />
          Supprimer la photo
        </Button>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  )
}
