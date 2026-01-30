'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Scissors, Plus, Trash2, RotateCcw, GripVertical } from 'lucide-react'

export interface Segment {
  id: string
  startTime: number
  endTime: number
  label?: string
  color?: string
}

interface VideoTimelineProps {
  duration: number
  currentTime: number
  segments: Segment[]
  onSeek: (time: number) => void
  onSegmentSelect: (segment: Segment | null) => void
  onSegmentUpdate: (segmentId: string, updates: Partial<Segment>) => void
  onSegmentDelete: (segmentId: string) => void
  onSegmentAdd: (startTime: number, endTime: number) => void
  onSplit: (time: number) => void
  selectedSegmentId: string | null
  disabled?: boolean
}

const SEGMENT_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
]

export function VideoTimeline({
  duration,
  currentTime,
  segments,
  onSeek,
  onSegmentSelect,
  onSegmentUpdate,
  onSegmentDelete,
  onSegmentAdd,
  onSplit,
  selectedSegmentId,
  disabled = false,
}: VideoTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState<'seek' | 'segment-start' | 'segment-end' | null>(null)
  const [dragSegmentId, setDragSegmentId] = useState<string | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)

  // Convert time to percentage position
  const timeToPercent = (time: number) => (time / duration) * 100

  // Convert percentage to time
  const percentToTime = (percent: number) => (percent / 100) * duration

  // Get mouse position as time
  const getTimeFromMouseEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!timelineRef.current) return 0
    const rect = timelineRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const percent = (x / rect.width) * 100
    return percentToTime(percent)
  }, [duration])

  // Handle mouse move for dragging
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromMouseEvent(e)

      if (dragType === 'seek') {
        onSeek(time)
      } else if (dragType === 'segment-start' && dragSegmentId) {
        const segment = segments.find(s => s.id === dragSegmentId)
        if (segment && time < segment.endTime - 0.1) {
          onSegmentUpdate(dragSegmentId, { startTime: Math.max(0, time) })
        }
      } else if (dragType === 'segment-end' && dragSegmentId) {
        const segment = segments.find(s => s.id === dragSegmentId)
        if (segment && time > segment.startTime + 0.1) {
          onSegmentUpdate(dragSegmentId, { endTime: Math.min(duration, time) })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setDragType(null)
      setDragSegmentId(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragType, dragSegmentId, segments, duration, getTimeFromMouseEvent, onSeek, onSegmentUpdate])

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (disabled) return
    const time = getTimeFromMouseEvent(e)
    onSeek(time)
  }

  // Handle timeline mouse down for seeking
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    e.preventDefault()
    setIsDragging(true)
    setDragType('seek')
    const time = getTimeFromMouseEvent(e)
    onSeek(time)
  }

  // Handle segment edge drag
  const handleSegmentEdgeDrag = (e: React.MouseEvent, segmentId: string, edge: 'start' | 'end') => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragType(edge === 'start' ? 'segment-start' : 'segment-end')
    setDragSegmentId(segmentId)
  }

  // Handle mouse move for hover time
  const handleMouseMove = (e: React.MouseEvent) => {
    const time = getTimeFromMouseEvent(e)
    setHoverTime(time)
  }

  // Format time display
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    const ms = Math.floor((time % 1) * 10)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
  }

  return (
    <div className="space-y-2">
      {/* Timeline container */}
      <div
        ref={timelineRef}
        className={`relative h-16 bg-background-secondary rounded-lg overflow-hidden ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'}`}
        onClick={handleTimelineClick}
        onMouseDown={handleTimelineMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverTime(null)}
      >
        {/* Time markers */}
        <div className="absolute inset-x-0 top-0 h-4 flex items-end px-1">
          {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-[10px] text-foreground-secondary"
              style={{ left: `${timeToPercent(i)}%`, transform: 'translateX(-50%)' }}
            >
              {i}s
            </div>
          ))}
        </div>

        {/* Segments layer */}
        <div className="absolute inset-x-0 top-5 bottom-1">
          {segments.map((segment, index) => (
            <div
              key={segment.id}
              className={`absolute top-0 bottom-0 rounded ${segment.color || SEGMENT_COLORS[index % SEGMENT_COLORS.length]} ${
                selectedSegmentId === segment.id ? 'ring-2 ring-white ring-opacity-80' : ''
              } cursor-pointer transition-all hover:brightness-110`}
              style={{
                left: `${timeToPercent(segment.startTime)}%`,
                width: `${timeToPercent(segment.endTime - segment.startTime)}%`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSegmentSelect(selectedSegmentId === segment.id ? null : segment)
              }}
            >
              {/* Segment label */}
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <span className="text-xs text-white font-medium truncate px-1">
                  {segment.label || `Segment ${index + 1}`}
                </span>
              </div>

              {/* Resize handles */}
              {!disabled && (
                <>
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 flex items-center justify-center"
                    onMouseDown={(e) => handleSegmentEdgeDrag(e, segment.id, 'start')}
                  >
                    <GripVertical className="w-3 h-3 text-white/60" />
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 flex items-center justify-center"
                    onMouseDown={(e) => handleSegmentEdgeDrag(e, segment.id, 'end')}
                  >
                    <GripVertical className="w-3 h-3 text-white/60" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent z-10 pointer-events-none"
          style={{ left: `${timeToPercent(currentTime)}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-full" />
        </div>

        {/* Hover indicator */}
        {hoverTime !== null && !isDragging && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
            style={{ left: `${timeToPercent(hoverTime)}%` }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-background px-1.5 py-0.5 rounded text-[10px] text-foreground whitespace-nowrap">
              {formatTime(hoverTime)}
            </div>
          </div>
        )}
      </div>

      {/* Timeline controls */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-foreground-secondary">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onSplit(currentTime)}
            disabled={disabled || segments.length === 0}
            className="btn-ghost p-1.5 text-xs flex items-center gap-1 disabled:opacity-50"
            title="Split at playhead"
          >
            <Scissors className="w-3.5 h-3.5" />
            Split
          </button>
          <button
            onClick={() => onSegmentAdd(currentTime, Math.min(currentTime + 1, duration))}
            disabled={disabled}
            className="btn-ghost p-1.5 text-xs flex items-center gap-1 disabled:opacity-50"
            title="Add segment"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          {selectedSegmentId && (
            <button
              onClick={() => onSegmentDelete(selectedSegmentId)}
              disabled={disabled}
              className="btn-ghost p-1.5 text-xs flex items-center gap-1 text-red-400 hover:text-red-300 disabled:opacity-50"
              title="Delete segment"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
