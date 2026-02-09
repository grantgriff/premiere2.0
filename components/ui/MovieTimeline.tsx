'use client'

import { useState, useEffect } from 'react'
import { useAppStore, useActiveMovie } from '@/lib/store'
import { Plus, Play, X, Sparkles, Download, Pause, GripVertical, Film } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { GenerateNextClipDialog } from './GenerateNextClipDialog'
import { ExportMovieDialog } from './ExportMovieDialog'

export function MovieTimeline() {
  const { user } = useAuth()
  const activeMovie = useActiveMovie()
  const removeClipFromMovie = useAppStore((state) => state.removeClipFromMovie)
  const updateMovie = useAppStore((state) => state.updateMovie)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [playingClipId, setPlayingClipId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')
  const [showAddExistingDialog, setShowAddExistingDialog] = useState(false)
  const [availableVideos, setAvailableVideos] = useState<any[]>([])
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const conversations = useAppStore((state) => state.conversations)
  const addClipToMovie = useAppStore((state) => state.addClipToMovie)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)

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

  const handleClickClip = (clip: NonNullable<typeof activeMovie>['clips'][0], index: number) => {
    // Set this video as the current video in the main player
    if (clip.video) {
      // Convert partial video data to full Video type
      const fullVideo = {
        ...clip.video,
        status: 'completed' as const,
        qualityScore: null,
        qualityReport: null,
        isVerifying: false,
        createdAt: new Date(),
        completedAt: new Date(),
      }
      setCurrentVideo(fullVideo)

      // TODO: Implement playlist mode to play clips sequentially from this point
      // For now, just load the selected clip
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

  // Load available videos when add existing dialog opens
  useEffect(() => {
    if (showAddExistingDialog) {
      const videos = conversations.flatMap((conv) =>
        conv.videos.filter((v) => v.status === 'completed' && v.videoUrl)
      )
      setAvailableVideos(videos)
    }
  }, [showAddExistingDialog, conversations])

  const handleAddExistingVideo = async (video: any) => {
    if (!activeMovie || !user?.id) return

    const newClip = {
      id: crypto.randomUUID(),
      videoId: video.id,
      position: activeMovie.clips.length,
      firstFrameUrl: null,
      lastFrameUrl: null,
      createdAt: new Date(),
      video: {
        id: video.id,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        prompt: video.prompt,
        model: video.model,
      },
    }

    // Add to local store
    addClipToMovie(activeMovie.id, newClip)

    // Add to API
    try {
      await fetch(`/api/movies/${activeMovie.id}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          position: activeMovie.clips.length,
        }),
      })
    } catch (error) {
      console.error('[MovieTimeline] Failed to add clip:', error)
    }

    setShowAddExistingDialog(false)
  }
  if (!activeMovie) {
    return null
  }

  return (
    <div className="h-40 border-t border-border bg-background-secondary flex items-center px-4 gap-4">
      {/* Timeline header */}
      <div className="flex flex-col items-center justify-center px-4 border-r border-border h-full min-w-[140px]">
        <div className="text-sm font-medium text-foreground mb-1">
          {activeMovie.title}
        </div>
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
              onClick={() => handleClickClip(clip, index)}
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
                  onClick={() => togglePlayClip(clip.id)}
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
                onClick={() => handleRemoveClip(clip.id)}
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
        <button
          onClick={() => setShowAddExistingDialog(true)}
          className="flex-shrink-0 w-40 h-24 rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center gap-2 text-foreground-secondary hover:text-accent transition-colors"
        >
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

      {/* Add Existing Video Dialog */}
      {showAddExistingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Film className="w-5 h-5" />
                Add Existing Video
              </h2>
              <button
                onClick={() => setShowAddExistingDialog(false)}
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-foreground-secondary" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {availableVideos.length === 0 ? (
                <div className="text-center py-8 text-foreground-secondary">
                  No videos available. Generate some videos first!
                </div>
              ) : (
                availableVideos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => handleAddExistingVideo(video)}
                    className="w-full flex items-center gap-4 p-4 bg-[#0a0a0a] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-accent rounded-lg transition-all text-left group"
                  >
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt="Video thumbnail"
                        className="w-32 h-20 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-32 h-20 bg-gradient-to-br from-accent/10 to-purple-500/10 rounded-lg flex items-center justify-center">
                        <Play className="w-8 h-8 text-accent/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium mb-1 line-clamp-2">
                        {video.prompt}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-foreground-secondary">
                        <span>{video.duration}s</span>
                        <span>•</span>
                        <span className="capitalize">{video.model}</span>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-accent flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
