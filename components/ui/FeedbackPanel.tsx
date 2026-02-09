'use client'

import { Clock, Trash2, MessageSquare, Sparkles, Loader2 } from 'lucide-react'
import { VideoComment } from './VideoAnnotationOverlay'

interface FeedbackPanelProps {
  comments: VideoComment[]
  onCommentClick: (timestamp: number) => void
  onDeleteComment: (commentId: string) => void
  onRegenerateWithFeedback: () => void
  isRefining: boolean
}

export function FeedbackPanel({
  comments,
  onCommentClick,
  onDeleteComment,
  onRegenerateWithFeedback,
  isRefining,
}: FeedbackPanelProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-80 h-full flex flex-col bg-[#171717] border-l border-[#2a2a2a]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          User Feedback
          {comments.length > 0 && (
            <span className="ml-auto text-xs bg-accent text-white px-2 py-0.5 rounded-full">
              {comments.length}
            </span>
          )}
        </h3>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="w-10 h-10 text-foreground-secondary mb-3 opacity-50" />
            <p className="text-sm text-foreground-secondary">
              No feedback yet
            </p>
            <p className="text-xs text-foreground-secondary mt-1 opacity-70">
              Click on the video to add feedback
            </p>
          </div>
        ) : (
          comments
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((comment) => (
              <div
                key={comment.id}
                className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 hover:border-[#3a3a3a] transition-colors group cursor-pointer"
                onClick={() => onCommentClick(comment.timestamp)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-accent">
                    <Clock className="w-3 h-3" />
                    {formatTime(comment.timestamp)}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteComment(comment.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>

                <p className="text-sm text-foreground">{comment.text}</p>

                {comment.boundingBox && (
                  <div className="mt-2 text-xs text-foreground-secondary flex items-center gap-1">
                    <div className="w-3 h-3 border border-blue-400 rounded-sm" />
                    Area highlighted
                  </div>
                )}

                <div className="mt-2 text-xs text-foreground-secondary">
                  Added {new Date(comment.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Regenerate Button */}
      {comments.length > 0 && (
        <div className="p-4 border-t border-[#2a2a2a]">
          <button
            onClick={onRegenerateWithFeedback}
            disabled={isRefining}
            className="w-full px-4 py-3 bg-accent hover:bg-accent/90 disabled:bg-accent/50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {isRefining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Refining prompt...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Regenerate with Feedback
              </>
            )}
          </button>
          <p className="text-xs text-foreground-secondary text-center mt-2">
            AI will refine your feedback into an improved prompt
          </p>
        </div>
      )}
    </div>
  )
}
