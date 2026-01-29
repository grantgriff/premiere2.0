// Luma AI API Integration
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const LUMA_API_BASE = 'https://api.lumalabs.ai/dream-machine/v1'

interface LumaGenerateRequest {
  prompt: string
  aspect_ratio?: string
  loop?: boolean
}

interface LumaGenerateResponse {
  id: string
  state: 'queued' | 'dreaming' | 'completed' | 'failed'
  video?: {
    url: string
    thumbnail_url: string
  }
  failure_reason?: string
}

export async function generateWithLuma(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.LUMA_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Luma API key not configured' }
  }

  try {
    const request: LumaGenerateRequest = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || '16:9',
      loop: false,
    }

    const response = await fetch(`${LUMA_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `Luma API error: ${error}` }
    }

    const data: LumaGenerateResponse = await response.json()

    return {
      success: true,
      jobId: data.id,
      estimatedTime: 10, // Luma is fast
    }
  } catch (error) {
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
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      return { status: 'failed', error: 'Failed to check status' }
    }

    const data: LumaGenerateResponse = await response.json()

    switch (data.state) {
      case 'completed':
        return {
          status: 'completed',
          videoUrl: data.video?.url,
          thumbnailUrl: data.video?.thumbnail_url,
        }
      case 'failed':
        return { status: 'failed', error: data.failure_reason || 'Generation failed' }
      case 'dreaming':
        return { status: 'processing' }
      default:
        return { status: 'pending' }
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
