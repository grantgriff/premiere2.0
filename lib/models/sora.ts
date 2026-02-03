// OpenAI Sora API Integration
// Docs: https://platform.openai.com/docs/api-reference/videos
import { GenerationParams, GenerationResult, GenerationStatus } from './types'
import { createClient } from '@supabase/supabase-js'

const OPENAI_API_BASE = 'https://api.openai.com/v1'
const SORA_MODEL = 'sora-2'

// Supabase client for uploading videos
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Support both old and new naming conventions for Supabase keys
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Sora] Missing Supabase configuration:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      checkedVars: ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
    })
    return null
  }
  return createClient(supabaseUrl, supabaseKey)
}

interface SoraGenerationResponse {
  id: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  created_at: number
}

interface SoraStatusResponse {
  id: string
  object?: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  created_at: number
  progress?: number // 0-100 percentage
  model?: string
  seconds?: string
  size?: string
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

    const hasCharacterRef = params.characterReferenceUrls && params.characterReferenceUrls.length > 0

    // IMPORTANT: Character references should NOT use input_reference (image-to-video mode)
    // Image-to-video animates the scene in the photo, not extract character appearance
    // The enhanced prompt already describes the character in detail
    if (hasCharacterRef) {
      console.log(`[Sora] Character detected - using text-to-video mode with enhanced prompt (image-to-video would animate the photo scene, not extract character)`)
    }

    // Build multipart form data
    const formData = new FormData()
    formData.append('model', SORA_MODEL)
    formData.append('prompt', params.prompt)
    formData.append('seconds', seconds.toString())
    formData.append('size', size)

    // Add image reference ONLY for style references, NOT for characters
    if (params.styleReferenceUrl && !hasCharacterRef) {
      try {
        console.log(`[Sora] Fetching style reference image: ${params.styleReferenceUrl.substring(0, 60)}...`)
        const imageResponse = await fetch(params.styleReferenceUrl)
        if (imageResponse.ok) {
          const imageBlob = await imageResponse.blob()
          // Determine file extension from URL or content-type
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
          const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpeg'
          formData.append('input_reference', imageBlob, `reference.${ext}`)
          console.log(`[Sora] Added reference image (${imageBlob.size} bytes, ${contentType})`)
        } else {
          console.warn(`[Sora] Failed to fetch reference image: ${imageResponse.status}`)
        }
      } catch (imgError) {
        console.warn('[Sora] Error fetching reference image:', imgError)
        // Continue without the image - don't fail the request
      }
    }

    console.log('[Sora] Request:', {
      model: SORA_MODEL,
      prompt: params.prompt,
      seconds,
      size,
      hasInputReference: !!imageUrl,
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
    console.log('[Sora] Status:', data.status, `progress: ${data.progress ?? 'N/A'}%`, data.id)

    // Log full response for debugging
    if (data.status !== 'completed') {
      console.log('[Sora] Full status response:', JSON.stringify(data, null, 2))
    }

    switch (data.status) {
      case 'completed':
        // Download video from content endpoint and upload to Supabase for public access
        const videoUrl = await downloadAndUploadSoraVideo(generationId, apiKey)

        if (!videoUrl) {
          // Critical: If download/upload fails, mark as failed instead of returning completed without URL
          return {
            status: 'failed',
            error: 'Failed to download and upload video to storage. Please try again.',
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

// Helper: Download video from OpenAI and upload to Supabase with retry logic
async function downloadAndUploadSoraVideo(
  generationId: string,
  apiKey: string,
  maxRetries: number = 3
): Promise<string | undefined> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Sora] Download attempt ${attempt}/${maxRetries}...`)

      // Download video from OpenAI
      const contentResponse = await fetch(`${OPENAI_API_BASE}/videos/${generationId}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      })

      if (!contentResponse.ok) {
        throw new Error(`Failed to download video: HTTP ${contentResponse.status}`)
      }

      const videoBlob = await contentResponse.blob()
      console.log(`[Sora] Downloaded video: ${videoBlob.size} bytes, type: ${videoBlob.type}`)

      if (videoBlob.size === 0) {
        throw new Error('Downloaded video is empty (0 bytes)')
      }

      // Upload to Supabase storage
      const supabase = getSupabaseClient()
      if (!supabase) {
        throw new Error('Supabase client not available - check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
      }

      const fileName = `sora-${generationId}-${Date.now()}.mp4`
      const filePath = `generated/${fileName}`

      console.log(`[Sora] Uploading to Supabase: ${filePath}`)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, videoBlob, {
          contentType: 'video/mp4',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(`Supabase upload failed: ${uploadError.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL from Supabase')
      }

      console.log(`[Sora] Video uploaded successfully: ${urlData.publicUrl}`)
      return urlData.publicUrl
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[Sora] Attempt ${attempt}/${maxRetries} failed:`, lastError.message)

      // Wait before retry (exponential backoff: 2s, 4s, 8s)
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000
        console.log(`[Sora] Retrying in ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  console.error(`[Sora] All ${maxRetries} download/upload attempts failed:`, lastError?.message)
  return undefined
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
