'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Download, Loader2, CheckCircle, Film, Play, Pause, SkipForward } from 'lucide-react'
import { Movie } from '@/lib/store'
import JSZip from 'jszip'

interface ExportMovieDialogProps {
  isOpen: boolean
  onClose: () => void
  movie: Movie
}

export function ExportMovieDialog({
  isOpen,
  onClose,
  movie,
}: ExportMovieDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Calculate total duration
  const totalDuration = movie.clips.reduce((sum, clip) => {
    return sum + (clip.video?.duration || 0)
  }, 0)

  // Get clips with videos
  const clipsWithVideos = movie.clips.filter(clip => clip.video?.videoUrl)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentClipIndex(0)
      setIsPlaying(false)
      setDownloadProgress(0)
      setIsDownloading(false)
    }
  }, [isOpen])

  // Handle video ended - play next clip
  const handleVideoEnded = () => {
    if (currentClipIndex < clipsWithVideos.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1)
    } else {
      // Loop back to start
      setCurrentClipIndex(0)
      setIsPlaying(false)
    }
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleNextClip = () => {
    if (currentClipIndex < clipsWithVideos.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1)
      setIsPlaying(true)
    } else {
      setCurrentClipIndex(0)
    }
  }

  const handleDownloadZip = async () => {
    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      const zip = new JSZip()

      // Download and add each clip to the ZIP
      for (let i = 0; i < clipsWithVideos.length; i++) {
        const clip = clipsWithVideos[i]
        const videoUrl = clip.video?.videoUrl

        if (!videoUrl) continue

        setDownloadProgress(Math.round(((i + 1) / clipsWithVideos.length) * 90))

        // Download video as blob
        const response = await fetch(videoUrl)
        const blob = await response.blob()

        // Add to ZIP with numbered filename
        const clipNumber = String(i + 1).padStart(2, '0')
        const fileName = `${clipNumber}_clip_${clip.video?.model || 'video'}.mp4`
        zip.file(fileName, blob)
      }

      setDownloadProgress(95)

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' })

      setDownloadProgress(100)

      // Download ZIP
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${movie.title.replace(/[^a-z0-9]/gi, '_')}_clips.zip`
      a.click()
      URL.revokeObjectURL(url)

      // Show success for a moment
      setTimeout(() => {
        setIsDownloading(false)
        setDownloadProgress(0)
      }, 1000)
    } catch (error) {
      console.error('[ExportMovie] Download error:', error)
      setIsDownloading(false)
      setDownloadProgress(0)
      alert('Failed to download clips. Please try again.')
    }
  }

  if (!isOpen) return null

  const currentClip = clipsWithVideos[currentClipIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-2xl max-w-4xl w-full mx-4 overflow-hidden border border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-accent/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Film className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Preview & Download</h2>
              <p className="text-xs text-foreground-secondary">Watch your movie and download clips</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="text-foreground-secondary hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Movie info */}
          <div className="bg-background-secondary rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">{movie.title}</span>
              <span className="text-xs text-foreground-secondary">
                {movie.clips.length} clip{movie.clips.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-foreground-secondary">
              <div>
                Total Duration: <span className="text-foreground font-medium">{totalDuration}s</span>
              </div>
              <div>
                Format: <span className="text-foreground font-medium">MP4</span>
              </div>
            </div>
          </div>

          {/* Video Player */}
          {clipsWithVideos.length > 0 && currentClip?.video?.videoUrl && (
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  src={currentClip.video.videoUrl}
                  className="w-full h-full object-contain"
                  onEnded={handleVideoEnded}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />

                {/* Play/Pause Overlay */}
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
                >
                  <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isPlaying ? (
                      <Pause className="w-8 h-8 text-white" />
                    ) : (
                      <Play className="w-8 h-8 text-white ml-1" />
                    )}
                  </div>
                </button>

                {/* Clip indicator */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <span className="text-white text-sm font-medium">
                    Clip {currentClipIndex + 1} of {clipsWithVideos.length}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Play
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleNextClip}
                    disabled={clipsWithVideos.length <= 1}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    <SkipForward className="w-4 h-4" />
                    Next Clip
                  </button>
                </div>

                <div className="text-xs text-foreground-secondary">
                  {currentClip.video?.duration}s · {currentClip.video?.model}
                </div>
              </div>

              {/* Clip thumbnails */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {clipsWithVideos.map((clip, index) => (
                  <button
                    key={clip.id}
                    onClick={() => {
                      setCurrentClipIndex(index)
                      setIsPlaying(true)
                    }}
                    className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentClipIndex
                        ? 'border-accent scale-105'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {clip.video?.thumbnailUrl ? (
                      <img
                        src={clip.video.thumbnailUrl}
                        alt={`Clip ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-background-secondary flex items-center justify-center">
                        <span className="text-xs text-foreground-secondary">{index + 1}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-foreground-secondary leading-relaxed">
              <span className="font-medium text-foreground">Download clips for editing:</span> Click
              the download button below to get a ZIP file with all clips numbered in order. Import
              the clips into your favorite video editor (iMovie, DaVinci Resolve, Premiere, etc.) to
              create your final video.
            </p>
          </div>

          {/* Download progress */}
          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-secondary">
                  {downloadProgress === 100 ? 'Complete!' : 'Downloading clips...'}
                </span>
                <span className="text-accent font-medium">{downloadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-background-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success message */}
          {downloadProgress === 100 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Download Complete!</p>
                <p className="text-xs text-foreground-secondary">
                  Check your downloads folder for the ZIP file with all clips.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDownloading && downloadProgress < 100}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
          >
            {downloadProgress === 100 ? 'Close' : 'Cancel'}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isDownloading || clipsWithVideos.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isDownloading && downloadProgress < 100 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Clips ({clipsWithVideos.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
