/**
 * Google Cloud Storage upload utilities
 * Used for uploading frames and images that need to be accessed by Veo
 */

import { GoogleAuth } from 'google-auth-library'

// Cache for auth client
let authClientCache: GoogleAuth | null = null

/**
 * Get OAuth access token from Google Cloud service account
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON

    if (!credentialsJson) {
      console.error('[GCS] GOOGLE_APPLICATION_CREDENTIALS_JSON not configured')
      return null
    }

    // Create auth client if not cached
    if (!authClientCache) {
      const credentials = JSON.parse(credentialsJson)
      authClientCache = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })
    }

    // Get access token
    const client = await authClientCache.getClient()
    const accessToken = await client.getAccessToken()

    return accessToken.token || null
  } catch (error) {
    console.error('[GCS] Failed to get access token:', error)
    return null
  }
}

/**
 * Upload a blob to Google Cloud Storage
 * @param bucket - GCS bucket name
 * @param path - Path within the bucket (e.g., "frames/xyz.jpg")
 * @param blob - The blob to upload
 * @param contentType - MIME type (default: image/jpeg)
 * @returns GCS URI (gs://bucket/path) or null if failed
 */
export async function uploadToGCS(
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      console.error('[GCS] Failed to get access token')
      return null
    }

    // Convert blob to array buffer
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to GCS using Storage API
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
      },
      body: buffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GCS] Upload failed:', response.status, errorText)
      return null
    }

    const gcsUri = `gs://${bucket}/${path}`
    console.log('[GCS] Upload successful:', gcsUri)
    return gcsUri

  } catch (error) {
    console.error('[GCS] Upload error:', error)
    return null
  }
}

/**
 * Download an image from a URL and upload to GCS
 * Useful for converting Supabase-hosted frames to GCS URIs
 * @param imageUrl - HTTP(S) URL of the image
 * @param bucket - GCS bucket name
 * @param path - Path within the bucket
 * @returns GCS URI (gs://bucket/path) or null if failed
 */
export async function downloadAndUploadToGCS(
  imageUrl: string,
  bucket: string,
  path: string
): Promise<string | null> {
  try {
    console.log('[GCS] Downloading image from:', imageUrl.substring(0, 80))

    // Download the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error('[GCS] Failed to download image:', response.status)
      return null
    }

    const blob = await response.blob()
    console.log('[GCS] Downloaded blob, size:', blob.size, 'type:', blob.type)

    // Upload to GCS
    return await uploadToGCS(bucket, path, blob, blob.type)

  } catch (error) {
    console.error('[GCS] Download and upload error:', error)
    return null
  }
}

/**
 * Get the default GCS bucket from environment
 */
export function getDefaultGCSBucket(): string {
  return process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'premiere-characters-grant'
}
