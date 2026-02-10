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
import { ConversationVideoGallery } from '@/components/ui/ConversationVideoGallery'
import { startGeneration, pollVideoStatus, VideoStatusResponse, createMessage } from '@/lib/api'
import { generateId } from '@/lib/utils'
import { extractBothFrames } from '@/lib/frameExtraction'
import { uploadToStorage, STORAGE_BUCKETS } from '@/lib/supabase'

export function VideoPanel() {
  const currentVideo = useAppStore((state) => state.currentVideo)
  const isGenerating = useAppStore((state) => state.isGenerating)
  const generationProgress = useAppStore((state) => state.generationProgress)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const conversations = useAppStore((state) => state.conversations)
  const addVideo = useAppStore((state) => state.addVideo)
  const updateVideo = useAppStore((state) => state.updateVideo)
  const addMessage = useAppStore((state) => state.addMessage)
  const setIsGenerating = useAppStore((state) => state.setIsGenerating)
  const setGenerationProgress = useAppStore((state) => state.setGenerationProgress)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)
  const user = useAppStore((state) => state.user)
  const movies = useAppStore((state) => state.movies)
  const multiModelGenerations = useAppStore((state) => state.multiModelGenerations)
  const setMultiModelMode = useAppStore((state) => state.setMultiModelMode)
  const activeMovieId = useAppStore((state) => state.activeMovieId)
  const setActiveMovie = useAppStore((state) => state.setActiveMovie)
  const updateMovie = useAppStore((state) => state.updateMovie)
  const setMovies = useAppStore((state) => state.setMovies)

  // Get the active conversation
  const activeConversation = conversations.find((c) => c.id === activeConversationId)

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
  const [newMovieTitle, setNewMovieTitle] = useState('')
  const [isCreatingMovie, setIsCreatingMovie] = useState(false)
  const [editingMovieTitle, setEditingMovieTitle] = useState('')
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Load existing comments when video changes
  useEffect(() => {
    if (!currentVideo) return

    const loadComments = async () => {
      try {
        console.log('[VideoPanel] Loading comments for video:', currentVideo.id)
        const response = await fetch(`/api/videos/${currentVideo.id}/comments`)
        if (response.ok) {
          const data = await response.json()
          console.log('[VideoPanel] Loaded comments:', data.comments)
          setComments(data.comments || [])
        } else {
          console.error('[VideoPanel] Failed to load comments:', response.status)
        }
      } catch (error) {
        console.error('[VideoPanel] Exception loading comments:', error)
      }
    }

    loadComments()
  }, [currentVideo?.id])

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

  // Handle regenerate - opens feedback dialog if comments exist, otherwise regenerates directly
  const handleRegenerate = async () => {
    if (!currentVideo || !activeConversationId || !user) return

    if (comments.length > 0) {
      // Open the feedback dialog so user can review and refine
      setShowRegenerateDialog(true)
    } else {
      // No feedback - just regenerate with the same prompt
      await handleRegenerateWithPrompt(currentVideo.prompt)
    }
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
        // Regenerate with refined prompt (context will be determined in handleRegenerateWithPrompt)
        await handleRegenerateWithPrompt(data.refinedPrompt)
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
      // Determine context to send based on video position in timeline AND model capabilities
      let contextType: 'characters' | 'previous_frame' | 'reference_frame' | 'none' = 'none'
      let characterIds: string[] | undefined
      let firstFrameUrl: string | undefined
      const styleReferences: Array<{ type: 'upload'; url: string; title: string }> = []

      // Model capability flags
      const supportsFirstFrame = currentVideo.model === 'veo3_1' // Only Veo 3.1 supports firstFrameGcsUri
      const supportsCharacters = true // All models support characters (Veo uses GCS URIs, others use HTTP URLs)

      console.log('[Regenerate] Model capabilities:', {
        model: currentVideo.model,
        supportsFirstFrame,
        supportsCharacters,
      })

      // Check if this video is part of a movie/timeline
      const videoInMovie = movies.find(movie =>
        movie.clips.some(clip => clip.videoId === currentVideo.id)
      )

      if (videoInMovie) {
        // Find this video's clip
        const currentClipIndex = videoInMovie.clips.findIndex(
          clip => clip.videoId === currentVideo.id
        )

        if (currentClipIndex > 0) {
          // This is a continuation video - use previous clip's last frame IF model supports it
          const previousClip = videoInMovie.clips[currentClipIndex - 1]
          if (previousClip.lastFrameUrl && supportsFirstFrame) {
            firstFrameUrl = previousClip.lastFrameUrl
            contextType = 'previous_frame'
            console.log('[Regenerate] Using previous clip last frame for timeline continuation (Veo only)')
          } else if (previousClip.lastFrameUrl && !supportsFirstFrame) {
            console.log(`[Regenerate] ⚠️ Previous frame available but ${currentVideo.model} doesn't support firstFrame - falling back to characters`)
            // Fall back to characters if model doesn't support first frame
            const characters = useAppStore.getState().characters
            if (characters.length > 0 && characters[0].embeddingStatus === 'ready' && supportsCharacters) {
              characterIds = characters.map(c => c.id)
              contextType = 'characters'
            }
          } else if (!previousClip.lastFrameUrl) {
            console.log('[Regenerate] ⚠️ No last frame available from previous clip')
            // Fall back to characters
            const characters = useAppStore.getState().characters
            if (characters.length > 0 && characters[0].embeddingStatus === 'ready' && supportsCharacters) {
              characterIds = characters.map(c => c.id)
              contextType = 'characters'
            }
          }
        } else if (currentClipIndex === 0) {
          // First video in timeline - use characters from conversation
          const characters = useAppStore.getState().characters
          if (characters.length > 0 && characters[0].embeddingStatus === 'ready' && supportsCharacters) {
            characterIds = characters.map(c => c.id)
            contextType = 'characters'
            console.log('[Regenerate] Using character references for first video in timeline')
          }
        }
      } else {
        // Not in a movie - this is a standalone video, use characters from conversation
        const characters = useAppStore.getState().characters
        if (characters.length > 0 && characters[0].embeddingStatus === 'ready' && supportsCharacters) {
          characterIds = characters.map(c => c.id)
          contextType = 'characters'
          console.log('[Regenerate] Using character references for standalone video')
        }
      }

      // If a reference frame was explicitly provided (from comment), use it as style reference
      if (referenceFrameUrl && contextType !== 'previous_frame') {
        styleReferences.push({
          type: 'upload' as const,
          url: referenceFrameUrl,
          title: 'Reference Frame',
        })
        contextType = 'reference_frame'
      }

      console.log('[Regenerate] Final context:', {
        contextType,
        characterIds: characterIds?.length || 0,
        firstFrameUrl: firstFrameUrl ? 'yes' : 'no',
        styleReferences: styleReferences.length,
      })

      // Add assistant message about regeneration
      const regeneratingMessage = {
        id: generateId(),
        role: 'assistant' as const,
        content: `Regenerating ${currentVideo.duration}s video with ${currentVideo.model} using refined feedback...`,
        timestamp: new Date(),
      }
      addMessage(activeConversationId, regeneratingMessage)
      createMessage(activeConversationId, 'assistant', regeneratingMessage.content)

      // Start generation with refined prompt and appropriate context
      const response = await startGeneration({
        prompt: refinedPrompt,
        model: currentVideo.model,
        duration: currentVideo.duration,
        conversationId: activeConversationId,
        characterIds,
        firstFrameUrl,
        styleReferences: styleReferences.length > 0 ? styleReferences : undefined,
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
      console.log('[VideoPanel] Adding comment:', comment)
      const response = await fetch(`/api/videos/${currentVideo.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comment),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[VideoPanel] Comment added successfully:', data.comment)
        setComments((prev) => {
          const updated = [...prev, data.comment]
          console.log('[VideoPanel] Updated comments state:', updated)
          return updated
        })
        // Show feedback panel when comment is added
        setShowFeedbackPanel(true)
        setShowAnnotations(true)
      } else {
        console.error('[VideoPanel] Failed to add comment:', response.status)
      }
    } catch (error) {
      console.error('[VideoPanel] Exception adding comment:', error)
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

  // Handle create new movie and add clip
  const handleCreateMovieAndAddClip = async () => {
    if (!currentVideo || !user || !newMovieTitle.trim()) {
      return
    }

    setIsCreatingMovie(true)
    try {
      // Create the movie
      const createResponse = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newMovieTitle.trim(),
          description: '',
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Failed to create movie: ${errorData.error}`)
        return
      }

      const { movie: newMovie } = await createResponse.json()
      console.log('[VideoPanel] Created new movie - Full response:', JSON.stringify(newMovie))
      console.log('[VideoPanel] Movie ID from API:', newMovie.id)
      console.log('[VideoPanel] Movie title:', newMovie.title)

      // Add the movie to local state first
      const addMovie = useAppStore.getState().addMovie
      addMovie({
        ...newMovie,
        createdAt: new Date(newMovie.createdAt),
        updatedAt: new Date(newMovie.updatedAt),
        clips: []
      })
      console.log('[VideoPanel] Added movie to local state with ID:', newMovie.id)

      // Longer delay to ensure database has committed the transaction and replicated
      await new Promise(resolve => setTimeout(resolve, 500))

      // Add clip to the new movie
      console.log('[VideoPanel] About to call handleAddToMovie with ID:', newMovie.id)
      await handleAddToMovie(newMovie.id)
      setNewMovieTitle('')
    } catch (error) {
      console.error('[VideoPanel] Exception creating movie:', error)
      alert(`Error creating movie: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCreatingMovie(false)
    }
  }

  // Get active movie
  const activeMovie = movies.find(m => m.id === activeMovieId)

  // Reload movies and initialize editing title when dialog opens
  useEffect(() => {
    if (showAddToMovieDialog) {
      // Reload movies to ensure we have fresh data
      loadMoviesFromAPI()

      if (activeMovie) {
        setEditingMovieTitle(activeMovie.title)
      }
    }
  }, [showAddToMovieDialog])

  // Load movies from API
  const loadMoviesFromAPI = async () => {
    if (!user) return

    try {
      console.log('[VideoPanel] Reloading movies from API')
      const response = await fetch(`/api/movies?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const moviesData = data.movies.map((m: any) => ({
          ...m,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
          clips: (m.clips || []).map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
          }))
        }))
        setMovies(moviesData)
        console.log('[VideoPanel] Loaded', moviesData.length, 'movies:', moviesData.map((m: any) => ({ id: m.id, title: m.title })))
      } else {
        console.error('[VideoPanel] Failed to load movies:', response.status)
        const errorData = await response.json().catch(() => ({}))
        console.error('[VideoPanel] Error details:', errorData)
      }
    } catch (error) {
      console.error('[VideoPanel] Exception loading movies:', error)
    }
  }

  // Handle updating movie title
  const handleUpdateMovieTitle = async () => {
    if (!activeMovie || !user || !editingMovieTitle.trim()) return

    try {
      const response = await fetch('/api/movies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeMovie.id,
          userId: user.id,
          title: editingMovieTitle.trim(),
        }),
      })

      if (response.ok) {
        updateMovie(activeMovie.id, { title: editingMovieTitle.trim() })
      }
    } catch (error) {
      console.error('[VideoPanel] Failed to update movie title:', error)
    }
  }

  // Handle add to movie
  const handleAddToMovie = async (movieId: string) => {
    console.log('[VideoPanel] handleAddToMovie called with movieId:', movieId)
    if (!currentVideo || !user) {
      console.error('[VideoPanel] Missing required data:', { currentVideo: !!currentVideo, user: !!user })
      return
    }

    if (!currentVideo.videoUrl) {
      console.error('[VideoPanel] Video URL not available')
      alert('Video URL not available. Please wait for generation to complete.')
      return
    }

    try {
      // Get the movie to find the next position
      const movie = movies.find(m => m.id === movieId)
      if (!movie) {
        console.error('[VideoPanel] Movie not found in local state:', movieId)
        console.error('[VideoPanel] Available movies:', movies.map(m => ({ id: m.id, title: m.title })))
        alert(`Movie not found. This may be due to stale data. Please refresh the page and try again.`)
        return
      }
      console.log('[VideoPanel] Movie found:', movie.title, 'ID:', movie.id)

      const nextPosition = movie.clips?.length || 0
      console.log('[VideoPanel] Adding video to movie:', { movieId, videoId: currentVideo.id, position: nextPosition })

      // Extract first and last frames
      console.log('[VideoPanel] Extracting frames from video...')
      let firstFrameUrl: string | null = null
      let lastFrameUrl: string | null = null

      try {
        const { firstFrame, lastFrame } = await extractBothFrames(currentVideo.videoUrl)

        // Upload frames to storage
        const frameBasePath = `${user.id}/frames/${generateId()}`
        const [firstUrl, lastUrl] = await Promise.all([
          uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_first.jpg`, firstFrame),
          uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_last.jpg`, lastFrame),
        ])

        firstFrameUrl = firstUrl
        lastFrameUrl = lastUrl
        console.log('[VideoPanel] Frames extracted and uploaded')
      } catch (frameError) {
        console.warn('[VideoPanel] Failed to extract frames, continuing without them:', frameError)
        // Continue without frames - not critical
      }

      // Add clip to movie with retry logic for newly created movies
      let response: Response | null = null
      let retries = 0
      const maxRetries = 5
      const retryDelays = [500, 1000, 2000, 3000, 5000] // Longer delays for database replication

      while (retries <= maxRetries) {
        console.log(`[VideoPanel] Attempting to add clip (attempt ${retries + 1}/${maxRetries + 1})...`)
        response = await fetch(`/api/movies/${movieId}/clips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: currentVideo.id,
            position: nextPosition,
            firstFrameUrl,
            lastFrameUrl,
          }),
        })

        console.log(`[VideoPanel] Response status: ${response.status}`)

        if (response.ok) {
          console.log('[VideoPanel] Clip added successfully on attempt', retries + 1)
          break // Success!
        }

        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.log('[VideoPanel] Error response:', errorData)

        // Check if it's a "movie not found" error (foreign key constraint)
        if (errorData.error?.includes('movie_clips_movie_id_fkey') ||
            errorData.error?.includes('Movie not found') ||
            errorData.error?.includes('Database error')) {

          if (retries < maxRetries) {
            const delay = retryDelays[retries]
            console.log(`[VideoPanel] Retryable error detected, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries})...`)
            console.log('[VideoPanel] Error was:', errorData.error)
            await new Promise(resolve => setTimeout(resolve, delay))
            retries++
            continue
          } else {
            console.error('[VideoPanel] Max retries exceeded, giving up')
          }
        }

        // Non-retryable error or max retries exceeded
        console.error('[VideoPanel] Failed to add clip after', retries + 1, 'attempts:', errorData)
        alert(`Failed to add clip to movie: ${errorData.error}`)
        return
      }

      console.log('[VideoPanel] Clip added successfully')

      // Reload movies to get updated data with the new clip
      const moviesResponse = await fetch(`/api/movies?userId=${user.id}`)
      if (moviesResponse.ok) {
        const data = await moviesResponse.json()
        const reloadedMovies = data.movies.map((m: any) => ({
          ...m,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
          clips: (m.clips || []).map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
          }))
        }))
        useAppStore.getState().setMovies(reloadedMovies)
        console.log('[VideoPanel] Movies reloaded, setting active movie to:', movieId)

        // Set this movie as active so timeline shows
        setActiveMovie(movieId)
      }

      setShowAddToMovieDialog(false)
    } catch (error) {
      console.error('[VideoPanel] Exception adding to movie:', error)
      alert(`Error adding clip to movie: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <>
      <main className="flex-1 min-w-[600px] flex bg-background border-r border-border">
        {/* Video Viewport */}
        <div className="flex-1 flex flex-col">
          {/* Conversation Video Gallery */}
          {activeConversation && activeConversation.videos.length > 0 && (
            <ConversationVideoGallery
              videos={activeConversation.videos}
              currentVideoId={currentVideo?.id || null}
              onVideoSelect={(video) => setCurrentVideo(video)}
            />
          )}

          <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
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

              {/* Back to Comparison Button */}
              {multiModelGenerations.length > 0 && (
                <div className="absolute top-4 left-4 z-20">
                  <button
                    onClick={() => setMultiModelMode(true)}
                    className="flex items-center gap-2 text-foreground text-sm bg-background/80 hover:bg-background px-3 py-1.5 rounded-lg border border-border transition-colors"
                  >
                    <Film className="w-4 h-4" />
                    <span>Back to Comparison</span>
                  </button>
                </div>
              )}

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

              {/* Annotation Overlay - Always show comments, but only allow editing when active */}
              <VideoAnnotationOverlay
                videoId={currentVideo.id}
                videoRef={videoRef}
                comments={comments}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                currentTime={currentTime}
                isPlaying={isPlaying}
                onPause={pauseVideo}
                isActive={showAnnotations}
              />

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
                  title="Add to movie"
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
                    // Always show feedback panel if there are comments
                    setShowFeedbackPanel(newState || comments.length > 0)
                  }}
                  className={`btn-secondary flex items-center gap-2 ${showAnnotations ? 'bg-accent/20 border-accent' : ''}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  {showAnnotations ? 'Stop Annotating' : 'Add Feedback'}
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
            <div className="flex items-center justify-between mb-6">
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

            {/* Active Movie - Quick Add */}
            {activeMovie && (
              <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-xs text-foreground-secondary mb-3">Current Movie</p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={editingMovieTitle}
                    onChange={(e) => setEditingMovieTitle(e.target.value)}
                    onBlur={handleUpdateMovieTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateMovieTitle()
                        e.currentTarget.blur()
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#3a3a3a] rounded-lg text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="text-xs text-foreground-secondary mb-3">
                  {activeMovie.clips?.length || 0} clip{(activeMovie.clips?.length || 0) !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={() => handleAddToMovie(activeMovie.id)}
                  className="w-full px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-medium text-sm rounded-lg transition-colors"
                >
                  Add to "{editingMovieTitle}"
                </button>
              </div>
            )}

            {/* Create New Movie Section */}
            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-2">
                {activeMovie ? 'Or Create New Movie' : 'Create New Movie'}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Movie title..."
                  value={newMovieTitle}
                  onChange={(e) => setNewMovieTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateMovieAndAddClip()}
                  className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#3a3a3a] rounded-lg text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleCreateMovieAndAddClip}
                  disabled={!newMovieTitle.trim() || isCreatingMovie}
                  className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:bg-accent/50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                >
                  {isCreatingMovie ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>

            {/* Other Movies Section */}
            {movies.filter(m => m.id !== activeMovieId).length > 0 && (
              <>
                <p className="text-sm font-medium text-foreground mb-2">Or Add to Different Movie</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {movies.filter(m => m.id !== activeMovieId).map((movie) => (
                    <button
                      key={movie.id}
                      onClick={() => handleAddToMovie(movie.id)}
                      className="w-full p-3 text-left border border-[#3a3a3a] hover:bg-[#2a2a2a] rounded-lg transition-colors"
                    >
                      <div className="font-medium text-foreground">{movie.title}</div>
                      <div className="text-xs text-foreground-secondary mt-1">
                        {movie.clips?.length || 0} clip{(movie.clips?.length || 0) !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
