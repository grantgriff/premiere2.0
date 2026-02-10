import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateVideo, checkGenerationStatus as checkModelStatus, MODEL_INFO, VideoModelId } from '@/lib/models'
import { checkRateLimit } from '@/lib/queue'
import { generateId, parseCharacterMentions, stripCharacterMentions } from '@/lib/utils'
import { createServerClient } from '@/lib/supabase-server'
import { enhancePromptWithGemini, getPromptToUse, Character } from '@/lib/prompt-enhancer'

// Store active generation jobs for status polling
// Maps internal videoId to external model job info
const activeJobs = new Map<string, {
  model: VideoModelId
  externalJobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
  startedAt: number
}>()

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session
    const supabase = await createServerClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to generate videos.' },
        { status: 401 }
      )
    }

    const userId = authUser.id

    const body = await request.json()
    const {
      prompt,
      model,
      duration,
      conversationId,
      styleReferenceUrls,
      styleReferences,
      characterIds,
      firstFrameUrl,
      lastFrameUrl,
    } = body

    // Validate required fields
    if (!prompt || !model || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, model, duration' },
        { status: 400 }
      )
    }

    // Validate model
    if (!MODEL_INFO[model as VideoModelId]) {
      return NextResponse.json({ error: 'Invalid model specified' }, { status: 400 })
    }

    // Get model info for validation
    const modelInfo = MODEL_INFO[model as VideoModelId]

    // Validate duration against model-specific allowed durations
    if (!modelInfo.allowedDurations.includes(duration)) {
      return NextResponse.json(
        { error: `Invalid duration for ${modelInfo.name}. Allowed: ${modelInfo.allowedDurations.join(', ')} seconds` },
        { status: 400 }
      )
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(userId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before generating more videos.' },
        { status: 429 }
      )
    }

    // Enforce video generation limit (10 videos max per user)
    const ADMIN_EMAILS = ['grant.griffith.12@gmail.com']
    const isAdmin = ADMIN_EMAILS.includes(authUser.email || '')
    const MAX_VIDEOS_PER_USER = 10

    if (!isAdmin) {
      const videoCount = await prisma.video.count({
        where: { userId },
      })

      if (videoCount >= MAX_VIDEOS_PER_USER) {
        return NextResponse.json(
          { error: `You've reached the maximum of ${MAX_VIDEOS_PER_USER} videos. Please contact us to unlock more.` },
          { status: 403 }
        )
      }
    }

    // Ensure user record exists (needed for database relationships)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      // Auto-create user record from authenticated session
      // This happens on first video generation after Google OAuth login
      const userMetadata = authUser.user_metadata || {}
      const googleId = authUser.app_metadata?.provider === 'google'
        ? authUser.user_metadata?.provider_id || authUser.id
        : authUser.id

      await prisma.user.create({
        data: {
          id: userId,
          email: authUser.email || `user-${userId.slice(0, 8)}@premiere.app`,
          name: userMetadata.full_name || userMetadata.name || `User ${userId.slice(0, 8)}`,
          googleId: googleId,
          avatarUrl: userMetadata.avatar_url || userMetadata.picture || null,
          credits: 0, // Credits not used - unlimited generations
        },
      })
      console.log(`[Generate] Created user record for ${authUser.email}`)
    }

    // Get or create conversation
    let convId = conversationId
    if (!convId) {
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
        },
      })
      convId = conversation.id
    }

    // Parse character mentions
    const mentionedCharacters = parseCharacterMentions(prompt)

    // Fetch character reference images if characters are selected
    let characterReferenceUrls: string[] = []
    let characterGcsUris: string[] = []
    let characterData: Character[] = []
    let characterWarning: string | null = null
    if (characterIds && characterIds.length > 0) {
      console.log(`[Generate] Fetching ${characterIds.length} character(s):`, characterIds)

      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('id, name, description, reference_image_url, gcs_image_uri')
        .in('id', characterIds)
        .eq('user_id', userId)

      if (charError) {
        console.error('[Generate] Error fetching characters:', charError)
        characterWarning = 'Could not load character data. Video will generate without character references.'
      } else if (characters && characters.length > 0) {
        // Store character data for prompt enhancement
        characterData = characters as Character[]

        // Extract both GCS URIs (for Veo) and HTTP URLs (for Luma/Runway/Sora)
        characterGcsUris = characters
          .map(c => c.gcs_image_uri)
          .filter((url): url is string => url !== null && url !== undefined)

        characterReferenceUrls = characters
          .map(c => c.reference_image_url)
          .filter((url): url is string => url !== null && url !== undefined)

        // Warn if characters exist but have no image references
        const charsWithoutGcs = characters.filter(c => !c.gcs_image_uri)
        if (charsWithoutGcs.length > 0) {
          const names = charsWithoutGcs.map(c => c.name).join(', ')
          console.warn(`[Generate] ⚠️ Characters missing GCS URI (Veo won't use their images): ${names}`)
          characterWarning = `Character image for "${names}" hasn't been synced to Google Cloud yet. Veo will use a text description instead — the character may not match the reference photo.`
        }

        console.log(`[Generate] Found ${characterGcsUris.length} GCS URI(s) and ${characterReferenceUrls.length} HTTP URL(s)`)
        if (characterGcsUris.length > 0) {
          console.log(`[Generate] GCS URIs (for Veo): ${characterGcsUris.join(', ')}`)
        }
        if (characterReferenceUrls.length > 0) {
          // Test accessibility of character image URLs
          await Promise.all(characterReferenceUrls.map(async (url, i) => {
            console.log(`[Generate] HTTP URL ${i + 1}: ${url.substring(0, 80)}...`)
            try {
              const testResponse = await fetch(url, { method: 'HEAD' })
              if (!testResponse.ok) {
                console.error(`[Generate] ⚠️ Character image ${i + 1} is NOT accessible! Status: ${testResponse.status}`)
              } else {
                console.log(`[Generate] ✓ Character image ${i + 1} is accessible`)
              }
            } catch (testError) {
              console.error(`[Generate] ⚠️ Failed to test character image ${i + 1}:`, testError)
            }
          }))
        }
      } else {
        console.warn(`[Generate] ⚠️ Character query returned ZERO results for IDs:`, characterIds)
        characterWarning = 'Character data could not be found. Video will generate without character references.'
      }
    }

    // Determine the primary style reference (image or video URL)
    // styleReferences contains typed references: { type: 'youtube' | 'upload' | 'url', url, title? }
    let primaryStyleUrl: string | undefined
    let styleReferenceType: 'image' | 'video' | undefined
    if (styleReferences && styleReferences.length > 0) {
      // Use the first uploaded/URL reference (prioritize direct uploads over YouTube)
      const directRef = styleReferences.find((r: { type: string; url: string }) =>
        r.type === 'upload' || r.type === 'url'
      )
      primaryStyleUrl = directRef?.url || styleReferences[0]?.url

      // Detect if it's an image or video based on URL
      if (primaryStyleUrl) {
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(primaryStyleUrl)
        const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(primaryStyleUrl) || primaryStyleUrl.includes('youtube')
        styleReferenceType = isImage ? 'image' : isVideo ? 'video' : undefined
      }
    } else if (styleReferenceUrls && styleReferenceUrls.length > 0) {
      primaryStyleUrl = styleReferenceUrls[0]
      if (primaryStyleUrl) {
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(primaryStyleUrl)
        const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(primaryStyleUrl)
        styleReferenceType = isImage ? 'image' : isVideo ? 'video' : undefined
      }
    }

    // ===== PROMPT ENHANCEMENT WITH GEMINI 2.5 PRO =====
    // Enhance the prompt for better video generation, especially with characters
    console.log('[Generate] Enhancing prompt with Gemini 2.5 Pro...')
    const hasCharacterImages = characterReferenceUrls.length > 0 || characterGcsUris.length > 0

    // Strip @mentions from prompt before enhancement to avoid duplication
    // Example: "generate @Grant climbing" -> "generate climbing"
    const promptForEnhancement = stripCharacterMentions(prompt)
    console.log('[Generate] Prompt after stripping @mentions:', promptForEnhancement)

    const enhancementResult = await enhancePromptWithGemini({
      originalPrompt: promptForEnhancement,
      characters: characterData.length > 0 ? characterData : undefined,
      hasCharacterImages,  // Tell the enhancer if character images will be sent
      hasStyleReference: !!primaryStyleUrl,
      styleReferenceType,
      model,
      duration,
      aspectRatio: '16:9',
    })

    // Use enhanced prompt if available, otherwise fallback to original
    const promptToUse = getPromptToUse(enhancementResult)

    if (enhancementResult.success) {
      console.log('[Generate] ✓ Prompt enhanced successfully')
      console.log('[Generate] Original:', prompt)
      console.log('[Generate] Enhanced:', promptToUse)
    } else {
      console.log('[Generate] ⚠ Prompt enhancement failed, using original prompt')
      if (enhancementResult.error) {
        console.log('[Generate] Enhancement error:', enhancementResult.error)
      }
    }

    // Create video record
    const videoId = generateId()
    console.log(`[Generate] Creating video with ID: ${videoId}`)

    try {
      await prisma.video.create({
        data: {
          id: videoId,
          conversationId: convId,
          userId,
          prompt,
          model: model as VideoModelId,
          duration,
          status: 'pending',
          styleReferenceUrls: JSON.stringify(styleReferenceUrls || []),
          characterIds: JSON.stringify(characterIds || []),
          metadata: JSON.stringify({
            mentionedCharacters,
            styleReferences: styleReferences || [],
            requestedAt: new Date().toISOString(),
            originalPrompt: prompt,
            enhancedPrompt: enhancementResult.success ? promptToUse : undefined,
            promptEnhancementUsed: enhancementResult.success,
          }),
        },
      })
      console.log(`[Generate] Video record created successfully: ${videoId}`)
    } catch (dbError) {
      const dbErrorMessage = dbError instanceof Error ? dbError.message : String(dbError)
      console.error(`[Generate] Failed to create video record:`, dbError)
      return NextResponse.json(
        { error: `Failed to create video record: ${dbErrorMessage}` },
        { status: 500 }
      )
    }

    // Handle frame chaining for video-to-video continuity
    let firstFrameGcsUri: string | undefined
    let lastFrameGcsUri: string | undefined

    if ((firstFrameUrl || lastFrameUrl) && model === 'veo3_1') {
      console.log('[Generate] Frame chaining requested for Veo 3.1')

      // Import GCS upload utility dynamically
      const { downloadAndUploadToGCS, getDefaultGCSBucket } = await import('@/lib/gcsUpload')
      const bucket = getDefaultGCSBucket()

      if (firstFrameUrl) {
        console.log('[Generate] Converting first frame to GCS:', firstFrameUrl.substring(0, 80))
        firstFrameGcsUri = await downloadAndUploadToGCS(
          firstFrameUrl,
          bucket,
          `frames/${userId}/${videoId}_first.jpg`
        ) || undefined
        if (firstFrameGcsUri) {
          console.log('[Generate] First frame GCS URI:', firstFrameGcsUri)
        } else {
          console.warn('[Generate] Failed to upload first frame to GCS')
        }
      }

      if (lastFrameUrl) {
        console.log('[Generate] Converting last frame to GCS:', lastFrameUrl.substring(0, 80))
        lastFrameGcsUri = await downloadAndUploadToGCS(
          lastFrameUrl,
          bucket,
          `frames/${userId}/${videoId}_last.jpg`
        ) || undefined
        if (lastFrameGcsUri) {
          console.log('[Generate] Last frame GCS URI:', lastFrameGcsUri)
        } else {
          console.warn('[Generate] Failed to upload last frame to GCS')
        }
      }

      // Frame chaining mode takes priority - don't use character references
      if (firstFrameGcsUri || lastFrameGcsUri) {
        console.log('[Generate] Using frame chaining mode - character references will be ignored')
        characterGcsUris = []
        characterReferenceUrls = []
      }
    }

    // Actually call the video generation API
    console.log(`[Generate] Starting ${model} generation for video ${videoId}`)
    console.log(`[Generate] Style reference: ${primaryStyleUrl || 'none'}`)
    console.log(`[Generate] Character HTTP URLs: ${characterReferenceUrls.length > 0 ? characterReferenceUrls.length : 'none'}`)
    console.log(`[Generate] Character GCS URIs: ${characterGcsUris.length > 0 ? characterGcsUris.length : 'none'}`)
    console.log(`[Generate] Frame chaining: ${firstFrameGcsUri || lastFrameGcsUri ? 'YES' : 'NO'}`)

    const genResult = await generateVideo(model as VideoModelId, {
      prompt: promptToUse, // Use the enhanced prompt here
      duration,
      aspectRatio: '16:9',
      styleReferenceUrl: primaryStyleUrl,
      characterReferenceUrls: characterReferenceUrls.length > 0 ? characterReferenceUrls : undefined,
      characterGcsUris: characterGcsUris.length > 0 ? characterGcsUris : undefined,
      firstFrameGcsUri,
      lastFrameGcsUri,
    })

    if (!genResult.success || !genResult.jobId) {
      // Model API failed - update status and return error
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'failed' },
      })

      console.log(`[Generate] Failed to start: ${genResult.error}`)

      // Return failure so client shows error immediately (no polling)
      return NextResponse.json({
        success: false,
        error: genResult.error || 'Failed to start video generation',
        videoId,
        conversationId: convId,
      })
    }

    // Store the job mapping for status polling
    activeJobs.set(videoId, {
      model: model as VideoModelId,
      externalJobId: genResult.jobId,
      status: 'processing',
      startedAt: Date.now(),
    })

    // Persist to database for serverless environments (activeJobs Map doesn't persist)
    await prisma.generationJob.create({
      data: {
        videoId,
        externalJobId: genResult.jobId,
        status: 'processing',
        startedAt: new Date(),
      },
    })

    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'processing' },
    })

    // Create user message in conversation
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: prompt,
        mediaUrls: JSON.stringify(styleReferenceUrls || []),
      },
    })

    console.log(`[Generate] Job started: ${genResult.jobId} for video ${videoId}`)

    return NextResponse.json({
      success: true,
      videoId,
      conversationId: convId,
      estimatedTime: modelInfo.estimatedTime,
      warning: characterWarning || undefined,
    })
  } catch (error) {
    // Log full error details for debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Generation error:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
    })

    // Return the actual error message to help with debugging
    return NextResponse.json(
      {
        error: `Failed to start video generation: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}

// Get generation status - polls the actual model API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId parameter' }, { status: 400 })
  }

  console.log(`[Status] Checking status for video: ${videoId}`)

  try {
    // Get from database first
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    })

    if (!video) {
      console.error(`[Status] Video not found in database: ${videoId}`)
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    console.log(`[Status] Found video: ${videoId}, status: ${(video as { status: string }).status}`)

    // Check if we have an active job for this video (try in-memory cache first)
    let activeJob = activeJobs.get(videoId)

    // If not in cache and video is processing, look up from database (critical for serverless)
    if (!activeJob && ((video as { status: string }).status === 'processing' || (video as { status: string }).status === 'pending')) {
      const dbJob = await prisma.generationJob.findUnique({
        where: { videoId },
      })

      if (dbJob && dbJob.externalJobId) {
        // Check if job has exceeded max attempts or timeout
        // Each poll from the client is ~2s apart. Generations take 20-120s depending
        // on model. In serverless (Vercel), the in-memory cache is lost between
        // invocations, so every poll hits this DB path and increments attempts.
        // 90 attempts × 2s = ~3 minutes, well above the slowest model (Sora ~120s).
        const MAX_ATTEMPTS = 90
        const MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes
        const jobAge = Date.now() - dbJob.createdAt.getTime()

        if (dbJob.attempts >= MAX_ATTEMPTS) {
          console.error(`[Status] Job ${dbJob.externalJobId} exceeded max attempts (${MAX_ATTEMPTS})`)

          // Mark as failed and stop polling
          await Promise.all([
            prisma.video.update({
              where: { id: videoId },
              data: { status: 'failed' },
            }),
            prisma.generationJob.update({
              where: { videoId },
              data: {
                status: 'failed',
                lastError: `Job exceeded maximum retry attempts (${MAX_ATTEMPTS})`,
              },
            }),
          ])

          return NextResponse.json({
            id: videoId,
            status: 'failed',
            error: `Generation failed after ${MAX_ATTEMPTS} attempts`,
            videoUrl: null,
            thumbnailUrl: null,
            qualityScore: null,
            model: (video as { model: string }).model,
            duration: (video as { duration: number }).duration,
            prompt: (video as { prompt: string }).prompt,
            createdAt: (video as { createdAt: Date }).createdAt.toISOString(),
            completedAt: null,
          })
        }

        if (jobAge > MAX_AGE_MS) {
          console.error(`[Status] Job ${dbJob.externalJobId} exceeded timeout (${MAX_AGE_MS}ms)`)

          // Mark as failed due to timeout
          await Promise.all([
            prisma.video.update({
              where: { id: videoId },
              data: { status: 'failed' },
            }),
            prisma.generationJob.update({
              where: { videoId },
              data: {
                status: 'failed',
                lastError: 'Job exceeded maximum time limit (10 minutes)',
              },
            }),
          ])

          return NextResponse.json({
            id: videoId,
            status: 'failed',
            error: 'Generation timed out (exceeded 10 minutes)',
            videoUrl: null,
            thumbnailUrl: null,
            qualityScore: null,
            model: (video as { model: string }).model,
            duration: (video as { duration: number }).duration,
            prompt: (video as { prompt: string }).prompt,
            createdAt: (video as { createdAt: Date }).createdAt.toISOString(),
            completedAt: null,
          })
        }

        // Increment attempts counter
        await prisma.generationJob.update({
          where: { videoId },
          data: { attempts: { increment: 1 } },
        })

        console.log(`[Status] Restored job from database: ${dbJob.externalJobId} (attempt ${dbJob.attempts + 1})`)
        activeJob = {
          model: (video as { model: VideoModelId }).model,
          externalJobId: dbJob.externalJobId,
          status: dbJob.status as 'pending' | 'processing' | 'completed' | 'failed',
          startedAt: dbJob.startedAt?.getTime() || Date.now(),
        }
        // Cache it for future requests
        activeJobs.set(videoId, activeJob)
      }
    }

    if (activeJob) {
      // If already completed or failed, return cached result
      if (activeJob.status === 'completed' || activeJob.status === 'failed') {
        return NextResponse.json({
          id: videoId,
          status: activeJob.status,
          videoUrl: activeJob.videoUrl || null,
          thumbnailUrl: activeJob.thumbnailUrl || null,
          qualityScore: null,
          model: activeJob.model,
          duration: (video as { duration: number }).duration,
          prompt: (video as { prompt: string }).prompt,
          createdAt: new Date(activeJob.startedAt).toISOString(),
          completedAt: activeJob.status === 'completed' ? new Date().toISOString() : null,
          error: activeJob.error,
        })
      }

      // Poll the model API for status
      if (activeJob.externalJobId) {
        console.log(`[Status] Polling model API for job: ${activeJob.externalJobId}`)
        const modelStatus = await checkModelStatus(activeJob.model, activeJob.externalJobId)

        // Check for completed status without video URL (API bug)
        if (modelStatus.status === 'completed' && !modelStatus.videoUrl) {
          console.error(`[Status] Model API returned completed but no video URL for ${activeJob.model}:`, modelStatus)
          activeJob.status = 'failed'
          activeJob.error = `${activeJob.model} completed but did not provide video URL`
          activeJobs.set(videoId, activeJob)

          await Promise.all([
            prisma.video.update({
              where: { id: videoId },
              data: { status: 'failed' },
            }),
            prisma.generationJob.update({
              where: { videoId },
              data: {
                status: 'failed',
                lastError: activeJob.error,
              },
            }),
          ])
        }
        // Update cache and database
        else if (modelStatus.status === 'completed' && modelStatus.videoUrl) {
          activeJob.status = 'completed'
          activeJob.videoUrl = modelStatus.videoUrl
          activeJob.thumbnailUrl = modelStatus.thumbnailUrl
          activeJobs.set(videoId, activeJob)

          // Update both Video and GenerationJob tables
          await Promise.all([
            prisma.video.update({
              where: { id: videoId },
              data: {
                status: 'completed',
                videoUrl: modelStatus.videoUrl,
                thumbnailUrl: modelStatus.thumbnailUrl,
                completedAt: new Date(),
              },
            }),
            prisma.generationJob.update({
              where: { videoId },
              data: {
                status: 'completed',
                completedAt: new Date(),
              },
            }),
          ])
        } else if (modelStatus.status === 'failed') {
          activeJob.status = 'failed'
          activeJob.error = modelStatus.error
          activeJobs.set(videoId, activeJob)

          // Update both Video and GenerationJob tables
          await Promise.all([
            prisma.video.update({
              where: { id: videoId },
              data: { status: 'failed' },
            }),
            prisma.generationJob.update({
              where: { videoId },
              data: {
                status: 'failed',
                lastError: modelStatus.error,
              },
            }),
          ])
        }

        return NextResponse.json({
          id: videoId,
          status: modelStatus.status,
          videoUrl: modelStatus.videoUrl || null,
          thumbnailUrl: modelStatus.thumbnailUrl || null,
          qualityScore: null,
          model: activeJob.model,
          duration: (video as { duration: number }).duration,
          prompt: (video as { prompt: string }).prompt,
          createdAt: new Date(activeJob.startedAt).toISOString(),
          completedAt: modelStatus.status === 'completed' ? new Date().toISOString() : null,
          error: modelStatus.error,
        })
      }
    }

    // No active job - return database state
    return NextResponse.json({
      id: videoId,
      status: (video as { status: string }).status,
      videoUrl: (video as { videoUrl: string | null }).videoUrl,
      thumbnailUrl: (video as { thumbnailUrl: string | null }).thumbnailUrl,
      qualityScore: (video as { qualityScore: number | null }).qualityScore,
      model: (video as { model: string }).model,
      duration: (video as { duration: number }).duration,
      prompt: (video as { prompt: string }).prompt,
      createdAt: (video as { createdAt: Date }).createdAt.toISOString(),
      completedAt: (video as { completedAt: Date | null }).completedAt?.toISOString() || null,
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
