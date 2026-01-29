'use client'

import { useState } from 'react'
import {
  Play,
  Pause,
  Download,
  RefreshCw,
  Scissors,
  Maximize2,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface VideoData {
  id: string
  url: string
  thumbnailUrl: string
  model: string
  duration: number
  qualityScore: number
  generationTime: number
}

export function VideoPanel() {
  const [video, setVideo] = useState<VideoData | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)

  // Quality badge color based on score
  const getQualityBadgeClass = (score: number) => {
    if (score >= 8) return 'quality-high'
    if (score >= 5) return 'quality-medium'
    return 'quality-low'
  }

  return (
    <main className="flex-1 min-w-[600px] flex flex-col bg-background border-r border-border">
      {/* Video Viewport */}
      <div className="flex-1 flex items-center justify-center p-8">
        {video ? (
          <div className="w-full max-w-4xl">
            {/* Video Container */}
            <div className="video-container relative">
              <video
                src={video.url}
                className="w-full h-full object-contain"
                poster={video.thumbnailUrl}
              />

              {/* Quality Badge */}
              <div
                className={`absolute top-4 right-4 quality-badge ${getQualityBadgeClass(
                  video.qualityScore
                )}`}
              >
                {video.qualityScore.toFixed(1)}/10
              </div>

              {/* Play/Pause Overlay */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
              >
                {isPlaying ? (
                  <Pause className="w-16 h-16 text-white" />
                ) : (
                  <Play className="w-16 h-16 text-white" />
                )}
              </button>
            </div>

            {/* Playback Controls */}
            <div className="mt-4 space-y-3">
              {/* Progress Bar */}
              <div className="h-1 bg-background-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="btn-ghost p-2"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="btn-ghost p-2"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-sm text-foreground-secondary">
                    0:00 / {video.duration}s
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button className="btn-ghost p-2">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Video Info */}
              <div className="flex items-center justify-between text-sm text-foreground-secondary">
                <div className="flex items-center gap-4">
                  <span className="model-chip">{video.model}</span>
                  <span>{video.duration}s</span>
                  <span>Generated in {video.generationTime}s</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button className="btn-secondary flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button className="btn-secondary flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
                <button className="btn-secondary flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Edit Segment
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="text-center max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-background-secondary flex items-center justify-center">
              <Play className="w-12 h-12 text-foreground-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Create Your First Video
            </h2>
            <p className="text-foreground-secondary mb-6">
              Enter a prompt in the chat panel to generate an AI-powered video.
              Choose from multiple models and styles.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="panel-secondary p-3 rounded-lg">
                <p className="text-foreground font-medium">Text to Video</p>
                <p className="text-foreground-secondary text-xs">
                  Describe your vision
                </p>
              </div>
              <div className="panel-secondary p-3 rounded-lg">
                <p className="text-foreground font-medium">Style Transfer</p>
                <p className="text-foreground-secondary text-xs">
                  Upload reference media
                </p>
              </div>
              <div className="panel-secondary p-3 rounded-lg">
                <p className="text-foreground font-medium">5+ AI Models</p>
                <p className="text-foreground-secondary text-xs">
                  Veo, Runway, Luma...
                </p>
              </div>
              <div className="panel-secondary p-3 rounded-lg">
                <p className="text-foreground font-medium">Quality Check</p>
                <p className="text-foreground-secondary text-xs">
                  AI-verified output
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
