'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
}

export function LoadingSpinner({
  size = 'md',
  className,
  text,
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 className={cn('animate-spin text-accent', sizeClasses[size])} />
      {text && <p className="text-sm text-foreground-secondary">{text}</p>}
    </div>
  )
}

// Full page loading
export function PageLoading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <LoadingSpinner size="xl" text={text} />
    </div>
  )
}

// Inline loading for buttons
export function ButtonLoading({ className }: { className?: string }) {
  return <Loader2 className={cn('w-4 h-4 animate-spin', className)} />
}

// Overlay loading
export function LoadingOverlay({
  isLoading,
  text,
  children,
}: {
  isLoading: boolean
  text?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <LoadingSpinner text={text} />
        </div>
      )}
    </div>
  )
}
