'use client'

import { useState } from 'react'
import { VideoModel, Video, useAppStore, Movie } from '@/lib/store'
import { GenerationPanel } from '../ui/GenerationPanel'
import { Film, X } from 'lucide-react'
import { extractBothFrames } from '@/lib/frameExtraction'
import { uploadToStorage, STORAGE_BUCKETS } from '@/lib/supabase'
import { generateId } from '@/lib/utils'

interface GenerationState {
  model: VideoModel
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  video?: Video
  error?: string
}

interface MovieSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (movieId: string) => void
  video: Video
}

function MovieSelectorModal({ isOpen, onClose, onSelect, video }: MovieSelectorModalProps) {
  const movies = useAppStore((state) => state.movies)
  const user = useAppStore((state) => state.user)
  const addMovie = useAppStore((state) => state.addMovie)
  const [isCreating, setIsCreating] = useState(false)
  const [newMovieTitle, setNewMovieTitle] = useState('')

  if (!isOpen) return null

  const handleCreateAndAdd = async () => {
    if (!newMovieTitle.trim() || !user) return

    setIsCreating(true)
    try {
      // Create new movie
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newMovieTitle.trim(),
          description: `Created from ${video.model} generation`,
        }),
      })

      if (response.ok) {
        const { movie } = await response.json()
        const newMovie: Movie = {
          ...movie,
          createdAt: new Date(movie.createdAt),
          updatedAt: new Date(movie.updatedAt),
          clips: [],
        }
        addMovie(newMovie)
        onSelect(newMovie.id)
        setNewMovieTitle('')
      }
    } catch (error) {
      console.error('[MovieSelector] Failed to create movie:', error)
      alert('Failed to create movie')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-lg max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Add to Movie</h2>
          <button onClick={onClose} className="text-foreground-secondary hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
          {/* Create New Movie */}
          <div className="space-y-2">
            <label className="text-sm text-foreground-secondary">Create New Movie</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMovieTitle}
                onChange={(e) => setNewMovieTitle(e.target.value)}
                placeholder="Movie title..."
                className="input-field flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
              />
              <button
                onClick={handleCreateAndAdd}
                disabled={!newMovieTitle.trim() || isCreating}
                className="btn-primary"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>

          {/* Existing Movies */}
          {movies.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm text-foreground-secondary">Or Add to Existing</label>
              <div className="space-y-2">
                {movies.map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => onSelect(movie.id)}
                    className="w-full p-3 rounded-lg border border-border hover:bg-background-secondary transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-background-secondary flex items-center justify-center">
                        <Film className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{movie.title}</p>
                        <p className="text-xs text-foreground-secondary">
                          {movie.clips.length} clip{movie.clips.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {movies.length === 0 && !newMovieTitle && (
            <p className="text-sm text-foreground-secondary text-center py-4">
              Create your first movie to get started
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface MultiModelVideoPanelProps {
  generations: GenerationState[]
}

export function MultiModelVideoPanel({ generations }: MultiModelVideoPanelProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [showMovieSelector, setShowMovieSelector] = useState(false)
  const user = useAppStore((state) => state.user)

  const handleAddToMovie = (video: Video) => {
    setSelectedVideo(video)
    setShowMovieSelector(true)
  }

  const handleMovieSelect = async (movieId: string) => {
    if (!selectedVideo || !user || !selectedVideo.videoUrl) return

    try {
      // Get the movie to determine next position
      const movies = useAppStore.getState().movies
      const movie = movies.find((m) => m.id === movieId)
      if (!movie) return

      const nextPosition = movie.clips.length

      // Extract first and last frames
      console.log('[MultiModelPanel] Extracting frames from video...')
      let firstFrameUrl: string | null = null
      let lastFrameUrl: string | null = null

      try {
        const { firstFrame, lastFrame } = await extractBothFrames(selectedVideo.videoUrl)

        // Upload frames to storage
        const frameBasePath = `${user.id}/frames/${generateId()}`
        const [firstUrl, lastUrl] = await Promise.all([
          uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_first.jpg`, firstFrame),
          uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_last.jpg`, lastFrame),
        ])

        firstFrameUrl = firstUrl
        lastFrameUrl = lastUrl
        console.log('[MultiModelPanel] Frames extracted and uploaded')
      } catch (frameError) {
        console.warn('[MultiModelPanel] Failed to extract frames, continuing without them:', frameError)
        // Continue without frames - not critical
      }

      // Add clip to movie
      const response = await fetch(`/api/movies/${movieId}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: selectedVideo.id,
          position: nextPosition,
          firstFrameUrl,
          lastFrameUrl,
        }),
      })

      if (response.ok) {
        const { clip } = await response.json()
        const addClipToMovie = useAppStore.getState().addClipToMovie
        addClipToMovie(movieId, {
          ...clip,
          createdAt: new Date(clip.createdAt),
        })
        console.log('[MultiModelPanel] Added video to movie with frames:', movieId)
        setShowMovieSelector(false)
        setSelectedVideo(null)
      }
    } catch (error) {
      console.error('[MultiModelPanel] Failed to add to movie:', error)
      alert('Failed to add video to movie')
    }
  }

  const handleDownload = (video: Video) => {
    if (!video.videoUrl) return

    const a = document.createElement('a')
    a.href = video.videoUrl
    a.download = `videocraft-${video.model}-${video.id}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Determine grid layout based on number of generations
  const gridClass =
    generations.length === 2
      ? 'grid-cols-2'
      : generations.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2'

  const setMultiModelMode = useAppStore((state) => state.setMultiModelMode)

  return (
    <>
      <main className="flex-1 min-w-[600px] flex flex-col bg-background border-r border-border">
        {/* Header with exit button */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="text-sm font-medium text-foreground-secondary">
            Model Comparison ({generations.length} models)
          </div>
          <button
            onClick={() => setMultiModelMode(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-background-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Exit Comparison
          </button>
        </div>
        <div className="flex-1 p-6">
          <div className={`grid ${gridClass} gap-4 h-full`}>
            {generations.map((gen) => (
              <GenerationPanel
                key={gen.model}
                model={gen.model}
                status={gen.status}
                progress={gen.progress}
                video={gen.video}
                error={gen.error}
                onAddToMovie={handleAddToMovie}
                onDownload={handleDownload}
              />
            ))}
          </div>
        </div>
      </main>

      {selectedVideo && (
        <MovieSelectorModal
          isOpen={showMovieSelector}
          onClose={() => {
            setShowMovieSelector(false)
            setSelectedVideo(null)
          }}
          onSelect={handleMovieSelect}
          video={selectedVideo}
        />
      )}
    </>
  )
}
