// Model exports and unified generation interface
import { VideoModelId, GenerationParams, GenerationResult, GenerationStatus, MODEL_INFO } from './types'
import { generateWithVeo, checkVeoStatus } from './veo'
import { generateWithRunway, checkRunwayStatus } from './runway'
import { generateWithLuma, checkLumaStatus } from './luma'

export * from './types'
export { analyzeVideoQuality, meetsQualityThreshold, getHighSeverityIssues } from './gemini'

// Unified generation function
export async function generateVideo(
  model: VideoModelId,
  params: GenerationParams
): Promise<GenerationResult> {
  // Validate duration against model limits
  const modelInfo = MODEL_INFO[model]
  if (params.duration > modelInfo.maxDuration) {
    return {
      success: false,
      error: `Duration ${params.duration}s exceeds ${modelInfo.name} limit of ${modelInfo.maxDuration}s`,
    }
  }

  try {
    switch (model) {
      case 'veo3_1':
        return await generateWithVeo(params)
      case 'runway':
        return await generateWithRunway(params)
      case 'luma':
        return await generateWithLuma(params)
      case 'sora':
        // Sora not yet implemented
        return { success: false, error: 'Sora integration coming soon' }
      case 'odyssey':
        // Odyssey not yet implemented
        return { success: false, error: 'Odyssey integration coming soon' }
      case 'world_labs':
        // World Labs not yet implemented
        return { success: false, error: 'World Labs integration coming soon' }
      default:
        return { success: false, error: `Unknown model: ${model}` }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[generateVideo] ${model} threw an exception:`, error)
    return {
      success: false,
      error: `${model} generation failed: ${errorMessage}`,
    }
  }
}

// Unified status check
export async function checkGenerationStatus(
  model: VideoModelId,
  jobId: string
): Promise<GenerationStatus> {
  switch (model) {
    case 'veo3_1':
      return checkVeoStatus(jobId)
    case 'runway':
      return checkRunwayStatus(jobId)
    case 'luma':
      return checkLumaStatus(jobId)
    default:
      return { status: 'failed', error: `Status check not implemented for ${model}` }
  }
}

// Fallback chain - try alternative models if primary fails
const FALLBACK_ORDER: VideoModelId[] = ['veo3_1', 'runway', 'luma']

export async function generateWithFallback(
  params: GenerationParams,
  preferredModel?: VideoModelId
): Promise<GenerationResult & { model: VideoModelId }> {
  const models = preferredModel
    ? [preferredModel, ...FALLBACK_ORDER.filter((m) => m !== preferredModel)]
    : FALLBACK_ORDER

  for (const model of models) {
    const modelInfo = MODEL_INFO[model]

    // Skip if duration exceeds model limit
    if (params.duration > modelInfo.maxDuration) {
      continue
    }

    const result = await generateVideo(model, params)
    if (result.success) {
      return { ...result, model }
    }

    console.log(`${model} failed, trying next model...`)
  }

  return {
    success: false,
    error: 'All models failed to generate video',
    model: preferredModel || 'veo3_1',
  }
}

// Calculate estimated cost for generation
export function estimateCost(model: VideoModelId, durationSeconds: number): number {
  const modelInfo = MODEL_INFO[model]
  return (durationSeconds / 10) * modelInfo.costPer10Seconds
}
