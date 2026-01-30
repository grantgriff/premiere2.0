'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline'
type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
  icon?: ReactNode
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-foreground-secondary/20 text-foreground-secondary',
  success: 'bg-green-500/20 text-green-500',
  warning: 'bg-yellow-500/20 text-yellow-500',
  error: 'bg-red-500/20 text-red-500',
  info: 'bg-blue-500/20 text-blue-500',
  outline: 'bg-transparent border border-border text-foreground-secondary',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-foreground-secondary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  outline: 'bg-foreground-secondary',
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
  icon,
  dot,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotColors[variant]
          )}
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  )
}

// Status badge presets
export function StatusBadge({
  status,
}: {
  status: 'online' | 'offline' | 'busy' | 'away'
}) {
  const config = {
    online: { label: 'Online', variant: 'success' as const },
    offline: { label: 'Offline', variant: 'default' as const },
    busy: { label: 'Busy', variant: 'error' as const },
    away: { label: 'Away', variant: 'warning' as const },
  }

  const { label, variant } = config[status]

  return (
    <Badge variant={variant} size="sm" dot>
      {label}
    </Badge>
  )
}

// Model badge
export function ModelBadge({ model }: { model: string }) {
  const modelColors: Record<string, BadgeVariant> = {
    veo3_1: 'info',
    runway: 'success',
    luma: 'warning',
    sora: 'error',
    odyssey: 'default',
    world_labs: 'info',
  }

  return (
    <Badge variant={modelColors[model] || 'default'} size="sm">
      {model}
    </Badge>
  )
}
