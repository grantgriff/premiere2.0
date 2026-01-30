'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  Download,
  RefreshCw,
  Scissors,
  Maximize2,
  Volume2,
  VolumeX,
  Loader2,
  Shield,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { QualityBadge } from '@/components/ui/QualityBadge'
import { QualityReport } from '@/lib/models/types'

export function VideoPanel() {
  const currentVideo = useAppStore((state) => state.currentVideo)
  const isGenerating = useAppStore((state) => state.isGenerating)
  const generationProgress = useAppStore((state) => state.generationProgress)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  // Handle video time updates
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      setProgress((video.currentTime / video.duration) * 100)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      setCurrentTime(0)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [currentVideo])

  // Play/pause control
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }

  // Mute control
  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !isMuted
    setIsMuted(!isMuted)
  }

  // Seek control
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    video.currentTime = percentage * video.duration
  }

  // Download video
  const handleDownload = () => {
    if (!currentVideo?.videoUrl) return

    const a = document.createElement('a')
    a.href = currentVideo.videoUrl
    a.download = `videocraft-${currentVideo.id}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <main className="flex-1 min-w-[600px] flex flex-col bg-background border-r border-border">
      {/* Video Viewport */}
      <div className="flex-1 flex items-center justify-center p-8">
        {isGenerating ? (
          /* Generating State */
          <div className="text-center max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-background-secondary flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-accent animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Generating Video...
            </h2>
            <div className="w-full max-w-xs mx-auto mb-4">
              <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className="text-sm text-foreground-secondary mt-2">
                {generationProgress}% complete
              </p>
            </div>
          </div>
        ) : currentVideo?.videoUrl ? (
          <div className="w-full max-w-4xl">
            {/* Video Container */}
            <div className="video-container relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={currentVideo.videoUrl}
                className="w-full h-full object-contain"
                poster={currentVideo.thumbnailUrl || undefined}
                playsInline
              />

              {/* Quality Badge */}
              <div className="absolute top-4 right-4">
                {currentVideo.isVerifying ? (
                  <div className="flex items-center gap-1.5 text-foreground-secondary text-sm bg-background/80 px-2.5 py-1 rounded-full">
                    <Shield className="w-4 h-4 animate-pulse" />
                    <span>Verifying...</span>
                  </div>
                ) : currentVideo.qualityScore !== null ? (
                  <QualityBadge
                    score={currentVideo.qualityScore}
                    report={currentVideo.qualityReport as QualityReport | null}
                    size="md"
                  />
                ) : null}
              </div>

              {/* Play/Pause Overlay */}
              <button
                onClick={togglePlay}
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
              <div
                className="h-2 bg-background-secondary rounded-full overflow-hidden cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={togglePlay} className="btn-ghost p-2">
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button onClick={toggleMute} className="btn-ghost p-2">
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <span className="text-sm text-foreground-secondary">
                    {formatTime(currentTime)} / {currentVideo.duration}s
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
                  <span className="model-chip">{currentVideo.model}</span>
                  <span>{currentVideo.duration}s duration</span>
                </div>
                <span className="text-xs opacity-60">
                  Prompt: {currentVideo.prompt.slice(0, 50)}
                  {currentVideo.prompt.length > 50 ? '...' : ''}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleDownload}
                  className="btn-secondary flex items-center gap-2"
                >
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
