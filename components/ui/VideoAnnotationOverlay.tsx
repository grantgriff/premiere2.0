'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Check, Square, MapPin } from 'lucide-react'

export interface VideoComment {
  id: string
  videoId: string
  userId: string
  timestamp: number // seconds with decimal precision
  text: string
  frameUrl?: string
  boundingBox?: {
    x: number // percentage (0-100)
    y: number // percentage (0-100)
    width: number // percentage (0-100)
    height: number // percentage (0-100)
  }
  createdAt: Date
}

interface VideoAnnotationOverlayProps {
  videoId: string
  videoRef: React.RefObject<HTMLVideoElement | null>
  comments: VideoComment[]
  onAddComment: (comment: Omit<VideoComment, 'id' | 'createdAt'>) => void
  onDeleteComment: (commentId: string) => void
  currentTime: number
  isPlaying: boolean
  onPause: () => void
  isActive?: boolean // Whether annotation mode is active (allows creating new comments)
}

export function VideoAnnotationOverlay({
  videoId,
  videoRef,
  comments,
  onAddComment,
  onDeleteComment,
  currentTime,
  isPlaying,
  onPause,
  isActive = true,
}: VideoAnnotationOverlayProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)
  const [boundingBox, setBoundingBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isDrawingBox, setIsDrawingBox] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Start drawing bounding box OR click to create comment
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCreating) return // Already creating a comment

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // Pause video
    onPause()

    // Start potential box drag
    setDrawStart({ x, y })
    setClickPosition({ x, y })
  }

  // Update bounding box while dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawStart || !overlayRef.current) return

    const rect = overlayRef.current.getBoundingClientRect()
    const currentX = ((e.clientX - rect.left) / rect.width) * 100
    const currentY = ((e.clientY - rect.top) / rect.height) * 100

    // Calculate distance from start
    const deltaX = Math.abs(currentX - drawStart.x)
    const deltaY = Math.abs(currentY - drawStart.y)

    // If moved more than 2%, consider it a drag
    if (deltaX > 2 || deltaY > 2) {
      setIsDrawingBox(true)

      const width = currentX - drawStart.x
      const height = currentY - drawStart.y

      setBoundingBox({
        x: width < 0 ? currentX : drawStart.x,
        y: height < 0 ? currentY : drawStart.y,
        width: Math.abs(width),
        height: Math.abs(height),
      })
    }
  }

  // Finish drawing - show comment input
  const handleMouseUp = () => {
    if (!drawStart) return

    // If we were drawing a box or just clicked, show the comment input
    setIsCreating(true)
    setDrawStart(null)
    setIsDrawingBox(false)
  }

  // Save comment
  const handleSaveComment = async () => {
    if (!commentText.trim()) return

    // Capture current frame
    const frameUrl = await captureFrame()

    onAddComment({
      videoId,
      userId: '', // Will be filled by API
      timestamp: currentTime,
      text: commentText,
      frameUrl,
      boundingBox: boundingBox || undefined,
    })

    // Reset state
    setIsCreating(false)
    setCommentText('')
    setClickPosition(null)
    setBoundingBox(null)
  }

  // Cancel comment creation
  const handleCancelComment = () => {
    setIsCreating(false)
    setCommentText('')
    setClickPosition(null)
    setBoundingBox(null)
    setIsDrawingBox(false)
    setDrawStart(null)
  }

  // Capture current video frame
  const captureFrame = async (): Promise<string | undefined> => {
    if (!videoRef.current) return undefined

    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return undefined

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob and return URL
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
      })

      if (!blob) return undefined

      // TODO: Upload to storage and return URL
      // For now, return data URL
      return canvas.toDataURL('image/jpeg', 0.8)
    } catch (error) {
      console.error('Failed to capture frame:', error)
      return undefined
    }
  }

  // Format timestamp
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 z-50 overflow-visible ${isActive ? 'cursor-crosshair' : ''}`}
      onMouseDown={isActive && !isCreating ? handleMouseDown : undefined}
      onMouseMove={isActive ? handleMouseMove : undefined}
      onMouseUp={isActive ? handleMouseUp : undefined}
      style={{ pointerEvents: isActive ? 'auto' : 'none' }}
    >
      {/* Existing Comments */}
      {comments.map((comment) => {
        // Use bounding box position if available, otherwise use 0,0
        const boxX = comment.boundingBox?.x || 0
        const boxY = comment.boundingBox?.y || 0

        return (
          <div
            key={comment.id}
            className="absolute pointer-events-none"
            style={{
              left: `${boxX}%`,
              top: `${boxY}%`,
            }}
          >
            {/* Bounding Box */}
            {comment.boundingBox && (
              <div
                className="absolute border-2 border-yellow-400 bg-yellow-400/10"
                style={{
                  width: `${comment.boundingBox.width}%`,
                  height: `${comment.boundingBox.height}%`,
                  left: 0,
                  top: 0,
                }}
              />
            )}

            {/* Comment Marker - Sleek teardrop pin, always visible */}
            <div
              className="absolute -translate-x-1/2 -translate-y-full cursor-pointer hover:scale-110 transition-transform group pointer-events-auto"
              style={{ top: 0, left: 0 }}
              title={`${formatTime(comment.timestamp)}: ${comment.text}`}
            >
            {/* Teardrop pin design */}
            <div className="relative">
              <MapPin className="w-8 h-8 text-yellow-400 drop-shadow-[0_2px_8px_rgba(250,204,21,0.5)] fill-yellow-400/90 stroke-yellow-600 stroke-[1.5]" />
              {/* Pulse effect to make it more visible */}
              <div className="absolute inset-0 -z-10">
                <MapPin className="w-8 h-8 text-yellow-400/40 animate-ping" style={{ animationDuration: '2s' }} />
              </div>
            </div>

            {/* Comment Tooltip on Hover */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 bg-black/90 text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              <div className="font-semibold mb-1">{formatTime(comment.timestamp)}</div>
              <div>{comment.text}</div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteComment(comment.id)
                }}
                className="absolute top-2 right-2 text-red-400 hover:text-red-300 pointer-events-auto"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            </div>
          </div>
        )
      })}

      {/* Active Bounding Box (while dragging or after creating) */}
      {boundingBox && (
        <div
          className="absolute border-2 border-blue-400 bg-blue-400/10 pointer-events-none"
          style={{
            left: `${boundingBox.x}%`,
            top: `${boundingBox.y}%`,
            width: `${boundingBox.width}%`,
            height: `${boundingBox.height}%`,
          }}
        />
      )}

      {/* Comment Input Dialog */}
      {isCreating && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-black/95 border border-[#3a3a3a] rounded-lg shadow-2xl p-4 z-[100]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground-secondary">
              @ {formatTime(currentTime)}
              {boundingBox && ' • Area selected'}
            </span>
            <button
              onClick={handleCancelComment}
              className="text-foreground-secondary hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <textarea
            autoFocus
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSaveComment()
              }
            }}
            placeholder="Add your feedback..."
            className="w-full h-20 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:border-accent resize-none"
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-foreground-secondary">
              {boundingBox ? '✓ Area captured' : 'Click saved'}
            </span>
            <button
              onClick={handleSaveComment}
              disabled={!commentText.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent/90 disabled:bg-accent/50 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {isActive && !isCreating && comments.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-lg">
          Click to add comment • Drag to highlight area
        </div>
      )}
    </div>
  )
}
