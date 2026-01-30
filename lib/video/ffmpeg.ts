// FFmpeg Video Processing Library
// Uses fluent-ffmpeg for server-side video manipulation

import { spawn } from 'child_process'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

// Temp directory for processing
const TEMP_DIR = '/tmp/videocraft'

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await mkdir(TEMP_DIR, { recursive: true })
  } catch (e) {
    // Directory exists
  }
}

// Color adjustment parameters
export interface ColorAdjustments {
  contrast?: number // -1 to 1 (0 = no change)
  brightness?: number // -1 to 1 (0 = no change)
  saturation?: number // 0 to 2 (1 = no change)
  exposure?: number // -2 to 2 (0 = no change)
  highlights?: number // -1 to 1 (0 = no change)
  shadows?: number // -1 to 1 (0 = no change)
  temperature?: number // -100 to 100 (0 = neutral, negative = cool, positive = warm)
  gamma?: number // 0.1 to 10 (1 = no change)
}

export interface TrimOptions {
  startTime: number // seconds
  endTime: number // seconds
}

export interface ExtendOptions {
  duration: number // additional seconds
  method: 'freeze' | 'loop' | 'reverse'
}

export interface SpeedOptions {
  factor: number // 0.25 to 4 (1 = normal, 0.5 = slow-mo, 2 = 2x speed)
}

export interface FpsOptions {
  fps: number // target FPS (24, 30, 60, etc.)
}

export interface ResolutionOptions {
  width: number
  height: number
  maintainAspect?: boolean
}

// Execute FFmpeg command
async function execFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args)
    let stdout = ''
    let stderr = ''

    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
      }
    })

    ffmpeg.on('error', (err) => {
      reject(err)
    })
  })
}

// Download video from URL to temp file
async function downloadToTemp(url: string): Promise<string> {
  await ensureTempDir()
  const tempPath = join(TEMP_DIR, `input_${randomUUID()}.mp4`)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`)

  const buffer = await response.arrayBuffer()
  await writeFile(tempPath, Buffer.from(buffer))

  return tempPath
}

// Cleanup temp files
async function cleanupTemp(paths: string[]) {
  for (const path of paths) {
    try {
      await unlink(path)
    } catch (e) {
      // File might not exist
    }
  }
}

// Build FFmpeg filter string for color adjustments
function buildColorFilter(adjustments: ColorAdjustments): string {
  const filters: string[] = []

  // Contrast and brightness using eq filter
  if (adjustments.contrast !== undefined || adjustments.brightness !== undefined || adjustments.saturation !== undefined || adjustments.gamma !== undefined) {
    const eqParts: string[] = []

    if (adjustments.contrast !== undefined) {
      // Map -1 to 1 range to 0 to 2 range for FFmpeg
      const contrast = 1 + adjustments.contrast
      eqParts.push(`contrast=${contrast.toFixed(2)}`)
    }

    if (adjustments.brightness !== undefined) {
      // Map -1 to 1 range to -1 to 1 for FFmpeg
      eqParts.push(`brightness=${adjustments.brightness.toFixed(2)}`)
    }

    if (adjustments.saturation !== undefined) {
      eqParts.push(`saturation=${adjustments.saturation.toFixed(2)}`)
    }

    if (adjustments.gamma !== undefined) {
      eqParts.push(`gamma=${adjustments.gamma.toFixed(2)}`)
    }

    if (eqParts.length > 0) {
      filters.push(`eq=${eqParts.join(':')}`)
    }
  }

  // Exposure simulation using curves
  if (adjustments.exposure !== undefined && adjustments.exposure !== 0) {
    // Simulate exposure with gamma adjustment
    const gamma = Math.pow(2, -adjustments.exposure)
    filters.push(`curves=all='0/0 0.5/${(0.5 * Math.pow(0.5, adjustments.exposure)).toFixed(3)} 1/1'`)
  }

  // Highlights and shadows using curves
  if (adjustments.highlights !== undefined && adjustments.highlights !== 0) {
    // Adjust highlights (top end of curve)
    const highlightPoint = 1 + (adjustments.highlights * 0.3)
    filters.push(`curves=all='0/0 0.5/0.5 1/${Math.min(1, Math.max(0, highlightPoint)).toFixed(3)}'`)
  }

  if (adjustments.shadows !== undefined && adjustments.shadows !== 0) {
    // Adjust shadows (bottom end of curve)
    const shadowPoint = adjustments.shadows * 0.2
    filters.push(`curves=all='0/${Math.max(0, shadowPoint).toFixed(3)} 0.5/0.5 1/1'`)
  }

  // Temperature (white balance) using colorbalance
  if (adjustments.temperature !== undefined && adjustments.temperature !== 0) {
    const temp = adjustments.temperature / 100 // Normalize to -1 to 1
    // Warm = more red/yellow, Cool = more blue
    const rs = temp > 0 ? temp * 0.3 : 0
    const bs = temp < 0 ? Math.abs(temp) * 0.3 : 0
    filters.push(`colorbalance=rs=${rs.toFixed(2)}:gs=0:bs=${bs.toFixed(2)}:rm=${rs.toFixed(2)}:gm=0:bm=${bs.toFixed(2)}:rh=${rs.toFixed(2)}:gh=0:bh=${bs.toFixed(2)}`)
  }

  return filters.join(',')
}

// Trim video
export async function trimVideo(
  inputUrl: string,
  options: TrimOptions
): Promise<Buffer> {
  await ensureTempDir()

  const inputPath = await downloadToTemp(inputUrl)
  const outputPath = join(TEMP_DIR, `output_${randomUUID()}.mp4`)

  try {
    const duration = options.endTime - options.startTime

    await execFFmpeg([
      '-y',
      '-i', inputPath,
      '-ss', options.startTime.toString(),
      '-t', duration.toString(),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast',
      outputPath,
    ])

    const { readFile } = await import('fs/promises')
    const result = await readFile(outputPath)

    await cleanupTemp([inputPath, outputPath])
    return result
  } catch (error) {
    await cleanupTemp([inputPath, outputPath])
    throw error
  }
}

// Extend video
export async function extendVideo(
  inputUrl: string,
  options: ExtendOptions
): Promise<Buffer> {
  await ensureTempDir()

  const inputPath = await downloadToTemp(inputUrl)
  const outputPath = join(TEMP_DIR, `output_${randomUUID()}.mp4`)

  try {
    let filterComplex = ''

    switch (options.method) {
      case 'freeze':
        // Freeze last frame
        filterComplex = `[0:v]tpad=stop_mode=clone:stop_duration=${options.duration}[v]`
        break
      case 'loop':
        // Loop the video
        const loopCount = Math.ceil(options.duration / 5) // Assuming ~5s video
        await execFFmpeg([
          '-y',
          '-stream_loop', loopCount.toString(),
          '-i', inputPath,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'fast',
          '-t', (5 + options.duration).toString(), // Original + extension
          outputPath,
        ])
        const { readFile } = await import('fs/promises')
        const loopResult = await readFile(outputPath)
        await cleanupTemp([inputPath, outputPath])
        return loopResult
      case 'reverse':
        // Add reversed video at end
        filterComplex = `[0:v]split[v1][v2];[v2]reverse[vr];[v1][vr]concat=n=2:v=1:a=0[v]`
        break
    }

    if (options.method !== 'loop') {
      await execFFmpeg([
        '-y',
        '-i', inputPath,
        '-filter_complex', filterComplex,
        '-map', '[v]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        outputPath,
      ])
    }

    const { readFile } = await import('fs/promises')
    const result = await readFile(outputPath)

    await cleanupTemp([inputPath, outputPath])
    return result
  } catch (error) {
    await cleanupTemp([inputPath, outputPath])
    throw error
  }
}

// Change video speed
export async function changeSpeed(
  inputUrl: string,
  options: SpeedOptions
): Promise<Buffer> {
  await ensureTempDir()

  const inputPath = await downloadToTemp(inputUrl)
  const outputPath = join(TEMP_DIR, `output_${randomUUID()}.mp4`)

  try {
    const pts = 1 / options.factor // PTS adjustment (inverse of speed factor)

    await execFFmpeg([
      '-y',
      '-i', inputPath,
      '-filter:v', `setpts=${pts.toFixed(4)}*PTS`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-an', // Remove audio for speed changes (or use atempo for audio)
      outputPath,
    ])

    const { readFile } = await import('fs/promises')
    const result = await readFile(outputPath)

    await cleanupTemp([inputPath, outputPath])
    return result
  } catch (error) {
    await cleanupTemp([inputPath, outputPath])
    throw error
  }
}

// Change FPS
export async function changeFps(
  inputUrl: string,
  options: FpsOptions
): Promise<Buffer> {
  await ensureTempDir()

  const inputPath = await downloadToTemp(inputUrl)
  const outputPath = join(TEMP_DIR, `output_${randomUUID()}.mp4`)

  try {
    await execFFmpeg([
      '-y',
      '-i', inputPath,
      '-filter:v', `fps=${options.fps}`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast',
      outputPath,
    ])

    const { readFile } = await import('fs/promises')
    const result = await readFile(outputPath)

    await cleanupTemp([inputPath, outputPath])
    return result
  } catch (error) {
    await cleanupTemp([inputPath, outputPath])
    throw error
  }
}

// Apply color adjustments
export async function applyColorAdjustments(
  inputUrl: string,
  adjustments: ColorAdjustments
): Promise<Buffer> {
  await ensureTempDir()

  const inputPath = await downloadToTemp(inputUrl)
  const outputPath = join(TEMP_DIR, `output_${randomUUID()}.mp4`)

  try {
    const filterString = buildColorFilter(adjustments)

    if (!filterString) {
      // No adjustments, just copy
      const { readFile } = await import('fs/promises')
      const result = await readFile(inputPath)
      await cleanupTemp([inputPath])
      return result
    }

    await execFFmpeg([
      '-y',
      '-i', inputPath,
      '-vf', filterString,
      '-c:v', 'libx264',
      '-c:a', 'copy',
      '-preset', 'fast',
      outputPath,
    ])

    const { readFile } = await import('fs/promises')
    const result = await readFile(outputPath)

    await cleanupTemp([inputPath, outputPath])
    return result
  } catch (error) {
    await cleanupTemp([inputPath, outputPath])
    throw error
  }
}

// Change resolution
export async function changeResolution(
  inputUrl: string,
  options: ResolutionOptions
): Promise<Buffer> {
  await ensureTempDir()

  const inputPath = await downloadToTemp(inputUrl)
  const outputPath = join(TEMP_DIR, `output_${randomUUID()}.mp4`)

  try {
    const scaleFilter = options.maintainAspect
      ? `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`
      : `scale=${options.width}:${options.height}`

    await execFFmpeg([
      '-y',
      '-i', inputPath,
      '-vf', scaleFilter,
      '-c:v', 'libx264',
      '-c:a', 'copy',
      '-preset', 'fast',
      outputPath,
    ])

    const { readFile } = await import('fs/promises')
    const result = await readFile(outputPath)

    await cleanupTemp([inputPath, outputPath])
    return result
  } catch (error) {
    await cleanupTemp([inputPath, outputPath])
    throw error
  }
}

// Combined processing - apply multiple operations at once
export async function processVideo(
  inputUrl: string,
  options: {
    trim?: TrimOptions
    speed?: SpeedOptions
    fps?: FpsOptions
    color?: ColorAdjustments
    resolution?: ResolutionOptions
  }
): Promise<Buffer> {
  await ensureTempDir()

  const inputPath = await downloadToTemp(inputUrl)
  const outputPath = join(TEMP_DIR, `output_${randomUUID()}.mp4`)

  try {
    const filters: string[] = []
    const inputArgs: string[] = ['-y', '-i', inputPath]

    // Trim (handled via -ss and -t)
    if (options.trim) {
      inputArgs.push('-ss', options.trim.startTime.toString())
      inputArgs.push('-t', (options.trim.endTime - options.trim.startTime).toString())
    }

    // Build filter chain
    if (options.speed) {
      const pts = 1 / options.speed.factor
      filters.push(`setpts=${pts.toFixed(4)}*PTS`)
    }

    if (options.fps) {
      filters.push(`fps=${options.fps.fps}`)
    }

    if (options.resolution) {
      const scaleFilter = options.resolution.maintainAspect
        ? `scale=${options.resolution.width}:${options.resolution.height}:force_original_aspect_ratio=decrease`
        : `scale=${options.resolution.width}:${options.resolution.height}`
      filters.push(scaleFilter)
    }

    if (options.color) {
      const colorFilter = buildColorFilter(options.color)
      if (colorFilter) {
        filters.push(colorFilter)
      }
    }

    const outputArgs: string[] = []

    if (filters.length > 0) {
      outputArgs.push('-vf', filters.join(','))
    }

    outputArgs.push(
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast',
      outputPath
    )

    await execFFmpeg([...inputArgs, ...outputArgs])

    const { readFile } = await import('fs/promises')
    const result = await readFile(outputPath)

    await cleanupTemp([inputPath, outputPath])
    return result
  } catch (error) {
    await cleanupTemp([inputPath, outputPath])
    throw error
  }
}

// Get video metadata
export async function getVideoInfo(inputUrl: string): Promise<{
  duration: number
  width: number
  height: number
  fps: number
  codec: string
}> {
  await ensureTempDir()
  const inputPath = await downloadToTemp(inputUrl)

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        inputPath,
      ])

      let stdout = ''
      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      ffprobe.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error('ffprobe failed'))
        }
      })
    })

    const info = JSON.parse(result)
    const videoStream = info.streams.find((s: { codec_type: string }) => s.codec_type === 'video')

    await cleanupTemp([inputPath])

    return {
      duration: parseFloat(info.format.duration),
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: eval(videoStream?.r_frame_rate || '30/1'),
      codec: videoStream?.codec_name || 'unknown',
    }
  } catch (error) {
    await cleanupTemp([inputPath])
    throw error
  }
}
