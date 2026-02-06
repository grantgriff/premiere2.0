'use client'

import { useState } from 'react'
import { useAppStore, useActiveMovie } from '@/lib/store'
import { Plus, Play, X, Sparkles } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { GenerateNextClipDialog } from './GenerateNextClipDialog'

export function MovieTimeline() {
  const { user } = useAuth()
  const activeMovie = useActiveMovie()
  const removeClipFromMovie = useAppStore((state) => state.removeClipFromMovie)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)

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

  if (!activeMovie) {
    return null
  }

  return (
    <div className="h-40 border-t border-border bg-background-secondary flex items-center px-4 gap-4">
      {/* Timeline header */}
      <div className="flex flex-col items-center justify-center px-4 border-r border-border h-full">
        <div className="text-sm font-medium text-foreground mb-1">
          {activeMovie.title}
        </div>
        <div className="text-xs text-foreground-secondary">
          {activeMovie.clips.length} clip{activeMovie.clips.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Clips carousel */}
      <div className="flex-1 overflow-x-auto flex items-center gap-3 py-4">
        {activeMovie.clips.map((clip, index) => (
          <div
            key={clip.id}
            className="relative group flex-shrink-0 w-36 h-24 rounded-lg overflow-hidden bg-background border border-border hover:border-accent transition-colors"
          >
            {/* Clip thumbnail/preview */}
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/10 to-purple-500/10">
              <Play className="w-8 h-8 text-accent/50" />
            </div>

            {/* Clip number overlay */}
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white">
              {index + 1}
            </div>

            {/* Remove button */}
            <button
              onClick={() => handleRemoveClip(clip.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-500 text-white p-1 rounded"
            >
              <X className="w-3 h-3" />
            </button>

            {/* Connector line to next clip */}
            {index < activeMovie.clips.length - 1 && (
              <div className="absolute top-1/2 -right-3 w-3 h-0.5 bg-border" />
            )}
          </div>
        ))}

        {/* Generate Next Clip button */}
        {activeMovie.clips.length > 0 && activeMovie.clips[activeMovie.clips.length - 1].lastFrameUrl && (
          <button
            onClick={() => setShowGenerateDialog(true)}
            className="flex-shrink-0 w-36 h-24 rounded-lg border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-purple-500/10 hover:border-accent hover:from-accent/20 hover:to-purple-500/20 flex flex-col items-center justify-center gap-2 text-accent transition-all group"
          >
            <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Generate Next</span>
          </button>
        )}

        {/* Add existing clip button */}
        <button className="flex-shrink-0 w-36 h-24 rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center gap-2 text-foreground-secondary hover:text-accent transition-colors">
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
    </div>
  )
}
