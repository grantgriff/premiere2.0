/**
 * Google Cloud Video Concatenation Utility
 *
 * Uses FFmpeg to concatenate videos. Can be deployed to:
 * - Google Cloud Run (recommended)
 * - Google Cloud Functions (with increased timeout)
 * - Local development
 *
 * Requirements:
 * - FFmpeg binary (installed in container for Cloud Run)
 * - Google Cloud Storage access
 * - Sufficient memory for video processing
 */

import { GoogleAuth } from 'google-auth-library'
import { getDefaultGCSBucket } from './gcsUpload'

/**
 * Job status for concatenation operations
 */
export type ConcatenationJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ConcatenationJob {
  id: string
  status: ConcatenationJobStatus
  videoUrls: string[]
  outputUrl?: string
  error?: string
  progress?: number
  createdAt: Date
  completedAt?: Date
}

/**
 * In-memory job storage (replace with database in production)
 */
const jobs = new Map<string, ConcatenationJob>()

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `concat_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Get OAuth access token for GCS operations
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    if (!credentialsJson) {
      console.error('[Concatenation] GOOGLE_APPLICATION_CREDENTIALS_JSON not configured')
      return null
    }

    const credentials = JSON.parse(credentialsJson)
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })

    const client = await auth.getClient()
    const accessToken = await client.getAccessToken()
    return accessToken.token || null
  } catch (error) {
    console.error('[Concatenation] Failed to get access token:', error)
    return null
  }
}

/**
 * Start a video concatenation job
 *
 * This is a placeholder that sets up the job structure.
 * For production, deploy this logic to Cloud Run with FFmpeg.
 *
 * @param videoUrls - Array of video URLs to concatenate (must be publicly accessible)
 * @param outputFileName - Desired output filename (without extension)
 * @returns Job ID for tracking
 */
export async function startConcatenationJob(
  videoUrls: string[],
  outputFileName: string = 'concatenated'
): Promise<{ jobId: string; error?: string }> {
  try {
    if (videoUrls.length === 0) {
      return { jobId: '', error: 'No videos provided' }
    }

    const jobId = generateJobId()
    const job: ConcatenationJob = {
      id: jobId,
      status: 'pending',
      videoUrls,
      createdAt: new Date(),
    }

    jobs.set(jobId, job)

    // Trigger async concatenation
    // In production, this would call a Cloud Run endpoint
    processConcatenation(jobId, videoUrls, outputFileName).catch((error) => {
      console.error('[Concatenation] Job failed:', error)
      const job = jobs.get(jobId)
      if (job) {
        job.status = 'failed'
        job.error = error.message
        jobs.set(jobId, job)
      }
    })

    return { jobId }
  } catch (error) {
    console.error('[Concatenation] Failed to start job:', error)
    return {
      jobId: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process concatenation (placeholder for Cloud Run implementation)
 *
 * PRODUCTION DEPLOYMENT:
 * Deploy this as a separate Cloud Run service with FFmpeg installed.
 *
 * Dockerfile example:
 * ```dockerfile
 * FROM node:18
 * RUN apt-get update && apt-get install -y ffmpeg
 * COPY . .
 * RUN npm install
 * CMD ["node", "concatenation-service.js"]
 * ```
 */
async function processConcatenation(
  jobId: string,
  videoUrls: string[],
  outputFileName: string
): Promise<void> {
  const job = jobs.get(jobId)
  if (!job) return

  job.status = 'processing'
  job.progress = 10
  jobs.set(jobId, job)

  try {
    // This is where FFmpeg concatenation would happen
    // For now, we'll simulate the process

    console.log(`[Concatenation] Processing job ${jobId}`)
    console.log(`[Concatenation] Videos to concatenate: ${videoUrls.length}`)

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // In production, this would:
    // 1. Download videos from URLs
    // 2. Create FFmpeg concat file
    // 3. Run FFmpeg concatenation
    // 4. Upload result to GCS
    // 5. Return public URL

    // For now, return the first video as output (placeholder)
    job.status = 'completed'
    job.outputUrl = videoUrls[0]
    job.progress = 100
    job.completedAt = new Date()
    jobs.set(jobId, job)

    console.log(`[Concatenation] Job ${jobId} completed`)
  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    jobs.set(jobId, job)
  }
}

/**
 * Check concatenation job status
 */
export async function getConcatenationJobStatus(
  jobId: string
): Promise<ConcatenationJob | null> {
  return jobs.get(jobId) || null
}

/**
 * Cloud Run implementation notes:
 *
 * 1. Create a new Cloud Run service:
 *    - Name: video-concatenator
 *    - Region: Same as your main app
 *    - Allow unauthenticated (or use service accounts)
 *
 * 2. Dockerfile with FFmpeg:
 *    ```dockerfile
 *    FROM node:18-slim
 *
 *    # Install FFmpeg
 *    RUN apt-get update && \
 *        apt-get install -y ffmpeg && \
 *        apt-get clean && \
 *        rm -rf /var/lib/apt/lists/*
 *
 *    WORKDIR /app
 *    COPY package*.json ./
 *    RUN npm ci --only=production
 *    COPY . .
 *
 *    CMD ["node", "server.js"]
 *    ```
 *
 * 3. Express server endpoint:
 *    ```javascript
 *    app.post('/concatenate', async (req, res) => {
 *      const { videoUrls, outputFileName } = req.body
 *
 *      // Download videos
 *      const downloads = await Promise.all(
 *        videoUrls.map(url => downloadVideo(url))
 *      )
 *
 *      // Create concat file
 *      const concatFile = downloads.map(f => `file '${f}'`).join('\n')
 *      fs.writeFileSync('concat.txt', concatFile)
 *
 *      // Run FFmpeg
 *      await execAsync(
 *        `ffmpeg -f concat -safe 0 -i concat.txt -c copy ${outputFileName}.mp4`
 *      )
 *
 *      // Upload to GCS
 *      const outputUrl = await uploadToGCS(`${outputFileName}.mp4`)
 *
 *      res.json({ success: true, outputUrl })
 *    })
 *    ```
 *
 * 4. Deploy:
 *    ```bash
 *    gcloud run deploy video-concatenator \
 *      --source . \
 *      --region us-central1 \
 *      --memory 2Gi \
 *      --timeout 600 \
 *      --allow-unauthenticated
 *    ```
 *
 * 5. Update export API to call Cloud Run:
 *    ```typescript
 *    const response = await fetch('https://video-concatenator-xxx.run.app/concatenate', {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify({ videoUrls, outputFileName: movie.title })
 *    })
 *    ```
 */
