// Google Veo 3.1 API Integration (Vertex AI)
// Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo
import { GenerationParams, GenerationResult, GenerationStatus } from './types'
import { GoogleAuth } from 'google-auth-library'
import { supabase, getSupabaseAdmin, STORAGE_BUCKETS } from '../supabase'
import { generateId } from '../utils'

// Vertex AI endpoints
const VERTEX_AI_REGION = 'us-central1'
const VEO_MODEL_CHARACTER = 'veo-3.1-generate-preview' // Preview model with referenceImages support
const VEO_MODEL_FRAME_CHAINING = 'veo-3.1-generate-001' // Production model with first/last frame support

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

function getVertexEndpoint(projectId: string, model: string): string {
  return `https://${VERTEX_AI_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_AI_REGION}/publishers/google/models/${model}`
}

interface VertexVeoRequest {
  instances: Array<{
    prompt: string
    image?: {
      bytesBase64Encoded?: string
      gcsUri?: string
      mimeType?: string
    }
    lastFrame?: {
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
    // Determine which mode to use:
    // - Frame chaining mode: if firstFrameGcsUri OR lastFrameGcsUri is provided
    // - Character reference mode: otherwise
    const useFrameChaining = !!(params.firstFrameGcsUri || params.lastFrameGcsUri)
    const selectedModel = useFrameChaining ? VEO_MODEL_FRAME_CHAINING : VEO_MODEL_CHARACTER

    console.log(`[Veo] Using ${useFrameChaining ? 'FRAME CHAINING' : 'CHARACTER REFERENCE'} mode`)
    console.log(`[Veo] Model: ${selectedModel}`)

    const endpoint = getVertexEndpoint(projectId, selectedModel)

    // Build Vertex AI request format
    const instance: {
      prompt: string
      image?: { gcsUri: string; mimeType: string }
      lastFrame?: { gcsUri: string; mimeType: string }
      referenceImages?: Array<{
        image: { gcsUri: string; mimeType: string }
        referenceType: 'asset' | 'style'
      }>
    } = {
      prompt: params.prompt,
    }

    if (useFrameChaining) {
      // MODE 2: Frame-to-frame chaining
      // Add first frame (image parameter)
      if (params.firstFrameGcsUri) {
        const mimeType = params.firstFrameGcsUri.endsWith('.png')
          ? 'image/png'
          : params.firstFrameGcsUri.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg'

        instance.image = {
          gcsUri: params.firstFrameGcsUri,
          mimeType,
        }
        console.log(`[Veo] First frame: ${params.firstFrameGcsUri.substring(0, 80)}...`)
      }

      // Add last frame (lastFrame parameter)
      if (params.lastFrameGcsUri) {
        const mimeType = params.lastFrameGcsUri.endsWith('.png')
          ? 'image/png'
          : params.lastFrameGcsUri.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg'

        instance.lastFrame = {
          gcsUri: params.lastFrameGcsUri,
          mimeType,
        }
        console.log(`[Veo] Last frame: ${params.lastFrameGcsUri.substring(0, 80)}...`)
      }
    } else {
      // MODE 1: Character reference images
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

            console.log(`[Veo] Adding character as reference asset: ${characterImageUri.substring(0, 80)}...`)
            console.log(`[Veo] MIME type: ${mimeType}`)
          } else {
            console.warn('[Veo] Character image is not a GCS URI. Veo requires gs:// URIs in Vertex AI.')
            console.warn(`[Veo] Skipping: ${characterImageUri.substring(0, 80)}...`)
          }
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
      model: selectedModel,
      mode: useFrameChaining ? 'FRAME_CHAINING' : 'CHARACTER_REFERENCE',
      prompt: params.prompt.substring(0, 100),
      hasFirstFrame: !!instance.image,
      hasLastFrame: !!instance.lastFrame,
      referenceAssets: instance.referenceImages?.length || 0,
    })

    // Debug: Log mode-specific details
    if (useFrameChaining) {
      console.log('[Veo] Frame Chaining Mode:')
      if (instance.image) {
        console.log(`[Veo]   First Frame: ${instance.image.gcsUri?.substring(0, 80)}`)
      }
      if (instance.lastFrame) {
        console.log(`[Veo]   Last Frame: ${instance.lastFrame.gcsUri?.substring(0, 80)}`)
      }
    } else if (instance.referenceImages && instance.referenceImages.length > 0) {
      console.log('[Veo] Character Reference Mode - Reference Images Array:')
      instance.referenceImages.forEach((ref, index) => {
        console.log(`[Veo]   [${index}]:`, {
          referenceType: ref.referenceType,
          imageType: ref.image.gcsUri ? 'gcsUri' : 'base64',
          gcsUri: ref.image.gcsUri?.substring(0, 80),
          mimeType: ref.image.mimeType,
        })
      })
    }

    // Debug: Log the full request body structure
    console.log('[Veo] Request instances[0] keys:', Object.keys(instance))
    console.log('[Veo] Request parameters:', JSON.stringify(requestBody.parameters, null, 2))

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
    // For status checks, we use the character model endpoint
    // The operation name should be valid across both Veo model variants
    const endpoint = getVertexEndpoint(projectId, VEO_MODEL_CHARACTER)

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
    console.log('[Veo] Status check response:', JSON.stringify(data))
    console.log('[Veo] Operation status:', data.done ? 'done' : 'in progress', 'Operation name:', operationName)

    if (data.error) {
      console.error('[Veo] Generation failed:', {
        operationName,
        errorCode: data.error.code,
        errorMessage: data.error.message,
        errorDetails: data.error.details
      })
      return {
        status: 'failed',
        error: data.error.message
      }
    }

    if (data.done && data.response?.videos?.[0]) {
      const video = data.response.videos[0]
      console.log('[Veo] Video object in response:', JSON.stringify(video))

      // Video can be in GCS or base64 - both need to be uploaded to Supabase for public HTTP access
      let videoBlob: Blob

      if (video.gcsUri) {
        // Video stored in GCS - download it and re-upload to Supabase for public access
        console.log('[Veo] Video stored at GCS:', video.gcsUri)
        console.log('[Veo] Downloading from GCS to upload to Supabase...')

        try {
          // Get OAuth2 access token for GCS access
          const accessToken = await getAccessToken()
          if (!accessToken) {
            return {
              status: 'failed',
              error: 'Failed to authenticate with Google Cloud for GCS download'
            }
          }

          // Convert gs://bucket/path to https://storage.googleapis.com/bucket/path
          const gcsUrl = video.gcsUri.replace('gs://', 'https://storage.googleapis.com/')

          const gcsResponse = await fetch(gcsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          if (!gcsResponse.ok) {
            console.error('[Veo] Failed to download from GCS:', gcsResponse.status, gcsResponse.statusText)
            return {
              status: 'failed',
              error: `Failed to download video from GCS: ${gcsResponse.status}`
            }
          }

          videoBlob = await gcsResponse.blob()
          console.log('[Veo] Successfully downloaded video from GCS')

        } catch (error) {
          console.error('[Veo] Error downloading from GCS:', error)
          return {
            status: 'failed',
            error: `Failed to download from GCS: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }

      } else if (video.bytesBase64Encoded) {
        // Video returned as base64 - convert to Blob
        console.log('[Veo] Video returned as base64, converting to blob...')

        try {
          const base64Data = video.bytesBase64Encoded
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          videoBlob = new Blob([bytes], { type: video.mimeType || 'video/mp4' })
          console.log('[Veo] Successfully converted base64 to blob')

        } catch (error) {
          console.error('[Veo] Error converting base64:', error)
          return {
            status: 'failed',
            error: `Failed to decode base64 video: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }

      } else {
        return {
          status: 'failed',
          error: 'Video has neither gcsUri nor bytesBase64Encoded'
        }
      }

      // Upload to Supabase storage using admin client (bypasses RLS)
      try {
        const videoId = generateId()
        const fileName = `veo_${videoId}.mp4`
        const filePath = `generated/${fileName}`

        console.log('[Veo] Uploading to Supabase storage with admin client...')
        console.log('[Veo] Video blob size:', videoBlob.size, 'bytes')
        console.log('[Veo] Upload path:', filePath)
        const supabaseAdmin = getSupabaseAdmin()
        const { data: uploadData, error } = await supabaseAdmin.storage
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

        console.log('[Veo] Upload successful. Path:', uploadData.path)

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from(STORAGE_BUCKETS.VIDEOS)
          .getPublicUrl(uploadData.path)

        console.log('[Veo] Generated public URL:', urlData.publicUrl)

        console.log('[Veo] ✓ Generation completed successfully. Video uploaded to:', urlData.publicUrl)

        return {
          status: 'completed',
          videoUrl: urlData.publicUrl,
          thumbnailUrl: undefined,
        }
      } catch (error) {
        console.error('[Veo] Upload error:', error)
        return {
          status: 'failed',
          error: `Failed to upload video: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }

    // Check for done without video (API bug)
    if (data.done && (!data.response || !data.response.videos || data.response.videos.length === 0)) {
      console.error('[Veo] Operation marked done but no videos in response:', JSON.stringify(data))
      return {
        status: 'failed',
        error: 'Veo marked operation as complete but did not provide video'
      }
    }

    // Still processing
    console.log('[Veo] Still processing...')
    return { status: 'processing' }
  } catch (error) {
    console.error('[Veo] Status check exception:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
