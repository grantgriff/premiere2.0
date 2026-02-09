import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getCurrentUserServer } from '@/lib/auth-server'

/**
 * GET /api/videos/[id]/comments - Get all comments for a video
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const videoId = (await params).id
    const user = await getCurrentUserServer()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Fetch all comments for this video
    const { data: comments, error } = await supabase
      .from('video_comments')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', user.id)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('[Comments API] Error fetching comments:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    // Transform to match VideoComment interface
    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      videoId: comment.video_id,
      userId: comment.user_id,
      timestamp: parseFloat(comment.timestamp),
      text: comment.text,
      frameUrl: comment.frame_url,
      boundingBox: comment.bounding_box_x !== null ? {
        x: parseFloat(comment.bounding_box_x),
        y: parseFloat(comment.bounding_box_y),
        width: parseFloat(comment.bounding_box_width),
        height: parseFloat(comment.bounding_box_height),
      } : undefined,
      createdAt: new Date(comment.created_at),
    }))

    return NextResponse.json({ comments: transformedComments })
  } catch (error) {
    console.error('[Comments API] Exception:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

/**
 * POST /api/videos/[id]/comments - Create a new comment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const videoId = (await params).id
    const user = await getCurrentUserServer()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { timestamp, text, frameUrl, boundingBox } = body

    if (!text || timestamp === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: timestamp, text' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Insert comment
    const { data: comment, error } = await supabase
      .from('video_comments')
      .insert({
        video_id: videoId,
        user_id: user.id,
        timestamp: timestamp.toString(),
        text,
        frame_url: frameUrl || null,
        bounding_box_x: boundingBox?.x?.toString() || null,
        bounding_box_y: boundingBox?.y?.toString() || null,
        bounding_box_width: boundingBox?.width?.toString() || null,
        bounding_box_height: boundingBox?.height?.toString() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Comments API] Error creating comment:', error)
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
    }

    // Transform to match VideoComment interface
    const transformedComment = {
      id: comment.id,
      videoId: comment.video_id,
      userId: comment.user_id,
      timestamp: parseFloat(comment.timestamp),
      text: comment.text,
      frameUrl: comment.frame_url,
      boundingBox: comment.bounding_box_x !== null ? {
        x: parseFloat(comment.bounding_box_x),
        y: parseFloat(comment.bounding_box_y),
        width: parseFloat(comment.bounding_box_width),
        height: parseFloat(comment.bounding_box_height),
      } : undefined,
      createdAt: new Date(comment.created_at),
    }

    return NextResponse.json({ comment: transformedComment })
  } catch (error) {
    console.error('[Comments API] Exception:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
