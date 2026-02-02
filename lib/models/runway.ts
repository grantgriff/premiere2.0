// Runway API Integration
// Docs: https://docs.dev.runwayml.com/
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1'
const RUNWAY_API_VERSION = '2024-11-06'

// Models for different input types
const RUNWAY_MODELS = {
  textToVideo: 'veo3.1',        // Text-only uses Veo through Runway
  imageToVideo: 'gen4_turbo',   // Image input uses Gen4 Turbo
  videoToVideo: 'gen4_aleph',   // Video input uses Gen4 Aleph
}

interface RunwayTaskResponse {
  id: string
}

interface RunwayTaskStatus {
  id: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'THROTTLED'
  createdAt: string
  failure?: string
  failureCode?: string
  output?: string[]  // Array of output URLs
  progress?: number
}

function getHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-Runway-Version': RUNWAY_API_VERSION,
  }
}

export async function generateWithRunway(params: GenerationParams): Promise<GenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY?.trim() // Trim whitespace/newlines
  if (!apiKey) {
    console.error('[Runway] RUNWAY_API_KEY environment variable is not set')
    return { success: false, error: 'Runway API key not configured. Please set RUNWAY_API_KEY environment variable.' }
  }

  // Debug: Log key format (not the actual key)
  const keyLength = apiKey.length
  const startsCorrectly = apiKey.startsWith('key_')
  console.log(`[Runway] API key validation - length: ${keyLength}, starts with "key_": ${startsCorrectly}`)

  if (!startsCorrectly) {
    console.error('[Runway] API key does not start with "key_" - this may be invalid')
    return { success: false, error: 'Runway API key appears to be invalid (should start with "key_")' }
  }

  try {
    // Determine which endpoint to use based on input
    const hasImageInput = params.styleReferenceUrl && isImageUrl(params.styleReferenceUrl)
    const hasVideoInput = params.styleReferenceUrl && isVideoUrl(params.styleReferenceUrl)

    let endpoint: string
    let requestBody: Record<string, unknown>

    if (hasVideoInput) {
      // Video-to-video
      endpoint = `${RUNWAY_API_BASE}/video_to_video`
      requestBody = {
        model: RUNWAY_MODELS.videoToVideo,
        videoUri: params.styleReferenceUrl,
        promptText: params.prompt,
        ratio: formatRatio(params.aspectRatio || '16:9'),
      }
    } else if (hasImageInput) {
      // Image-to-video
      endpoint = `${RUNWAY_API_BASE}/image_to_video`
      requestBody = {
        model: RUNWAY_MODELS.imageToVideo,
        promptImage: params.styleReferenceUrl,
        promptText: params.prompt,
        ratio: formatRatio(params.aspectRatio || '16:9'),
        duration: Math.min(params.duration, 10), // Gen4 max is 10s
      }
    } else {
      // Text-to-video
      endpoint = `${RUNWAY_API_BASE}/text_to_video`
      const mappedDuration = mapToVeoDuration(params.duration)
      if (mappedDuration !== params.duration) {
        console.log(`[Runway] Mapped duration ${params.duration}s -> ${mappedDuration}s (Veo requires 4, 6, or 8)`)
      }
      requestBody = {
        model: RUNWAY_MODELS.textToVideo,
        promptText: params.prompt,
        ratio: formatRatioForTextToVideo(params.aspectRatio || '16:9'),
        duration: mappedDuration, // Veo only accepts 4, 6, or 8
        audio: true,
      }
    }

    console.log('Runway request:', endpoint, JSON.stringify(requestBody, null, 2))

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Runway] API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        endpoint: endpoint,
        requestBody: JSON.stringify(requestBody),
      })

      if (response.status === 429) {
        return { success: false, error: 'Runway rate limit exceeded. Please try again later.' }
      }

      if (response.status === 401) {
        return { success: false, error: 'Runway API authentication failed. Please check your API key.' }
      }

      if (response.status === 400) {
        // Try to parse the error for more details
        try {
          const errorJson = JSON.parse(errorText)
          const errorDetail = errorJson.error || errorJson.message || errorText
          return { success: false, error: `Runway API validation error: ${errorDetail}` }
        } catch {
          return { success: false, error: `Runway API validation error: ${errorText}` }
        }
      }

      return { success: false, error: `Runway API error (${response.status}): ${errorText}` }
    }

    const data: RunwayTaskResponse = await response.json()
    console.log('Runway task created:', data.id)

    return {
      success: true,
      jobId: data.id,
      estimatedTime: hasVideoInput ? 60 : hasImageInput ? 45 : 30,
    }
  } catch (error) {
    console.error('Runway generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function checkRunwayStatus(taskId: string): Promise<GenerationStatus> {
  const apiKey = process.env.RUNWAY_API_KEY?.trim()
  if (!apiKey) {
    return { status: 'failed', error: 'Runway API key not configured' }
  }

  try {
    const response = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: getHeaders(apiKey),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'failed', error: 'Task not found or was deleted' }
      }
      const errorText = await response.text()
      console.error('Runway status check error:', response.status, errorText)
      return { status: 'failed', error: `Failed to check status: ${response.status}` }
    }

    const data: RunwayTaskStatus = await response.json()
    console.log('Runway task status:', data.status, data.id)

    switch (data.status) {
      case 'SUCCEEDED':
        return {
          status: 'completed',
          videoUrl: data.output?.[0] || undefined,
          thumbnailUrl: undefined, // Runway doesn't provide separate thumbnail
        }
      case 'FAILED':
        return {
          status: 'failed',
          error: data.failure || data.failureCode || 'Generation failed'
        }
      case 'RUNNING':
        return { status: 'processing' }
      case 'PENDING':
      case 'THROTTLED':
      default:
        return { status: 'pending' }
    }
  } catch (error) {
    console.error('Runway status check error:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Helper: Check if URL is likely an image
function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
  const lowerUrl = url.toLowerCase()
  return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
         lowerUrl.includes('image') ||
         (!lowerUrl.includes('video') && !lowerUrl.includes('.mp4') && !lowerUrl.includes('.mov'))
}

// Helper: Check if URL is likely a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv']
  const lowerUrl = url.toLowerCase()
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('video')
}

// Helper: Format aspect ratio for image-to-video/video-to-video
// Accepted: "1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672"
function formatRatio(ratio: string): string {
  const ratioMap: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '4:3': '1104:832',
    '3:4': '832:1104',
    '1:1': '960:960',
    '21:9': '1584:672',
  }
  return ratioMap[ratio] || '1280:720'
}

// Helper: Format aspect ratio for text-to-video (Veo through Runway)
// Accepted: "1280:720", "720:1280", "1080:1920", "1920:1080"
function formatRatioForTextToVideo(ratio: string): string {
  const ratioMap: Record<string, string> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '1280:720', // No 1:1 for text-to-video, default to 16:9
  }
  return ratioMap[ratio] || '1280:720'
}

// Helper: Map any duration to valid Veo duration (4, 6, or 8 seconds only)
function mapToVeoDuration(duration: number): number {
  // Veo only supports durations of 4, 6, or 8 seconds
  // Map to the nearest valid value
  if (duration <= 5) return 4
  if (duration <= 7) return 6
  return 8
}
