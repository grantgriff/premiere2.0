import { NextRequest, NextResponse } from 'next/server'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface YouTubeSearchResult {
  id: {
    videoId: string
  }
  snippet: {
    title: string
    description: string
    thumbnails: {
      medium: {
        url: string
        width: number
        height: number
      }
      high: {
        url: string
        width: number
        height: number
      }
    }
    channelTitle: string
    publishedAt: string
  }
}

interface YouTubeSearchResponse {
  items: YouTubeSearchResult[]
  nextPageToken?: string
  pageInfo: {
    totalResults: number
    resultsPerPage: number
  }
}

// Search YouTube videos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const maxResults = searchParams.get('maxResults') || '10'

  if (!query) {
    return NextResponse.json({ error: 'Missing q (query) parameter' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API not configured' },
      { status: 500 }
    )
  }

  try {
    const url = new URL(`${YOUTUBE_API_BASE}/search`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'video')
    url.searchParams.set('maxResults', maxResults)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      const error = await response.text()
      console.error('YouTube API error:', error)
      return NextResponse.json(
        { error: 'YouTube search failed' },
        { status: response.status }
      )
    }

    const data: YouTubeSearchResponse = await response.json()

    // Transform results to a cleaner format
    const videos = data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }))

    return NextResponse.json({
      videos,
      totalResults: data.pageInfo.totalResults,
    })
  } catch (error) {
    console.error('YouTube search error:', error)
    return NextResponse.json(
      { error: 'Failed to search YouTube' },
      { status: 500 }
    )
  }
}

// Get video details for style extraction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, startTime, endTime } = body

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing required field: videoId' },
        { status: 400 }
      )
    }

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'YouTube API not configured' },
        { status: 500 }
      )
    }

    // Get video details
    const url = new URL(`${YOUTUBE_API_BASE}/videos`)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('id', videoId)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to get video details' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const video = data.items?.[0]

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // In production, this would trigger style extraction
    // For now, return video info with timestamp range
    return NextResponse.json({
      success: true,
      video: {
        id: videoId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.high?.url,
        duration: video.contentDetails.duration,
      },
      styleExtraction: {
        status: 'pending',
        startTime: startTime || 0,
        endTime: endTime || 30,
        message: 'Style extraction will be performed during generation',
      },
    })
  } catch (error) {
    console.error('Get video details error:', error)
    return NextResponse.json(
      { error: 'Failed to get video details' },
      { status: 500 }
    )
  }
}
