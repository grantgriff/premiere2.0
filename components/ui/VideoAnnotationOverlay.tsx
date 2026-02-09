'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Check, Square } from 'lucide-react'

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
  videoRef: React.RefObject<HTMLVideoElement>
  comments: VideoComment[]
  onAddComment: (comment: Omit<VideoComment, 'id' | 'createdAt'>) => void
  onDeleteComment: (commentId: string) => void
  currentTime: number
  isPlaying: boolean
  onPause: () => void
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
}: VideoAnnotationOverlayProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentPosition, setCommentPosition] = useState<{ x: number; y: number } | null>(null)
  const [boundingBox, setBoundingBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isDrawingBox, setIsDrawingBox] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Handle click on video to create comment
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isCreating || isDrawingBox) return // Don't create new comment if already creating one

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    // Pause video
    onPause()

    // Start creating comment at this position
    setCommentPosition({ x, y })
    setIsCreating(true)
    setBoundingBox(null)
  }

  // Start drawing bounding box
  const handleStartDrawBox = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!overlayRef.current) return

    const rect = overlayRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setDrawStart({ x, y })
    setIsDrawingBox(true)
  }

  // Update bounding box while dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingBox || !drawStart || !overlayRef.current) return

    const rect = overlayRef.current.getBoundingClientRect()
    const currentX = ((e.clientX - rect.left) / rect.width) * 100
    const currentY = ((e.clientY - rect.top) / rect.height) * 100

    const width = currentX - drawStart.x
    const height = currentY - drawStart.y

    setBoundingBox({
      x: width < 0 ? currentX : drawStart.x,
      y: height < 0 ? currentY : drawStart.y,
      width: Math.abs(width),
      height: Math.abs(height),
    })
  }

  // Finish drawing bounding box
  const handleMouseUp = () => {
    if (isDrawingBox) {
      setIsDrawingBox(false)
      setDrawStart(null)
    }
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
    setCommentPosition(null)
    setBoundingBox(null)
  }

  // Cancel comment creation
  const handleCancelComment = () => {
    setIsCreating(false)
    setCommentText('')
    setCommentPosition(null)
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
      className="absolute inset-0 z-30 cursor-crosshair"
      onClick={!isCreating ? handleOverlayClick : undefined}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Existing Comments */}
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="absolute"
          style={{
            left: `${comment.boundingBox?.x || 0}%`,
            top: `${comment.boundingBox?.y || 0}%`,
          }}
        >
          {/* Bounding Box */}
          {comment.boundingBox && (
            <div
              className="absolute border-2 border-yellow-400 bg-yellow-400/10 pointer-events-none"
              style={{
                width: `${comment.boundingBox.width}%`,
                height: `${comment.boundingBox.height}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}

          {/* Comment Marker */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform group"
            title={`${formatTime(comment.timestamp)}: ${comment.text}`}
          >
            <MessageSquare className="w-4 h-4 text-black" />

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
      ))}

      {/* New Comment Creation */}
      {isCreating && commentPosition && (
        <div
          className="absolute z-40"
          style={{
            left: `${commentPosition.x}%`,
            top: `${commentPosition.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Current Bounding Box */}
          {boundingBox && (
            <div
              className="absolute border-2 border-blue-400 bg-blue-400/10"
              style={{
                left: `${boundingBox.x - commentPosition.x}%`,
                top: `${boundingBox.y - commentPosition.y}%`,
                width: `${boundingBox.width}%`,
                height: `${boundingBox.height}%`,
              }}
            />
          )}

          {/* Comment Input Card */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 bg-black/95 border border-[#3a3a3a] rounded-lg shadow-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground-secondary">
                @ {formatTime(currentTime)}
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
              placeholder="Add your feedback..."
              className="w-full h-20 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:border-accent resize-none"
            />

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleStartDrawBox}
                onMouseDown={handleStartDrawBox}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  boundingBox
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'border-[#3a3a3a] text-foreground-secondary hover:border-[#4a4a4a]'
                } flex items-center justify-center gap-2`}
              >
                <Square className="w-4 h-4" />
                {boundingBox ? 'Box Added' : 'Add Box'}
              </button>
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

          {/* Center Marker */}
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isCreating && comments.length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-lg">
          Click anywhere on the video to add a comment
        </div>
      )}
    </div>
  )
}
