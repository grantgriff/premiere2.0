'use client'

import { useState } from 'react'
import { Play, Pause, Download, Loader2, Film, Check, AlertCircle, Plus, MessageSquare, RefreshCw } from 'lucide-react'
import { VideoModel, Video, useAppStore } from '@/lib/store'
import { QualityBadge } from './QualityBadge'
import { QualityReport } from '@/lib/models/types'

interface GenerationPanelProps {
  model: VideoModel
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  video?: Video
  onAddToMovie?: (video: Video) => void
  onDownload?: (video: Video) => void
  onSetAsCurrentVideo?: (video: Video) => void
}

const MODEL_NAMES: Record<VideoModel, string> = {
  veo3_1: 'Veo 3.1',
  runway: 'Runway',
  luma: 'Luma AI',
  sora: 'Sora',
  odyssey: 'Odyssey',
  world_labs: 'World Labs',
}

export function GenerationPanel({
  model,
  status,
  progress,
  video,
  onAddToMovie,
  onDownload,
  onSetAsCurrentVideo
}: GenerationPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)
  const setMultiModelMode = useAppStore((state) => state.setMultiModelMode)

  const togglePlay = () => {
    if (!videoElement) return
    if (isPlaying) {
      videoElement.pause()
    } else {
      videoElement.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleDownload = () => {
    if (video && onDownload) {
      onDownload(video)
    }
  }

  const handleAddToMovie = () => {
    if (video && onAddToMovie) {
      onAddToMovie(video)
    }
  }

  const handleFeedback = () => {
    if (video) {
      // Set as current video and exit multi-model mode
      setCurrentVideo(video)
      setMultiModelMode(false)
      // User will be able to add feedback in single video view
    }
  }

  const handleRegenerate = () => {
    if (video) {
      // Set as current video and exit multi-model mode
      setCurrentVideo(video)
      setMultiModelMode(false)
      // User can regenerate from single video view
    }
  }

  return (
    <div className="flex flex-col h-full bg-background-secondary rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-foreground">{MODEL_NAMES[model]}</span>
        </div>
        {status === 'completed' && video && video.qualityScore !== null && (
          <QualityBadge
            score={video.qualityScore}
            report={video.qualityReport as QualityReport | null}
            size="sm"
          />
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-background">
        {status === 'queued' && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background-secondary flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-foreground-secondary animate-pulse" />
            </div>
            <p className="text-sm text-foreground-secondary">Queued...</p>
          </div>
        )}

        {status === 'processing' && (
          <div className="text-center w-full max-w-xs">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background-secondary flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
            <p className="text-sm font-medium text-foreground mb-3">Generating...</p>
            <div className="w-full h-2 bg-background-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-foreground-secondary mt-2">{progress}% complete</p>
          </div>
        )}

        {status === 'completed' && video?.videoUrl && (
          <div className="w-full">
            <div className="video-container relative bg-black rounded-lg overflow-hidden mb-3">
              <video
                ref={setVideoElement}
                src={video.videoUrl}
                className="w-full h-full object-contain"
                poster={video.thumbnailUrl || undefined}
                playsInline
                loop
              />
              <button
                onClick={togglePlay}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
              >
                {isPlaying ? (
                  <Pause className="w-12 h-12 text-white" />
                ) : (
                  <Play className="w-12 h-12 text-white" />
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddToMovie}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add to Movie
                </button>
                <button
                  onClick={handleDownload}
                  className="btn-secondary p-2"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFeedback}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Feedback
                </button>
                <button
                  onClick={handleRegenerate}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-red-500">Generation failed</p>
            <p className="text-xs text-foreground-secondary mt-1">Please try again</p>
          </div>
        )}
      </div>

      {/* Footer - Show video info when completed */}
      {status === 'completed' && video && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-foreground-secondary truncate" title={video.prompt}>
            {video.prompt}
          </p>
        </div>
      )}
    </div>
  )
}
