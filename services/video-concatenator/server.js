/**
 * Video Concatenation Service
 * Google Cloud Run service for concatenating videos using FFmpeg
 */

const express = require('express')
const ffmpeg = require('fluent-ffmpeg')
const { Storage } = require('@google-cloud/storage')
const fetch = require('node-fetch')
const fs = require('fs').promises
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8080
const TEMP_DIR = '/tmp'
const GCS_BUCKET = process.env.GCS_BUCKET || 'premiere-characters-grant'

// Initialize Google Cloud Storage
const storage = new Storage()

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'video-concatenator' })
})

/**
 * Download a video from URL to temp directory
 */
async function downloadVideo(url, filename) {
  console.log(`[Download] Fetching: ${url.substring(0, 80)}...`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`)
  }

  const buffer = await response.buffer()
  const filePath = path.join(TEMP_DIR, filename)
  await fs.writeFile(filePath, buffer)

  console.log(`[Download] Saved to: ${filePath}`)
  return filePath
}

/**
 * Concatenate videos using FFmpeg
 */
function concatenateVideos(inputFiles, outputFile) {
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg] Concatenating ${inputFiles.length} videos...`)

    // Create FFmpeg command
    let command = ffmpeg()

    // Add each input file
    inputFiles.forEach(file => {
      command = command.input(file)
    })

    // Configure output
    command
      .on('start', (commandLine) => {
        console.log('[FFmpeg] Command:', commandLine)
      })
      .on('progress', (progress) => {
        console.log(`[FFmpeg] Progress: ${JSON.stringify(progress)}`)
      })
      .on('end', () => {
        console.log('[FFmpeg] Concatenation completed')
        resolve(outputFile)
      })
      .on('error', (err) => {
        console.error('[FFmpeg] Error:', err)
        reject(err)
      })
      // Concatenate using concat filter (works with different codecs)
      .complexFilter([
        {
          filter: 'concat',
          options: { n: inputFiles.length, v: 1, a: 0 },
          outputs: 'out'
        }
      ], 'out')
      .outputOptions([
        '-c:v libx264',      // Re-encode to H.264
        '-preset fast',       // Fast encoding
        '-crf 23',           // Good quality
        '-pix_fmt yuv420p'   // Compatibility
      ])
      .output(outputFile)
      .run()
  })
}

/**
 * Upload file to Google Cloud Storage
 */
async function uploadToGCS(localPath, remotePath) {
  console.log(`[GCS] Uploading to: gs://${GCS_BUCKET}/${remotePath}`)

  const bucket = storage.bucket(GCS_BUCKET)
  await bucket.upload(localPath, {
    destination: remotePath,
    metadata: {
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000',
    },
  })

  // Make file public
  await bucket.file(remotePath).makePublic()

  // Get public URL
  const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${remotePath}`
  console.log(`[GCS] Public URL: ${publicUrl}`)

  return publicUrl
}

/**
 * Clean up temporary files
 */
async function cleanup(files) {
  console.log(`[Cleanup] Removing ${files.length} temporary files...`)
  await Promise.all(
    files.map(file =>
      fs.unlink(file).catch(err =>
        console.warn(`[Cleanup] Failed to delete ${file}:`, err.message)
      )
    )
  )
}

/**
 * POST /concatenate
 * Concatenate multiple videos into one
 *
 * Body: {
 *   videoUrls: string[]     // Array of video URLs to concatenate
 *   outputFileName?: string // Optional output filename (without extension)
 * }
 *
 * Response: {
 *   success: boolean
 *   outputUrl?: string
 *   error?: string
 * }
 */
app.post('/concatenate', async (req, res) => {
  const requestId = uuidv4()
  console.log(`[${requestId}] New concatenation request`)

  const tempFiles = []

  try {
    const { videoUrls, outputFileName = 'concatenated' } = req.body

    // Validate input
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'videoUrls array is required and must not be empty'
      })
    }

    console.log(`[${requestId}] Concatenating ${videoUrls.length} videos`)

    // Download all videos
    const downloadedFiles = []
    for (let i = 0; i < videoUrls.length; i++) {
      const filename = `${requestId}_input_${i}.mp4`
      const filePath = await downloadVideo(videoUrls[i], filename)
      downloadedFiles.push(filePath)
      tempFiles.push(filePath)
    }

    // Concatenate videos
    const outputPath = path.join(TEMP_DIR, `${requestId}_output.mp4`)
    tempFiles.push(outputPath)

    await concatenateVideos(downloadedFiles, outputPath)

    // Upload to GCS
    const gcsPath = `movies/${outputFileName}_${Date.now()}.mp4`
    const publicUrl = await uploadToGCS(outputPath, gcsPath)

    // Clean up
    await cleanup(tempFiles)

    console.log(`[${requestId}] Success! Output URL: ${publicUrl}`)

    res.json({
      success: true,
      outputUrl: publicUrl
    })

  } catch (error) {
    console.error(`[${requestId}] Error:`, error)

    // Clean up on error
    await cleanup(tempFiles)

    res.status(500).json({
      success: false,
      error: error.message || 'Concatenation failed'
    })
  }
})

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Video Concatenator service listening on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`GCS Bucket: ${GCS_BUCKET}`)
})
