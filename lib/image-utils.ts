// Image utilities for character images
// Ensures images are properly sized for video generation models

/**
 * Standard video dimensions for character images
 * Using 1280x720 (720p 16:9) as it's supported by all models
 */
export const VIDEO_DIMENSIONS = {
  width: 1280,
  height: 720,
} as const

/**
 * Resize an image file to match video generation requirements
 *
 * Sora requires input images to match output video dimensions exactly.
 * Other models (Luma, Runway) benefit from consistent aspect ratios.
 *
 * This function:
 * - Loads the image
 * - Resizes to 1280x720 (720p 16:9)
 * - Maintains quality with smooth scaling
 * - Returns as a Blob ready for upload
 *
 * @param file - The original image file
 * @returns Resized image as a Blob
 */
export async function resizeImageForVideo(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }

    img.onload = () => {
      // Set canvas to target video dimensions
      canvas.width = VIDEO_DIMENSIONS.width
      canvas.height = VIDEO_DIMENSIONS.height

      // Draw image scaled to fill canvas (may crop)
      // Using 'cover' strategy: image fills entire canvas, maintaining aspect ratio
      const imgAspect = img.width / img.height
      const canvasAspect = canvas.width / canvas.height

      let drawWidth = canvas.width
      let drawHeight = canvas.height
      let offsetX = 0
      let offsetY = 0

      if (imgAspect > canvasAspect) {
        // Image is wider - fit height, crop width
        drawWidth = canvas.height * imgAspect
        drawHeight = canvas.height
        offsetX = (canvas.width - drawWidth) / 2
      } else {
        // Image is taller - fit width, crop height
        drawWidth = canvas.width
        drawHeight = canvas.width / imgAspect
        offsetY = (canvas.height - drawHeight) / 2
      }

      // Fill background (in case of transparency)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw image centered and scaled
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

      // Convert to Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log(`[ImageUtils] Resized image: ${img.width}x${img.height} → ${VIDEO_DIMENSIONS.width}x${VIDEO_DIMENSIONS.height}`)
            console.log(`[ImageUtils] Original size: ${(file.size / 1024).toFixed(1)}KB, New size: ${(blob.size / 1024).toFixed(1)}KB`)
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob from canvas'))
          }
        },
        'image/jpeg',
        0.92 // High quality JPEG
      )
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // Load the image
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        img.src = e.target.result as string
      }
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Get image dimensions without loading the full image
 * Useful for validation before resizing
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        img.src = e.target.result as string
      }
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    reader.readAsDataURL(file)
  })
}
