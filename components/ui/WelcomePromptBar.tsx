'use client'

import { useState, useRef } from 'react'
import { Send, ChevronDown, AtSign, Loader2 } from 'lucide-react'
import { useAppStore, VideoModel } from '@/lib/store'
import { CharacterManager } from '@/components/ui/CharacterManager'
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

interface WelcomePromptBarProps {
  onSubmit: (prompt: string) => void
}

export function WelcomePromptBar({ onSubmit }: WelcomePromptBarProps) {
  const [input, setInput] = useState('')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showDurationDropdown, setShowDurationDropdown] = useState(false)
  const [showCharacterDropdown, setShowCharacterDropdown] = useState(false)
  const [showCharacterManager, setShowCharacterManager] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    onSubmit(input.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Close dropdowns when clicking outside
  const handleBackdropClick = () => {
    setShowModelDropdown(false)
    setShowDurationDropdown(false)
    setShowCharacterDropdown(false)
  }

  return (
    <>
      <div className="w-full max-w-2xl mx-auto px-4">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            What do you want to create?
          </h1>
          <p className="text-sm text-foreground-secondary">
            Describe a scene and we'll generate a video for you
          </p>
        </div>

        {/* Prompt Bar */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-2xl shadow-2xl overflow-hidden">
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
                    <span className="text-accent ml-0.5">×{selectedModels.length}</span>
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
                          {isSelected && <span className="text-accent text-xs">✓</span>}
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
                    if (characters.length === 0) {
                      setShowCharacterManager(true)
                    } else {
                      setShowCharacterDropdown(!showCharacterDropdown)
                      setShowModelDropdown(false)
                      setShowDurationDropdown(false)
                    }
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

                {showCharacterDropdown && characters.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl z-50 py-1">
                    {characters.map((char) => {
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
                          {isSelected && <span className="text-accent text-xs">✓</span>}
                        </button>
                      )
                    })}
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

            {/* Text input */}
            <div className="px-4 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your video scene..."
                rows={2}
                maxLength={2000}
                className="w-full bg-transparent text-foreground placeholder:text-foreground-secondary/50 text-sm resize-none focus:outline-none"
                disabled={isGenerating}
              />
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between px-4 pb-3">
              <span className="text-[10px] text-foreground-secondary">{input.length}/2000</span>
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
