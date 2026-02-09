import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// POST /api/movies/[id]/clips - Add a clip to a movie
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const movieId = (await params).id
    const body = await request.json()
    const { videoId, position, firstFrameUrl, lastFrameUrl } = body

    if (!videoId || position === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: videoId, position' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Verify movie exists first
    console.log('[Movie Clips API] Verifying movie exists:', movieId)
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .select('id, title, user_id')
      .eq('id', movieId)
      .maybeSingle()

    if (movieError) {
      console.error('[Movie Clips API] Database error checking movie:', movieId, 'Error:', movieError)
      console.error('[Movie Clips API] Error code:', movieError?.code, 'Message:', movieError?.message)
      return NextResponse.json(
        { error: `Database error: ${movieError.message}` },
        { status: 500 }
      )
    }

    if (!movie) {
      console.error('[Movie Clips API] Movie not found:', movieId)
      console.error('[Movie Clips API] Movie does not exist in database')
      return NextResponse.json(
        { error: `Movie not found: ${movieId}` },
        { status: 404 }
      )
    }

    console.log('[Movie Clips API] Movie verified:', movie.title, 'User:', movie.user_id)

    // Insert the clip
    const { data: clip, error } = await supabase
      .from('movie_clips')
      .insert({
        movie_id: movieId,
        video_id: videoId,
        position,
        first_frame_url: firstFrameUrl || null,
        last_frame_url: lastFrameUrl || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Movie Clips API] Error adding clip:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update movie's updated_at timestamp
    await supabase
      .from('movies')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', movieId)

    console.log('[Movie Clips API] Added clip to movie:', movieId)
    return NextResponse.json({ clip })
  } catch (error) {
    console.error('[Movie Clips API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to add clip to movie' },
      { status: 500 }
    )
  }
}

// DELETE /api/movies/[id]/clips - Remove a clip from a movie
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const movieId = (await params).id
    const { searchParams } = new URL(request.url)
    const clipId = searchParams.get('clipId')

    if (!clipId) {
      return NextResponse.json({ error: 'Missing clipId' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Get the clip's position before deleting
    const { data: clipToDelete } = await supabase
      .from('movie_clips')
      .select('position')
      .eq('id', clipId)
      .eq('movie_id', movieId)
      .single()

    if (!clipToDelete) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }

    // Delete the clip
    const { error: deleteError } = await supabase
      .from('movie_clips')
      .delete()
      .eq('id', clipId)
      .eq('movie_id', movieId)

    if (deleteError) {
      console.error('[Movie Clips API] Error deleting clip:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Reorder remaining clips (decrement position for clips after the deleted one)
    const { data: remainingClips } = await supabase
      .from('movie_clips')
      .select('id, position')
      .eq('movie_id', movieId)
      .gt('position', clipToDelete.position)

    if (remainingClips && remainingClips.length > 0) {
      for (const clip of remainingClips) {
        await supabase
          .from('movie_clips')
          .update({ position: clip.position - 1 })
          .eq('id', clip.id)
      }
    }

    // Update movie's updated_at timestamp
    await supabase
      .from('movies')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', movieId)

    console.log('[Movie Clips API] Removed clip from movie:', movieId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Movie Clips API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to remove clip from movie' },
      { status: 500 }
    )
  }
}

// PUT /api/movies/[id]/clips - Reorder clips in a movie
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const movieId = (await params).id
    const body = await request.json()
    const { clipOrders } = body // Array of { clipId, position }

    if (!clipOrders || !Array.isArray(clipOrders)) {
      return NextResponse.json(
        { error: 'Missing or invalid clipOrders array' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Update each clip's position
    for (const { clipId, position } of clipOrders) {
      await supabase
        .from('movie_clips')
        .update({ position })
        .eq('id', clipId)
        .eq('movie_id', movieId)
    }

    // Update movie's updated_at timestamp
    await supabase
      .from('movies')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', movieId)

    console.log('[Movie Clips API] Reordered clips in movie:', movieId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Movie Clips API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to reorder clips' },
      { status: 500 }
    )
  }
}
