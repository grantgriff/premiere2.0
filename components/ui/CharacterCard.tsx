'use client'

import { useState, useRef, useEffect } from 'react'
import {
  User,
  Check,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Clock,
} from 'lucide-react'
import { Character } from '@/lib/store'

interface CharacterCardProps {
  character: Character
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
}

export function CharacterCard({
  character,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  compact = false,
}: CharacterCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
  }, [showMenu])

  // Check if this is an auto-capture character (pending with no image)
  const isAwaitingCapture =
    character.embeddingStatus === 'pending' &&
    !character.referenceImageUrl &&
    !character.thumbnailUrl

  const statusIcon = {
    pending: isAwaitingCapture
      ? <Zap className="w-3 h-3 text-purple-400" />
      : <Clock className="w-3 h-3 text-yellow-400" />,
    processing: <Loader2 className="w-3 h-3 animate-spin text-blue-400" />,
    ready: <CheckCircle2 className="w-3 h-3 text-green-400" />,
    failed: <AlertCircle className="w-3 h-3 text-red-400" />,
  }

  const statusText = {
    pending: isAwaitingCapture ? 'Awaiting capture' : 'Pending',
    processing: 'Processing...',
    ready: 'Ready',
    failed: 'Failed',
  }

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          isSelected
            ? 'bg-accent/20 ring-1 ring-accent'
            : 'bg-background-secondary hover:bg-background-secondary/80'
        }`}
      >
        {/* Avatar */}
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-background flex-shrink-0">
          {character.thumbnailUrl || character.referenceImageUrl ? (
            <img
              src={character.thumbnailUrl || character.referenceImageUrl || ''}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : isAwaitingCapture ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-accent/20">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-4 h-4 text-foreground-secondary" />
            </div>
          )}
          {isSelected && (
            <div className="absolute inset-0 bg-accent/40 flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        {/* Name */}
        <span className={`text-sm truncate ${isSelected ? 'text-foreground' : 'text-foreground-secondary'}`}>
          {character.name}
        </span>

        {/* Status indicator */}
        <div className="ml-auto">{statusIcon[character.embeddingStatus]}</div>
      </button>
    )
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all ${
        isSelected
          ? 'ring-2 ring-accent shadow-lg shadow-accent/20'
          : 'ring-1 ring-border hover:ring-foreground-secondary/30'
      }`}
    >
      {/* Image/Avatar area */}
      <button
        onClick={onSelect}
        className="w-full aspect-square bg-background-secondary relative group"
      >
        {character.thumbnailUrl || character.referenceImageUrl ? (
          <img
            src={character.thumbnailUrl || character.referenceImageUrl || ''}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : isAwaitingCapture ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-500/10 to-accent/10">
            <Zap className="w-10 h-10 text-purple-400 mb-2" />
            <span className="text-xs text-foreground-secondary">Auto-capture</span>
            <span className="text-[10px] text-foreground-secondary/60">Generate video to capture</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-12 h-12 text-foreground-secondary/50" />
          </div>
        )}

        {/* Selection overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <Check className="w-6 h-6 text-white" />
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      </button>

      {/* Info section */}
      <div className="p-3 bg-background">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-foreground truncate">{character.name}</h4>
            <p className="text-xs text-foreground-secondary truncate mt-0.5">
              {character.description}
            </p>
          </div>

          {/* Menu button */}
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-1 rounded hover:bg-background-secondary text-foreground-secondary hover:text-foreground"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          {statusIcon[character.embeddingStatus]}
          <span className="text-foreground-secondary">
            {statusText[character.embeddingStatus]}
          </span>
          {character.usageCount > 0 && (
            <span className="ml-auto text-foreground-secondary/60">
              Used {character.usageCount}x
            </span>
          )}
        </div>
      </div>

      {/* Dropdown menu - rendered outside card to avoid clipping */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div
            className="fixed z-50 bg-background border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
            style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onEdit()
              }}
              className="w-full px-3 py-2 text-left text-sm text-foreground-secondary hover:bg-background-secondary hover:text-foreground flex items-center gap-2"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
                onDelete()
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-background-secondary flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
