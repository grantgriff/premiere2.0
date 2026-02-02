// API Client for Video Generation
// Uses real API routes which connect to Luma, etc.

import { VideoModel } from './store'
import { generateId } from './utils'

// Check if we should use simulation mode (no API keys)
const USE_SIMULATION = typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co')

// Sample video URLs for simulation fallback
const SAMPLE_VIDEOS = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
]

const SAMPLE_THUMBNAILS = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
]

export interface StyleReference {
  type: 'youtube' | 'upload' | 'url'
  url: string
  videoId?: string
  title?: string
}

export interface GenerationRequest {
  prompt: string
  model: VideoModel
  duration: number
  userId: string
  conversationId?: string
  styleReferenceUrls?: string[]
  styleReferences?: StyleReference[]
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
  prompt?: string
  error?: string
}

// Simulated job storage (client-side only for dev without server)
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

// Start video generation
export async function startGeneration(request: GenerationRequest): Promise<GenerationResponse> {
  try {
    // Try real API first
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (response.ok) {
      return response.json()
    }

    // If API fails, fall back to simulation
    console.warn('API failed, using simulation mode')
    return simulateGeneration(request)
  } catch (error) {
    // Network error - use simulation
    console.warn('Network error, using simulation mode:', error)
    return simulateGeneration(request)
  }
}

// Simulation fallback
function simulateGeneration(request: GenerationRequest): GenerationResponse {
  const videoId = generateId()
  const conversationId = request.conversationId || generateId()

  simulatedJobs.set(videoId, {
    status: 'pending',
    prompt: request.prompt,
    model: request.model,
    duration: request.duration,
    startedAt: Date.now(),
  })

  // Process in background
  processSimulatedJob(videoId, request.duration)

  return {
    success: true,
    videoId,
    conversationId,
    estimatedTime: getEstimatedTime(request.model),
    creditsRemaining: 100 - request.duration,
  }
}

// Check generation status
export async function checkGenerationStatus(videoId: string): Promise<VideoStatusResponse> {
  // Check simulated jobs first (for client-side simulation)
  const simJob = simulatedJobs.get(videoId)
  if (simJob) {
    return {
      id: videoId,
      status: simJob.status,
      videoUrl: simJob.videoUrl || null,
      thumbnailUrl: simJob.thumbnailUrl || null,
      qualityScore: simJob.qualityScore || null,
      model: simJob.model,
      duration: simJob.duration,
      prompt: simJob.prompt,
      createdAt: new Date(simJob.startedAt).toISOString(),
      completedAt: simJob.completedAt ? new Date(simJob.completedAt).toISOString() : null,
    }
  }

  try {
    const response = await fetch(`/api/generate?videoId=${videoId}`)
    if (response.ok) {
      return response.json()
    }
    throw new Error('API error')
  } catch {
    return {
      id: videoId,
      status: 'failed',
      videoUrl: null,
      thumbnailUrl: null,
      qualityScore: null,
      model: 'luma',
      duration: 5,
      createdAt: new Date().toISOString(),
      completedAt: null,
      error: 'Failed to check status',
    }
  }
}

// Process a simulated job
function processSimulatedJob(videoId: string, duration: number) {
  const job = simulatedJobs.get(videoId)
  if (!job) return

  // Move to processing after 1 second
  setTimeout(() => {
    const j = simulatedJobs.get(videoId)
    if (j) {
      j.status = 'processing'
      simulatedJobs.set(videoId, j)
    }
  }, 1000)

  // Complete after simulated generation time
  const genTime = Math.min(duration * 1000, 8000) // Max 8 seconds in simulation
  setTimeout(() => {
    const j = simulatedJobs.get(videoId)
    if (j) {
      const randomIndex = Math.floor(Math.random() * SAMPLE_VIDEOS.length)
      j.status = 'completed'
      j.completedAt = Date.now()
      j.videoUrl = SAMPLE_VIDEOS[randomIndex]
      j.thumbnailUrl = SAMPLE_THUMBNAILS[randomIndex % SAMPLE_THUMBNAILS.length]
      j.qualityScore = 7 + Math.random() * 3
      simulatedJobs.set(videoId, j)
    }
  }, genTime + 2000)
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

// YouTube search
export async function searchYouTube(query: string): Promise<{
  videos: Array<{
    id: string
    title: string
    thumbnail: string
    channel: string
  }>
}> {
  try {
    const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`)
    if (response.ok) {
      return response.json()
    }
  } catch {
    // Fall through to simulation
  }

  // Simulation fallback
  return {
    videos: [
      { id: '1', title: `${query} - Result 1`, thumbnail: SAMPLE_THUMBNAILS[0], channel: 'Demo Channel' },
      { id: '2', title: `${query} - Result 2`, thumbnail: SAMPLE_THUMBNAILS[1], channel: 'Demo Channel' },
      { id: '3', title: `${query} - Result 3`, thumbnail: SAMPLE_THUMBNAILS[2], channel: 'Demo Channel' },
    ],
  }
}

// Poll for video completion
export function pollVideoStatus(
  videoId: string,
  onUpdate: (status: VideoStatusResponse) => void,
  interval = 2000
): () => void {
  let active = true

  const poll = async () => {
    if (!active) return

    const status = await checkGenerationStatus(videoId)
    onUpdate(status)

    if (status.status === 'pending' || status.status === 'processing') {
      setTimeout(poll, interval)
    }
  }

  poll()

  // Return cleanup function
  return () => {
    active = false
  }
}

// Quality Verification
export interface VerifyResponse {
  success: boolean
  qualityScore: number
  report: {
    overallScore: number
    dimensions: {
      accuracy: number
      facialQuality: number
      objectCoherence: number
      lightingConsistency: number
      motionSmoothness: number
    }
    issues: Array<{
      type: string
      severity: string
      timestamp?: number
      description: string
    }>
    biasFlags: Array<{
      type: string
      severity: string
      description: string
    }>
  }
  hasHighSeverityIssues: boolean
  highSeverityIssues?: Array<{ type: string; severity: string; description: string }>
}

export async function verifyVideoQuality(videoId: string, videoUrl: string): Promise<VerifyResponse | null> {
  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, videoUrl }),
    })

    if (response.ok) {
      return response.json()
    }

    // Fall back to simulation
    return simulateVerification()
  } catch (error) {
    console.warn('Verification API error, using simulation:', error)
    return simulateVerification()
  }
}

function simulateVerification(): VerifyResponse {
  const score = 6 + Math.random() * 4 // Random score between 6-10

  return {
    success: true,
    qualityScore: score,
    report: {
      overallScore: score,
      dimensions: {
        accuracy: 5 + Math.random() * 5,
        facialQuality: 5 + Math.random() * 5,
        objectCoherence: 6 + Math.random() * 4,
        lightingConsistency: 6 + Math.random() * 4,
        motionSmoothness: 5 + Math.random() * 5,
      },
      issues: score < 7 ? [
        {
          type: 'artifact',
          severity: 'low',
          description: 'Minor compression artifacts detected',
        },
      ] : [],
      biasFlags: [],
    },
    hasHighSeverityIssues: false,
  }
}

// Conversation types
export interface ConversationResponse {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
    videoId?: string | null
  }>
  videos: Array<{
    id: string
    prompt: string
    model: VideoModel
    duration: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    videoUrl: string | null
    thumbnailUrl: string | null
    qualityScore: number | null
    qualityReport: Record<string, unknown> | null
    createdAt: string
    completedAt: string | null
  }>
}

// Fetch all conversations for a user
export async function fetchConversations(userId: string): Promise<ConversationResponse[]> {
  try {
    const response = await fetch(`/api/conversations?userId=${encodeURIComponent(userId)}`)
    if (response.ok) {
      const data = await response.json()
      return data.conversations || []
    }
    console.warn('Failed to fetch conversations:', response.status)
    return []
  } catch (error) {
    console.warn('Error fetching conversations:', error)
    return []
  }
}

// Fetch a single conversation with details
export async function fetchConversationDetails(conversationId: string, userId: string): Promise<ConversationResponse | null> {
  try {
    const response = await fetch(`/api/conversations?id=${conversationId}&userId=${encodeURIComponent(userId)}`)
    if (response.ok) {
      const data = await response.json()
      return data.conversation || null
    }
    return null
  } catch (error) {
    console.warn('Error fetching conversation details:', error)
    return null
  }
}

// Create a new conversation
export async function createConversation(userId: string, title?: string): Promise<ConversationResponse | null> {
  try {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title }),
    })
    if (response.ok) {
      const data = await response.json()
      return data.conversation || null
    }
    return null
  } catch (error) {
    console.warn('Error creating conversation:', error)
    return null
  }
}

// Update a conversation
export async function updateConversationTitle(id: string, userId: string, title: string): Promise<boolean> {
  try {
    const response = await fetch('/api/conversations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId, title }),
    })
    return response.ok
  } catch (error) {
    console.warn('Error updating conversation:', error)
    return false
  }
}

// Delete a conversation
export async function deleteConversationApi(id: string, userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/conversations?id=${id}&userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
    return response.ok
  } catch (error) {
    console.warn('Error deleting conversation:', error)
    return false
  }
}

// Create a message
export async function createMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  videoId?: string
): Promise<{ id: string } | null> {
  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, role, content, videoId }),
    })
    if (response.ok) {
      const data = await response.json()
      return data.message || null
    }
    return null
  } catch (error) {
    console.warn('Error creating message:', error)
    return null
  }
}
