import { VideoModel, Video, useAppStore } from './store'
import { startGeneration, pollVideoStatus, verifyVideoQuality, VideoStatusResponse, StyleReference } from './api'
import { generateId } from './utils'
import { QualityReport, MODEL_INFO } from './models/types'

export interface GenerationState {
  model: VideoModel
  videoId: string | null
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  video?: Video
  error?: string
}

export type GenerationStateMap = Map<VideoModel, GenerationState>

/**
 * Map the requested duration to the closest allowed duration for a specific model
 */
function mapDurationForModel(requestedDuration: number, model: VideoModel): number {
  const modelInfo = MODEL_INFO[model]
  const allowedDurations = modelInfo.allowedDurations

  // If the requested duration is allowed, use it
  if (allowedDurations.includes(requestedDuration)) {
    return requestedDuration
  }

  // Otherwise, find the closest allowed duration
  const closest = allowedDurations.reduce((prev, curr) => {
    return Math.abs(curr - requestedDuration) < Math.abs(prev - requestedDuration) ? curr : prev
  })

  console.log(`[MultiModel] Mapped duration ${requestedDuration}s -> ${closest}s for ${model}`)
  return closest
}

/**
 * Start simultaneous generation for multiple models
 */
export async function startMultiModelGeneration(
  models: VideoModel[],
  prompt: string,
  requestedDuration: number,
  conversationId: string,
  styleReferences: StyleReference[],
  characterIds?: string[],
  onProgressUpdate?: (states: GenerationStateMap) => void,
  firstFrameUrl?: string,
): Promise<GenerationStateMap> {
  const states: GenerationStateMap = new Map()

  // Initialize all states as queued
  models.forEach((model) => {
    states.set(model, {
      model,
      videoId: null,
      status: 'queued',
      progress: 0,
    })
  })

  // Notify initial state
  onProgressUpdate?.(states)

  // Start all generations in parallel
  const generationPromises = models.map(async (model) => {
    try {
      // Update to processing
      const state = states.get(model)!
      state.status = 'processing'
      state.progress = 5
      onProgressUpdate?.(states)

      // Map duration to what this model supports
      const duration = mapDurationForModel(requestedDuration, model)

      // Start generation with model-specific parameters
      const response = await startGeneration({
        prompt,
        model,
        duration,
        conversationId,
        styleReferences,
        characterIds, // Backend will handle Veo vs non-Veo character handling
        firstFrameUrl: model === 'veo3_1' ? firstFrameUrl : undefined,
      })

      if (!response.success || !response.videoId) {
        throw new Error(response.error || 'Failed to start generation')
      }

      // Update with video ID
      state.videoId = response.videoId
      state.progress = 10
      onProgressUpdate?.(states)

      // Create video entry
      const video: Video = {
        id: response.videoId,
        prompt,
        model,
        duration,
        status: 'pending',
        videoUrl: null,
        thumbnailUrl: null,
        qualityScore: null,
        qualityReport: null,
        isVerifying: false,
        createdAt: new Date(),
        completedAt: null,
      }

      // Add to conversation
      const addVideo = useAppStore.getState().addVideo
      addVideo(conversationId, video)

      // Poll for completion
      await new Promise<void>((resolve, reject) => {
        pollVideoStatus(response.videoId!, (status: VideoStatusResponse) => {
          const currentState = states.get(model)!

          // Update progress
          if (status.status === 'processing') {
            currentState.progress = Math.min(currentState.progress + 10, 90)
            onProgressUpdate?.(states)
          }

          // Update video in store
          const updateVideo = useAppStore.getState().updateVideo
          updateVideo(conversationId, response.videoId!, {
            status: status.status,
            videoUrl: status.videoUrl,
            thumbnailUrl: status.thumbnailUrl,
            qualityScore: status.qualityScore,
            completedAt: status.completedAt ? new Date(status.completedAt) : null,
          })

          // Handle completion
          if (status.status === 'completed' && status.videoUrl) {
            currentState.status = 'completed'
            currentState.progress = 100
            currentState.video = {
              id: response.videoId!,
              prompt,
              model,
              duration,
              status: 'completed',
              videoUrl: status.videoUrl,
              thumbnailUrl: status.thumbnailUrl,
              qualityScore: null,
              qualityReport: null,
              isVerifying: true,
              createdAt: new Date(),
              completedAt: new Date(),
            }
            onProgressUpdate?.(states)

            // Run quality verification in background
            verifyVideoQuality(response.videoId!, status.videoUrl).then((verifyResult) => {
              if (verifyResult && currentState.video) {
                const qualityReport = verifyResult.report as QualityReport

                // Update video with quality results
                updateVideo(conversationId, response.videoId!, {
                  qualityScore: verifyResult.qualityScore,
                  qualityReport,
                  isVerifying: false,
                })

                // Update state
                currentState.video = {
                  ...currentState.video,
                  qualityScore: verifyResult.qualityScore,
                  qualityReport,
                  isVerifying: false,
                }
                onProgressUpdate?.(states)
              }
            })

            resolve()
          } else if (status.status === 'failed') {
            currentState.status = 'failed'
            currentState.error = status.error || 'Generation failed'
            onProgressUpdate?.(states)
            reject(new Error(currentState.error))
          }
        })
      })
    } catch (error) {
      const state = states.get(model)!
      state.status = 'failed'
      state.error = error instanceof Error ? error.message : 'Unknown error'
      onProgressUpdate?.(states)
      console.error(`[MultiModel] ${model} generation failed:`, error)
    }
  })

  // Wait for all to complete (or fail)
  await Promise.allSettled(generationPromises)

  return states
}
