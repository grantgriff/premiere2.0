import { NextRequest, NextResponse } from 'next/server'
import {
  createConversation,
  getConversations,
  getConversationWithDetails,
  updateConversation,
  deleteConversation,
} from '@/lib/db-supabase'
import { generateId } from '@/lib/utils'
import { createServerClient } from '@/lib/supabase-server'

// Create a new conversation
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    const userId = user.id
    const body = await request.json()
    const { title } = body

    const conversation = await createConversation({
      id: generateId(),
      userId,
      title: title || 'New Conversation',
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: [],
        videos: [],
      },
    })
  } catch (error) {
    console.error('Create conversation error:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}

// Get all conversations for a user, or get a single conversation with details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const conversationId = searchParams.get('id')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
  }

  try {
    // If conversationId provided, get that conversation with details
    if (conversationId) {
      const result = await getConversationWithDetails(conversationId, userId)

      if (!result) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      return NextResponse.json({
        conversation: {
          id: result.conversation.id,
          title: result.conversation.title,
          createdAt: result.conversation.created_at,
          updatedAt: result.conversation.updated_at,
          messages: result.messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
            videoId: m.video_id,
          })),
          videos: result.videos.map(v => ({
            id: v.id,
            prompt: v.prompt,
            model: v.model,
            duration: v.duration,
            status: v.status,
            videoUrl: v.video_url,
            thumbnailUrl: v.thumbnail_url,
            qualityScore: v.quality_score,
            qualityReport: v.quality_report,
            createdAt: v.created_at,
            completedAt: v.completed_at,
          })),
        },
      })
    }

    // Otherwise get all conversations (without messages/videos for list view)
    const dbConversations = await getConversations(userId)

    const conversations = dbConversations.map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      messages: [],
      videos: [],
    }))

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Get conversations error:', error)
    return NextResponse.json(
      { error: 'Failed to get conversations' },
      { status: 500 }
    )
  }
}

// Update a conversation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, title } = body

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: id, userId' },
        { status: 400 }
      )
    }

    const conversation = await updateConversation(id, userId, { title })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
    })
  } catch (error) {
    console.error('Update conversation error:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

// Delete a conversation
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const userId = searchParams.get('userId')

  if (!id || !userId) {
    return NextResponse.json(
      { error: 'Missing required parameters: id, userId' },
      { status: 400 }
    )
  }

  try {
    const success = await deleteConversation(id, userId)

    if (!success) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete conversation error:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
