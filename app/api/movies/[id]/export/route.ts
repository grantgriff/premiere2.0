import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/movies/[id]/export - Export a movie
 *
 * NOTE: True video concatenation requires FFmpeg or a video processing service.
 * This implementation provides:
 * 1. A manifest with all video URLs in order
 * 2. For future: Integration with video processing service
 *
 * For production, consider:
 * - AWS MediaConvert
 * - Google Cloud Video Intelligence API
 * - Cloudflare Stream
 * - Custom FFmpeg service
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const movieId = (await params).id

    const supabase = getSupabaseAdmin()

    // Fetch movie with clips and video data
    const { data: movie, error } = await supabase
      .from('movies')
      .select(`
        *,
        clips:movie_clips(
          id,
          video_id,
          position,
          video:videos!movie_clips_video_id_fkey(
            id,
            video_url,
            duration,
            prompt,
            model
          )
        )
      `)
      .eq('id', movieId)
      .single()

    if (error || !movie) {
      return NextResponse.json(
        { error: 'Movie not found' },
        { status: 404 }
      )
    }

    // Sort clips by position
    const sortedClips = movie.clips?.sort((a: any, b: any) => a.position - b.position) || []

    // Get all video URLs
    const videoUrls = sortedClips
      .map((clip: any) => clip.video?.video_url)
      .filter((url: any): url is string => url !== null && url !== undefined)

    if (videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'No videos found in movie' },
        { status: 400 }
      )
    }

    // For now, return manifest for client-side processing
    // or future server-side video concatenation
    const manifest = {
      movieId: movie.id,
      title: movie.title,
      clips: sortedClips.map((clip: any, index: number) => ({
        position: index,
        videoUrl: clip.video?.video_url,
        duration: clip.video?.duration,
        prompt: clip.video?.prompt,
        model: clip.video?.model,
      })),
      totalDuration: sortedClips.reduce(
        (sum: number, clip: any) => sum + (clip.video?.duration || 0),
        0
      ),
      exportedAt: new Date().toISOString(),
    }

    // TODO: Implement actual video concatenation
    // Options:
    // 1. Use FFmpeg via serverless function (AWS Lambda, Google Cloud Functions)
    // 2. Use cloud video processing service (MediaConvert, Cloud Video Intelligence)
    // 3. Client-side concatenation using WebCodecs API (browser support varies)
    // 4. Third-party API (Cloudinary, Mux, etc.)

    // For now, return the first video URL as a placeholder
    // In production, this would be the concatenated video URL
    return NextResponse.json({
      success: true,
      exportUrl: videoUrls[0], // Placeholder: returns first clip
      manifest,
      note: 'Video concatenation requires additional infrastructure. Currently returning first clip. See API code for integration options.',
    })
  } catch (error) {
    console.error('[Export Movie API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to export movie' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/movies/[id]/export - Get export manifest
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const movieId = (await params).id

    const supabase = getSupabaseAdmin()

    // Fetch movie with clips
    const { data: movie, error } = await supabase
      .from('movies')
      .select(`
        *,
        clips:movie_clips(
          id,
          video_id,
          position,
          video:videos!movie_clips_video_id_fkey(
            id,
            video_url,
            duration,
            prompt,
            model
          )
        )
      `)
      .eq('id', movieId)
      .single()

    if (error || !movie) {
      return NextResponse.json(
        { error: 'Movie not found' },
        { status: 404 }
      )
    }

    // Sort clips by position
    const sortedClips = movie.clips?.sort((a: any, b: any) => a.position - b.position) || []

    const manifest = {
      movieId: movie.id,
      title: movie.title,
      description: movie.description,
      clips: sortedClips.map((clip: any, index: number) => ({
        position: index,
        videoUrl: clip.video?.video_url,
        duration: clip.video?.duration,
        prompt: clip.video?.prompt,
        model: clip.video?.model,
      })),
      totalDuration: sortedClips.reduce(
        (sum: number, clip: any) => sum + (clip.video?.duration || 0),
        0
      ),
      totalClips: sortedClips.length,
    }

    return NextResponse.json({ manifest })
  } catch (error) {
    console.error('[Export Movie API] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to get export manifest' },
      { status: 500 }
    )
  }
}
