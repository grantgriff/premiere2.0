import { NextRequest, NextResponse } from 'next/server'
import { createMessage, getMessages } from '@/lib/db-supabase'
import { generateId } from '@/lib/utils'

// Create a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, role, content, videoId } = body

    if (!conversationId || !role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, role, content' },
        { status: 400 }
      )
    }

    const message = await createMessage({
      id: generateId(),
      conversationId,
      role,
      content,
      videoId: videoId || null,
    })

    if (!message) {
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.created_at,
        videoId: message.video_id,
      },
    })
  } catch (error) {
    console.error('Create message error:', error)
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    )
  }
}

// Get all messages for a conversation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json(
      { error: 'Missing conversationId parameter' },
      { status: 400 }
    )
  }

  try {
    const dbMessages = await getMessages(conversationId)

    const messages = dbMessages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      videoId: m.video_id,
    }))

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    )
  }
}
