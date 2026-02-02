import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateVideo, checkGenerationStatus as checkModelStatus, MODEL_INFO, VideoModelId } from '@/lib/models'
import { checkRateLimit } from '@/lib/queue'
import { generateId, isValidDuration, parseCharacterMentions } from '@/lib/utils'

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
    const body = await request.json()
    const { prompt, model, duration, conversationId, userId, styleReferenceUrls, styleReferences, characterIds } =
      body

    // Validate required fields
    if (!prompt || !model || !duration || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, model, duration, userId' },
        { status: 400 }
      )
    }

    // Validate model
    if (!MODEL_INFO[model as VideoModelId]) {
      return NextResponse.json({ error: 'Invalid model specified' }, { status: 400 })
    }

    // Validate duration
    if (!isValidDuration(duration)) {
      return NextResponse.json(
        { error: 'Invalid duration. Must be 1, 3, 5, 10, 15, or 30 seconds' },
        { status: 400 }
      )
    }

    // Check duration against model limit
    const modelInfo = MODEL_INFO[model as VideoModelId]
    if (duration > modelInfo.maxDuration) {
      return NextResponse.json(
        { error: `Duration exceeds ${modelInfo.name} limit of ${modelInfo.maxDuration}s` },
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

    // Ensure user record exists (needed for database relationships)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      // Auto-create user record
      await prisma.user.create({
        data: {
          id: userId,
          email: `user-${userId.slice(0, 8)}@premiere.app`, // Placeholder email
          name: `User ${userId.slice(0, 8)}`, // Required field
          googleId: `auto-${userId}`, // Required unique field for auto-created users
          credits: 0, // Credits not used - unlimited generations
        },
      })
      console.log(`[Generate] Created new user record for ${userId}`)
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
          }),
        },
      })
      console.log(`[Generate] Video record created successfully: ${videoId}`)
    } catch (dbError) {
      console.error(`[Generate] Failed to create video record:`, dbError)
      return NextResponse.json(
        { error: 'Failed to create video record in database' },
        { status: 500 }
      )
    }

    // Determine the primary style reference (image or video URL)
    // styleReferences contains typed references: { type: 'youtube' | 'upload' | 'url', url, title? }
    let primaryStyleUrl: string | undefined
    if (styleReferences && styleReferences.length > 0) {
      // Use the first uploaded/URL reference (prioritize direct uploads over YouTube)
      const directRef = styleReferences.find((r: { type: string; url: string }) =>
        r.type === 'upload' || r.type === 'url'
      )
      primaryStyleUrl = directRef?.url || styleReferences[0]?.url
    } else if (styleReferenceUrls && styleReferenceUrls.length > 0) {
      primaryStyleUrl = styleReferenceUrls[0]
    }

    // Actually call the video generation API
    console.log(`[Generate] Starting ${model} generation for video ${videoId}`)
    console.log(`[Generate] Style reference: ${primaryStyleUrl || 'none'}`)

    const genResult = await generateVideo(model as VideoModelId, {
      prompt,
      duration,
      aspectRatio: '16:9',
      styleReferenceUrl: primaryStyleUrl,
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
        mediaUrls: styleReferenceUrls || [],
      },
    })

    console.log(`[Generate] Job started: ${genResult.jobId} for video ${videoId}`)

    return NextResponse.json({
      success: true,
      videoId,
      conversationId: convId,
      estimatedTime: modelInfo.estimatedTime,
    })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json(
      { error: 'Failed to start video generation' },
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

    // Check if we have an active job for this video
    const activeJob = activeJobs.get(videoId)

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
        const modelStatus = await checkModelStatus(activeJob.model, activeJob.externalJobId)

        // Update cache and database
        if (modelStatus.status === 'completed' && modelStatus.videoUrl) {
          activeJob.status = 'completed'
          activeJob.videoUrl = modelStatus.videoUrl
          activeJob.thumbnailUrl = modelStatus.thumbnailUrl
          activeJobs.set(videoId, activeJob)

          await prisma.video.update({
            where: { id: videoId },
            data: {
              status: 'completed',
              videoUrl: modelStatus.videoUrl,
              thumbnailUrl: modelStatus.thumbnailUrl,
              completedAt: new Date(),
            },
          })
        } else if (modelStatus.status === 'failed') {
          activeJob.status = 'failed'
          activeJob.error = modelStatus.error
          activeJobs.set(videoId, activeJob)

          await prisma.video.update({
            where: { id: videoId },
            data: { status: 'failed' },
          })
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
