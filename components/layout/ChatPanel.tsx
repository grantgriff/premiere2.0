'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Image as ImageIcon,
  Video,
  Youtube,
  AtSign,
  Loader2,
  X,
  User,
} from 'lucide-react'
import { useAppStore, useActiveConversation, VideoModel } from '@/lib/store'
import { startGeneration, pollVideoStatus, verifyVideoQuality, VideoStatusResponse, StyleReference, createConversation as createConversationApi, createMessage as createMessageApi } from '@/lib/api'
import { generateId } from '@/lib/utils'
import { QualityReport, MODEL_INFO, VideoModelId } from '@/lib/models/types'
import { CharacterMention, extractCharacterMentions } from '@/components/ui/CharacterMention'
import { CharacterManager } from '@/components/ui/CharacterManager'
import { YouTubeSearchPanel, YouTubeVideo } from '@/components/ui/YouTubeSearchPanel'
import { uploadToStorage, STORAGE_BUCKETS } from '@/lib/supabase'
import { startMultiModelGeneration } from '@/lib/multiModelGeneration'
import { AgenticTrace, TraceStep } from '@/components/ui/AgenticTrace'

interface UploadedFile {
  id: string
  type: 'image' | 'video'
  file: File
  previewUrl: string
}

const MODELS: { id: VideoModel; name: string; speed: string; disabled?: boolean }[] = [
  { id: 'luma', name: 'Luma AI', speed: '5-10s' },
  { id: 'veo3_1', name: 'Veo 3.1', speed: '45-60s' },
  { id: 'runway', name: 'Runway', speed: '30-45s' },
  { id: 'sora', name: 'Sora', speed: '30-60s' },
  { id: 'odyssey', name: 'Odyssey', speed: '20-40s', disabled: true },
  { id: 'world_labs', name: 'World Labs', speed: '30-45s', disabled: true },
]

// Get allowed durations for the selected model
function getModelDurations(modelId: VideoModel): number[] {
  return MODEL_INFO[modelId as VideoModelId]?.allowedDurations || [5, 10]
}

// Get supported input types for the selected model
function getModelSupportedInputs(modelId: VideoModel): ('text' | 'image' | 'video')[] {
  return MODEL_INFO[modelId as VideoModelId]?.supportedInputs || ['text']
}

// Check if model supports a specific input type
function modelSupportsInput(modelId: VideoModel, inputType: 'text' | 'image' | 'video'): boolean {
  return getModelSupportedInputs(modelId).includes(inputType)
}

export function ChatPanel() {
  const [input, setInput] = useState('')
  const [showCharacterManager, setShowCharacterManager] = useState(false)
  const [showYouTubeSearch, setShowYouTubeSearch] = useState(false)
  const [selectedYouTubeVideos, setSelectedYouTubeVideos] = useState<YouTubeVideo[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [videoUsage, setVideoUsage] = useState<{ remaining: number | null; maxVideos: number | null; isAdmin: boolean } | null>(null)
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([])
  const [currentPrompt, setCurrentPrompt] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null) as React.RefObject<HTMLTextAreaElement>
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Global state
  const user = useAppStore((state) => state.user)
  const characters = useAppStore((state) => state.characters)
  const selectedCharacterIds = useAppStore((state) => state.selectedCharacterIds)
  const toggleCharacterSelection = useAppStore((state) => state.toggleCharacterSelection)
  const selectedModel = useAppStore((state) => state.selectedModel)
  const setSelectedModel = useAppStore((state) => state.setSelectedModel)
  const selectedModels = useAppStore((state) => state.selectedModels)
  const toggleModelSelection = useAppStore((state) => state.toggleModelSelection)
  const multiModelMode = useAppStore((state) => state.multiModelMode)
  const setMultiModelMode = useAppStore((state) => state.setMultiModelMode)
  const setMultiModelGenerations = useAppStore((state) => state.setMultiModelGenerations)
  const selectedDuration = useAppStore((state) => state.selectedDuration)
  const setSelectedDuration = useAppStore((state) => state.setSelectedDuration)
  const isGenerating = useAppStore((state) => state.isGenerating)
  const setIsGenerating = useAppStore((state) => state.setIsGenerating)
  const generationProgress = useAppStore((state) => state.generationProgress)
  const setGenerationProgress = useAppStore((state) => state.setGenerationProgress)

  // Conversation state
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const addConversation = useAppStore((state) => state.addConversation)
  const addMessage = useAppStore((state) => state.addMessage)
  const addVideo = useAppStore((state) => state.addVideo)
  const updateVideo = useAppStore((state) => state.updateVideo)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)
  const setUser = useAppStore((state) => state.setUser)

  const activeConversation = useActiveConversation()
  const movies = useAppStore((state) => state.movies)
  const activeMovieId = useAppStore((state) => state.activeMovieId)

  // Fetch video usage quota
  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage')
      if (res.ok) {
        const data = await res.json()
        setVideoUsage({ remaining: data.remaining, maxVideos: data.maxVideos, isAdmin: data.isAdmin })
      }
    } catch {
      // Silently fail — usage display is non-critical
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  // Refresh usage after generation completes
  useEffect(() => {
    if (!isGenerating) {
      fetchUsage()
    }
  }, [isGenerating, fetchUsage])

  // Initialize selectedModels with all enabled models if empty
  useEffect(() => {
    if (selectedModels.length === 0) {
      // Select all enabled models by default
      const enabledModels = MODELS.filter(m => !m.disabled).map(m => m.id)
      enabledModels.forEach(model => toggleModelSelection(model))

      // Set multi-model mode since we're selecting multiple models
      setMultiModelMode(true)
    }
  }, [])

  // Listen for welcome prompt submissions from the centered prompt bar
  useEffect(() => {
    const handleWelcomeSubmit = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const prompt = detail?.prompt
      if (prompt) {
        setInput(prompt)
        // If files were uploaded from the welcome bar, add them
        if (detail.uploadedFiles?.length > 0) {
          const files: UploadedFile[] = detail.uploadedFiles.map((f: { type: 'image' | 'video'; file: File; previewUrl: string }) => ({
            id: generateId(),
            type: f.type,
            file: f.file,
            previewUrl: f.previewUrl,
          }))
          setUploadedFiles(files)
        }
        // Trigger submission on next tick after input is set
        setTimeout(() => {
          const form = document.querySelector('form[data-chatpanel-form]') as HTMLFormElement
          if (form) {
            form.requestSubmit()
          }
        }, 50)
      }
    }
    window.addEventListener('welcome-prompt-submit', handleWelcomeSubmit)
    return () => window.removeEventListener('welcome-prompt-submit', handleWelcomeSubmit)
  }, [])

  // Scroll to bottom when messages or trace steps change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages, traceSteps])

  // Auto-select valid duration when model changes
  useEffect(() => {
    const allowedDurations = getModelDurations(selectedModel)
    if (!allowedDurations.includes(selectedDuration)) {
      // Select the first allowed duration for this model
      setSelectedDuration(allowedDurations[0])
    }
  }, [selectedModel, selectedDuration, setSelectedDuration])

  // Clear invalid uploads when model changes
  useEffect(() => {
    const supportsImage = modelSupportsInput(selectedModel, 'image')
    const supportsVideo = modelSupportsInput(selectedModel, 'video')

    // Remove uploaded files that don't match model's supported inputs
    setUploadedFiles(prev => {
      const filtered = prev.filter(file => {
        if (file.type === 'image' && !supportsImage) {
          URL.revokeObjectURL(file.previewUrl)
          return false
        }
        if (file.type === 'video' && !supportsVideo) {
          URL.revokeObjectURL(file.previewUrl)
          return false
        }
        return true
      })
      return filtered
    })

    // Clear YouTube videos if model doesn't support video or image references
    if (!supportsVideo && !supportsImage) {
      setSelectedYouTubeVideos([])
    }
  }, [selectedModel])

  // Clear trace when user manually switches conversations (not during generation)
  const prevConvIdRef = useRef<string | null>(null)
  useEffect(() => {
    // Only clear if we're NOT generating (to avoid clearing during new conv creation)
    if (!isGenerating && activeConversationId !== prevConvIdRef.current) {
      setTraceSteps([])
      setCurrentPrompt('')
    }
    prevConvIdRef.current = activeConversationId
  }, [activeConversationId, isGenerating])

  // Helper to update a single trace step by id
  const updateStep = (stepId: string, updates: Partial<TraceStep>) => {
    setTraceSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating || !user) return

    const prompt = input.trim()
    setInput('')
    setCurrentPrompt(prompt)
    setIsGenerating(true)
    setGenerationProgress(0)

    // Check for scene continuity (last frame from active movie)
    const modelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel
    const trackedName = multiModelMode
      ? MODELS.find(m => m.id === selectedModels[0])?.name || selectedModels[0]
      : modelName
    const hasChars = selectedCharacterIds.length > 0
    let hasMovieContinuity = false
    if (activeMovieId) {
      const activeMovie = movies.find(m => m.id === activeMovieId)
      if (activeMovie && activeMovie.clips.length > 0) {
        const lastClip = activeMovie.clips.sort((a, b) => a.position - b.position)[activeMovie.clips.length - 1]
        hasMovieContinuity = !!lastClip?.lastFrameUrl
      }
    }

    // Initialize trace steps
    const initialSteps: TraceStep[] = [
      { id: 'enhance', label: 'Enhancing prompt', detail: 'Rewriting for optimal video generation...', icon: 'enhance', status: 'active' },
      ...(hasChars ? [{ id: 'characters', label: 'Resolving characters', detail: `Preparing ${selectedCharacterIds.length} character reference(s)`, icon: 'characters' as const, status: 'pending' as const }] : []),
      ...(hasMovieContinuity ? [{ id: 'continuity', label: 'Scene continuity', detail: 'Using last frame from previous scene', icon: 'continuity' as const, status: 'pending' as const }] : []),
      { id: 'submit', label: `Submitting to ${multiModelMode ? `${selectedModels.length} models` : trackedName}`, icon: 'submit', status: 'pending' },
      { id: 'generate', label: 'Generating video', detail: multiModelMode ? `Following ${trackedName} · ${selectedDuration}s clip` : `${selectedDuration}s clip`, icon: 'generate', status: 'pending' },
      { id: 'quality', label: 'Quality verification', icon: 'quality', status: 'pending' },
    ]
    setTraceSteps(initialSteps)

    // Create or get conversation
    let convId = activeConversationId
    if (!convId) {
      const title = prompt.slice(0, 40) + (prompt.length > 40 ? '...' : '')
      const dbConversation = await createConversationApi(title)
      const newConv = {
        id: dbConversation?.id || generateId(),
        title,
        messages: [],
        videos: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      addConversation(newConv)
      convId = newConv.id
    }

    // Add user message
    addMessage(convId, { id: generateId(), role: 'user' as const, content: prompt, timestamp: new Date() })
    createMessageApi(convId, 'user', prompt)

    try {
      // Upload files to storage first
      const uploadedUrls: StyleReference[] = []
      for (const uploadedFile of uploadedFiles) {
        const bucket = uploadedFile.type === 'image' ? STORAGE_BUCKETS.IMAGES : STORAGE_BUCKETS.VIDEOS
        const path = `${user.id}/${generateId()}_${uploadedFile.file.name}`
        const url = await uploadToStorage(bucket, path, uploadedFile.file)
        if (url) {
          uploadedUrls.push({ type: 'upload', url, title: uploadedFile.file.name })
        }
      }

      const styleReferences: StyleReference[] = [
        ...selectedYouTubeVideos.map(v => ({ type: 'youtube' as const, url: v.url, videoId: v.id, title: v.title })),
        ...uploadedUrls,
      ]

      // Enhance prompt with character names when characters are selected
      let enhancedPrompt = prompt
      if (hasChars) {
        const selectedCharacters = characters.filter(c => selectedCharacterIds.includes(c.id))
        const characterNames = selectedCharacters.map(c => c.name).join(' and ')
        enhancedPrompt = `A cinematic shot of ${characterNames} ${prompt}. ${characterNames} is the main subject and central focus of this video. Match the exact appearance, facial features, hair, clothing, and style from the reference image provided. Keep ${characterNames}'s face clearly visible and recognizable throughout the video.`
      }

      // Resolve scene continuity — if active movie has clips, use last frame as first frame
      let continuityFrameUrl: string | undefined
      if (activeMovieId) {
        const activeMovie = movies.find(m => m.id === activeMovieId)
        if (activeMovie && activeMovie.clips.length > 0) {
          const lastClip = activeMovie.clips.sort((a, b) => a.position - b.position)[activeMovie.clips.length - 1]
          if (lastClip?.lastFrameUrl) {
            continuityFrameUrl = lastClip.lastFrameUrl
            updateStep('continuity', { status: 'completed', detail: `Linked to scene ${lastClip.position + 1} last frame`, timestamp: new Date() })
          }
        }
      }

      // Multi-model generation — trace follows the first selected model
      if (multiModelMode) {
        if (selectedModels.length < 2 || selectedModels.length > 4) {
          setIsGenerating(false)
          setTraceSteps(prev => prev.map(s => ({ ...s, status: 'failed' as const })))
          return
        }

        const trackedModel = selectedModels[0]
        const trackedModelName = MODELS.find(m => m.id === trackedModel)?.name || trackedModel
        let submitMarkedComplete = false

        updateStep('enhance', { status: 'completed', detail: `Prompt optimized for ${selectedModels.length} models`, timestamp: new Date() })
        if (hasChars) updateStep('characters', { status: 'completed', detail: 'Character images prepared', timestamp: new Date() })
        updateStep('submit', { status: 'active', detail: `Sending to ${selectedModels.length} models simultaneously...` })

        const states = await startMultiModelGeneration(
          selectedModels, enhancedPrompt, selectedDuration, convId, styleReferences,
          selectedCharacterIds.length > 0 ? selectedCharacterIds : undefined,
          (updatedStates) => {
            const generationsArray = Array.from(updatedStates.values())
            setMultiModelGenerations(generationsArray)

            // Follow the tracked model's lifecycle for the trace
            const tracked = updatedStates.get(trackedModel)
            if (!tracked) return

            if (tracked.status === 'processing' && !submitMarkedComplete) {
              submitMarkedComplete = true
              updateStep('submit', { status: 'completed', detail: `Jobs sent to ${selectedModels.length} models`, timestamp: new Date() })
              updateStep('generate', { status: 'active', detail: `Following ${trackedModelName}... ${tracked.progress}%` })
            } else if (tracked.status === 'processing') {
              updateStep('generate', { detail: `Following ${trackedModelName}... ${tracked.progress}%` })
            } else if (tracked.status === 'completed') {
              updateStep('generate', { status: 'completed', detail: `${trackedModelName} finished`, timestamp: new Date() })
              if (tracked.video?.isVerifying) {
                updateStep('quality', { status: 'active', detail: `Verifying ${trackedModelName} output...` })
              }
              if (tracked.video && !tracked.video.isVerifying && tracked.video.qualityScore !== null) {
                const score = tracked.video.qualityScore
                const label = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Poor'
                updateStep('quality', { status: 'completed', detail: `${trackedModelName}: ${score.toFixed(1)}/10 — ${label}`, timestamp: new Date() })
              }
            } else if (tracked.status === 'failed') {
              if (!submitMarkedComplete) {
                updateStep('submit', { status: 'failed', detail: tracked.error || 'Submission failed', timestamp: new Date() })
              }
              updateStep('generate', { status: 'failed', detail: `${trackedModelName}: ${tracked.error || 'Failed'}`, timestamp: new Date() })
            }
          },
          continuityFrameUrl,
        )

        // Finalize any steps still pending after all models done
        const finalTracked = states.get(trackedModel)
        if (finalTracked?.status === 'completed') {
          updateStep('generate', { status: 'completed', detail: `${trackedModelName} finished`, timestamp: new Date() })
          // If quality didn't get resolved via callback, mark complete
          if (!finalTracked.video?.qualityScore) {
            updateStep('quality', { status: 'completed', detail: 'Verification complete', timestamp: new Date() })
          }
        }

        setIsGenerating(false)
        setUploadedFiles([])
        setSelectedYouTubeVideos([])
        return
      }

      // Single model generation
      const response = await startGeneration({
        prompt: enhancedPrompt,
        model: selectedModel,
        duration: selectedDuration,
        conversationId: convId,
        styleReferences,
        characterIds: selectedCharacterIds.length > 0 ? selectedCharacterIds : undefined,
        firstFrameUrl: continuityFrameUrl,
      })

      // Update enhance step with the actual enhanced prompt from server
      if (response.enhancedPrompt) {
        updateStep('enhance', {
          status: 'completed',
          detail: 'Prompt rewritten by Gemini',
          expandedContent: response.enhancedPrompt,
          timestamp: new Date(),
        })
      } else {
        updateStep('enhance', { status: 'completed', detail: 'Using original prompt', timestamp: new Date() })
      }

      if (hasChars) {
        updateStep('characters', { status: 'completed', detail: 'Character images prepared', timestamp: new Date() })
      }

      if (!response.success || !response.videoId) {
        throw new Error(response.error || 'Failed to start generation')
      }

      // Show warning
      if (response.warning) {
        updateStep('characters', { detail: `Warning: ${response.warning}` })
      }

      updateStep('submit', { status: 'completed', detail: `Job submitted to ${modelName}`, timestamp: new Date() })
      updateStep('generate', { status: 'active', detail: `Generating ${selectedDuration}s clip with ${modelName}...` })

      // Create video entry
      const video = {
        id: response.videoId,
        prompt: response.enhancedPrompt || enhancedPrompt,
        model: selectedModel,
        duration: selectedDuration,
        status: 'pending' as const,
        videoUrl: null, thumbnailUrl: null, qualityScore: null, qualityReport: null,
        isVerifying: false, createdAt: new Date(), completedAt: null,
      }
      addVideo(convId, video)

      // Save summary message to DB for conversation history
      createMessageApi(convId, 'assistant', `Generating ${selectedDuration}s video with ${modelName}...`)

      // Poll for completion
      pollVideoStatus(response.videoId, (status: VideoStatusResponse) => {
        if (status.status === 'processing') {
          const currentProgress = useAppStore.getState().generationProgress
          const newProgress = Math.min(currentProgress + 10, 90)
          setGenerationProgress(newProgress)
          updateStep('generate', { detail: `Processing... ${newProgress}%` })
        }

        updateVideo(convId!, response.videoId!, {
          status: status.status, videoUrl: status.videoUrl,
          thumbnailUrl: status.thumbnailUrl, qualityScore: status.qualityScore,
          completedAt: status.completedAt ? new Date(status.completedAt) : null,
        })

        if (status.status === 'completed' && status.videoUrl) {
          setGenerationProgress(100)

          updateStep('generate', { status: 'completed', detail: 'Video generated successfully', timestamp: new Date() })
          updateStep('quality', { status: 'active', detail: 'Running quality analysis...' })

          const completedVideo = {
            id: response.videoId!, prompt: response.enhancedPrompt || enhancedPrompt,
            model: selectedModel, duration: selectedDuration,
            status: 'completed' as const, videoUrl: status.videoUrl,
            thumbnailUrl: status.thumbnailUrl, qualityScore: null, qualityReport: null,
            isVerifying: true, createdAt: new Date(), completedAt: new Date(),
          }
          setCurrentVideo(completedVideo)
          updateVideo(convId!, response.videoId!, { isVerifying: true })
          createMessageApi(convId!, 'assistant', 'Video ready!', response.videoId)

          verifyVideoQuality(response.videoId!, status.videoUrl).then((verifyResult) => {
            if (verifyResult) {
              const qualityReport = verifyResult.report as QualityReport
              updateVideo(convId!, response.videoId!, { qualityScore: verifyResult.qualityScore, qualityReport, isVerifying: false })

              const currentState = useAppStore.getState()
              const cv = currentState.currentVideo
              if (cv && cv.id === response.videoId) {
                setCurrentVideo({ ...cv, qualityScore: verifyResult.qualityScore, qualityReport, isVerifying: false })
              }

              const qualityLabel = verifyResult.qualityScore >= 8 ? 'Excellent' : verifyResult.qualityScore >= 6 ? 'Good' : verifyResult.qualityScore >= 4 ? 'Fair' : 'Poor'
              updateStep('quality', {
                status: 'completed',
                detail: `${verifyResult.qualityScore.toFixed(1)}/10 — ${qualityLabel}`,
                timestamp: new Date(),
              })
              createMessageApi(convId!, 'assistant', `Quality: ${verifyResult.qualityScore.toFixed(1)}/10 (${qualityLabel})`)
            } else {
              updateVideo(convId!, response.videoId!, { isVerifying: false })
              updateStep('quality', { status: 'completed', detail: 'Verification skipped', timestamp: new Date() })
            }
            setIsGenerating(false)
          })
        } else if (status.status === 'failed') {
          setIsGenerating(false)
          updateStep('generate', { status: 'failed', detail: status.error || 'Generation failed', timestamp: new Date() })
          updateStep('quality', { status: 'failed' })
          createMessageApi(convId!, 'assistant', `Failed: ${status.error || 'Unknown error'}`)
        }
      })

      setUploadedFiles([])
      setSelectedYouTubeVideos([])
    } catch (error) {
      setIsGenerating(false)
      const errMsg = error instanceof Error ? error.message : 'Failed to generate video'
      // Mark the first pending/active step as failed
      setTraceSteps(prev => {
        const updated = [...prev]
        const activeIdx = updated.findIndex(s => s.status === 'active' || s.status === 'pending')
        if (activeIdx >= 0) {
          updated[activeIdx] = { ...updated[activeIdx], status: 'failed', detail: errMsg }
        }
        return updated
      })
      createMessageApi(convId, 'assistant', `Error: ${errMsg}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleYouTubeSelect = (video: YouTubeVideo) => {
    setSelectedYouTubeVideos(prev => {
      // Toggle selection
      const exists = prev.some(v => v.id === video.id)
      if (exists) {
        return prev.filter(v => v.id !== video.id)
      }
      // Limit to 3 reference videos
      if (prev.length >= 3) {
        return [...prev.slice(1), video]
      }
      return [...prev, video]
    })
  }

  const removeYouTubeVideo = (videoId: string) => {
    setSelectedYouTubeVideos(prev => prev.filter(v => v.id !== videoId))
  }

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024 // 10MB for images, 100MB for videos

    if (file.size > maxSize) {
      alert(`File too large. Max size: ${type === 'image' ? '10MB' : '100MB'}`)
      return
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    const uploadedFile: UploadedFile = {
      id: generateId(),
      type,
      file,
      previewUrl,
    }

    // Limit to 3 total uploads
    setUploadedFiles(prev => {
      if (prev.length >= 3) {
        // Clean up old preview URL
        URL.revokeObjectURL(prev[0].previewUrl)
        return [...prev.slice(1), uploadedFile]
      }
      return [...prev, uploadedFile]
    })

    // Reset the input
    e.target.value = ''
  }

  const removeUploadedFile = (id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file) {
        URL.revokeObjectURL(file.previewUrl)
      }
      return prev.filter(f => f.id !== id)
    })
  }

  return (
    <aside className="w-full lg:w-[360px] h-full flex flex-col panel lg:border-l border-border">
      {/* Chat Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
        {!activeConversation || activeConversation.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-foreground-secondary">
              <p className="mb-2">Start a conversation to generate video</p>
              <p className="text-sm">Describe what you want to create</p>
            </div>
          </div>
        ) : (
          activeConversation.messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'user' ? 'message-user' : 'message-assistant'}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs text-foreground-secondary mt-1 opacity-60">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ))
        )}

        {traceSteps.length > 0 && (
          <AgenticTrace
            originalPrompt={currentPrompt}
            steps={traceSteps}
            isActive={isGenerating}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Model Selector */}
      <div className="px-3 sm:px-4 py-3 border-t border-border" data-onboarding="model-selection">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-foreground-secondary">Model</label>
          {selectedModels.length > 1 && (
            <span className="text-xs text-accent">
              Multi-Model ({selectedModels.length})
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {MODELS.map((model) => {
            const isSelected = selectedModels.includes(model.id)
            return (
              <button
                key={model.id}
                onClick={() => {
                  if (model.disabled) return

                  // Calculate what the new selection would be
                  const newSelectedModels = selectedModels.includes(model.id)
                    ? selectedModels.filter((m) => m !== model.id)
                    : [...selectedModels, model.id]

                  // Don't allow deselecting the last model
                  if (newSelectedModels.length === 0) return

                  // Toggle the model selection
                  toggleModelSelection(model.id)

                  // Automatically enable/disable multi-model mode based on selection count
                  setMultiModelMode(newSelectedModels.length > 1)

                  // Update selectedModel for single-model mode
                  if (newSelectedModels.length === 1) {
                    setSelectedModel(newSelectedModels[0])
                  }
                }}
                className={`model-chip text-xs ${isSelected ? 'model-chip-active' : ''} ${model.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={model.disabled ? 'Coming soon' : `Generation time: ${model.speed}`}
                disabled={isGenerating || model.disabled}
              >
                {model.name}
                {model.disabled && <span className="ml-1 text-[10px]">(soon)</span>}
              </button>
            )
          })}
        </div>
        {selectedModels.length === 0 && (
          <p className="text-xs text-foreground-secondary mt-2">
            Select 1 model for single generation or 2-4 models to compare
          </p>
        )}
        {selectedModels.length === 1 && (
          <p className="text-xs text-foreground-secondary mt-2">
            Click another model to enable multi-model comparison
          </p>
        )}
        {selectedModels.length > 4 && (
          <p className="text-xs text-red-400 mt-2">
            Maximum 4 models for comparison
          </p>
        )}
      </div>

      {/* Duration Selector */}
      <div className="px-3 sm:px-4 py-3 border-t border-border">
        <label className="text-xs text-foreground-secondary mb-2 block">Duration</label>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {getModelDurations(selectedModel).map((duration) => (
            <button
              key={duration}
              onClick={() => setSelectedDuration(duration)}
              className={`duration-chip text-xs ${selectedDuration === duration ? 'duration-chip-active' : ''}`}
              disabled={isGenerating}
            >
              {duration}s
            </button>
          ))}
        </div>
      </div>

      {/* Selected Characters */}
      {selectedCharacterIds.length > 0 && (
        <div className="px-3 sm:px-4 py-2 border-t border-border">
          <label className="text-xs text-foreground-secondary mb-2 block">Characters</label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {selectedCharacterIds.map((id) => {
              const char = characters.find((c) => c.id === id)
              if (!char) return null
              return (
                <div
                  key={id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 rounded-full text-xs"
                >
                  <div className="w-4 h-4 rounded-full overflow-hidden bg-background-secondary">
                    {char.thumbnailUrl ? (
                      <img src={char.thumbnailUrl} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-0.5 text-foreground-secondary" />
                    )}
                  </div>
                  <span className="text-foreground">@{char.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleCharacterSelection(id)}
                    className="text-foreground-secondary hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
          {selectedModel !== 'veo3_1' && (
            <p className="text-xs text-yellow-500/80 mt-2">
              Tip: Veo 3.1 is the only model that uses character reference images. Other models rely on a text description instead.
            </p>
          )}
        </div>
      )}

      {/* Selected YouTube References */}
      {selectedYouTubeVideos.length > 0 && (
        <div className="px-3 sm:px-4 py-2 border-t border-border">
          <label className="text-xs text-foreground-secondary mb-2 block">
            YouTube References ({selectedYouTubeVideos.length}/3)
          </label>
          <div className="space-y-2">
            {selectedYouTubeVideos.map((video) => (
              <div
                key={video.id}
                className="flex items-center gap-2 p-2 bg-background-secondary rounded-lg"
              >
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-16 h-9 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {video.title}
                  </p>
                  <p className="text-xs text-foreground-secondary truncate">
                    {video.channel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeYouTubeVideo(video.id)}
                  className="p-1 text-foreground-secondary hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-border">
          <label className="text-xs text-foreground-secondary mb-2 block">
            Uploaded References ({uploadedFiles.length}/3)
          </label>
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="relative group"
              >
                {file.type === 'image' ? (
                  <img
                    src={file.previewUrl}
                    alt={file.file.name}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-16 h-16 bg-background-secondary rounded-lg border border-border flex items-center justify-center">
                    <Video className="w-6 h-6 text-foreground-secondary" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeUploadedFile(file.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <p className="text-xs text-foreground-secondary truncate w-16 mt-1">
                  {file.file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} data-chatpanel-form className="p-3 sm:p-4 border-t border-border">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your video... Use @name to tag characters"
            rows={3}
            maxLength={2000}
            className="input-field w-full resize-none pr-12 text-sm sm:text-base"
            disabled={isGenerating}
          />
          <CharacterMention
            inputRef={inputRef}
            value={input}
            onChange={setInput}
            onCharacterSelect={(char) => {
              if (!selectedCharacterIds.includes(char.id)) {
                toggleCharacterSelection(char.id)
              }
            }}
          />
          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, 'image')}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, 'video')}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {/* Image upload - only for models that support image input */}
            {modelSupportsInput(selectedModel, 'image') && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className={`btn-ghost p-1.5 ${uploadedFiles.some(f => f.type === 'image') ? 'text-accent' : ''}`}
                title="Upload image reference"
                disabled={isGenerating || uploadedFiles.length >= 3}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            )}
            {/* Video upload - only for models that support video input */}
            {modelSupportsInput(selectedModel, 'video') && (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className={`btn-ghost p-1.5 ${uploadedFiles.some(f => f.type === 'video') ? 'text-accent' : ''}`}
                title="Upload video reference"
                disabled={isGenerating || uploadedFiles.length >= 3}
              >
                <Video className="w-4 h-4" />
              </button>
            )}
            {/* YouTube search - for models that support video or image (can extract frames) */}
            {(modelSupportsInput(selectedModel, 'video') || modelSupportsInput(selectedModel, 'image')) && (
              <button
                type="button"
                onClick={() => setShowYouTubeSearch(true)}
                className={`btn-ghost p-1.5 ${selectedYouTubeVideos.length > 0 ? 'text-red-500' : ''}`}
                title="Search YouTube for reference"
                disabled={isGenerating}
              >
                <Youtube className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCharacterManager(true)}
              className={`btn-ghost p-1.5 ${selectedCharacterIds.length > 0 ? 'text-accent' : ''}`}
              title="Tag character"
              disabled={isGenerating}
              data-onboarding="character-button"
            >
              <AtSign className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 mt-3">
          <div className="flex items-center gap-2 text-xs text-foreground-secondary">
            <span>{input.length}/2000</span>
            {videoUsage && !videoUsage.isAdmin && videoUsage.remaining !== null && (
              <span className={`hidden sm:inline ${videoUsage.remaining <= 3 ? 'text-warning' : 'text-foreground-secondary'} ${videoUsage.remaining === 0 ? 'text-error' : ''}`}>
                {videoUsage.remaining} videos left
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            data-onboarding="generate-button"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Generating...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </form>

      {/* Character Manager Modal */}
      <CharacterManager
        isOpen={showCharacterManager}
        onClose={() => setShowCharacterManager(false)}
        selectionMode={true}
      />

      {/* YouTube Search Panel */}
      <YouTubeSearchPanel
        isOpen={showYouTubeSearch}
        onClose={() => setShowYouTubeSearch(false)}
        onSelectVideo={handleYouTubeSelect}
        selectedVideos={selectedYouTubeVideos}
      />
    </aside>
  )
}
