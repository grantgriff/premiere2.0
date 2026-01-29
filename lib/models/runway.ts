// Runway Gen-3 API Integration
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const RUNWAY_API_BASE = 'https://api.runwayml.com/v1'

interface RunwayGenerateRequest {
  prompt: string
  duration: number
  model: string
  aspectRatio?: string
  seed?: number
  motion?: number
  styleReference?: {
    url: string
    weight: number
  }
}

interface RunwayGenerateResponse {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'
  output?: {
    video_url: string
    thumbnail_url: string
  }
  error?: string
}

export async function generateWithRunway(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Runway API key not configured' }
  }

  try {
    const request: RunwayGenerateRequest = {
      prompt: params.prompt,
      duration: Math.min(params.duration, 18), // Runway max is 18s
      model: 'gen-3-alpha',
      aspectRatio: params.aspectRatio || '16:9',
    }

    // Add style reference if provided
    if (params.styleReferenceUrl && params.styleInfluence) {
      request.styleReference = {
        url: params.styleReferenceUrl,
        weight: params.styleInfluence / 100,
      }
    }

    const response = await fetch(`${RUNWAY_API_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `Runway API error: ${error}` }
    }

    const data: RunwayGenerateResponse = await response.json()

    return {
      success: true,
      jobId: data.id,
      estimatedTime: 45,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkRunwayStatus(jobId: string): Promise<GenerationStatus> {
  const apiKey = process.env.RUNWAY_API_KEY
  if (!apiKey) {
    return { status: 'failed', error: 'Runway API key not configured' }
  }

  try {
    const response = await fetch(`${RUNWAY_API_BASE}/generations/${jobId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      return { status: 'failed', error: 'Failed to check status' }
    }

    const data: RunwayGenerateResponse = await response.json()

    switch (data.status) {
      case 'SUCCEEDED':
        return {
          status: 'completed',
          videoUrl: data.output?.video_url,
          thumbnailUrl: data.output?.thumbnail_url,
        }
      case 'FAILED':
        return { status: 'failed', error: data.error || 'Generation failed' }
      case 'PROCESSING':
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
