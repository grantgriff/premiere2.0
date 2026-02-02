'use client'

import { useState, useRef, useEffect } from 'react'
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
import { QualityReport } from '@/lib/models/types'
import { CharacterMention, extractCharacterMentions } from '@/components/ui/CharacterMention'
import { CharacterManager } from '@/components/ui/CharacterManager'
import { YouTubeSearchPanel, YouTubeVideo } from '@/components/ui/YouTubeSearchPanel'
import { uploadToStorage, STORAGE_BUCKETS } from '@/lib/supabase'

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

const DURATIONS = [1, 3, 5, 10, 15, 30]

export function ChatPanel() {
  const [input, setInput] = useState('')
  const [showCharacterManager, setShowCharacterManager] = useState(false)
  const [showYouTubeSearch, setShowYouTubeSearch] = useState(false)
  const [selectedYouTubeVideos, setSelectedYouTubeVideos] = useState<YouTubeVideo[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating || !user) return

    const prompt = input.trim()
    setInput('')
    setIsGenerating(true)
    setGenerationProgress(0)

    // Create or get conversation
    let convId = activeConversationId
    if (!convId) {
      const title = prompt.slice(0, 40) + (prompt.length > 40 ? '...' : '')

      // Create in database first
      const dbConversation = await createConversationApi(user.id, title)

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
    const userMessage = {
      id: generateId(),
      role: 'user' as const,
      content: prompt,
      timestamp: new Date(),
    }
    addMessage(convId, userMessage)

    // Save user message to database
    createMessageApi(convId, 'user', prompt)

    // Add assistant "generating" message
    const generatingMessage = {
      id: generateId(),
      role: 'assistant' as const,
      content: `Generating ${selectedDuration}s video with ${MODELS.find(m => m.id === selectedModel)?.name}...`,
      timestamp: new Date(),
    }
    addMessage(convId, generatingMessage)

    // Save generating message to database
    createMessageApi(convId, 'assistant', generatingMessage.content)

    try {
      // Upload files to storage first
      const uploadedUrls: StyleReference[] = []
      for (const uploadedFile of uploadedFiles) {
        const bucket = uploadedFile.type === 'image' ? STORAGE_BUCKETS.IMAGES : STORAGE_BUCKETS.VIDEOS
        const path = `${user.id}/${generateId()}_${uploadedFile.file.name}`
        const url = await uploadToStorage(bucket, path, uploadedFile.file)
        if (url) {
          uploadedUrls.push({
            type: 'upload',
            url,
            title: uploadedFile.file.name,
          })
        }
      }

      // Build all style references
      const styleReferences: StyleReference[] = [
        ...selectedYouTubeVideos.map(v => ({
          type: 'youtube' as const,
          url: v.url,
          videoId: v.id,
          title: v.title,
        })),
        ...uploadedUrls,
      ]

      // Start generation with all references
      const response = await startGeneration({
        prompt,
        model: selectedModel,
        duration: selectedDuration,
        userId: user.id,
        conversationId: convId,
        styleReferences,
      })

      if (!response.success || !response.videoId) {
        throw new Error(response.error || 'Failed to start generation')
      }

      // Show warning if model API had issues
      if (response.warning) {
        const warningContent = `Warning: ${response.warning}`
        addMessage(convId, {
          id: generateId(),
          role: 'assistant' as const,
          content: warningContent,
          timestamp: new Date(),
        })
        createMessageApi(convId, 'assistant', warningContent)
      }

      // Create video entry
      const video = {
        id: response.videoId,
        prompt,
        model: selectedModel,
        duration: selectedDuration,
        status: 'pending' as const,
        videoUrl: null,
        thumbnailUrl: null,
        qualityScore: null,
        qualityReport: null,
        isVerifying: false,
        createdAt: new Date(),
        completedAt: null,
      }
      addVideo(convId, video)

      // Poll for completion
      pollVideoStatus(response.videoId, (status: VideoStatusResponse) => {
        // Update progress
        if (status.status === 'processing') {
          const currentProgress = useAppStore.getState().generationProgress
          setGenerationProgress(Math.min(currentProgress + 10, 90))
        }

        // Update video in store
        updateVideo(convId!, response.videoId!, {
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

          // Set current video with verifying state
          const completedVideo = {
            id: response.videoId!,
            prompt,
            model: selectedModel,
            duration: selectedDuration,
            status: 'completed' as const,
            videoUrl: status.videoUrl,
            thumbnailUrl: status.thumbnailUrl,
            qualityScore: null,
            qualityReport: null,
            isVerifying: true,
            createdAt: new Date(),
            completedAt: new Date(),
          }
          setCurrentVideo(completedVideo)
          updateVideo(convId!, response.videoId!, { isVerifying: true })

          // Add initial completion message
          const completionContent = 'Video ready! Running quality verification...'
          addMessage(convId!, {
            id: generateId(),
            role: 'assistant' as const,
            content: completionContent,
            timestamp: new Date(),
            videoId: response.videoId,
          })
          createMessageApi(convId!, 'assistant', completionContent, response.videoId)

          // Run quality verification
          verifyVideoQuality(response.videoId!, status.videoUrl).then((verifyResult) => {
            if (verifyResult) {
              const qualityReport = verifyResult.report as QualityReport

              // Update video with quality results
              updateVideo(convId!, response.videoId!, {
                qualityScore: verifyResult.qualityScore,
                qualityReport,
                isVerifying: false,
              })

              // Update current video if still viewing
              const currentState = useAppStore.getState()
              const cv = currentState.currentVideo
              if (cv && cv.id === response.videoId) {
                setCurrentVideo({
                  id: cv.id,
                  prompt: cv.prompt,
                  model: cv.model,
                  duration: cv.duration,
                  status: cv.status,
                  videoUrl: cv.videoUrl,
                  thumbnailUrl: cv.thumbnailUrl,
                  qualityScore: verifyResult.qualityScore,
                  qualityReport,
                  isVerifying: false,
                  createdAt: cv.createdAt,
                  completedAt: cv.completedAt,
                })
              }

              // Add quality result message
              const qualityLabel = verifyResult.qualityScore >= 8 ? 'Excellent' :
                                   verifyResult.qualityScore >= 6 ? 'Good' :
                                   verifyResult.qualityScore >= 4 ? 'Fair' : 'Poor'
              const qualityContent = `Quality verified: ${verifyResult.qualityScore.toFixed(1)}/10 (${qualityLabel})${verifyResult.hasHighSeverityIssues ? ' - Some issues detected' : ''}`
              addMessage(convId!, {
                id: generateId(),
                role: 'assistant' as const,
                content: qualityContent,
                timestamp: new Date(),
              })
              createMessageApi(convId!, 'assistant', qualityContent)
            } else {
              // Verification failed
              updateVideo(convId!, response.videoId!, { isVerifying: false })
              const currentState = useAppStore.getState()
              const cv = currentState.currentVideo
              if (cv && cv.id === response.videoId) {
                setCurrentVideo({
                  id: cv.id,
                  prompt: cv.prompt,
                  model: cv.model,
                  duration: cv.duration,
                  status: cv.status,
                  videoUrl: cv.videoUrl,
                  thumbnailUrl: cv.thumbnailUrl,
                  qualityScore: cv.qualityScore,
                  qualityReport: cv.qualityReport,
                  isVerifying: false,
                  createdAt: cv.createdAt,
                  completedAt: cv.completedAt,
                })
              }
            }
          })
        } else if (status.status === 'failed') {
          setIsGenerating(false)
          const failContent = `Generation failed: ${status.error || 'Unknown error'}`
          addMessage(convId!, {
            id: generateId(),
            role: 'assistant' as const,
            content: failContent,
            timestamp: new Date(),
          })
          createMessageApi(convId!, 'assistant', failContent)
        }
      })
      // Clear uploaded files after successful submission
      setUploadedFiles([])
      setSelectedYouTubeVideos([])
    } catch (error) {
      setIsGenerating(false)
      const errorContent = `Error: ${error instanceof Error ? error.message : 'Failed to generate video'}`
      addMessage(convId, {
        id: generateId(),
        role: 'assistant' as const,
        content: errorContent,
        timestamp: new Date(),
      })
      createMessageApi(convId, 'assistant', errorContent)
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
    <aside className="w-[360px] h-full flex flex-col panel border-l border-border">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {isGenerating && (
          <div className="message-assistant">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating video...</span>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <p className="text-xs text-foreground-secondary mt-1">
              {generationProgress < 30 && 'Starting generation...'}
              {generationProgress >= 30 && generationProgress < 70 && 'Processing frames...'}
              {generationProgress >= 70 && generationProgress < 100 && 'Finalizing...'}
              {generationProgress === 100 && 'Complete!'}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Model Selector */}
      <div className="px-4 py-3 border-t border-border">
        <label className="text-xs text-foreground-secondary mb-2 block">Model</label>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => !model.disabled && setSelectedModel(model.id)}
              className={`model-chip text-xs ${selectedModel === model.id ? 'model-chip-active' : ''} ${model.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={model.disabled ? 'Coming soon' : `Generation time: ${model.speed}`}
              disabled={isGenerating || model.disabled}
            >
              {model.name}
              {model.disabled && <span className="ml-1 text-[10px]">(soon)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Selector */}
      <div className="px-4 py-3 border-t border-border">
        <label className="text-xs text-foreground-secondary mb-2 block">Duration</label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((duration) => (
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
        <div className="px-4 py-2 border-t border-border">
          <label className="text-xs text-foreground-secondary mb-2 block">Characters</label>
          <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      {/* Selected YouTube References */}
      {selectedYouTubeVideos.length > 0 && (
        <div className="px-4 py-2 border-t border-border">
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
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your video... Use @name to tag characters"
            rows={3}
            maxLength={2000}
            className="input-field w-full resize-none pr-12"
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
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className={`btn-ghost p-1.5 ${uploadedFiles.some(f => f.type === 'image') ? 'text-accent' : ''}`}
              title="Upload image reference"
              disabled={isGenerating || uploadedFiles.length >= 3}
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className={`btn-ghost p-1.5 ${uploadedFiles.some(f => f.type === 'video') ? 'text-accent' : ''}`}
              title="Upload video reference"
              disabled={isGenerating || uploadedFiles.length >= 3}
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowYouTubeSearch(true)}
              className={`btn-ghost p-1.5 ${selectedYouTubeVideos.length > 0 ? 'text-red-500' : ''}`}
              title="Search YouTube for reference"
              disabled={isGenerating}
            >
              <Youtube className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowCharacterManager(true)}
              className={`btn-ghost p-1.5 ${selectedCharacterIds.length > 0 ? 'text-accent' : ''}`}
              title="Tag character"
              disabled={isGenerating}
            >
              <AtSign className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-foreground-secondary">{input.length}/2000</span>
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
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
