// Google Veo 3.1 API Integration (Vertex AI)
// Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo
import { GenerationParams, GenerationResult, GenerationStatus } from './types'
import { GoogleAuth } from 'google-auth-library'
import { supabase, getSupabaseAdmin, STORAGE_BUCKETS } from '../supabase'
import { generateId } from '../utils'

// Vertex AI endpoints
const VERTEX_AI_REGION = 'us-central1'
const VEO_MODEL = 'veo-3.1-fast-generate-001'

// Cache for auth client
let authClientCache: GoogleAuth | null = null

// Helper to get OAuth access token from Google Cloud service account
async function getAccessToken(): Promise<string | null> {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON

    if (!credentialsJson) {
      console.error('[Veo] GOOGLE_APPLICATION_CREDENTIALS_JSON not configured')
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
    console.error('[Veo] Failed to get access token:', error)
    return null
  }
}

function getVertexEndpoint(projectId: string): string {
  return `https://${VERTEX_AI_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_AI_REGION}/publishers/google/models/${VEO_MODEL}`
}

interface VertexVeoRequest {
  instances: Array<{
    prompt: string
    image?: {
      bytesBase64Encoded?: string
      gcsUri?: string
      mimeType?: string
    }
    referenceImages?: Array<{
      image: {
        bytesBase64Encoded?: string
        gcsUri?: string
        mimeType: string
      }
      referenceType: 'asset' | 'style'
    }>
  }>
  parameters: {
    sampleCount?: number
    resolution?: string
    aspectRatio?: string
    durationSeconds?: string
    storageUri?: string
    generateAudio?: boolean
  }
}

interface VertexOperationResponse {
  name: string
  metadata?: {
    '@type': string
    [key: string]: unknown
  }
  done?: boolean
  error?: {
    code: number
    message: string
    details: unknown[]
  }
  response?: {
    '@type': string
    videos?: Array<{
      gcsUri?: string
      bytesBase64Encoded?: string
      mimeType?: string
    }>
  }
}

export async function generateWithVeo(params: GenerationParams): Promise<GenerationResult> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT

  if (!projectId) {
    return {
      success: false,
      error: 'GOOGLE_CLOUD_PROJECT_ID not configured. Set your Google Cloud project ID in environment variables.'
    }
  }

  // Get OAuth2 access token from service account
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return {
      success: false,
      error: 'Failed to authenticate with Google Cloud. Set GOOGLE_APPLICATION_CREDENTIALS_JSON with your service account JSON in environment variables.'
    }
  }

  try {
    const endpoint = getVertexEndpoint(projectId)

    // Build Vertex AI request format
    const instance: {
      prompt: string
      referenceImages?: Array<{
        image: { gcsUri: string; mimeType: string }
        referenceType: 'asset' | 'style'
      }>
    } = {
      prompt: params.prompt,
    }

    // Add character reference images as assets (not first frame)
    const characterGcsUris = params.characterGcsUris || []

    if (characterGcsUris.length > 0) {
      instance.referenceImages = []

      for (const characterImageUri of characterGcsUris) {
        if (characterImageUri.startsWith('gs://')) {
          // Determine MIME type from file extension
          const mimeType = characterImageUri.endsWith('.png')
            ? 'image/png'
            : characterImageUri.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg' // Default to JPEG for .jpg, .jpeg, or unknown

          instance.referenceImages.push({
            image: {
              gcsUri: characterImageUri,
              mimeType,
            },
            referenceType: 'asset', // Use as reference asset, not first frame
          })

          console.log(`[Veo] Adding character as reference asset (not first frame): ${characterImageUri.substring(0, 80)}...`)
          console.log(`[Veo] MIME type: ${mimeType}`)
        } else {
          console.warn('[Veo] Character image is not a GCS URI. Veo requires gs:// URIs in Vertex AI.')
          console.warn(`[Veo] Skipping: ${characterImageUri.substring(0, 80)}...`)
        }
      }
    }

    // Set up output storage URI for Veo (required when using referenceImages)
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'premiere-characters-grant'
    const outputPath = `veo-outputs/${generateId()}`
    const storageUri = `gs://${bucketName}/${outputPath}`

    const requestBody: VertexVeoRequest = {
      instances: [instance],
      parameters: {
        sampleCount: 1,
        resolution: '720p',
        aspectRatio: params.aspectRatio || '16:9',
        durationSeconds: params.duration.toString(),
        storageUri: storageUri, // Output location for generated video
        generateAudio: false,
      },
    }

    console.log('[Veo] Vertex AI Request:', {
      endpoint: `${endpoint}:predictLongRunning`,
      projectId,
      prompt: params.prompt.substring(0, 100),
      referenceAssets: instance.referenceImages?.length || 0,
    })

    // Debug: Log the full request body to verify structure
    console.log('[Veo] Full request body:', JSON.stringify(requestBody, null, 2))

    const response = await fetch(`${endpoint}:predictLongRunning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Veo] Vertex AI error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })

      if (response.status === 403) {
        return {
          success: false,
          error: 'Veo access denied. Make sure Vertex AI API is enabled and billing is set up in your Google Cloud project.'
        }
      }
      if (response.status === 404) {
        return {
          success: false,
          error: 'Veo model not found in Vertex AI. Make sure you have access to veo-3.1-fast-generate-001 in your project.'
        }
      }
      if (response.status === 400) {
        return {
          success: false,
          error: `Veo request error: ${errorText}. Check that your parameters are correct.`
        }
      }

      return {
        success: false,
        error: `Veo API error (${response.status}): ${errorText}`
      }
    }

    const data: VertexOperationResponse = await response.json()
    console.log('[Veo] Operation started:', data.name)

    if (data.error) {
      return {
        success: false,
        error: data.error.message
      }
    }

    if (!data.name) {
      return {
        success: false,
        error: 'Veo did not return an operation name'
      }
    }

    return {
      success: true,
      jobId: data.name,
      estimatedTime: 60, // Veo takes about 60 seconds
    }
  } catch (error) {
    console.error('[Veo] Generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function checkVeoStatus(operationName: string): Promise<GenerationStatus> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT

  if (!projectId) {
    return {
      status: 'failed',
      error: 'Missing Google Cloud project ID'
    }
  }

  // Get OAuth2 access token
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return {
      status: 'failed',
      error: 'Failed to authenticate with Google Cloud'
    }
  }

  try {
    const endpoint = getVertexEndpoint(projectId)

    // Use fetchPredictOperation endpoint as per Vertex AI docs
    const response = await fetch(`${endpoint}:fetchPredictOperation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        operationName: operationName,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Veo] Status check error:', response.status, errorText)
      return {
        status: 'failed',
        error: `Failed to check status: ${response.status}`
      }
    }

    const data: VertexOperationResponse = await response.json()
    console.log('[Veo] Operation status:', data.done ? 'done' : 'in progress')

    if (data.error) {
      return {
        status: 'failed',
        error: data.error.message
      }
    }

    if (data.done && data.response?.videos?.[0]) {
      const video = data.response.videos[0]

      // Video can be in GCS or base64
      if (video.gcsUri) {
        // Convert gs:// URI to public URL
        // Note: The GCS bucket needs to be publicly accessible or you need to generate a signed URL
        console.log('[Veo] Video stored at:', video.gcsUri)

        return {
          status: 'completed',
          videoUrl: video.gcsUri, // You may need to convert this to a public HTTP URL
          thumbnailUrl: undefined,
        }
      } else if (video.bytesBase64Encoded) {
        // Video returned as base64 - upload to Supabase storage
        console.log('[Veo] Video returned as base64, uploading to Supabase storage...')

        try {
          // Convert base64 to Blob
          const base64Data = video.bytesBase64Encoded
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const videoBlob = new Blob([bytes], { type: video.mimeType || 'video/mp4' })

          // Upload to Supabase storage using admin client (bypasses RLS)
          const videoId = generateId()
          const fileName = `veo_${videoId}.mp4`
          const filePath = `generated/${fileName}`

          console.log('[Veo] Uploading to Supabase storage with admin client...')
          const supabaseAdmin = getSupabaseAdmin()
          const { data, error } = await supabaseAdmin.storage
            .from(STORAGE_BUCKETS.VIDEOS)
            .upload(filePath, videoBlob, {
              contentType: video.mimeType || 'video/mp4',
              cacheControl: '3600',
              upsert: false,
            })

          if (error) {
            console.error('[Veo] Failed to upload video to storage:', error)
            return {
              status: 'failed',
              error: `Failed to upload video: ${error.message}`
            }
          }

          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from(STORAGE_BUCKETS.VIDEOS)
            .getPublicUrl(data.path)

          console.log('[Veo] Video uploaded successfully:', urlData.publicUrl)

          return {
            status: 'completed',
            videoUrl: urlData.publicUrl,
            thumbnailUrl: undefined,
          }
        } catch (uploadError) {
          console.error('[Veo] Error uploading base64 video:', uploadError)
          return {
            status: 'failed',
            error: uploadError instanceof Error ? uploadError.message : 'Failed to upload video'
          }
        }
      }

      return {
        status: 'failed',
        error: 'Video completed but no URL or data returned'
      }
    }

    // Still processing
    return { status: 'processing' }
  } catch (error) {
    console.error('[Veo] Status check exception:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
