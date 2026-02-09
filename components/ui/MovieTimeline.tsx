'use client'

import { useState } from 'react'
import { useAppStore, useActiveMovie } from '@/lib/store'
import { Plus, Play, X, Sparkles, Download, Pause, GripVertical } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { GenerateNextClipDialog } from './GenerateNextClipDialog'
import { ExportMovieDialog } from './ExportMovieDialog'

export function MovieTimeline() {
  const { user } = useAuth()
  const activeMovie = useActiveMovie()
  const removeClipFromMovie = useAppStore((state) => state.removeClipFromMovie)
  const updateMovie = useAppStore((state) => state.updateMovie)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [playingClipId, setPlayingClipId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')

  const handleRemoveClip = async (clipId: string) => {
    if (!activeMovie || !user?.id) return

    // Remove from local store
    removeClipFromMovie(activeMovie.id, clipId)

    // Remove from API
    try {
      await fetch(`/api/movies/${activeMovie.id}/clips?clipId=${clipId}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('[MovieTimeline] Failed to remove clip:', error)
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === dropIndex || !activeMovie || !user?.id) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    // Reorder clips
    const newClips = [...activeMovie.clips]
    const [draggedClip] = newClips.splice(draggedIndex, 1)
    newClips.splice(dropIndex, 0, draggedClip)

    // Update positions
    const updatedClips = newClips.map((clip, index) => ({
      ...clip,
      position: index,
    }))

    // Update local state
    updateMovie(activeMovie.id, { clips: updatedClips })

    // Update API
    try {
      await fetch(`/api/movies/${activeMovie.id}/clips/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipIds: updatedClips.map(c => c.id),
        }),
      })
    } catch (error) {
      console.error('[MovieTimeline] Failed to reorder clips:', error)
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const togglePlayClip = (clipId: string) => {
    setPlayingClipId(playingClipId === clipId ? null : clipId)
  }

  const handleClickClip = (clip: typeof activeMovie.clips[0]) => {
    // Set this video as the current video in the main player
    if (clip.video) {
      setCurrentVideo(clip.video)
    }
  }

  const handleStartEditingTitle = () => {
    setEditingTitle(activeMovie?.title || '')
    setIsEditingTitle(true)
  }

  const handleSaveTitle = async () => {
    if (!activeMovie || !user?.id || !editingTitle.trim()) {
      setIsEditingTitle(false)
      return
    }

    try {
      const response = await fetch('/api/movies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeMovie.id,
          userId: user.id,
          title: editingTitle.trim(),
        }),
      })

      if (response.ok) {
        updateMovie(activeMovie.id, { title: editingTitle.trim() })
      }
    } catch (error) {
      console.error('[MovieTimeline] Failed to update movie title:', error)
    }

    setIsEditingTitle(false)
  }

  if (!activeMovie) {
    return null
  }

  return (
    <div className="h-40 border-t border-border bg-background-secondary flex items-center px-4 gap-4">
      {/* Timeline header */}
      <div className="flex flex-col items-center justify-center px-4 border-r border-border h-full min-w-[140px]">
        {isEditingTitle ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveTitle()
              } else if (e.key === 'Escape') {
                setIsEditingTitle(false)
              }
            }}
            autoFocus
            className="text-sm font-medium text-foreground mb-1 px-2 py-1 bg-background border border-accent rounded w-full text-center"
          />
        ) : (
          <div
            onClick={handleStartEditingTitle}
            className="text-sm font-medium text-foreground mb-1 cursor-pointer hover:text-accent transition-colors"
          >
            {activeMovie.title}
          </div>
        )}
        <div className="text-xs text-foreground-secondary mb-2">
          {activeMovie.clips.length} clip{activeMovie.clips.length !== 1 ? 's' : ''}
        </div>

        {/* Export button */}
        {activeMovie.clips.length > 0 && (
          <button
            onClick={() => setShowExportDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        )}
      </div>

      {/* Clips carousel */}
      <div className="flex-1 overflow-x-auto flex items-center gap-3 py-4">
        {activeMovie.clips.map((clip, index) => {
          const isPlaying = playingClipId === clip.id
          const isDragging = draggedIndex === index
          const isDragOver = dragOverIndex === index

          return (
            <div
              key={clip.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => handleClickClip(clip)}
              className={`relative group flex-shrink-0 w-40 h-24 rounded-lg overflow-hidden bg-background border-2 transition-all cursor-pointer ${
                isDragging ? 'opacity-50 scale-95' : ''
              } ${
                isDragOver ? 'border-accent scale-105' : 'border-border hover:border-accent'
              }`}
            >
              {/* Video preview or thumbnail */}
              {clip.video?.videoUrl ? (
                <video
                  src={clip.video.videoUrl}
                  className="w-full h-full object-cover"
                  loop
                  muted
                  playsInline
                  ref={(el) => {
                    if (el) {
                      if (isPlaying) {
                        el.play()
                      } else {
                        el.pause()
                        el.currentTime = 0
                      }
                    }
                  }}
                />
              ) : clip.video?.thumbnailUrl ? (
                <img
                  src={clip.video.thumbnailUrl}
                  alt={`Clip ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/10 to-purple-500/10">
                  <Play className="w-8 h-8 text-accent/50" />
                </div>
              )}

              {/* Drag handle */}
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm px-1.5 py-1 rounded cursor-grab active:cursor-grabbing">
                <GripVertical className="w-3 h-3 text-white" />
              </div>

              {/* Clip number overlay */}
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white font-medium">
                {index + 1}
              </div>

              {/* Duration badge */}
              {clip.video?.duration && (
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white">
                  {clip.video.duration}s
                </div>
              )}

              {/* Play/Pause button */}
              {clip.video?.videoUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePlayClip(clip.id)
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors"
                >
                  {isPlaying ? (
                    <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pause className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    </div>
                  )}
                </button>
              )}

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveClip(clip.id)
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-500 text-white p-1 rounded z-10"
              >
                <X className="w-3 h-3" />
              </button>

              {/* Connector line to next clip */}
              {index < activeMovie.clips.length - 1 && (
                <div className="absolute top-1/2 -right-3 w-3 h-0.5 bg-border z-0" />
              )}
            </div>
          )
        })}

        {/* Generate Next Clip button */}
        {activeMovie.clips.length > 0 && activeMovie.clips[activeMovie.clips.length - 1].lastFrameUrl && (
          <button
            onClick={() => setShowGenerateDialog(true)}
            className="flex-shrink-0 w-40 h-24 rounded-lg border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-purple-500/10 hover:border-accent hover:from-accent/20 hover:to-purple-500/20 flex flex-col items-center justify-center gap-2 text-accent transition-all group"
          >
            <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Generate Next</span>
          </button>
        )}

        {/* Add existing clip button */}
        <button className="flex-shrink-0 w-40 h-24 rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center gap-2 text-foreground-secondary hover:text-accent transition-colors">
          <Plus className="w-6 h-6" />
          <span className="text-xs">Add Existing</span>
        </button>
      </div>

      {/* Generate Next Clip Dialog */}
      {activeMovie.clips.length > 0 && activeMovie.clips[activeMovie.clips.length - 1].lastFrameUrl && (
        <GenerateNextClipDialog
          isOpen={showGenerateDialog}
          onClose={() => setShowGenerateDialog(false)}
          movieId={activeMovie.id}
          previousClip={activeMovie.clips[activeMovie.clips.length - 1]}
        />
      )}

      {/* Export Movie Dialog */}
      <ExportMovieDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        movie={activeMovie}
      />
    </div>
  )
}
