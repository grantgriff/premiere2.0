// API Client for Video Generation
// In development mode, uses simulation; in production, calls real APIs

import { VideoModel } from './store'
import { generateId } from './utils'

const IS_DEV = process.env.NODE_ENV === 'development'

// Sample video URLs for development simulation
const SAMPLE_VIDEOS = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
]

const SAMPLE_THUMBNAILS = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
]

export interface GenerationRequest {
  prompt: string
  model: VideoModel
  duration: number
  userId: string
  conversationId?: string
  styleReferenceUrls?: string[]
  characterIds?: string[]
}

export interface GenerationResponse {
  success: boolean
  videoId?: string
  conversationId?: string
  estimatedTime?: string
  creditsRemaining?: number
  error?: string
}

export interface VideoStatusResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl: string | null
  thumbnailUrl: string | null
  qualityScore: number | null
  model: VideoModel
  duration: number
  createdAt: string
  completedAt: string | null
  error?: string
}

// Start video generation
export async function startGeneration(request: GenerationRequest): Promise<GenerationResponse> {
  if (IS_DEV) {
    // Simulate API call in development
    await simulateDelay(500)

    const videoId = generateId()
    const conversationId = request.conversationId || generateId()

    // Store in simulated queue
    simulatedJobs.set(videoId, {
      status: 'pending',
      prompt: request.prompt,
      model: request.model,
      duration: request.duration,
      startedAt: Date.now(),
    })

    // Start simulated processing
    processSimulatedJob(videoId, request.duration)

    return {
      success: true,
      videoId,
      conversationId,
      estimatedTime: getEstimatedTime(request.model),
      creditsRemaining: 100 - request.duration,
    }
  }

  // Real API call
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  return response.json()
}

// Check generation status
export async function checkGenerationStatus(videoId: string): Promise<VideoStatusResponse> {
  if (IS_DEV) {
    await simulateDelay(200)

    const job = simulatedJobs.get(videoId)
    if (!job) {
      return {
        id: videoId,
        status: 'failed',
        videoUrl: null,
        thumbnailUrl: null,
        qualityScore: null,
        model: 'veo3_1',
        duration: 5,
        createdAt: new Date().toISOString(),
        completedAt: null,
        error: 'Video not found',
      }
    }

    return {
      id: videoId,
      status: job.status,
      videoUrl: job.videoUrl || null,
      thumbnailUrl: job.thumbnailUrl || null,
      qualityScore: job.qualityScore || null,
      model: job.model,
      duration: job.duration,
      createdAt: new Date(job.startedAt).toISOString(),
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
    }
  }

  const response = await fetch(`/api/generate?videoId=${videoId}`)
  return response.json()
}

// Simulated job storage
interface SimulatedJob {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  prompt: string
  model: VideoModel
  duration: number
  startedAt: number
  completedAt?: number
  videoUrl?: string
  thumbnailUrl?: string
  qualityScore?: number
}

const simulatedJobs = new Map<string, SimulatedJob>()

// Process a simulated job
function processSimulatedJob(videoId: string, duration: number) {
  const job = simulatedJobs.get(videoId)
  if (!job) return

  // Move to processing after 1 second
  setTimeout(() => {
    job.status = 'processing'
    simulatedJobs.set(videoId, job)
  }, 1000)

  // Complete after simulated generation time (faster in dev)
  const genTime = Math.min(duration * 1000, 10000) // Max 10 seconds in dev
  setTimeout(() => {
    const randomIndex = Math.floor(Math.random() * SAMPLE_VIDEOS.length)
    job.status = 'completed'
    job.completedAt = Date.now()
    job.videoUrl = SAMPLE_VIDEOS[randomIndex]
    job.thumbnailUrl = SAMPLE_THUMBNAILS[randomIndex % SAMPLE_THUMBNAILS.length]
    job.qualityScore = 7 + Math.random() * 3 // Random score between 7-10
    simulatedJobs.set(videoId, job)
  }, genTime + 2000)
}

// Utility functions
function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getEstimatedTime(model: VideoModel): string {
  const times: Record<VideoModel, string> = {
    veo3_1: '45-60s',
    runway: '30-45s',
    luma: '5-10s',
    sora: '30-60s',
    odyssey: '20-40s',
    world_labs: '30-45s',
  }
  return times[model] || '30-60s'
}

// YouTube search (simulated in dev)
export async function searchYouTube(query: string): Promise<{
  videos: Array<{
    id: string
    title: string
    thumbnail: string
    channel: string
  }>
}> {
  if (IS_DEV) {
    await simulateDelay(500)
    return {
      videos: [
        { id: '1', title: `${query} - Result 1`, thumbnail: SAMPLE_THUMBNAILS[0], channel: 'Demo Channel' },
        { id: '2', title: `${query} - Result 2`, thumbnail: SAMPLE_THUMBNAILS[1], channel: 'Demo Channel' },
        { id: '3', title: `${query} - Result 3`, thumbnail: SAMPLE_THUMBNAILS[2], channel: 'Demo Channel' },
      ],
    }
  }

  const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`)
  return response.json()
}
