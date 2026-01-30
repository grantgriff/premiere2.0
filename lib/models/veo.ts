// Google Veo 3.1 API Integration
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface VeoGenerateRequest {
  model: string
  contents: {
    role: string
    parts: {
      text?: string
      inlineData?: {
        mimeType: string
        data: string
      }
    }[]
  }[]
  generationConfig: {
    videoDurationSeconds: number
    aspectRatio?: string
  }
}

interface VeoGenerateResponse {
  name: string // Operation name for polling
  done: boolean
  result?: {
    videos: {
      uri: string
      thumbnailUri: string
    }[]
  }
  error?: {
    code: number
    message: string
  }
}

export async function generateWithVeo(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { success: false, error: 'Gemini API key not configured (needed for Veo)' }
  }

  try {
    const request: VeoGenerateRequest = {
      model: 'models/veo-3.1',
      contents: [
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        videoDurationSeconds: params.duration,
        aspectRatio: params.aspectRatio || '16:9',
      },
    }

    // Add style reference if provided
    if (params.styleReferenceUrl) {
      // In production, fetch the image and convert to base64
      request.contents[0].parts.push({
        text: `Style reference: ${params.styleReferenceUrl}`,
      })
    }

    const response = await fetch(
      `${VEO_API_BASE}/models/veo-3.1:generateVideo?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return { success: false, error: `Veo API error: ${error}` }
    }

    const data: VeoGenerateResponse = await response.json()

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    return {
      success: true,
      jobId: data.name,
      estimatedTime: 60,
    }
  } catch (error) {
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
    const response = await fetch(
      `${VEO_API_BASE}/${operationName}?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return { status: 'failed', error: 'Failed to check status' }
    }

    const data: VeoGenerateResponse = await response.json()

    if (data.error) {
      return { status: 'failed', error: data.error.message }
    }

    if (data.done && data.result) {
      return {
        status: 'completed',
        videoUrl: data.result.videos[0]?.uri,
        thumbnailUrl: data.result.videos[0]?.thumbnailUri,
      }
    }

    return { status: 'processing' }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
