import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// Cloud Run concatenation service URL
// Set this environment variable after deploying the concatenation service
const CONCATENATOR_URL = process.env.CONCATENATOR_SERVICE_URL

/**
 * POST /api/movies/[id]/export - Export a movie
 *
 * Concatenates all clips in a movie into a single video file.
 * Uses Google Cloud Run service with FFmpeg for video processing.
 *
 * Deployment Required:
 * 1. Deploy services/video-concatenator to Cloud Run
 * 2. Set CONCATENATOR_SERVICE_URL environment variable
 * 3. Ensure service has access to GCS bucket
 *
 * See services/video-concatenator/README.md for deployment instructions.
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

    // Check if concatenation service is configured
    if (!CONCATENATOR_URL) {
      console.warn('[Export] CONCATENATOR_SERVICE_URL not configured')

      // Return manifest for manual processing or client-side handling
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
      }

      return NextResponse.json({
        success: true,
        exportUrl: videoUrls[0], // Fallback: return first clip
        manifest,
        note: 'Video concatenation service not configured. Deploy services/video-concatenator to Cloud Run and set CONCATENATOR_SERVICE_URL environment variable. See services/video-concatenator/README.md for instructions.',
      })
    }

    console.log(`[Export] Calling concatenation service: ${CONCATENATOR_URL}`)
    console.log(`[Export] Concatenating ${videoUrls.length} videos for movie: ${movie.title}`)

    // Call Cloud Run concatenation service
    const concatResponse = await fetch(`${CONCATENATOR_URL}/concatenate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrls: videoUrls,
        outputFileName: movie.title.replace(/[^a-z0-9]/gi, '_'),
      }),
    })

    if (!concatResponse.ok) {
      const errorData = await concatResponse.json().catch(() => ({}))
      console.error('[Export] Concatenation service error:', errorData)

      return NextResponse.json(
        {
          error: errorData.error || `Concatenation service returned ${concatResponse.status}`,
          details: errorData,
        },
        { status: 500 }
      )
    }

    const { success, outputUrl, error: concatError } = await concatResponse.json()

    if (!success || !outputUrl) {
      return NextResponse.json(
        { error: concatError || 'Concatenation failed' },
        { status: 500 }
      )
    }

    console.log(`[Export] Success! Output URL: ${outputUrl}`)

    // Update movie with export URL (optional - for caching)
    await supabase
      .from('movies')
      .update({
        thumbnail_url: outputUrl, // Store export URL in thumbnail_url field
        updated_at: new Date().toISOString(),
      })
      .eq('id', movieId)

    return NextResponse.json({
      success: true,
      exportUrl: outputUrl,
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
