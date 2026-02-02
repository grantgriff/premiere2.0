// OpenAI Sora API Integration
// Docs: https://platform.openai.com/docs/api-reference/videos
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const OPENAI_API_BASE = 'https://api.openai.com/v1'
const SORA_MODEL = 'sora-2-2025-12-08'

interface SoraGenerationResponse {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: number
}

interface SoraStatusResponse {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: number
  output?: {
    video_url: string
    thumbnail_url?: string
  }
  error?: {
    message: string
    code?: string
  }
}

function getHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

export async function generateWithSora(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    console.error('[Sora] OPENAI_API_KEY environment variable is not set')
    return { success: false, error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' }
  }

  // Validate API key format
  const keyLength = apiKey.length
  const startsCorrectly = apiKey.startsWith('sk-')
  console.log(`[Sora] API key validation - length: ${keyLength}, starts with "sk-": ${startsCorrectly}`)

  if (!startsCorrectly) {
    console.error('[Sora] API key does not start with "sk-" - this may be invalid')
    return { success: false, error: 'OpenAI API key appears to be invalid (should start with "sk-")' }
  }

  try {
    // Map aspect ratio to Sora format
    const aspectRatio = mapAspectRatio(params.aspectRatio || '16:9')

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: SORA_MODEL,
      prompt: params.prompt,
      duration: Math.min(params.duration, 20), // Sora max is typically 20s per generation
      aspect_ratio: aspectRatio,
    }

    // Add image input if provided (for image-to-video)
    if (params.styleReferenceUrl && isImageUrl(params.styleReferenceUrl)) {
      requestBody.image = params.styleReferenceUrl
    }

    console.log('[Sora] Request:', JSON.stringify(requestBody, null, 2))

    const response = await fetch(`${OPENAI_API_BASE}/videos/generations`, {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Sora] API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })

      if (response.status === 429) {
        return { success: false, error: 'OpenAI rate limit exceeded. Please try again later.' }
      }

      if (response.status === 401) {
        return { success: false, error: 'OpenAI API authentication failed. Please check your API key.' }
      }

      if (response.status === 400) {
        try {
          const errorJson = JSON.parse(errorText)
          const errorDetail = errorJson.error?.message || errorJson.message || errorText
          return { success: false, error: `Sora API validation error: ${errorDetail}` }
        } catch {
          return { success: false, error: `Sora API validation error: ${errorText}` }
        }
      }

      if (response.status === 403) {
        return { success: false, error: 'Sora access denied. You may need to enable Sora in your OpenAI account settings.' }
      }

      return { success: false, error: `Sora API error (${response.status}): ${errorText}` }
    }

    const data: SoraGenerationResponse = await response.json()
    console.log('[Sora] Generation started:', data.id)

    return {
      success: true,
      jobId: data.id,
      estimatedTime: params.duration <= 10 ? 45 : 90,
    }
  } catch (error) {
    console.error('[Sora] Generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkSoraStatus(generationId: string): Promise<GenerationStatus> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return { status: 'failed', error: 'OpenAI API key not configured' }
  }

  try {
    const response = await fetch(`${OPENAI_API_BASE}/videos/generations/${generationId}`, {
      method: 'GET',
      headers: getHeaders(apiKey),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'failed', error: 'Generation not found or was deleted' }
      }
      const errorText = await response.text()
      console.error('[Sora] Status check error:', response.status, errorText)
      return { status: 'failed', error: `Failed to check status: ${response.status}` }
    }

    const data: SoraStatusResponse = await response.json()
    console.log('[Sora] Status:', data.status, data.id)

    switch (data.status) {
      case 'completed':
        return {
          status: 'completed',
          videoUrl: data.output?.video_url,
          thumbnailUrl: data.output?.thumbnail_url,
        }
      case 'failed':
        return {
          status: 'failed',
          error: data.error?.message || 'Generation failed',
        }
      case 'running':
        return { status: 'processing' }
      case 'pending':
      default:
        return { status: 'pending' }
    }
  } catch (error) {
    console.error('[Sora] Status check error:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Helper: Map aspect ratio to Sora format
function mapAspectRatio(ratio: string): string {
  const ratioMap: Record<string, string> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
    '4:3': '4:3',
    '3:4': '3:4',
    '21:9': '21:9',
  }
  return ratioMap[ratio] || '16:9'
}

// Helper: Check if URL is likely an image
function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
  const lowerUrl = url.toLowerCase()
  return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
         lowerUrl.includes('image') ||
         (!lowerUrl.includes('video') && !lowerUrl.includes('.mp4') && !lowerUrl.includes('.mov'))
}
