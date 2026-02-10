'use client'

import { useState, useEffect, useRef } from 'react'
import { User, Check } from 'lucide-react'
import { useAppStore, Character } from '@/lib/store'

interface CharacterMentionProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
  onCharacterSelect?: (character: Character) => void
}

export function CharacterMention({
  inputRef,
  value,
  onChange,
  onCharacterSelect,
}: CharacterMentionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const characters = useAppStore((state) => state.characters)
  const selectedCharacterIds = useAppStore((state) => state.selectedCharacterIds)

  // Filter characters based on search
  const filteredCharacters = characters.filter(
    (c) =>
      c.embeddingStatus === 'ready' &&
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Detect @ trigger
  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    const handleInput = () => {
      const cursorPos = textarea.selectionStart
      const textBeforeCursor = value.substring(0, cursorPos)

      // Find the last @ that starts a mention
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)

        // Check if this @ is the start of a mention (not preceded by a word character)
        const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
        const isValidMention = /\s|^/.test(charBeforeAt) && !/\s/.test(textAfterAt)

        if (isValidMention) {
          setSearchQuery(textAfterAt)
          setIsOpen(true)
          setSelectedIndex(0)

          // Calculate position
          const rect = textarea.getBoundingClientRect()
          const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
          const lines = textBeforeCursor.split('\n')
          const currentLine = lines.length - 1

          setMenuPosition({
            top: rect.top + (currentLine + 1) * lineHeight + 4,
            left: rect.left + 12,
          })
          return
        }
      }

      setIsOpen(false)
      setSearchQuery('')
    }

    handleInput()
  }, [value, inputRef])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredCharacters.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
        case 'Tab':
          if (filteredCharacters[selectedIndex]) {
            e.preventDefault()
            insertMention(filteredCharacters[selectedIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredCharacters])

  // Insert mention
  const insertMention = (character: Character) => {
    const textarea = inputRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBeforeCursor = value.substring(0, cursorPos)
    const textAfterCursor = value.substring(cursorPos)

    // Find the @ position
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    const newText =
      textBeforeCursor.substring(0, lastAtIndex) +
      `@${character.name} ` +
      textAfterCursor

    onChange(newText)
    setIsOpen(false)
    setSearchQuery('')

    if (onCharacterSelect) {
      onCharacterSelect(character)
    }

    // Focus and set cursor position
    setTimeout(() => {
      const newCursorPos = lastAtIndex + character.name.length + 2
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen || filteredCharacters.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-background border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-w-[280px] max-h-[200px] overflow-y-auto"
      style={{ top: menuPosition.top, left: menuPosition.left }}
    >
      <div className="px-3 py-1.5 text-xs text-foreground-secondary border-b border-border">
        Characters
      </div>
      {filteredCharacters.map((character, index) => (
        <button
          key={character.id}
          onClick={() => insertMention(character)}
          className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
            index === selectedIndex
              ? 'bg-accent/10 text-foreground'
              : 'text-foreground-secondary hover:bg-background-secondary hover:text-foreground'
          }`}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full overflow-hidden bg-background-secondary flex-shrink-0">
            {character.thumbnailUrl ? (
              <img
                src={character.thumbnailUrl}
                alt={character.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-4 h-4 text-foreground-secondary" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{character.name}</p>
            <p className="text-xs text-foreground-secondary truncate">
              {character.description}
            </p>
          </div>

          {/* Selected indicator */}
          {selectedCharacterIds.includes(character.id) && (
            <Check className="w-4 h-4 text-accent flex-shrink-0" />
          )}
        </button>
      ))}
    </div>
  )
}

// Helper to extract character names from prompt
export function extractCharacterMentions(text: string): string[] {
  const mentions = text.match(/@(\w+)/g)
  if (!mentions) return []
  return mentions.map((m) => m.substring(1))
}

// Helper to highlight mentions in text
export function highlightMentions(text: string, characters: Character[]): React.ReactNode {
  const characterNames = characters.map((c) => c.name.toLowerCase())
  const parts = text.split(/(@\w+)/g)

  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.substring(1).toLowerCase()
      if (characterNames.includes(name)) {
        return (
          <span key={i} className="text-accent font-medium">
            {part}
          </span>
        )
      }
    }
    return part
  })
}
