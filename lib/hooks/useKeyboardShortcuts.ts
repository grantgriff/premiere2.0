'use client'

import { useEffect, useCallback } from 'react'

interface ShortcutHandler {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        const metaMatch = shortcut.meta ? event.metaKey : true // Don't check meta if not specified

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault()
          shortcut.handler()
          break
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Common shortcut presets
export const commonShortcuts = {
  newConversation: { key: 'n', ctrl: true, description: 'New conversation' },
  search: { key: 'k', ctrl: true, description: 'Search' },
  settings: { key: ',', ctrl: true, description: 'Settings' },
  toggleSidebar: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
  focusInput: { key: '/', description: 'Focus input' },
  escape: { key: 'Escape', description: 'Close modal / Cancel' },
}
