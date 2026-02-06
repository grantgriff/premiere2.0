'use client'

import { useState } from 'react'
import { X, Download, Loader2, CheckCircle, Film } from 'lucide-react'
import { Movie } from '@/lib/store'

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
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Calculate total duration
  const totalDuration = movie.clips.reduce((sum, clip) => {
    return sum + (clip.video?.duration || 0)
  }, 0)

  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)
    setError(null)
    setStatusMessage('Preparing video files...')

    try {
      // Call export API
      const response = await fetch(`/api/movies/${movie.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Export failed')
      }

      const data = await response.json()

      if (data.exportUrl) {
        setExportProgress(100)
        setExportUrl(data.exportUrl)
        setStatusMessage('Export complete!')
      } else {
        throw new Error('No export URL returned')
      }
    } catch (err) {
      console.error('[ExportMovie] Error:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
      setIsExporting(false)
    }
  }

  const handleDownload = () => {
    if (exportUrl) {
      // Download the video
      const a = document.createElement('a')
      a.href = exportUrl
      a.download = `${movie.title.replace(/[^a-z0-9]/gi, '_')}.mp4`
      a.click()
    }
  }

  const handleReset = () => {
    setIsExporting(false)
    setExportProgress(0)
    setExportUrl(null)
    setStatusMessage('')
    setError(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-2xl max-w-xl w-full mx-4 overflow-hidden border border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-accent/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Film className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Export Movie</h2>
              <p className="text-xs text-foreground-secondary">Combine all clips into a single video</p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset()
              onClose()
            }}
            disabled={isExporting && !exportUrl}
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

          {/* Export warning/note */}
          {!isExporting && !exportUrl && !error && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-sm text-foreground-secondary leading-relaxed">
                <span className="font-medium text-foreground">Note:</span> This feature concatenates
                all video clips in sequence. For best results, ensure all clips have the same
                resolution and aspect ratio.
              </p>
            </div>
          )}

          {/* Progress */}
          {isExporting && !error && !exportUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-secondary">{statusMessage}</span>
                <span className="text-accent font-medium">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 bg-background-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success */}
          {exportUrl && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Export Complete!</p>
                <p className="text-xs text-foreground-secondary">
                  Your movie is ready to download.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm font-medium text-red-500 mb-1">Export Failed</p>
              <p className="text-xs text-foreground-secondary">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={() => {
              handleReset()
              onClose()
            }}
            disabled={isExporting && !exportUrl}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground-secondary hover:bg-background-secondary transition-colors disabled:opacity-50"
          >
            {exportUrl ? 'Close' : 'Cancel'}
          </button>

          {exportUrl ? (
            <button
              onClick={handleDownload}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Video
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={isExporting || movie.clips.length === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  Export Movie
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
