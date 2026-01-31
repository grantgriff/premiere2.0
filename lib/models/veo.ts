// Google Veo 3.1 API Integration
// Docs: https://ai.google.dev/gemini-api/docs/video
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const VEO_MODEL = 'veo-3.1-generate-preview'

interface VeoGenerateRequest {
  instances: {
    prompt: string
  }[]
  parameters: {
    aspectRatio?: string
    durationSeconds?: number
    personGeneration?: string
  }
}

interface VeoGenerateResponse {
  name: string // Operation name for polling (format: operations/xxx)
  done?: boolean
  metadata?: {
    '@type': string
  }
  error?: {
    code: number
    message: string
    status: string
  }
}

interface VeoOperationResponse {
  name: string
  done: boolean
  metadata?: Record<string, unknown>
  response?: {
    '@type': string
    videos: {
      uri: string
    }[]
  }
  error?: {
    code: number
    message: string
    status: string
  }
}

export async function generateWithVeo(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Gemini API key not configured (needed for Veo). Get one at ai.google.dev' }
  }

  try {
    // Build the prompt with style reference if provided
    let prompt = params.prompt
    if (params.styleReferenceUrl) {
      prompt = `${params.prompt}. Style reference: ${params.styleReferenceUrl}`
    }

    const request: VeoGenerateRequest = {
      instances: [{ prompt }],
      parameters: {
        aspectRatio: params.aspectRatio || '16:9',
        durationSeconds: Math.min(params.duration, 8), // Veo max is 8 seconds per generation
        personGeneration: 'allow_adult',
      },
    }

    const response = await fetch(
      `${VEO_API_BASE}/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Veo API error response:', errorText)

      // Check for common errors
      if (response.status === 403) {
        return { success: false, error: 'Veo API access denied. Make sure billing is enabled on your Google Cloud project and Veo API is enabled.' }
      }
      if (response.status === 404) {
        return { success: false, error: 'Veo model not found. The Veo API may not be available in your region or billing may not be enabled.' }
      }

      return { success: false, error: `Veo API error (${response.status}): ${errorText}` }
    }

    const data: VeoGenerateResponse = await response.json()

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    if (!data.name) {
      return { success: false, error: 'Veo API did not return an operation name' }
    }

    return {
      success: true,
      jobId: data.name,
      estimatedTime: 60,
    }
  } catch (error) {
    console.error('Veo generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkVeoStatus(operationName: string): Promise<GenerationStatus> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { status: 'failed', error: 'Gemini API key not configured' }
  }

  try {
    // The operation name might be a full path or just the operation ID
    const opPath = operationName.startsWith('operations/') ? operationName : `operations/${operationName}`

    const response = await fetch(
      `${VEO_API_BASE}/${opPath}?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Veo status check error:', errorText)
      return { status: 'failed', error: `Failed to check status: ${response.status}` }
    }

    const data: VeoOperationResponse = await response.json()

    if (data.error) {
      return { status: 'failed', error: data.error.message }
    }

    if (data.done && data.response?.videos) {
      const videoUri = data.response.videos[0]?.uri
      return {
        status: 'completed',
        videoUrl: videoUri,
        // Veo doesn't provide thumbnails directly, we'd need to generate one
        thumbnailUrl: undefined,
      }
    }

    return { status: 'processing' }
  } catch (error) {
    console.error('Veo status check exception:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
