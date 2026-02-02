// Luma AI (Ray 2) API Integration
// Docs: https://docs.lumalabs.ai/docs/video-generation
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const LUMA_API_BASE = 'https://api.lumalabs.ai/dream-machine/v1'

// Model names from docs: ray-flash-2 (Ray 2 Flash), ray-2 (Ray 2)
const LUMA_MODEL = 'ray-flash-2'

interface LumaKeyframe {
  type: 'image' | 'generation'
  url?: string
  id?: string
}

interface LumaGenerateResponse {
  id: string
  state: 'queued' | 'dreaming' | 'completed' | 'failed'
  failure_reason?: string | null
  created_at: string
  assets?: {
    video?: string
  }
  version?: string
}

// Valid Luma durations: "5s", "9s", "10s"
const VALID_LUMA_DURATIONS = [5, 9, 10]

function mapToLumaDuration(duration: number): string {
  // Find the closest valid duration
  if (duration <= 5) return '5s'
  if (duration <= 9) return '9s'
  return '10s'
}

export async function generateWithLuma(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.LUMA_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Luma API key not configured' }
  }

  try {
    // Map duration to valid Luma format
    const lumaDuration = mapToLumaDuration(params.duration || 5)

    // Build request body matching exact API spec
    const body: Record<string, unknown> = {
      model: LUMA_MODEL,
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || '16:9',
      resolution: '720p',
      duration: lumaDuration,
      loop: false,
    }

    // Add keyframes for image-to-video (style reference or character image)
    const imageUrl = params.styleReferenceUrl || params.characterReferenceUrls?.[0]
    if (imageUrl) {
      body.keyframes = {
        frame0: {
          type: 'image',
          url: imageUrl,
        },
      }
      if (!params.styleReferenceUrl && params.characterReferenceUrls?.[0]) {
        console.log(`[Luma] Using character reference image as frame0: ${imageUrl.substring(0, 60)}...`)
      }
    }

    console.log('[Luma] Request URL:', `${LUMA_API_BASE}/generations/video`)
    console.log('[Luma] Request body:', JSON.stringify(body, null, 2))

    const response = await fetch(`${LUMA_API_BASE}/generations/video`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const responseText = await response.text()
    console.log('[Luma] Response status:', response.status)
    console.log('[Luma] Response body:', responseText)

    if (!response.ok) {
      return {
        success: false,
        error: `Luma API error (${response.status}): ${responseText}`
      }
    }

    const data: LumaGenerateResponse = JSON.parse(responseText)

    if (!data.id) {
      return { success: false, error: 'Luma API did not return a generation ID' }
    }

    return {
      success: true,
      jobId: data.id,
      estimatedTime: 30,
    }
  } catch (error) {
    console.error('[Luma] Generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkLumaStatus(jobId: string): Promise<GenerationStatus> {
  const apiKey = process.env.LUMA_API_KEY
  if (!apiKey) {
    return { status: 'failed', error: 'Luma API key not configured' }
  }

  try {
    const response = await fetch(`${LUMA_API_BASE}/generations/${jobId}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Luma] Status check error:', response.status, errorText)
      return { status: 'failed', error: `Failed to check status: ${response.status}` }
    }

    const data: LumaGenerateResponse = await response.json()
    console.log('[Luma] Status:', data.state, data.id)

    switch (data.state) {
      case 'completed':
        return {
          status: 'completed',
          videoUrl: data.assets?.video || undefined,
          thumbnailUrl: undefined,
        }
      case 'failed':
        return {
          status: 'failed',
          error: data.failure_reason || 'Generation failed'
        }
      case 'dreaming':
        return { status: 'processing' }
      case 'queued':
      default:
        return { status: 'pending' }
    }
  } catch (error) {
    console.error('[Luma] Status check error:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
