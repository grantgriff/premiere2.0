import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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

    switch (provider) {
      case 'veo':
        return handleVeoWebhook(event, data)
      case 'runway':
        return handleRunwayWebhook(event, data)
      case 'luma':
        return handleLumaWebhook(event, data)
      default:
        console.warn(`Unknown provider: ${provider}`)
        return NextResponse.json({ received: true })
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleVeoWebhook(
  event: string,
  data: { operationId: string; videoUrl?: string; thumbnailUrl?: string; error?: string }
) {
  const { operationId, videoUrl, thumbnailUrl, error } = data

  // Find video by external job ID in metadata
  const video = await prisma.video.findFirst({
    where: {
      metadata: {
        path: ['externalJobId'],
        equals: operationId,
      },
    },
  })

  if (!video) {
    console.warn(`Video not found for operation: ${operationId}`)
    return NextResponse.json({ received: true })
  }

  if (event === 'generation.completed' && videoUrl) {
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: 'completed',
        videoUrl,
        thumbnailUrl,
        completedAt: new Date(),
      },
    })

    // Queue quality check
    await enqueueQualityCheck({
      id: generateId(),
      videoId: video.id,
      videoUrl,
      createdAt: new Date().toISOString(),
    })

    // Add assistant message
    await prisma.message.create({
      data: {
        conversationId: video.conversationId,
        role: 'assistant',
        content: `Video generated successfully! Quality verification in progress.`,
      },
    })
  } else if (event === 'generation.failed') {
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: 'failed',
        metadata: {
          ...(video.metadata as object),
          error,
        },
      },
    })

    // Refund credits
    await prisma.user.update({
      where: { id: video.userId },
      data: { credits: { increment: video.duration } },
    })

    // Add error message
    await prisma.message.create({
      data: {
        conversationId: video.conversationId,
        role: 'assistant',
        content: `Video generation failed: ${error || 'Unknown error'}. Your credits have been refunded.`,
      },
    })
  }

  return NextResponse.json({ received: true })
}

async function handleRunwayWebhook(
  event: string,
  data: { generationId: string; output?: { video_url: string; thumbnail_url: string }; error?: string }
) {
  const { generationId, output, error } = data

  const video = await prisma.video.findFirst({
    where: {
      metadata: {
        path: ['externalJobId'],
        equals: generationId,
      },
    },
  })

  if (!video) {
    return NextResponse.json({ received: true })
  }

  if (event === 'SUCCEEDED' && output) {
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: 'completed',
        videoUrl: output.video_url,
        thumbnailUrl: output.thumbnail_url,
        completedAt: new Date(),
      },
    })

    await enqueueQualityCheck({
      id: generateId(),
      videoId: video.id,
      videoUrl: output.video_url,
      createdAt: new Date().toISOString(),
    })
  } else if (event === 'FAILED') {
    await prisma.video.update({
      where: { id: video.id },
      data: { status: 'failed' },
    })

    await prisma.user.update({
      where: { id: video.userId },
      data: { credits: { increment: video.duration } },
    })
  }

  return NextResponse.json({ received: true })
}

async function handleLumaWebhook(
  event: string,
  data: { id: string; video?: { url: string; thumbnail_url: string }; failure_reason?: string }
) {
  const { id, video, failure_reason } = data

  const videoRecord = await prisma.video.findFirst({
    where: {
      metadata: {
        path: ['externalJobId'],
        equals: id,
      },
    },
  })

  if (!videoRecord) {
    return NextResponse.json({ received: true })
  }

  if (event === 'completed' && video) {
    await prisma.video.update({
      where: { id: videoRecord.id },
      data: {
        status: 'completed',
        videoUrl: video.url,
        thumbnailUrl: video.thumbnail_url,
        completedAt: new Date(),
      },
    })

    await enqueueQualityCheck({
      id: generateId(),
      videoId: videoRecord.id,
      videoUrl: video.url,
      createdAt: new Date().toISOString(),
    })
  } else if (event === 'failed') {
    await prisma.video.update({
      where: { id: videoRecord.id },
      data: { status: 'failed' },
    })

    await prisma.user.update({
      where: { id: videoRecord.userId },
      data: { credits: { increment: videoRecord.duration } },
    })
  }

  return NextResponse.json({ received: true })
}
