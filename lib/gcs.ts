// Google Cloud Storage Upload Utility
// Used for uploading character images so Veo can reference them

interface GCSUploadResult {
  success: boolean
  gcsUri?: string  // gs://bucket/path format
  publicUrl?: string // https://storage.googleapis.com/bucket/path format
  error?: string
}

/**
 * Upload a file to Google Cloud Storage
 * Returns both gs:// URI (for Veo) and public HTTPS URL (for display)
 */
export async function uploadToGCS(
  file: File | Blob,
  path: string
): Promise<GCSUploadResult> {
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GCS_BUCKET
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!bucketName) {
    console.error('[GCS] GOOGLE_CLOUD_STORAGE_BUCKET not configured')
    return {
      success: false,
      error: 'GCS bucket not configured. Set GOOGLE_CLOUD_STORAGE_BUCKET in environment variables.'
    }
  }

  if (!apiKey) {
    console.error('[GCS] Google AI API key not configured')
    return {
      success: false,
      error: 'Google AI API key not configured'
    }
  }

  try {
    // Ensure path doesn't start with /
    const cleanPath = path.startsWith('/') ? path.slice(1) : path

    console.log(`[GCS] Uploading to gs://${bucketName}/${cleanPath}`)

    // Use Google Cloud Storage JSON API
    // Docs: https://cloud.google.com/storage/docs/json_api/v1/objects/insert
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(cleanPath)}`

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-goog-api-key': apiKey,
      },
      body: file,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GCS] Upload failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })

      if (response.status === 404) {
        return {
          success: false,
          error: `GCS bucket '${bucketName}' not found. Create it in Google Cloud Console.`
        }
      }

      if (response.status === 403) {
        return {
          success: false,
          error: 'GCS access denied. Make sure your API key has permission to upload to the bucket.'
        }
      }

      return {
        success: false,
        error: `GCS upload failed (${response.status}): ${errorText}`
      }
    }

    const data = await response.json()
    console.log('[GCS] Upload successful:', data.name)

    // Construct URIs
    const gcsUri = `gs://${bucketName}/${cleanPath}`
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${cleanPath}`

    return {
      success: true,
      gcsUri,
      publicUrl,
    }
  } catch (error) {
    console.error('[GCS] Upload exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete a file from Google Cloud Storage
 */
export async function deleteFromGCS(gcsUri: string): Promise<boolean> {
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || process.env.GCS_BUCKET
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!bucketName || !apiKey) {
    console.error('[GCS] Configuration missing')
    return false
  }

  try {
    // Extract object name from gs:// URI
    const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
    if (!match) {
      console.error('[GCS] Invalid GCS URI:', gcsUri)
      return false
    }

    const [, bucket, objectName] = match

    if (bucket !== bucketName) {
      console.warn(`[GCS] URI bucket (${bucket}) doesn't match configured bucket (${bucketName})`)
    }

    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectName)}`

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'x-goog-api-key': apiKey,
      },
    })

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text()
      console.error('[GCS] Delete failed:', response.status, errorText)
      return false
    }

    console.log('[GCS] Deleted:', objectName)
    return true
  } catch (error) {
    console.error('[GCS] Delete exception:', error)
    return false
  }
}

/**
 * Convert a gs:// URI to a public HTTPS URL
 */
export function gcsUriToHttps(gcsUri: string): string | null {
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!match) {
    return null
  }

  const [, bucket, path] = match
  return `https://storage.googleapis.com/${bucket}/${path}`
}
