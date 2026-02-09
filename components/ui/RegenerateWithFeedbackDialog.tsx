'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, RefreshCw, Sparkles, Clock, MessageSquare } from 'lucide-react'
import { VideoComment } from './VideoAnnotationOverlay'
import { Video } from '@/lib/store'

interface RegenerateWithFeedbackDialogProps {
  isOpen: boolean
  onClose: () => void
  video: Video
  comments: VideoComment[]
  onRegenerate: (refinedPrompt: string, referenceFrameUrl?: string) => void
}

export function RegenerateWithFeedbackDialog({
  isOpen,
  onClose,
  video,
  comments,
  onRegenerate,
}: RegenerateWithFeedbackDialogProps) {
  const [isRefining, setIsRefining] = useState(false)
  const [refinedPrompt, setRefinedPrompt] = useState('')
  const [useFirstFrame, setUseFirstFrame] = useState(true)

  // Refine prompt with Gemini when dialog opens
  useEffect(() => {
    if (isOpen && comments.length > 0) {
      refinePromptWithGemini()
    }
  }, [isOpen])

  const refinePromptWithGemini = async () => {
    setIsRefining(true)
    try {
      const response = await fetch(`/api/videos/${video.id}/refine-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: video.prompt,
          comments: comments.map((c) => ({
            timestamp: c.timestamp,
            text: c.text,
            boundingBox: c.boundingBox,
          })),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setRefinedPrompt(data.refinedPrompt)
      } else {
        // Fallback if Gemini fails
        setRefinedPrompt(generateFallbackPrompt())
      }
    } catch (error) {
      console.error('Failed to refine prompt:', error)
      setRefinedPrompt(generateFallbackPrompt())
    } finally {
      setIsRefining(false)
    }
  }

  // Fallback prompt generation (simple concatenation)
  const generateFallbackPrompt = () => {
    const feedbackText = comments
      .map((c) => `At ${formatTime(c.timestamp)}: ${c.text}`)
      .join('. ')

    return `${video.prompt}\n\nFeedback to incorporate: ${feedbackText}`
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleRegenerate = () => {
    const firstFrameUrl = useFirstFrame && comments.length > 0 ? comments[0].frameUrl : undefined
    onRegenerate(refinedPrompt, firstFrameUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Regenerate with Feedback</h2>
              <p className="text-sm text-foreground-secondary">
                {comments.length} comment{comments.length !== 1 ? 's' : ''} • AI-refined prompt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-foreground-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Original Prompt */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Original Prompt</h3>
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
              <p className="text-sm text-foreground-secondary">{video.prompt}</p>
            </div>
          </div>

          {/* Comments Summary */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Feedback Points
            </h3>
            <div className="space-y-2">
              {comments.map((comment, index) => (
                <div
                  key={comment.id}
                  className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 flex items-start gap-3"
                >
                  <div className="flex items-center gap-2 text-xs text-foreground-secondary min-w-fit">
                    <Clock className="w-3 h-3" />
                    {formatTime(comment.timestamp)}
                  </div>
                  <p className="text-sm text-foreground flex-1">{comment.text}</p>
                  {comment.boundingBox && (
                    <div className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400">
                      Area highlighted
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Refined Prompt */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium text-foreground">AI-Refined Prompt</h3>
              {isRefining && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
            </div>

            {isRefining ? (
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 flex items-center justify-center min-h-[120px]">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-2" />
                  <p className="text-sm text-foreground-secondary">Gemini is refining your prompt...</p>
                </div>
              </div>
            ) : (
              <textarea
                value={refinedPrompt}
                onChange={(e) => setRefinedPrompt(e.target.value)}
                className="w-full h-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:border-accent resize-none"
                placeholder="Refined prompt will appear here..."
              />
            )}
          </div>

          {/* Reference Frame Option */}
          {comments.length > 0 && comments[0].frameUrl && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useFirstFrame}
                  onChange={(e) => setUseFirstFrame(e.target.checked)}
                  className="w-4 h-4 rounded border-[#3a3a3a] bg-[#0a0a0a] text-accent focus:ring-accent focus:ring-offset-0"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Use first frame as reference</p>
                  <p className="text-xs text-foreground-secondary">
                    Helps maintain visual consistency with the original video
                  </p>
                </div>
              </label>
              {useFirstFrame && comments[0].frameUrl && (
                <div className="mt-3 border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <img
                    src={comments[0].frameUrl}
                    alt="Reference frame"
                    className="w-full h-auto"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={refinePromptWithGemini}
              disabled={isRefining}
              className="px-4 py-2 text-sm border border-[#3a3a3a] hover:bg-[#2a2a2a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefining ? 'animate-spin' : ''}`} />
              Re-refine
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isRefining || !refinedPrompt}
              className="px-6 py-2 bg-accent hover:bg-accent/90 disabled:bg-accent/50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Regenerate Video
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
