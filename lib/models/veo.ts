// Google Veo 3.1 API Integration (Vertex AI)
// Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

// Vertex AI endpoints
const VERTEX_AI_REGION = 'us-central1'
const VEO_MODEL = 'veo-3.1-fast-generate-001'

// Helper to get OAuth access token from Google Cloud
async function getAccessToken(): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  // For now, we'll use API keys as a workaround since Vertex AI OAuth is complex
  // In production, you'd want to use service account JSON or application default credentials
  if (apiKey) {
    // Try to exchange API key for access token (this is a fallback)
    return apiKey
  }

  console.error('[Veo] No authentication method available')
  return null
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
    }
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
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!projectId) {
    return {
      success: false,
      error: 'GOOGLE_CLOUD_PROJECT_ID not configured. Set your Google Cloud project ID in environment variables.'
    }
  }

  if (!apiKey) {
    return {
      success: false,
      error: 'Google AI API key not configured. Set GOOGLE_AI_API_KEY in environment variables.'
    }
  }

  try {
    const endpoint = getVertexEndpoint(projectId)

    // Build Vertex AI request format
    const instance: { prompt: string; image?: { gcsUri: string } } = {
      prompt: params.prompt,
    }

    // Add character reference image if provided (use first one)
    if (params.characterReferenceUrls && params.characterReferenceUrls.length > 0) {
      const imageUrl = params.characterReferenceUrls[0]
      console.log(`[Veo] Adding character reference image: ${imageUrl.substring(0, 60)}...`)

      // If it's a GCS URI, use directly; otherwise we'd need to convert
      if (imageUrl.startsWith('gs://')) {
        instance.image = { gcsUri: imageUrl }
      } else {
        console.warn('[Veo] Image URL is not a GCS URI. Veo only supports gs:// URIs for images in Vertex AI.')
        console.warn('[Veo] You may need to upload the image to Google Cloud Storage first.')
      }
    }

    const requestBody: VertexVeoRequest = {
      instances: [instance],
      parameters: {
        sampleCount: 1,
        resolution: '720p',
        aspectRatio: params.aspectRatio || '16:9',
        durationSeconds: params.duration.toString(),
        generateAudio: false,
      },
    }

    console.log('[Veo] Vertex AI Request:', {
      endpoint: `${endpoint}:predictLongRunning`,
      projectId,
      prompt: params.prompt.substring(0, 100),
      hasImage: !!instance.image,
    })

    const response = await fetch(`${endpoint}:predictLongRunning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey, // Using API key for now
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
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!projectId || !apiKey) {
    return {
      status: 'failed',
      error: 'Missing Google Cloud project ID or API key'
    }
  }

  try {
    const endpoint = getVertexEndpoint(projectId)

    // Use fetchPredictOperation endpoint as per Vertex AI docs
    const response = await fetch(`${endpoint}:fetchPredictOperation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
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
        // Video returned as base64 - need to upload to your storage
        console.log('[Veo] Video returned as base64, needs to be uploaded')
        return {
          status: 'failed',
          error: 'Veo returned base64 video - need to implement upload to storage'
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
