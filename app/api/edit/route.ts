import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  trimVideo,
  extendVideo,
  changeSpeed,
  changeFps,
  applyColorAdjustments,
  changeResolution,
  processVideo,
  getVideoInfo,
  ColorAdjustments,
} from '@/lib/video/ffmpeg'

// Supported edit operations
type EditOperation =
  | 'trim'
  | 'extend'
  | 'remix'
  | 'speed'
  | 'fps'
  | 'color'
  | 'resolution'
  | 'process' // Combined operations

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operation, videoId, videoUrl, userId, ...params } = body

    if (!operation) {
      return NextResponse.json(
        { error: 'Missing required field: operation' },
        { status: 400 }
      )
    }

    // Get video URL from database or request
    let sourceUrl = videoUrl
    if (!sourceUrl && videoId) {
      const video = await prisma.video.findUnique({
        where: { id: videoId },
      })
      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }
      sourceUrl = video.videoUrl
    }

    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'Missing video source (videoUrl or videoId)' },
        { status: 400 }
      )
    }

    let resultBuffer: Buffer
    let resultInfo: { duration?: number; message: string }

    switch (operation as EditOperation) {
      case 'trim': {
        const { startTime, endTime } = params
        if (startTime === undefined || endTime === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields for trim: startTime, endTime' },
            { status: 400 }
          )
        }

        resultBuffer = await trimVideo(sourceUrl, { startTime, endTime })
        resultInfo = {
          duration: endTime - startTime,
          message: `Trimmed video to ${startTime}s - ${endTime}s`,
        }
        break
      }

      case 'extend': {
        const { duration, method = 'freeze' } = params
        if (!duration) {
          return NextResponse.json(
            { error: 'Missing required field for extend: duration' },
            { status: 400 }
          )
        }

        resultBuffer = await extendVideo(sourceUrl, { duration, method })
        resultInfo = {
          message: `Extended video by ${duration}s using ${method} method`,
        }
        break
      }

      case 'speed': {
        const { factor } = params
        if (!factor || factor <= 0 || factor > 4) {
          return NextResponse.json(
            { error: 'Speed factor must be between 0.25 and 4' },
            { status: 400 }
          )
        }

        resultBuffer = await changeSpeed(sourceUrl, { factor })
        resultInfo = {
          message: `Changed speed to ${factor}x`,
        }
        break
      }

      case 'fps': {
        const { fps } = params
        if (!fps || fps < 1 || fps > 120) {
          return NextResponse.json(
            { error: 'FPS must be between 1 and 120' },
            { status: 400 }
          )
        }

        resultBuffer = await changeFps(sourceUrl, { fps })
        resultInfo = {
          message: `Changed FPS to ${fps}`,
        }
        break
      }

      case 'color': {
        const colorAdjustments: ColorAdjustments = {}

        // Validate and apply color parameters
        if (params.contrast !== undefined) {
          if (params.contrast < -1 || params.contrast > 1) {
            return NextResponse.json(
              { error: 'Contrast must be between -1 and 1' },
              { status: 400 }
            )
          }
          colorAdjustments.contrast = params.contrast
        }

        if (params.brightness !== undefined) {
          if (params.brightness < -1 || params.brightness > 1) {
            return NextResponse.json(
              { error: 'Brightness must be between -1 and 1' },
              { status: 400 }
            )
          }
          colorAdjustments.brightness = params.brightness
        }

        if (params.saturation !== undefined) {
          if (params.saturation < 0 || params.saturation > 2) {
            return NextResponse.json(
              { error: 'Saturation must be between 0 and 2' },
              { status: 400 }
            )
          }
          colorAdjustments.saturation = params.saturation
        }

        if (params.exposure !== undefined) {
          if (params.exposure < -2 || params.exposure > 2) {
            return NextResponse.json(
              { error: 'Exposure must be between -2 and 2' },
              { status: 400 }
            )
          }
          colorAdjustments.exposure = params.exposure
        }

        if (params.highlights !== undefined) {
          if (params.highlights < -1 || params.highlights > 1) {
            return NextResponse.json(
              { error: 'Highlights must be between -1 and 1' },
              { status: 400 }
            )
          }
          colorAdjustments.highlights = params.highlights
        }

        if (params.shadows !== undefined) {
          if (params.shadows < -1 || params.shadows > 1) {
            return NextResponse.json(
              { error: 'Shadows must be between -1 and 1' },
              { status: 400 }
            )
          }
          colorAdjustments.shadows = params.shadows
        }

        if (params.temperature !== undefined) {
          if (params.temperature < -100 || params.temperature > 100) {
            return NextResponse.json(
              { error: 'Temperature must be between -100 and 100' },
              { status: 400 }
            )
          }
          colorAdjustments.temperature = params.temperature
        }

        if (params.gamma !== undefined) {
          if (params.gamma < 0.1 || params.gamma > 10) {
            return NextResponse.json(
              { error: 'Gamma must be between 0.1 and 10' },
              { status: 400 }
            )
          }
          colorAdjustments.gamma = params.gamma
        }

        resultBuffer = await applyColorAdjustments(sourceUrl, colorAdjustments)
        resultInfo = {
          message: 'Applied color adjustments',
        }
        break
      }

      case 'resolution': {
        const { width, height, maintainAspect = true } = params
        if (!width || !height) {
          return NextResponse.json(
            { error: 'Missing required fields for resolution: width, height' },
            { status: 400 }
          )
        }

        resultBuffer = await changeResolution(sourceUrl, { width, height, maintainAspect })
        resultInfo = {
          message: `Changed resolution to ${width}x${height}`,
        }
        break
      }

      case 'process': {
        // Combined operations - apply multiple edits at once
        const processOptions: Parameters<typeof processVideo>[1] = {}

        if (params.trim) {
          processOptions.trim = params.trim
        }
        if (params.speed) {
          processOptions.speed = { factor: params.speed.factor }
        }
        if (params.fps) {
          processOptions.fps = { fps: params.fps.fps }
        }
        if (params.color) {
          processOptions.color = params.color
        }
        if (params.resolution) {
          processOptions.resolution = params.resolution
        }

        resultBuffer = await processVideo(sourceUrl, processOptions)
        resultInfo = {
          message: 'Applied multiple video edits',
        }
        break
      }

      case 'remix': {
        // Remix requires AI regeneration - this triggers a new generation
        const { prompt, startTime, endTime } = params
        if (!prompt || startTime === undefined || endTime === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields for remix: prompt, startTime, endTime' },
            { status: 400 }
          )
        }

        // For remix, we need to:
        // 1. Extract the segment to be replaced
        // 2. Get frames before and after for context
        // 3. Generate new content with the AI model
        // 4. Blend/transition the new content

        // This is a placeholder - full implementation would call the generation API
        return NextResponse.json({
          success: true,
          operation: 'remix',
          status: 'processing',
          estimatedTime: '45-90s',
          message: `Remixing segment from ${startTime}s to ${endTime}s with prompt: "${prompt}"`,
          // In production, this would return a job ID to poll for status
          jobId: crypto.randomUUID(),
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        )
    }

    // For non-remix operations that produce immediate results
    // Convert buffer to base64 data URL for response
    const base64 = resultBuffer.toString('base64')
    const dataUrl = `data:video/mp4;base64,${base64}`

    // Optionally upload to storage and return URL instead
    // For now, return base64 for smaller videos

    return NextResponse.json({
      success: true,
      operation,
      ...resultInfo,
      // For large files, you'd want to upload to Supabase storage
      // and return a URL instead of base64
      videoData: resultBuffer.length < 5 * 1024 * 1024 ? dataUrl : undefined,
      videoSize: resultBuffer.length,
      message: resultInfo.message,
    })
  } catch (error) {
    console.error('Edit operation error:', error)

    // Check if FFmpeg is available
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return NextResponse.json(
        {
          error: 'FFmpeg not installed on server',
          details: 'Video editing requires FFmpeg. Please ensure FFmpeg is installed.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to process edit operation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET - Get video metadata/info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoUrl = searchParams.get('videoUrl')
  const videoId = searchParams.get('videoId')

  if (!videoUrl && !videoId) {
    return NextResponse.json(
      { error: 'Missing videoUrl or videoId parameter' },
      { status: 400 }
    )
  }

  try {
    let sourceUrl: string | null = videoUrl

    if (!sourceUrl && videoId) {
      const video = await prisma.video.findUnique({
        where: { id: videoId },
      })
      if (!video || !video.videoUrl) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }
      sourceUrl = video.videoUrl as string
    }

    const info = await getVideoInfo(sourceUrl!)

    return NextResponse.json({
      success: true,
      info,
    })
  } catch (error) {
    console.error('Get video info error:', error)
    return NextResponse.json(
      { error: 'Failed to get video info' },
      { status: 500 }
    )
  }
}
