'use client'

import { useState } from 'react'
import {
  Wand2,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Clock,
  Scissors,
  Film,
  X
} from 'lucide-react'
import { VideoTimeline, Segment } from './VideoTimeline'
import { Video, VideoModel } from '@/lib/store'
import { generateId } from '@/lib/utils'

interface EditingPanelProps {
  video: Video
  currentTime: number
  onSeek: (time: number) => void
  onExtend: (fromTime: number, prompt: string, duration: number) => void
  onRemix: (segment: Segment, prompt: string) => void
  onTrim: (startTime: number, endTime: number) => void
  onClose: () => void
  isProcessing: boolean
}

type EditMode = 'timeline' | 'extend' | 'remix' | 'trim'

export function EditingPanel({
  video,
  currentTime,
  onSeek,
  onExtend,
  onRemix,
  onTrim,
  onClose,
  isProcessing,
}: EditingPanelProps) {
  const [editMode, setEditMode] = useState<EditMode>('timeline')
  const [segments, setSegments] = useState<Segment[]>([
    {
      id: generateId(),
      startTime: 0,
      endTime: video.duration,
      label: 'Full Video',
      color: 'bg-blue-500',
    },
  ])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [extendPrompt, setExtendPrompt] = useState('')
  const [extendDuration, setExtendDuration] = useState(5)
  const [remixPrompt, setRemixPrompt] = useState('')
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(video.duration)

  const selectedSegment = segments.find(s => s.id === selectedSegmentId)

  // Segment management
  const handleSegmentSelect = (segment: Segment | null) => {
    setSelectedSegmentId(segment?.id || null)
    if (segment) {
      setTrimStart(segment.startTime)
      setTrimEnd(segment.endTime)
    }
  }

  const handleSegmentUpdate = (segmentId: string, updates: Partial<Segment>) => {
    setSegments(prev => prev.map(s =>
      s.id === segmentId ? { ...s, ...updates } : s
    ))
  }

  const handleSegmentDelete = (segmentId: string) => {
    setSegments(prev => prev.filter(s => s.id !== segmentId))
    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId(null)
    }
  }

  const handleSegmentAdd = (startTime: number, endTime: number) => {
    const newSegment: Segment = {
      id: generateId(),
      startTime,
      endTime,
      label: `Segment ${segments.length + 1}`,
    }
    setSegments(prev => [...prev, newSegment])
    setSelectedSegmentId(newSegment.id)
  }

  const handleSplit = (time: number) => {
    // Find segment containing this time
    const segmentToSplit = segments.find(s => time > s.startTime && time < s.endTime)
    if (!segmentToSplit) return

    const index = segments.indexOf(segmentToSplit)
    const newSegments = [...segments]

    // Update original segment to end at split point
    newSegments[index] = { ...segmentToSplit, endTime: time }

    // Insert new segment starting at split point
    const newSegment: Segment = {
      id: generateId(),
      startTime: time,
      endTime: segmentToSplit.endTime,
      label: `Segment ${segments.length + 1}`,
    }
    newSegments.splice(index + 1, 0, newSegment)

    setSegments(newSegments)
  }

  const handleExtendSubmit = () => {
    if (!extendPrompt.trim()) return
    onExtend(video.duration, extendPrompt, extendDuration)
    setExtendPrompt('')
  }

  const handleRemixSubmit = () => {
    if (!remixPrompt.trim() || !selectedSegment) return
    onRemix(selectedSegment, remixPrompt)
    setRemixPrompt('')
  }

  const handleTrimSubmit = () => {
    onTrim(trimStart, trimEnd)
  }

  return (
    <div className="bg-background-secondary rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Film className="w-4 h-4" />
          Video Editor
        </h3>
        <button onClick={onClose} className="btn-ghost p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-border">
        {[
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'extend', label: 'Extend', icon: ArrowRight },
          { id: 'remix', label: 'Remix', icon: Sparkles },
          { id: 'trim', label: 'Trim', icon: Scissors },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setEditMode(id as EditMode)}
            className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-1.5 transition-colors ${
              editMode === id
                ? 'bg-accent/10 text-accent border-b-2 border-accent'
                : 'text-foreground-secondary hover:text-foreground hover:bg-background'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Timeline always visible */}
        <VideoTimeline
          duration={video.duration}
          currentTime={currentTime}
          segments={segments}
          onSeek={onSeek}
          onSegmentSelect={handleSegmentSelect}
          onSegmentUpdate={handleSegmentUpdate}
          onSegmentDelete={handleSegmentDelete}
          onSegmentAdd={handleSegmentAdd}
          onSplit={handleSplit}
          selectedSegmentId={selectedSegmentId}
          disabled={isProcessing}
        />

        {/* Mode-specific controls */}
        {editMode === 'extend' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm text-foreground-secondary">
              Continue the video from the end with a new prompt
            </p>
            <textarea
              value={extendPrompt}
              onChange={(e) => setExtendPrompt(e.target.value)}
              placeholder="Describe what happens next..."
              className="input-field w-full resize-none"
              rows={2}
              disabled={isProcessing}
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-foreground-secondary">Duration:</label>
              <div className="flex gap-1">
                {[3, 5, 10].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExtendDuration(d)}
                    className={`px-2 py-1 text-xs rounded ${
                      extendDuration === d
                        ? 'bg-accent text-white'
                        : 'bg-background text-foreground-secondary hover:text-foreground'
                    }`}
                    disabled={isProcessing}
                  >
                    {d}s
                  </button>
                ))}
              </div>
              <button
                onClick={handleExtendSubmit}
                disabled={!extendPrompt.trim() || isProcessing}
                className="btn-primary ml-auto flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Extend Video
              </button>
            </div>
          </div>
        )}

        {editMode === 'remix' && (
          <div className="space-y-3 pt-2 border-t border-border">
            {selectedSegment ? (
              <>
                <p className="text-sm text-foreground-secondary">
                  Regenerate the selected segment ({selectedSegment.startTime.toFixed(1)}s - {selectedSegment.endTime.toFixed(1)}s) with a new prompt
                </p>
                <textarea
                  value={remixPrompt}
                  onChange={(e) => setRemixPrompt(e.target.value)}
                  placeholder="Describe the new content for this segment..."
                  className="input-field w-full resize-none"
                  rows={2}
                  disabled={isProcessing}
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRemixSubmit}
                    disabled={!remixPrompt.trim() || isProcessing}
                    className="btn-primary ml-auto flex items-center gap-1.5 text-sm disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Remix Segment
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground-secondary text-center py-4">
                Select a segment on the timeline to remix it
              </p>
            )}
          </div>
        )}

        {editMode === 'trim' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm text-foreground-secondary">
              Adjust start and end points to trim the video
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-foreground-secondary mb-1 block">Start Time</label>
                <input
                  type="number"
                  value={trimStart}
                  onChange={(e) => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                  step={0.1}
                  min={0}
                  max={trimEnd - 0.1}
                  className="input-field w-full text-sm"
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="text-xs text-foreground-secondary mb-1 block">End Time</label>
                <input
                  type="number"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.min(video.duration, parseFloat(e.target.value) || video.duration))}
                  step={0.1}
                  min={trimStart + 0.1}
                  max={video.duration}
                  className="input-field w-full text-sm"
                  disabled={isProcessing}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground-secondary">
                New duration: {(trimEnd - trimStart).toFixed(1)}s
              </span>
              <button
                onClick={handleTrimSubmit}
                disabled={isProcessing}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                <Scissors className="w-3.5 h-3.5" />
                Apply Trim
              </button>
            </div>
          </div>
        )}

        {editMode === 'timeline' && (
          <div className="text-sm text-foreground-secondary text-center py-2">
            Click on the timeline to seek. Drag segment edges to resize. Use the controls above to edit.
          </div>
        )}
      </div>
    </div>
  )
}
