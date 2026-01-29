import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateVideo, MODEL_INFO, VideoModelId } from '@/lib/models'
import { enqueueGeneration, checkRateLimit } from '@/lib/queue'
import { generateId, isValidDuration, parseCharacterMentions } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, model, duration, conversationId, userId, styleReferenceUrls, characterIds } =
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

    // Check user credits
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || (user as { credits: number }).credits < duration) {
      return NextResponse.json(
        { error: 'Insufficient credits for this generation' },
        { status: 402 }
      )
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
    const video = await prisma.video.create({
      data: {
        id: generateId(),
        conversationId: convId,
        userId,
        prompt,
        model: model as VideoModelId,
        duration,
        status: 'pending',
        styleReferenceUrls: styleReferenceUrls || [],
        characterIds: characterIds || [],
        metadata: {
          mentionedCharacters,
          requestedAt: new Date().toISOString(),
        },
      },
    })

    // Add to generation queue
    await enqueueGeneration({
      id: generateId(),
      videoId: video.id,
      userId,
      prompt,
      model,
      duration,
      styleReferenceUrls,
      characterIds,
      createdAt: new Date().toISOString(),
    })

    // Deduct credits
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: duration } },
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

    return NextResponse.json({
      success: true,
      videoId: video.id,
      conversationId: convId,
      estimatedTime: modelInfo.estimatedTime,
      creditsRemaining: (user as { credits: number }).credits - duration,
    })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json(
      { error: 'Failed to start video generation' },
      { status: 500 }
    )
  }
}

// Get generation status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId parameter' }, { status: 400 })
  }

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return NextResponse.json(video)
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
