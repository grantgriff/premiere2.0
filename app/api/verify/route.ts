import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeVideoQuality, getHighSeverityIssues } from '@/lib/models/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, videoUrl } = body

    if (!videoId || !videoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: videoId, videoUrl' },
        { status: 400 }
      )
    }

    // Run quality analysis
    const report = await analyzeVideoQuality(videoUrl)

    if (!report) {
      return NextResponse.json(
        { error: 'Failed to analyze video quality' },
        { status: 500 }
      )
    }

    // Update video with quality report
    await prisma.video.update({
      where: { id: videoId },
      data: {
        qualityScore: report.overallScore,
        qualityReport: report as object,
      },
    })

    // Check for high severity issues
    const highSeverityIssues = getHighSeverityIssues(report)
    const hasHighSeverityIssues = highSeverityIssues.length > 0

    return NextResponse.json({
      success: true,
      qualityScore: report.overallScore,
      report,
      hasHighSeverityIssues,
      highSeverityIssues: hasHighSeverityIssues ? highSeverityIssues : undefined,
    })
  } catch (error) {
    console.error('Quality verification error:', error)
    return NextResponse.json(
      { error: 'Failed to verify video quality' },
      { status: 500 }
    )
  }
}

// Get quality report for a video
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId parameter' }, { status: 400 })
  }

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        qualityScore: true,
        qualityReport: true,
      },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (!video.qualityReport) {
      return NextResponse.json(
        { error: 'Quality report not yet available' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      qualityScore: video.qualityScore,
      report: video.qualityReport,
    })
  } catch (error) {
    console.error('Get quality report error:', error)
    return NextResponse.json(
      { error: 'Failed to get quality report' },
      { status: 500 }
    )
  }
}
