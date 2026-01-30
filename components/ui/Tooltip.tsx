'use client'

import { useState, useRef, ReactNode } from 'react'

interface TooltipProps {
  content: string | ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-background-secondary',
    bottom:
      'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-background-secondary',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-background-secondary',
    right:
      'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-background-secondary',
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={`
            absolute z-50 px-2.5 py-1.5 rounded-lg
            bg-background-secondary text-foreground text-xs
            shadow-lg border border-border
            whitespace-nowrap pointer-events-none
            animate-in fade-in duration-150
            ${positionClasses[position]}
          `}
          role="tooltip"
        >
          {content}
          <div
            className={`
              absolute w-0 h-0 border-4
              ${arrowClasses[position]}
            `}
          />
        </div>
      )}
    </div>
  )
}

// Keyboard shortcut tooltip helper
export function ShortcutTooltip({
  children,
  shortcut,
  description,
}: {
  children: ReactNode
  shortcut: string
  description?: string
}) {
  return (
    <Tooltip
      content={
        <div className="flex items-center gap-2">
          {description && <span>{description}</span>}
          <kbd className="px-1.5 py-0.5 rounded bg-background text-[10px] font-mono">
            {shortcut}
          </kbd>
        </div>
      }
    >
      {children}
    </Tooltip>
  )
}
