'use client'

import { useState, useRef } from 'react'
import { Send, ChevronDown, AtSign, Loader2, ImageIcon, Video } from 'lucide-react'
import { useAppStore, VideoModel } from '@/lib/store'
import { CharacterManager } from '@/components/ui/CharacterManager'
import { CharacterMention } from '@/components/ui/CharacterMention'
import { MODEL_INFO, VideoModelId } from '@/lib/models/types'

const MODELS: { id: VideoModel; name: string }[] = [
  { id: 'veo3_1', name: 'Veo 3.1' },
  { id: 'luma', name: 'Luma AI' },
  { id: 'runway', name: 'Runway' },
  { id: 'sora', name: 'Sora' },
]

function getModelDurations(modelId: VideoModel): number[] {
  return MODEL_INFO[modelId as VideoModelId]?.allowedDurations || [5, 10]
}

function modelSupportsInput(modelId: VideoModel, inputType: 'text' | 'image' | 'video'): boolean {
  const inputs = MODEL_INFO[modelId as VideoModelId]?.supportedInputs || ['text']
  return inputs.includes(inputType)
}

interface UploadedFile {
  type: 'image' | 'video'
  file: File
  previewUrl: string
}

interface WelcomePromptBarProps {
  onSubmit: (prompt: string, uploadedFiles?: UploadedFile[]) => void
}

export type { UploadedFile }

export function WelcomePromptBar({ onSubmit }: WelcomePromptBarProps) {
  const [input, setInput] = useState('')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showDurationDropdown, setShowDurationDropdown] = useState(false)
  const [showCharacterDropdown, setShowCharacterDropdown] = useState(false)
  const [showCharacterManager, setShowCharacterManager] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const selectedModel = useAppStore((state) => state.selectedModel)
  const setSelectedModel = useAppStore((state) => state.setSelectedModel)
  const selectedModels = useAppStore((state) => state.selectedModels)
  const toggleModelSelection = useAppStore((state) => state.toggleModelSelection)
  const setMultiModelMode = useAppStore((state) => state.setMultiModelMode)
  const selectedDuration = useAppStore((state) => state.selectedDuration)
  const setSelectedDuration = useAppStore((state) => state.setSelectedDuration)
  const characters = useAppStore((state) => state.characters)
  const selectedCharacterIds = useAppStore((state) => state.selectedCharacterIds)
  const toggleCharacterSelection = useAppStore((state) => state.toggleCharacterSelection)
  const isGenerating = useAppStore((state) => state.isGenerating)

  const modelName = MODELS.find(m => m.id === selectedModel)?.name || 'Veo 3.1'
  const durations = getModelDurations(selectedModel)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating) return
    onSubmit(input.trim(), uploadedFiles.length > 0 ? uploadedFiles : undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024
    if (file.size > maxSize) {
      alert(`File too large. Max size: ${type === 'image' ? '10MB' : '100MB'}`)
      return
    }

    if (uploadedFiles.length >= 3) {
      alert('Maximum 3 uploads allowed')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setUploadedFiles(prev => [...prev, { type, file, previewUrl }])

    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => {
      const removed = prev[index]
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Close dropdowns when clicking outside
  const handleBackdropClick = () => {
    setShowModelDropdown(false)
    setShowDurationDropdown(false)
    setShowCharacterDropdown(false)
  }

  const supportsImage = modelSupportsInput(selectedModel, 'image')
  const supportsVideo = modelSupportsInput(selectedModel, 'video')

  return (
    <>
      <div className="w-full max-w-2xl mx-auto px-4">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            What do you want to create?
          </h1>
          <p className="text-sm text-foreground-secondary">
            Describe a scene and we&apos;ll generate a video for you
          </p>
        </div>

        {/* Prompt Bar */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-2xl shadow-2xl">
            {/* Top row: Model, Duration, Characters */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              {/* Model selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowModelDropdown(!showModelDropdown)
                    setShowDurationDropdown(false)
                    setShowCharacterDropdown(false)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2a2a2a] hover:bg-[#333] text-xs font-medium text-foreground transition-colors"
                >
                  {modelName}
                  {selectedModels.length > 1 && (
                    <span className="text-accent ml-0.5">&times;{selectedModels.length}</span>
                  )}
                  <ChevronDown className="w-3 h-3 text-foreground-secondary" />
                </button>

                {showModelDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl z-50 py-1">
                    <p className="px-3 py-1.5 text-[10px] text-foreground-secondary uppercase tracking-wider">
                      Select models (1-4)
                    </p>
                    {MODELS.map((model) => {
                      const isSelected = selectedModels.includes(model.id)
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            const newSelected = selectedModels.includes(model.id)
                              ? selectedModels.filter(m => m !== model.id)
                              : [...selectedModels, model.id]
                            if (newSelected.length === 0) return
                            toggleModelSelection(model.id)
                            setMultiModelMode(newSelected.length > 1)
                            if (newSelected.length === 1) {
                              setSelectedModel(newSelected[0])
                            }
                          }}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[#2a2a2a] transition-colors ${
                            isSelected ? 'text-foreground' : 'text-foreground-secondary'
                          }`}
                        >
                          <span>{model.name}</span>
                          {isSelected && <span className="text-accent text-xs">&#10003;</span>}
                          {model.id === 'veo3_1' && !isSelected && (
                            <span className="text-[10px] text-accent/60">recommended</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Duration selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowDurationDropdown(!showDurationDropdown)
                    setShowModelDropdown(false)
                    setShowCharacterDropdown(false)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2a2a2a] hover:bg-[#333] text-xs font-medium text-foreground transition-colors"
                >
                  {selectedDuration}s
                  <ChevronDown className="w-3 h-3 text-foreground-secondary" />
                </button>

                {showDurationDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-28 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl z-50 py-1">
                    {durations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDuration(d)
                          setShowDurationDropdown(false)
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-[#2a2a2a] transition-colors ${
                          selectedDuration === d ? 'text-foreground' : 'text-foreground-secondary'
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Character selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowCharacterDropdown(!showCharacterDropdown)
                    setShowModelDropdown(false)
                    setShowDurationDropdown(false)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCharacterIds.length > 0
                      ? 'bg-accent/20 text-accent'
                      : 'bg-[#2a2a2a] hover:bg-[#333] text-foreground'
                  }`}
                  data-onboarding="character-button"
                >
                  <AtSign className="w-3 h-3" />
                  {selectedCharacterIds.length > 0
                    ? `${selectedCharacterIds.length} character${selectedCharacterIds.length > 1 ? 's' : ''}`
                    : 'Characters'
                  }
                  <ChevronDown className="w-3 h-3 text-foreground-secondary" />
                </button>

                {showCharacterDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl z-50 py-1">
                    {characters.length > 0 && characters.map((char) => {
                      const isSelected = selectedCharacterIds.includes(char.id)
                      return (
                        <button
                          key={char.id}
                          type="button"
                          onClick={() => toggleCharacterSelection(char.id)}
                          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[#2a2a2a] transition-colors ${
                            isSelected ? 'text-foreground' : 'text-foreground-secondary'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-[#2a2a2a] flex-shrink-0">
                            {char.thumbnailUrl ? (
                              <img src={char.thumbnailUrl} alt={char.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-foreground-secondary">?</div>
                            )}
                          </div>
                          <span className="flex-1 truncate">{char.name}</span>
                          {isSelected && <span className="text-accent text-xs">&#10003;</span>}
                        </button>
                      )
                    })}
                    {characters.length === 0 && (
                      <p className="px-3 py-2 text-xs text-foreground-secondary">
                        No characters yet. Create one to get started.
                      </p>
                    )}
                    <div className="border-t border-[#2a2a2a] mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCharacterDropdown(false)
                          setShowCharacterManager(true)
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-accent hover:bg-[#2a2a2a] transition-colors"
                      >
                        + Create New Character
                      </button>
                    </div>
                    {selectedCharacterIds.length > 0 && selectedModel !== 'veo3_1' && (
                      <div className="px-3 py-1.5 border-t border-[#2a2a2a]">
                        <p className="text-[10px] text-yellow-500/80">
                          Tip: Veo 3.1 is the only model that uses character images directly.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1" />
            </div>

            {/* Uploaded files preview */}
            {uploadedFiles.length > 0 && (
              <div className="px-4 pt-1">
                <div className="flex items-center gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="w-14 h-10 rounded-md overflow-hidden bg-[#2a2a2a] border border-[#3a3a3a]">
                        {file.type === 'image' ? (
                          <img src={file.previewUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <video src={file.previewUrl} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeUploadedFile(index)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                      <p className="text-[9px] text-foreground-secondary truncate w-14 mt-0.5">
                        {file.file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text input */}
            <div className="px-4 py-2 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your video... Use @name to tag characters"
                rows={2}
                maxLength={2000}
                className="w-full bg-transparent text-foreground placeholder:text-foreground-secondary/50 text-sm resize-none focus:outline-none"
                disabled={isGenerating}
              />
              {/* Character @ mention autocomplete */}
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
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-foreground-secondary mr-1">{input.length}/2000</span>
                {/* Image upload */}
                {supportsImage && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className={`p-1.5 rounded-md hover:bg-[#2a2a2a] transition-colors ${
                      uploadedFiles.some(f => f.type === 'image') ? 'text-accent' : 'text-foreground-secondary'
                    }`}
                    title="Upload reference image"
                    disabled={isGenerating || uploadedFiles.length >= 3}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                )}
                {/* Video upload */}
                {supportsVideo && (
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className={`p-1.5 rounded-md hover:bg-[#2a2a2a] transition-colors ${
                      uploadedFiles.some(f => f.type === 'video') ? 'text-accent' : 'text-foreground-secondary'
                    }`}
                    title="Upload reference video"
                    disabled={isGenerating || uploadedFiles.length >= 3}
                  >
                    <Video className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent/90 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-onboarding="generate-button"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Generate
              </button>
            </div>
          </div>

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
        </form>
      </div>

      {/* Click-away backdrop for dropdowns */}
      {(showModelDropdown || showDurationDropdown || showCharacterDropdown) && (
        <div className="fixed inset-0 z-40" onClick={handleBackdropClick} />
      )}

      {/* Character Manager */}
      <CharacterManager
        isOpen={showCharacterManager}
        onClose={() => setShowCharacterManager(false)}
      />
    </>
  )
}
