'use client'

import { useState, useRef } from 'react'
import {
  Send,
  Image as ImageIcon,
  Video,
  Youtube,
  AtSign,
  Loader2,
} from 'lucide-react'

type VideoModel = 'veo3_1' | 'runway' | 'luma' | 'sora' | 'odyssey' | 'world_labs'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const MODELS: { id: VideoModel; name: string; speed: string }[] = [
  { id: 'veo3_1', name: 'Veo 3.1', speed: '45-60s' },
  { id: 'runway', name: 'Runway', speed: '30-45s' },
  { id: 'luma', name: 'Luma AI', speed: '5-10s' },
  { id: 'sora', name: 'Sora', speed: '30-60s' },
  { id: 'odyssey', name: 'Odyssey', speed: '20-40s' },
  { id: 'world_labs', name: 'World Labs', speed: '30-45s' },
]

const DURATIONS = [1, 3, 5, 10, 15, 30]

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState<VideoModel>('veo3_1')
  const [selectedDuration, setSelectedDuration] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isGenerating) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsGenerating(true)

    // Simulate generation - will be replaced with actual API call
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Generating ${selectedDuration}s video using ${
          MODELS.find((m) => m.id === selectedModel)?.name
        }...\n\nYour prompt: "${userMessage.content}"`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsGenerating(false)
    }, 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <aside className="w-[360px] h-full flex flex-col panel border-l border-border">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-foreground-secondary">
              <p className="mb-2">Start a conversation to generate video</p>
              <p className="text-sm">Describe what you want to create</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === 'user' ? 'message-user' : 'message-assistant'
              }
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
          <div className="message-assistant flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating video...</span>
          </div>
        )}
      </div>

      {/* Model Selector */}
      <div className="px-4 py-3 border-t border-border">
        <label className="text-xs text-foreground-secondary mb-2 block">
          Model
        </label>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`model-chip text-xs ${
                selectedModel === model.id ? 'model-chip-active' : ''
              }`}
              title={`Generation time: ${model.speed}`}
            >
              {model.name}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Selector */}
      <div className="px-4 py-3 border-t border-border">
        <label className="text-xs text-foreground-secondary mb-2 block">
          Duration
        </label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((duration) => (
            <button
              key={duration}
              onClick={() => setSelectedDuration(duration)}
              className={`duration-chip text-xs ${
                selectedDuration === duration ? 'duration-chip-active' : ''
              }`}
            >
              {duration}s
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your video..."
            rows={3}
            maxLength={2000}
            className="input-field w-full resize-none pr-12"
            disabled={isGenerating}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button
              type="button"
              className="btn-ghost p-1.5"
              title="Upload image"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="btn-ghost p-1.5"
              title="Upload video"
            >
              <Video className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="btn-ghost p-1.5"
              title="Search YouTube"
            >
              <Youtube className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="btn-ghost p-1.5"
              title="Tag character"
            >
              <AtSign className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-foreground-secondary">
            {input.length}/2000
          </span>
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
    </aside>
  )
}
