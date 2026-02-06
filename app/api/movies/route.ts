import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/movies - Get all movies for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data: movies, error } = await supabase
      .from('movies')
      .select(`
        *,
        clips:movie_clips(
          id,
          video_id,
          position,
          first_frame_url,
          last_frame_url,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[Movies API] Error fetching movies:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sort clips by position within each movie
    const moviesWithSortedClips = movies?.map(movie => ({
      ...movie,
      clips: movie.clips?.sort((a, b) => a.position - b.position) || []
    }))

    return NextResponse.json({ movies: moviesWithSortedClips })
  } catch (error) {
    console.error('[Movies API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to fetch movies' },
      { status: 500 }
    )
  }
}

// POST /api/movies - Create a new movie
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, title, description } = body

    if (!userId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const { data: movie, error } = await supabase
      .from('movies')
      .insert({
        user_id: userId,
        title,
        description: description || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Movies API] Error creating movie:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Movies API] Created movie:', movie.id)
    return NextResponse.json({ movie })
  } catch (error) {
    console.error('[Movies API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to create movie' },
      { status: 500 }
    )
  }
}

// PUT /api/movies - Update a movie
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, title, description, thumbnailUrl } = body

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: id, userId' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const updateData: any = { updated_at: new Date().toISOString() }
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (thumbnailUrl !== undefined) updateData.thumbnail_url = thumbnailUrl

    const { data: movie, error } = await supabase
      .from('movies')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[Movies API] Error updating movie:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Movies API] Updated movie:', movie.id)
    return NextResponse.json({ movie })
  } catch (error) {
    console.error('[Movies API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to update movie' },
      { status: 500 }
    )
  }
}

// DELETE /api/movies - Delete a movie
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const userId = searchParams.get('userId')

  if (!id || !userId) {
    return NextResponse.json(
      { error: 'Missing required fields: id, userId' },
      { status: 400 }
    )
  }

  try {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('movies')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[Movies API] Error deleting movie:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[Movies API] Deleted movie:', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Movies API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to delete movie' },
      { status: 500 }
    )
  }
}
