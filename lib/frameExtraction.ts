/**
 * Utility functions for extracting frames from videos
 * Used for video chaining in the Movies feature
 */

/**
 * Extract a frame from a video at a specific time
 * @param videoUrl - URL of the video
 * @param timeInSeconds - Time to extract frame (default: last frame)
 * @param quality - JPEG quality (0-1, default: 0.95)
 * @returns Blob of the extracted frame as JPEG
 */
export async function extractFrameFromVideo(
  videoUrl: string,
  timeInSeconds?: number,
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      // If no time specified, use last frame (duration - 0.1 seconds)
      const targetTime = timeInSeconds !== undefined ? timeInSeconds : Math.max(0, video.duration - 0.1)
      video.currentTime = targetTime
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Draw the current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create blob from canvas'))
            }
            // Cleanup
            video.src = ''
            video.load()
          },
          'image/jpeg',
          quality
        )
      } catch (error) {
        reject(error)
      }
    }

    video.onerror = () => {
      reject(new Error('Failed to load video'))
    }

    // Start loading
    video.src = videoUrl
  })
}

/**
 * Extract the first frame from a video
 * @param videoUrl - URL of the video
 * @param quality - JPEG quality (0-1, default: 0.95)
 * @returns Blob of the extracted frame as JPEG
 */
export async function extractFirstFrame(videoUrl: string, quality: number = 0.95): Promise<Blob> {
  return extractFrameFromVideo(videoUrl, 0.1, quality)
}

/**
 * Extract the last frame from a video
 * @param videoUrl - URL of the video
 * @param quality - JPEG quality (0-1, default: 0.95)
 * @returns Blob of the extracted frame as JPEG
 */
export async function extractLastFrame(videoUrl: string, quality: number = 0.95): Promise<Blob> {
  return extractFrameFromVideo(videoUrl, undefined, quality)
}

/**
 * Extract both first and last frames from a video
 * @param videoUrl - URL of the video
 * @param quality - JPEG quality (0-1, default: 0.95)
 * @returns Object with firstFrame and lastFrame blobs
 */
export async function extractBothFrames(
  videoUrl: string,
  quality: number = 0.95
): Promise<{ firstFrame: Blob; lastFrame: Blob }> {
  const [firstFrame, lastFrame] = await Promise.all([
    extractFirstFrame(videoUrl, quality),
    extractLastFrame(videoUrl, quality),
  ])

  return { firstFrame, lastFrame }
}

/**
 * Upload a frame blob to storage
 * @param frameBlob - The frame blob to upload
 * @param uploadFn - Upload function (e.g., uploadToStorage from supabase)
 * @param bucket - Storage bucket name
 * @param path - Path within the bucket
 * @returns URL of the uploaded frame
 */
export async function uploadFrame(
  frameBlob: Blob,
  uploadFn: (bucket: string, path: string, file: File | Blob) => Promise<string | null>,
  bucket: string,
  path: string
): Promise<string | null> {
  return uploadFn(bucket, path, frameBlob)
}
