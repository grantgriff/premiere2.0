import { NextRequest, NextResponse } from 'next/server'
import { prisma, Video } from '@/lib/db'
import { enqueueQualityCheck } from '@/lib/queue'
import { generateId } from '@/lib/utils'

// Handle webhooks from video generation providers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, event, data } = body

    // Validate webhook (in production, verify signatures)
    if (!provider || !event || !data) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    console.log(`Webhook received: ${provider} - ${event}`)

    // In development, webhooks are simulated
    // In production, implement proper webhook handling
    switch (provider) {
      case 'veo':
        return handleWebhook(event, data, 'veo')
      case 'runway':
        return handleWebhook(event, data, 'runway')
      case 'luma':
        return handleWebhook(event, data, 'luma')
      default:
        console.warn(`Unknown provider: ${provider}`)
        return NextResponse.json({ received: true })
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleWebhook(
  event: string,
  data: {
    videoId?: string
    operationId?: string
    generationId?: string
    id?: string
    videoUrl?: string
    video_url?: string
    thumbnailUrl?: string
    thumbnail_url?: string
    video?: { url: string; thumbnail_url: string }
    output?: { video_url: string; thumbnail_url: string }
    error?: string
    failure_reason?: string
  },
  provider: string
) {
  // Get video ID from various possible fields
  const videoId = data.videoId || data.operationId || data.generationId || data.id
  if (!videoId) {
    console.warn('No video ID in webhook data')
    return NextResponse.json({ received: true })
  }

  // Try to find the video
  const video = await prisma.video.findUnique({ where: { id: videoId } })

  if (!video) {
    console.warn(`Video not found: ${videoId}`)
    return NextResponse.json({ received: true })
  }

  const videoData = video as Video

  // Determine video URL from various possible fields
  const videoUrl = data.videoUrl || data.video_url || data.video?.url || data.output?.video_url
  const thumbnailUrl = data.thumbnailUrl || data.thumbnail_url || data.video?.thumbnail_url || data.output?.thumbnail_url
  const errorMessage = data.error || data.failure_reason

  // Handle success events
  const successEvents = ['generation.completed', 'SUCCEEDED', 'completed', 'success']
  const failureEvents = ['generation.failed', 'FAILED', 'failed', 'error']

  if (successEvents.includes(event) && videoUrl) {
    await prisma.video.update({
      where: { id: videoData.id },
      data: {
        status: 'completed',
        videoUrl,
        thumbnailUrl: thumbnailUrl || null,
        completedAt: new Date(),
      },
    })

    // Queue quality check
    await enqueueQualityCheck({
      id: generateId(),
      videoId: videoData.id,
      videoUrl,
      createdAt: new Date().toISOString(),
    })

    // Add assistant message
    await prisma.message.create({
      data: {
        conversationId: videoData.conversationId,
        role: 'assistant',
        content: `Video generated successfully using ${provider}! Quality verification in progress.`,
      },
    })

    console.log(`Video ${videoData.id} completed successfully`)
  } else if (failureEvents.includes(event)) {
    await prisma.video.update({
      where: { id: videoData.id },
      data: {
        status: 'failed',
      },
    })

    // Refund credits
    await prisma.user.update({
      where: { id: videoData.userId },
      data: { credits: { increment: videoData.duration } },
    })

    // Add error message
    await prisma.message.create({
      data: {
        conversationId: videoData.conversationId,
        role: 'assistant',
        content: `Video generation failed: ${errorMessage || 'Unknown error'}. Your credits have been refunded.`,
      },
    })

    console.log(`Video ${videoData.id} failed: ${errorMessage}`)
  }

  return NextResponse.json({ received: true })
}
