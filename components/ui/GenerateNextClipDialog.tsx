'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Sparkles, Film, Link as LinkIcon } from 'lucide-react'
import { useAppStore, MovieClip } from '@/lib/store'
import { startGeneration, pollVideoStatus, VideoStatusResponse } from '@/lib/api'
import { MODEL_INFO, VideoModelId } from '@/lib/models/types'
import { generateId } from '@/lib/utils'
import { extractBothFrames } from '@/lib/frameExtraction'
import { uploadToStorage, STORAGE_BUCKETS } from '@/lib/supabase'

const MODELS = [
  { id: 'veo3_1' as const, name: 'Veo 3.1', speed: '~60s', disabled: false },
  { id: 'runway' as const, name: 'Runway', speed: '~30s', disabled: false },
  { id: 'luma' as const, name: 'Luma', speed: '~30s', disabled: false },
  { id: 'sora' as const, name: 'Sora', speed: '~90s', disabled: false },
]

interface GenerateNextClipDialogProps {
  isOpen: boolean
  onClose: () => void
  movieId: string
  previousClip: MovieClip
}

export function GenerateNextClipDialog({
  isOpen,
  onClose,
  movieId,
  previousClip,
}: GenerateNextClipDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<VideoModelId>('veo3_1')
  const [selectedDuration, setSelectedDuration] = useState(8)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')

  const user = useAppStore((state) => state.user)
  const addClipToMovie = useAppStore((state) => state.addClipToMovie)
  const addVideo = useAppStore((state) => state.addVideo)
  const updateVideo = useAppStore((state) => state.updateVideo)

  // Get model info for duration options
  const modelInfo = MODEL_INFO[selectedModel]
  const availableDurations = modelInfo?.allowedDurations || [4, 6, 8]

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPrompt('Continue the scene...')
      setIsGenerating(false)
      setProgress(0)
      setStatusMessage('')
      // Set duration based on model
      setSelectedDuration(availableDurations.includes(8) ? 8 : availableDurations[0])
    }
  }, [isOpen, availableDurations])

  // Adjust duration when model changes
  useEffect(() => {
    if (!availableDurations.includes(selectedDuration)) {
      setSelectedDuration(availableDurations.includes(8) ? 8 : availableDurations[0])
    }
  }, [selectedModel, selectedDuration, availableDurations])

  const handleGenerate = async () => {
    if (!prompt.trim() || !user?.id || !previousClip.lastFrameUrl) {
      return
    }

    setIsGenerating(true)
    setProgress(5)
    setStatusMessage('Starting generation...')

    try {
      // Start generation with frame chaining
      setStatusMessage('Preparing frame chaining...')
      const response = await startGeneration({
        prompt: prompt.trim(),
        model: selectedModel,
        duration: selectedDuration,
        // Frame chaining parameters - Veo will use frame chaining mode
        lastFrameUrl: previousClip.lastFrameUrl,
      })

      if (!response.success || !response.videoId) {
        throw new Error(response.error || 'Failed to start generation')
      }

      const videoId = response.videoId
      setProgress(10)
      setStatusMessage(`Generating with ${MODEL_INFO[selectedModel].name}...`)

      // Poll for completion
      await new Promise<void>((resolve, reject) => {
        pollVideoStatus(videoId, async (status: VideoStatusResponse) => {
          if (status.status === 'processing') {
            setProgress((prev) => Math.min(prev + 10, 90))
            setStatusMessage(`Generating... ${Math.floor(progress)}%`)
          }

          if (status.status === 'completed' && status.videoUrl) {
            setProgress(95)
            setStatusMessage('Extracting frames...')

            try {
              // Extract frames from generated video
              const { firstFrame, lastFrame } = await extractBothFrames(status.videoUrl)

              // Upload frames to storage
              const frameBasePath = `${user.id}/frames/${generateId()}`
              const [firstUrl, lastUrl] = await Promise.all([
                uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_first.jpg`, firstFrame),
                uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_last.jpg`, lastFrame),
              ])

              setProgress(98)
              setStatusMessage('Adding to movie...')

              // Get next position
              const movie = useAppStore.getState().movies.find((m) => m.id === movieId)
              const nextPosition = movie?.clips.length || 0

              // Add clip to movie via API
              const clipResponse = await fetch(`/api/movies/${movieId}/clips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  videoId,
                  position: nextPosition,
                  firstFrameUrl: firstUrl,
                  lastFrameUrl: lastUrl,
                }),
              })

              if (clipResponse.ok) {
                const { clip } = await clipResponse.json()
                addClipToMovie(movieId, {
                  ...clip,
                  createdAt: new Date(clip.createdAt),
                })

                setProgress(100)
                setStatusMessage('Complete!')

                // Close dialog after short delay
                setTimeout(() => {
                  onClose()
                }, 500)

                resolve()
              } else {
                throw new Error('Failed to add clip to movie')
              }
            } catch (error) {
              console.error('[GenerateNextClip] Failed to process video:', error)
              reject(error)
            }
          } else if (status.status === 'failed') {
            setStatusMessage('Generation failed')
            reject(new Error(status.error || 'Generation failed'))
          }
        })
      })
    } catch (error) {
      console.error('[GenerateNextClip] Error:', error)
      setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-2xl max-w-2xl w-full mx-4 overflow-hidden border border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-accent/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Generate Next Clip</h2>
              <p className="text-xs text-foreground-secondary">Continues from previous clip using frame chaining</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-foreground-secondary hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Frame chaining indicator */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">
                  Frame Chaining Enabled
                </p>
                <p className="text-xs text-foreground-secondary leading-relaxed">
                  This video will smoothly continue from the last frame of the previous clip, creating seamless transitions.
                  {selectedModel === 'veo3_1' && (
                    <span className="block mt-1 text-accent/80">
                      Using Veo 3.1 frame-to-frame generation mode
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Prompt input */}
          <div>
            <label className="text-sm text-foreground-secondary mb-2 block">
              Continuation Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              placeholder="Describe what happens next..."
              className="w-full h-24 px-4 py-3 rounded-lg bg-background-secondary border border-border text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none disabled:opacity-50"
            />
          </div>

          {/* Model selector */}
          <div>
            <label className="text-sm text-foreground-secondary mb-2 block">Model</label>
            <div className="flex flex-wrap gap-2">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  disabled={isGenerating || model.disabled}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedModel === model.id
                      ? 'bg-accent text-white'
                      : 'bg-background-secondary text-foreground-secondary hover:bg-background-secondary/70'
                  } ${model.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {model.name}
                  {model.disabled && <span className="ml-1 text-xs">(soon)</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Duration selector */}
          <div>
            <label className="text-sm text-foreground-secondary mb-2 block">Duration</label>
            <div className="flex flex-wrap gap-2">
              {availableDurations.map((duration) => (
                <button
                  key={duration}
                  onClick={() => setSelectedDuration(duration)}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedDuration === duration
                      ? 'bg-accent text-white'
                      : 'bg-background-secondary text-foreground-secondary hover:bg-background-secondary/70'
                  } disabled:opacity-50`}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </div>

          {/* Progress indicator */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-secondary">{statusMessage}</span>
                <span className="text-accent font-medium">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-background-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                Generate Clip
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
