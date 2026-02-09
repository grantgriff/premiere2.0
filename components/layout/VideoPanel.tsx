'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Play,
  Pause,
  Download,
  RefreshCw,
  Maximize2,
  Volume2,
  VolumeX,
  Loader2,
  Shield,
  Youtube,
  Share2,
  MessageSquare,
  Film,
  X,
} from 'lucide-react'
import { useAppStore, Video } from '@/lib/store'
import { QualityBadge } from '@/components/ui/QualityBadge'
import { QualityReport } from '@/lib/models/types'
import { YouTubeUploadPanel } from '@/components/ui/YouTubeUploadPanel'
import { VideoAnnotationOverlay, VideoComment } from '@/components/ui/VideoAnnotationOverlay'
import { RegenerateWithFeedbackDialog } from '@/components/ui/RegenerateWithFeedbackDialog'
import { FeedbackPanel } from '@/components/ui/FeedbackPanel'
import { startGeneration, pollVideoStatus, VideoStatusResponse, createMessage } from '@/lib/api'
import { generateId } from '@/lib/utils'

export function VideoPanel() {
  const currentVideo = useAppStore((state) => state.currentVideo)
  const isGenerating = useAppStore((state) => state.isGenerating)
  const generationProgress = useAppStore((state) => state.generationProgress)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const addVideo = useAppStore((state) => state.addVideo)
  const updateVideo = useAppStore((state) => state.updateVideo)
  const addMessage = useAppStore((state) => state.addMessage)
  const setIsGenerating = useAppStore((state) => state.setIsGenerating)
  const setGenerationProgress = useAppStore((state) => state.setGenerationProgress)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)
  const user = useAppStore((state) => state.user)
  const movies = useAppStore((state) => state.movies)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [showYouTubeUpload, setShowYouTubeUpload] = useState(false)
  const [comments, setComments] = useState<VideoComment[]>([])
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [showAddToMovieDialog, setShowAddToMovieDialog] = useState(false)
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)

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

  // Handle regenerate - simple version without feedback
  const handleRegenerate = async () => {
    if (!currentVideo || !activeConversationId || !user) return

    // Just regenerate with the same prompt
    await handleRegenerateWithPrompt(currentVideo.prompt)
  }

  // Handle click on feedback comment to seek to timestamp
  const handleCommentClick = (timestamp: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = timestamp
    setCurrentTime(timestamp)
  }

  // Handle regenerate from feedback panel
  const handleRegenerateFromPanel = async () => {
    if (!currentVideo || comments.length === 0) return

    setIsRefining(true)
    try {
      // Call Gemini to refine prompt
      const response = await fetch(`/api/videos/${currentVideo.id}/refine-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: currentVideo.prompt,
          comments: comments.map((c) => ({
            timestamp: c.timestamp,
            text: c.text,
            boundingBox: c.boundingBox,
          })),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Get first frame if available
        const firstFrameUrl = comments.length > 0 ? comments[0].frameUrl : undefined
        // Regenerate with refined prompt
        await handleRegenerateWithPrompt(data.refinedPrompt, firstFrameUrl)
      }
    } catch (error) {
      console.error('Failed to refine prompt:', error)
    } finally {
      setIsRefining(false)
    }
  }

  // Handle regenerate with refined prompt
  const handleRegenerateWithPrompt = async (refinedPrompt: string, referenceFrameUrl?: string) => {
    if (!currentVideo || !activeConversationId || !user) {
      console.error('Missing required data for regeneration')
      return
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      // Build style references from reference frame if provided
      const styleReferences = referenceFrameUrl
        ? [
            {
              type: 'upload' as const,
              url: referenceFrameUrl,
              title: 'Reference Frame',
            },
          ]
        : []

      // Add assistant message about regeneration
      const regeneratingMessage = {
        id: generateId(),
        role: 'assistant' as const,
        content: `Regenerating ${currentVideo.duration}s video with ${currentVideo.model} using refined feedback...`,
        timestamp: new Date(),
      }
      addMessage(activeConversationId, regeneratingMessage)
      createMessage(activeConversationId, 'assistant', regeneratingMessage.content)

      // Start generation with refined prompt
      const response = await startGeneration({
        prompt: refinedPrompt,
        model: currentVideo.model,
        duration: currentVideo.duration,
        conversationId: activeConversationId,
        styleReferences,
      })

      if (!response.success || !response.videoId) {
        throw new Error(response.error || 'Failed to start regeneration')
      }

      // Create video entry
      const newVideo = {
        id: response.videoId,
        prompt: refinedPrompt,
        model: currentVideo.model,
        duration: currentVideo.duration,
        status: 'pending' as const,
        videoUrl: null,
        thumbnailUrl: null,
        qualityScore: null,
        qualityReport: null,
        isVerifying: false,
        createdAt: new Date(),
        completedAt: null,
      }
      addVideo(activeConversationId, newVideo)

      // Poll for completion
      pollVideoStatus(response.videoId, (status: VideoStatusResponse) => {
        // Update progress
        if (status.status === 'processing') {
          const currentProgress = useAppStore.getState().generationProgress
          setGenerationProgress(Math.min(currentProgress + 10, 90))
        }

        // Update video in store
        updateVideo(activeConversationId, response.videoId!, {
          status: status.status,
          videoUrl: status.videoUrl,
          thumbnailUrl: status.thumbnailUrl,
          qualityScore: status.qualityScore,
          completedAt: status.completedAt ? new Date(status.completedAt) : null,
        })

        // Handle completion
        if (status.status === 'completed' && status.videoUrl) {
          setGenerationProgress(100)
          setIsGenerating(false)

          // Set as current video
          const completedVideo = {
            id: response.videoId!,
            prompt: refinedPrompt,
            model: currentVideo.model,
            duration: currentVideo.duration,
            status: 'completed' as const,
            videoUrl: status.videoUrl,
            thumbnailUrl: status.thumbnailUrl,
            qualityScore: status.qualityScore,
            qualityReport: null,
            isVerifying: false,
            createdAt: new Date(),
            completedAt: status.completedAt ? new Date(status.completedAt) : null,
          }
          setCurrentVideo(completedVideo)

          // Add completion message
          const completionMsg = `✓ Regeneration complete with refined feedback!`
          addMessage(activeConversationId, {
            id: generateId(),
            role: 'assistant' as const,
            content: completionMsg,
            timestamp: new Date(),
          })
          createMessage(activeConversationId, 'assistant', completionMsg)
        }

        // Handle failure
        if (status.status === 'failed') {
          setIsGenerating(false)
          const errorMsg = `✗ Regeneration failed: ${status.error || 'Unknown error'}`
          addMessage(activeConversationId, {
            id: generateId(),
            role: 'assistant' as const,
            content: errorMsg,
            timestamp: new Date(),
          })
          createMessage(activeConversationId, 'assistant', errorMsg)
        }
      })
    } catch (error) {
      setIsGenerating(false)
      console.error('Failed to regenerate video:', error)
      const errorMsg = `✗ Failed to start regeneration: ${error instanceof Error ? error.message : 'Unknown error'}`
      addMessage(activeConversationId, {
        id: generateId(),
        role: 'assistant' as const,
        content: errorMsg,
        timestamp: new Date(),
      })
      createMessage(activeConversationId, 'assistant', errorMsg)
    }
  }

  // Load comments when video changes
  useEffect(() => {
    if (!currentVideo?.id) {
      setComments([])
      return
    }

    // Fetch comments for this video
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/videos/${currentVideo.id}/comments`)
        if (response.ok) {
          const data = await response.json()
          setComments(data.comments || [])
        }
      } catch (error) {
        console.error('Failed to load comments:', error)
      }
    }

    fetchComments()
  }, [currentVideo?.id])

  // Add comment
  const handleAddComment = async (comment: Omit<VideoComment, 'id' | 'createdAt'>) => {
    if (!currentVideo) return

    try {
      const response = await fetch(`/api/videos/${currentVideo.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comment),
      })

      if (response.ok) {
        const data = await response.json()
        setComments((prev) => [...prev, data.comment])
        // Show feedback panel when first comment is added
        if (comments.length === 0) {
          setShowFeedbackPanel(true)
        }
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!currentVideo) return

    try {
      const response = await fetch(`/api/videos/${currentVideo.id}/comments/${commentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId))
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  // Pause video
  const pauseVideo = () => {
    if (videoRef.current && isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

  // Handle fullscreen
  const handleFullscreen = () => {
    if (!videoContainerRef.current) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoContainerRef.current.requestFullscreen()
    }
  }

  // Handle add to movie
  const handleAddToMovie = async (movieId: string) => {
    if (!currentVideo || !user) return

    try {
      // Get the movie to find the next position
      const movie = movies.find(m => m.id === movieId)
      if (!movie) return

      const nextPosition = movie.clips?.length || 0

      // Add clip to movie
      const response = await fetch(`/api/movies/${movieId}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: currentVideo.id,
          position: nextPosition,
        }),
      })

      if (response.ok) {
        // Reload movies to get updated data
        const moviesResponse = await fetch(`/api/movies?userId=${user.id}`)
        if (moviesResponse.ok) {
          const data = await moviesResponse.json()
          useAppStore.getState().setMovies(data.movies)
        }

        setShowAddToMovieDialog(false)
      }
    } catch (error) {
      console.error('Failed to add to movie:', error)
    }
  }

  return (
    <>
    <main className="flex-1 min-w-[600px] flex bg-background border-r border-border">
      {/* Video Viewport */}
      <div className="flex-1 flex flex-col">
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
            <div ref={videoContainerRef} className="video-container relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={currentVideo.videoUrl}
                className="w-full h-full object-contain"
                poster={currentVideo.thumbnailUrl || undefined}
                playsInline
              />

              {/* Quality Badge */}
              <div className="absolute top-4 right-4 z-20">
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

              {/* Annotation Overlay */}
              {showAnnotations && (
                <VideoAnnotationOverlay
                  videoId={currentVideo.id}
                  videoRef={videoRef}
                  comments={comments}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onPause={pauseVideo}
                />
              )}

              {/* Play/Pause Overlay */}
              {!showAnnotations && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                >
                  {isPlaying ? (
                    <Pause className="w-16 h-16 text-white" />
                  ) : (
                    <Play className="w-16 h-16 text-white" />
                  )}
                </button>
              )}
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
                  <button onClick={handleFullscreen} className="btn-ghost p-2" title="Fullscreen">
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
                  onClick={() => setShowAddToMovieDialog(true)}
                  className="btn-secondary flex items-center gap-2"
                  disabled={movies.length === 0}
                  title={movies.length === 0 ? 'Create a movie first' : 'Add to movie'}
                >
                  <Film className="w-4 h-4" />
                  Add to Movie
                </button>
                <button
                  onClick={handleDownload}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handleRegenerate}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {comments.length > 0 ? 'Regenerate with Feedback' : 'Regenerate'}
                  {comments.length > 0 && (
                    <span className="ml-1 text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">
                      {comments.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    const newState = !showAnnotations
                    setShowAnnotations(newState)
                    setShowFeedbackPanel(newState)
                  }}
                  className={`btn-secondary flex items-center gap-2 ${showAnnotations ? 'bg-accent/20 border-accent' : ''}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  {showAnnotations ? 'Close Feedback' : 'Feedback'}
                  {comments.length > 0 && (
                    <span className="ml-1 text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">
                      {comments.length}
                    </span>
                  )}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowYouTubeUpload(true)}
                  className="btn-primary flex items-center gap-2 bg-red-500 hover:bg-red-600"
                >
                  <Youtube className="w-4 h-4" />
                  Upload to YouTube
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

      {/* Feedback Panel - Shows when feedback mode is active */}
      {showFeedbackPanel && currentVideo && (
        <FeedbackPanel
          comments={comments}
          onCommentClick={handleCommentClick}
          onDeleteComment={handleDeleteComment}
          onRegenerateWithFeedback={handleRegenerateFromPanel}
          isRefining={isRefining}
        />
      )}
    </main>

      {/* YouTube Upload Panel */}
      <YouTubeUploadPanel
        isOpen={showYouTubeUpload}
        onClose={() => setShowYouTubeUpload(false)}
        video={currentVideo}
      />

      {/* Regenerate with Feedback Dialog */}
      {currentVideo && (
        <RegenerateWithFeedbackDialog
          isOpen={showRegenerateDialog}
          onClose={() => setShowRegenerateDialog(false)}
          video={currentVideo}
          comments={comments}
          onRegenerate={handleRegenerateWithPrompt}
        />
      )}

      {/* Add to Movie Dialog */}
      {showAddToMovieDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Film className="w-5 h-5" />
                Add to Movie
              </h2>
              <button
                onClick={() => setShowAddToMovieDialog(false)}
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-foreground-secondary" />
              </button>
            </div>

            <p className="text-sm text-foreground-secondary mb-4">
              Select a movie to add this clip to:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {movies.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => handleAddToMovie(movie.id)}
                  className="w-full p-3 text-left border border-[#3a3a3a] hover:bg-[#2a2a2a] rounded-lg transition-colors"
                >
                  <div className="font-medium text-foreground">{movie.title}</div>
                  <div className="text-xs text-foreground-secondary mt-1">
                    {movie.clips?.length || 0} clips
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
