// OpenAI Sora API Integration
// Docs: https://platform.openai.com/docs/api-reference/videos
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const OPENAI_API_BASE = 'https://api.openai.com/v1'
const SORA_MODEL = 'sora-2'

interface SoraGenerationResponse {
  id: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  created_at: number
}

interface SoraStatusResponse {
  id: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  created_at: number
  output_url?: string
  error?: {
    message: string
    code?: string
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
    // Map duration to allowed Sora values (4, 8, or 12 seconds)
    const seconds = mapToSoraDuration(params.duration)

    // Map aspect ratio to Sora resolution
    const size = mapAspectRatioToSize(params.aspectRatio || '16:9')

    // Build multipart form data
    const formData = new FormData()
    formData.append('model', SORA_MODEL)
    formData.append('prompt', params.prompt)
    formData.append('seconds', seconds.toString())
    formData.append('size', size)

    console.log('[Sora] Request:', {
      model: SORA_MODEL,
      prompt: params.prompt,
      seconds,
      size,
    })

    const response = await fetch(`${OPENAI_API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
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
      estimatedTime: seconds <= 8 ? 60 : 120,
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
    const response = await fetch(`${OPENAI_API_BASE}/videos/${generationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
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
        // The video URL is in output_url, but we may need to fetch the content endpoint
        let videoUrl = data.output_url
        if (!videoUrl) {
          // Try fetching from the content endpoint
          const contentResponse = await fetch(`${OPENAI_API_BASE}/videos/${generationId}/content`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
            },
          })
          if (contentResponse.ok) {
            // The content endpoint may redirect to or return the video URL
            videoUrl = contentResponse.url
          }
        }
        return {
          status: 'completed',
          videoUrl,
        }
      case 'failed':
        return {
          status: 'failed',
          error: data.error?.message || 'Generation failed',
        }
      case 'in_progress':
        return { status: 'processing' }
      case 'queued':
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

// Helper: Map duration to Sora allowed values (4, 8, or 12 seconds)
function mapToSoraDuration(duration: number): number {
  if (duration <= 4) return 4
  if (duration <= 8) return 8
  return 12
}

// Helper: Map aspect ratio to Sora resolution size
function mapAspectRatioToSize(ratio: string): string {
  // Sora allowed sizes: 720x1280, 1280x720, 1024x1792, 1792x1024
  const sizeMap: Record<string, string> = {
    '16:9': '1280x720',   // Landscape
    '9:16': '720x1280',   // Portrait
    '1:1': '1280x720',    // Default to landscape for square (Sora doesn't support 1:1)
    '4:3': '1280x720',    // Closest landscape
    '3:4': '720x1280',    // Closest portrait
    '21:9': '1792x1024',  // Ultra-wide landscape
    '9:21': '1024x1792',  // Ultra-tall portrait
  }
  return sizeMap[ratio] || '1280x720'
}
