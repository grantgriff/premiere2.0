// Luma AI (Ray 2) API Integration
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const LUMA_API_BASE = 'https://api.lumalabs.ai/dream-machine/v1'
const LUMA_MODEL = 'ray-flash-2' // Ray 2 Flash - faster model

interface LumaKeyframe {
  type: 'image' | 'generation'
  url?: string
  id?: string
}

interface LumaGenerateRequest {
  prompt: string
  model: string
  aspect_ratio?: string
  resolution?: '540p' | '720p' | '1080p' | '4k'
  duration?: string // "5s" format
  loop?: boolean
  keyframes?: {
    frame0?: LumaKeyframe
    frame1?: LumaKeyframe
  }
  callback_url?: string
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
  request?: {
    prompt: string
    aspect_ratio?: string
    loop?: boolean
    keyframes?: Record<string, unknown>
  }
}

export async function generateWithLuma(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.LUMA_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Luma API key not configured' }
  }

  try {
    const request: LumaGenerateRequest = {
      prompt: params.prompt,
      model: LUMA_MODEL,
      aspect_ratio: params.aspectRatio || '16:9',
      resolution: '720p',
      duration: `${params.duration || 5}s`,
      loop: false,
    }

    // Add start frame if image URL provided
    if (params.styleReferenceUrl) {
      request.keyframes = {
        frame0: {
          type: 'image',
          url: params.styleReferenceUrl,
        },
      }
    }

    console.log('Luma request:', JSON.stringify(request, null, 2))

    const response = await fetch(`${LUMA_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Luma API error response:', errorText)
      return { success: false, error: `Luma API error: ${response.status} - ${errorText}` }
    }

    const data: LumaGenerateResponse = await response.json()
    console.log('Luma response:', JSON.stringify(data, null, 2))

    return {
      success: true,
      jobId: data.id,
      estimatedTime: 30, // Ray Flash is fast but still takes time
    }
  } catch (error) {
    console.error('Luma generation error:', error)
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
        'Accept': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Luma status check error:', errorText)
      return { status: 'failed', error: `Failed to check status: ${response.status}` }
    }

    const data: LumaGenerateResponse = await response.json()
    console.log('Luma status:', data.state, data.id)

    switch (data.state) {
      case 'completed':
        return {
          status: 'completed',
          videoUrl: data.assets?.video || null,
          thumbnailUrl: null, // Luma doesn't return separate thumbnail
        }
      case 'failed':
        return { status: 'failed', error: data.failure_reason || 'Generation failed' }
      case 'dreaming':
        return { status: 'processing' }
      case 'queued':
      default:
        return { status: 'pending' }
    }
  } catch (error) {
    console.error('Luma status check error:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Helper to create image-to-video generation
export async function generateImageToVideo(
  prompt: string,
  imageUrl: string,
  duration: number = 5
): Promise<GenerationResult> {
  return generateWithLuma({
    prompt,
    duration,
    styleReferenceUrl: imageUrl,
  })
}
