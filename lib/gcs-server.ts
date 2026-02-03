// Server-side GCS utilities
// These functions run on the server and can download from Supabase URLs to upload to GCS

import { uploadToGCS } from './gcs'

/**
 * Download an image from a URL and upload it to GCS
 * Used to mirror character images from Supabase to GCS for Veo API
 */
export async function mirrorImageToGCS(
  sourceUrl: string,
  gcsPath: string
): Promise<{ success: boolean; gcsUri?: string; error?: string }> {
  try {
    console.log(`[GCS Mirror] Downloading from: ${sourceUrl}`)

    // Download the image from Supabase
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to download image: ${response.status} ${response.statusText}`
      }
    }

    const blob = await response.blob()
    console.log(`[GCS Mirror] Downloaded ${blob.size} bytes, type: ${blob.type}`)

    // Upload to GCS
    const result = await uploadToGCS(blob, gcsPath)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to upload to GCS'
      }
    }

    console.log(`[GCS Mirror] Success! GCS URI: ${result.gcsUri}`)

    return {
      success: true,
      gcsUri: result.gcsUri
    }
  } catch (error) {
    console.error('[GCS Mirror] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
