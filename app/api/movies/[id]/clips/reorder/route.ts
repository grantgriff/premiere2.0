import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// PUT /api/movies/[id]/clips/reorder - Reorder clips in a movie
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const movieId = (await params).id
    const body = await request.json()
    const { clipIds } = body

    if (!clipIds || !Array.isArray(clipIds)) {
      return NextResponse.json(
        { error: 'Invalid clipIds array' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Update each clip's position
    const updatePromises = clipIds.map((clipId: string, index: number) =>
      supabase
        .from('movie_clips')
        .update({ position: index })
        .eq('id', clipId)
        .eq('movie_id', movieId)
    )

    await Promise.all(updatePromises)

    // Update movie's updated_at timestamp
    await supabase
      .from('movies')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', movieId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Reorder Clips API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to reorder clips' },
      { status: 500 }
    )
  }
}
