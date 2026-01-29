import { Redis } from '@upstash/redis'

// Initialize Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

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

// Add job to generation queue
export async function enqueueGeneration(job: GenerationJob): Promise<void> {
  await redis.lpush(QUEUES.VIDEO_GENERATION, JSON.stringify(job))
}

// Add job to quality check queue
export async function enqueueQualityCheck(job: QualityCheckJob): Promise<void> {
  await redis.lpush(QUEUES.QUALITY_CHECK, JSON.stringify(job))
}

// Get next job from queue (FIFO)
export async function dequeueJob<T>(queueName: string): Promise<T | null> {
  const job = await redis.rpop(queueName)
  if (!job) return null
  return JSON.parse(job as string) as T
}

// Get queue length
export async function getQueueLength(queueName: string): Promise<number> {
  return await redis.llen(queueName)
}

// Store job status
export async function setJobStatus(
  jobId: string,
  status: 'processing' | 'completed' | 'failed',
  data?: Record<string, unknown>
): Promise<void> {
  await redis.hset(`job:${jobId}`, {
    status,
    updatedAt: new Date().toISOString(),
    ...data,
  })
  // Expire after 24 hours
  await redis.expire(`job:${jobId}`, 86400)
}

// Get job status
export async function getJobStatus(
  jobId: string
): Promise<Record<string, string> | null> {
  const status = await redis.hgetall(`job:${jobId}`)
  return status as Record<string, string> | null
}

// Rate limiting
export async function checkRateLimit(
  userId: string,
  limit: number = 10,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${userId}`
  const current = await redis.incr(key)

  if (current === 1) {
    await redis.expire(key, windowSeconds)
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  }
}
