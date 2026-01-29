// In-Memory Queue for Development
// In production, use Upstash Redis

// Queue names
export const QUEUES = {
  VIDEO_GENERATION: 'video-generation',
  QUALITY_CHECK: 'quality-check',
} as const

export interface GenerationJob {
  id: string
  videoId: string
  userId: string
  prompt: string
  model: string
  duration: number
  styleReferenceUrls?: string[]
  characterIds?: string[]
  createdAt: string
}

export interface QualityCheckJob {
  id: string
  videoId: string
  videoUrl: string
  createdAt: string
}

// In-memory storage
const queues = new Map<string, string[]>()
const jobStatuses = new Map<string, Record<string, string>>()
const rateLimits = new Map<string, { count: number; resetAt: number }>()

// Initialize queues
queues.set(QUEUES.VIDEO_GENERATION, [])
queues.set(QUEUES.QUALITY_CHECK, [])

// Add job to generation queue
export async function enqueueGeneration(job: GenerationJob): Promise<void> {
  const queue = queues.get(QUEUES.VIDEO_GENERATION) || []
  queue.push(JSON.stringify(job))
  queues.set(QUEUES.VIDEO_GENERATION, queue)
  console.log(`[Queue] Enqueued generation job: ${job.id}`)
}

// Add job to quality check queue
export async function enqueueQualityCheck(job: QualityCheckJob): Promise<void> {
  const queue = queues.get(QUEUES.QUALITY_CHECK) || []
  queue.push(JSON.stringify(job))
  queues.set(QUEUES.QUALITY_CHECK, queue)
  console.log(`[Queue] Enqueued quality check job: ${job.id}`)
}

// Get next job from queue (FIFO)
export async function dequeueJob<T>(queueName: string): Promise<T | null> {
  const queue = queues.get(queueName) || []
  const job = queue.shift()
  if (!job) return null
  queues.set(queueName, queue)
  return JSON.parse(job) as T
}

// Get queue length
export async function getQueueLength(queueName: string): Promise<number> {
  const queue = queues.get(queueName) || []
  return queue.length
}

// Store job status
export async function setJobStatus(
  jobId: string,
  status: 'processing' | 'completed' | 'failed',
  data?: Record<string, unknown>
): Promise<void> {
  const existing = jobStatuses.get(jobId) || {}
  jobStatuses.set(jobId, {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
    ...(data ? Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ) : {}),
  })
  console.log(`[Queue] Job ${jobId} status: ${status}`)
}

// Get job status
export async function getJobStatus(
  jobId: string
): Promise<Record<string, string> | null> {
  return jobStatuses.get(jobId) || null
}

// Rate limiting
export async function checkRateLimit(
  userId: string,
  limit: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now()
  const existing = rateLimits.get(userId)

  // Reset if window has passed
  if (!existing || existing.resetAt < now) {
    rateLimits.set(userId, {
      count: 1,
      resetAt: now + (windowSeconds * 1000),
    })
    return { allowed: true, remaining: limit - 1 }
  }

  // Increment count
  existing.count++
  rateLimits.set(userId, existing)

  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
  }
}

// Helper to view queue state (for debugging)
export function getQueueState() {
  return {
    queues: Object.fromEntries(
      Array.from(queues.entries()).map(([k, v]) => [k, v.length])
    ),
    jobStatuses: Object.fromEntries(jobStatuses),
    rateLimits: Object.fromEntries(rateLimits),
  }
}
