// Google Veo 3.1 API Integration
// Docs: https://ai.google.dev/gemini-api/docs/video
import { GenerationParams, GenerationResult, GenerationStatus } from './types'

const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const VEO_MODEL = 'veo-3.1-fast-generate-preview'

interface VeoGenerateRequest {
  prompt: string
  config?: {
    aspectRatio?: '16:9' | '9:16'
    resolution?: '720p' | '1080p' | '4k'
    durationSeconds?: '4' | '6' | '8' // API expects string values
    personGeneration?: 'allow_all' | 'allow_adult'
    negativePrompt?: string
  }
  image?: {
    bytesBase64Encoded?: string
    mimeType?: string
    fileUri?: string
  }
  // Up to 3 reference images for style/content guidance (Veo 3.1 only)
  referenceImages?: Array<{
    image: {
      fileUri?: string
      bytesBase64Encoded?: string
      mimeType?: string
    }
    // Reference type: 'REFERENCE_TYPE_STYLE' | 'REFERENCE_TYPE_SUBJECT' etc.
    referenceType?: string
  }>
}

interface VeoGenerateResponse {
  name: string // Operation name for polling
  done?: boolean
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
    // Can be either format depending on API version
    generatedVideos?: Array<{
      video: {
        uri: string
        mimeType?: string
      }
    }>
    generateVideoResponse?: {
      generatedSamples: Array<{
        video: {
          uri: string
          mimeType?: string
        }
      }>
    }
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
    // Map duration to allowed values (4, 6, 8) as strings
    let durationSeconds: '4' | '6' | '8' = '8'
    if (params.duration <= 4) durationSeconds = '4'
    else if (params.duration <= 6) durationSeconds = '6'
    else durationSeconds = '8'

    // Map aspect ratio
    const aspectRatio: '16:9' | '9:16' = params.aspectRatio === '9:16' ? '9:16' : '16:9'

    const request: VeoGenerateRequest = {
      prompt: params.prompt,
      config: {
        aspectRatio,
        resolution: '720p', // Default to 720p for faster generation
        durationSeconds,
        personGeneration: 'allow_all', // Required for text-to-video
      },
    }

    // Add image for image-to-video if provided (first frame)
    if (params.styleReferenceUrl) {
      // If it's a file URI or https URL, use fileUri
      if (params.styleReferenceUrl.startsWith('http') || params.styleReferenceUrl.startsWith('gs://')) {
        request.image = {
          fileUri: params.styleReferenceUrl,
        }
      }
      // Note: For base64 images, you'd use bytesBase64Encoded instead
    }

    // Add character reference images (Veo 3.1 supports up to 3 referenceImages)
    if (params.characterReferenceUrls && params.characterReferenceUrls.length > 0) {
      // Take up to 3 character images
      const characterImages = params.characterReferenceUrls.slice(0, 3)
      console.log(`[Veo] Adding ${characterImages.length} character reference image(s)`)

      request.referenceImages = characterImages.map(url => ({
        image: {
          fileUri: url,
        },
        // Use SUBJECT type for character consistency
        referenceType: 'REFERENCE_TYPE_SUBJECT',
      }))

      // Note: When using referenceImages, durationSeconds must be "8" according to docs
      if (request.config && characterImages.length > 0) {
        request.config.durationSeconds = '8'
        console.log('[Veo] Using 8s duration (required with referenceImages)')
      }
    }

    console.log('[Veo] Request:', JSON.stringify(request, null, 2))

    const response = await fetch(
      `${VEO_API_BASE}/models/${VEO_MODEL}:generateVideos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Veo API error response:', response.status, errorText)

      if (response.status === 403) {
        return { success: false, error: 'Veo API access denied. Make sure billing is enabled and Veo API is enabled in your Google Cloud project.' }
      }
      if (response.status === 404) {
        return { success: false, error: 'Veo model not found. The Veo API may not be available in your region.' }
      }
      if (response.status === 429) {
        return { success: false, error: 'Veo rate limit exceeded. Please try again later.' }
      }

      return { success: false, error: `Veo API error (${response.status}): ${errorText}` }
    }

    const data: VeoGenerateResponse = await response.json()
    console.log('Veo response:', JSON.stringify(data, null, 2))

    if (data.error) {
      return { success: false, error: data.error.message }
    }

    if (!data.name) {
      return { success: false, error: 'Veo API did not return an operation name' }
    }

    return {
      success: true,
      jobId: data.name,
      estimatedTime: durationSeconds === '8' ? 45 : 30, // Fast model is quicker
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
    // The operation name is the full path returned from generateVideos
    // Format: operations/{operation_id} or just the operation name
    const opPath = operationName.startsWith('operations/')
      ? operationName
      : `operations/${operationName}`

    const response = await fetch(
      `${VEO_API_BASE}/${opPath}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Veo status check error:', response.status, errorText)
      return { status: 'failed', error: `Failed to check status: ${response.status}` }
    }

    const data: VeoOperationResponse = await response.json()
    console.log('Veo operation status:', data.done ? 'done' : 'pending', data.name)

    if (data.error) {
      return { status: 'failed', error: data.error.message }
    }

    if (data.done && data.response) {
      // Handle both response formats
      let videoUri: string | undefined

      // Format 1: generatedVideos array
      if (data.response.generatedVideos?.[0]?.video?.uri) {
        videoUri = data.response.generatedVideos[0].video.uri
      }
      // Format 2: generateVideoResponse.generatedSamples array
      else if (data.response.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
        videoUri = data.response.generateVideoResponse.generatedSamples[0].video.uri
      }

      if (videoUri) {
        return {
          status: 'completed',
          videoUrl: videoUri,
          thumbnailUrl: undefined, // Veo doesn't provide thumbnails
        }
      }
      return { status: 'failed', error: 'Video generated but no URI returned' }
    }

    // Still processing
    return { status: 'processing' }
  } catch (error) {
    console.error('Veo status check exception:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
