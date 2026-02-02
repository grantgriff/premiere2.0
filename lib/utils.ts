import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format duration from seconds to MM:SS
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString()
}

// Generate a unique ID
export function generateId(): string {
  return crypto.randomUUID()
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

// Parse @character mentions from prompt
export function parseCharacterMentions(prompt: string): string[] {
  const regex = /@(\w+)/g
  const matches = prompt.match(regex)
  return matches ? matches.map((m) => m.slice(1)) : []
}

// Validate video duration (accepts any duration allowed by any model)
export function isValidDuration(duration: number): boolean {
  // All possible durations across all video models:
  // Veo: 4, 6, 8  |  Runway: 4, 6, 8, 10  |  Luma: 5, 9, 10  |  Sora: 4, 8, 12
  return [4, 5, 6, 8, 9, 10, 12].includes(duration)
}

// Get quality badge color based on score
export function getQualityLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 8) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

// Extract hex colors from an array
export function extractColorPalette(colors: string[]): string[] {
  return colors.filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 6)
}

// Delay utility for async operations
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Exponential backoff for retries
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 4,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt)
        await delay(delayMs)
      }
    }
  }

  throw lastError
}

// File size formatter
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Validate file type for uploads
export function isValidMediaType(
  mimeType: string,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']
): boolean {
  return allowedTypes.includes(mimeType)
}

// Max file size (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024
