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
  X,
  Palette,
  Gauge,
  Sun,
  Moon,
  Thermometer,
  Contrast,
  SunDim,
  Loader2,
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

type EditMode = 'timeline' | 'extend' | 'remix' | 'trim' | 'color' | 'speed'

// Color adjustment slider component
function ColorSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled,
  icon,
  unit = '',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  icon?: React.ReactNode
  unit?: string
}) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground-secondary flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        <span className="text-xs font-mono text-foreground">
          {value > 0 ? '+' : ''}{value.toFixed(2)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-background-secondary
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-md disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, var(--accent) ${percentage}%, var(--background-secondary) ${percentage}%)`,
        }}
      />
    </div>
  )
}

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

  // Color grading state
  const [colorSettings, setColorSettings] = useState({
    contrast: 0,
    brightness: 0,
    saturation: 1,
    exposure: 0,
    highlights: 0,
    shadows: 0,
    temperature: 0,
    gamma: 1,
  })

  // Speed/FPS state
  const [speedFactor, setSpeedFactor] = useState(1)
  const [targetFps, setTargetFps] = useState(30)

  // Processing state
  const [isApplyingEdit, setIsApplyingEdit] = useState(false)
  const [editMessage, setEditMessage] = useState<string | null>(null)

  const selectedSegment = segments.find(s => s.id === selectedSegmentId)

  // Reset color settings
  const resetColorSettings = () => {
    setColorSettings({
      contrast: 0,
      brightness: 0,
      saturation: 1,
      exposure: 0,
      highlights: 0,
      shadows: 0,
      temperature: 0,
      gamma: 1,
    })
  }

  // Apply color grading
  const handleApplyColor = async () => {
    if (!video.videoUrl) return

    setIsApplyingEdit(true)
    setEditMessage(null)

    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'color',
          videoUrl: video.videoUrl,
          contrast: colorSettings.contrast,
          brightness: colorSettings.brightness,
          saturation: colorSettings.saturation,
          exposure: colorSettings.exposure,
          highlights: colorSettings.highlights,
          shadows: colorSettings.shadows,
          temperature: colorSettings.temperature,
          gamma: colorSettings.gamma,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditMessage('Color grading applied successfully!')
        // In a real app, you'd update the video URL with the processed video
      } else {
        setEditMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setEditMessage('Failed to apply color grading')
    } finally {
      setIsApplyingEdit(false)
    }
  }

  // Apply speed/FPS changes
  const handleApplySpeedFps = async () => {
    if (!video.videoUrl) return

    setIsApplyingEdit(true)
    setEditMessage(null)

    try {
      // Apply both speed and FPS in one operation
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'process',
          videoUrl: video.videoUrl,
          speed: speedFactor !== 1 ? { factor: speedFactor } : undefined,
          fps: targetFps !== 30 ? { fps: targetFps } : undefined,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditMessage('Speed/FPS changes applied!')
      } else {
        setEditMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setEditMessage('Failed to apply changes')
    } finally {
      setIsApplyingEdit(false)
    }
  }

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
    const segmentToSplit = segments.find(s => time > s.startTime && time < s.endTime)
    if (!segmentToSplit) return

    const index = segments.indexOf(segmentToSplit)
    const newSegments = [...segments]

    newSegments[index] = { ...segmentToSplit, endTime: time }

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

  const handleTrimSubmit = async () => {
    setIsApplyingEdit(true)
    setEditMessage(null)

    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'trim',
          videoUrl: video.videoUrl,
          startTime: trimStart,
          endTime: trimEnd,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setEditMessage(`Trimmed to ${data.duration?.toFixed(1)}s`)
        onTrim(trimStart, trimEnd)
      } else {
        setEditMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setEditMessage('Failed to trim video')
    } finally {
      setIsApplyingEdit(false)
    }
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
      <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
        {[
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'trim', label: 'Trim', icon: Scissors },
          { id: 'extend', label: 'Extend', icon: ArrowRight },
          { id: 'remix', label: 'Remix', icon: Sparkles },
          { id: 'color', label: 'Color', icon: Palette },
          { id: 'speed', label: 'Speed/FPS', icon: Gauge },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setEditMode(id as EditMode)}
            className={`flex-shrink-0 px-3 py-2 text-sm flex items-center justify-center gap-1.5 transition-colors ${
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
        {/* Timeline always visible for non-color/speed modes */}
        {editMode !== 'color' && editMode !== 'speed' && (
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
            disabled={isProcessing || isApplyingEdit}
          />
        )}

        {/* Status message */}
        {editMessage && (
          <div className={`text-sm px-3 py-2 rounded-lg ${
            editMessage.startsWith('Error')
              ? 'bg-red-500/10 text-red-500'
              : 'bg-green-500/10 text-green-500'
          }`}>
            {editMessage}
          </div>
        )}

        {/* Mode-specific controls */}
        {editMode === 'color' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-secondary">
              Adjust color grading and white balance
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-3">
                <ColorSlider
                  label="Exposure"
                  value={colorSettings.exposure}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, exposure: v }))}
                  min={-2}
                  max={2}
                  disabled={isApplyingEdit}
                  icon={<Sun className="w-3 h-3" />}
                />
                <ColorSlider
                  label="Contrast"
                  value={colorSettings.contrast}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, contrast: v }))}
                  min={-1}
                  max={1}
                  disabled={isApplyingEdit}
                  icon={<Contrast className="w-3 h-3" />}
                />
                <ColorSlider
                  label="Highlights"
                  value={colorSettings.highlights}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, highlights: v }))}
                  min={-1}
                  max={1}
                  disabled={isApplyingEdit}
                  icon={<SunDim className="w-3 h-3" />}
                />
                <ColorSlider
                  label="Shadows"
                  value={colorSettings.shadows}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, shadows: v }))}
                  min={-1}
                  max={1}
                  disabled={isApplyingEdit}
                  icon={<Moon className="w-3 h-3" />}
                />
              </div>

              {/* Right column */}
              <div className="space-y-3">
                <ColorSlider
                  label="Saturation"
                  value={colorSettings.saturation}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, saturation: v }))}
                  min={0}
                  max={2}
                  disabled={isApplyingEdit}
                  icon={<Palette className="w-3 h-3" />}
                />
                <ColorSlider
                  label="Temperature"
                  value={colorSettings.temperature}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, temperature: v }))}
                  min={-100}
                  max={100}
                  step={1}
                  disabled={isApplyingEdit}
                  icon={<Thermometer className="w-3 h-3" />}
                />
                <ColorSlider
                  label="Brightness"
                  value={colorSettings.brightness}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, brightness: v }))}
                  min={-1}
                  max={1}
                  disabled={isApplyingEdit}
                  icon={<Sun className="w-3 h-3" />}
                />
                <ColorSlider
                  label="Gamma"
                  value={colorSettings.gamma}
                  onChange={(v) => setColorSettings(prev => ({ ...prev, gamma: v }))}
                  min={0.1}
                  max={3}
                  step={0.1}
                  disabled={isApplyingEdit}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                onClick={resetColorSettings}
                disabled={isApplyingEdit}
                className="btn-ghost text-sm"
              >
                Reset All
              </button>
              <button
                onClick={handleApplyColor}
                disabled={isApplyingEdit}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                {isApplyingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Palette className="w-3.5 h-3.5" />
                    Apply Color Grading
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {editMode === 'speed' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-secondary">
              Adjust playback speed and frame rate
            </p>

            <div className="space-y-4">
              {/* Speed control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-foreground">Speed</label>
                  <span className="text-sm font-mono text-accent">{speedFactor}x</span>
                </div>
                <div className="flex gap-2">
                  {[0.25, 0.5, 1, 1.5, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setSpeedFactor(speed)}
                      disabled={isApplyingEdit}
                      className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                        speedFactor === speed
                          ? 'bg-accent text-white'
                          : 'bg-background text-foreground-secondary hover:text-foreground hover:bg-background-secondary'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
                <p className="text-xs text-foreground-secondary">
                  {speedFactor < 1 ? 'Slow motion' : speedFactor > 1 ? 'Fast forward' : 'Normal speed'}
                  {speedFactor !== 1 && ` • New duration: ${(video.duration / speedFactor).toFixed(1)}s`}
                </p>
              </div>

              {/* FPS control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-foreground">Frame Rate (FPS)</label>
                  <span className="text-sm font-mono text-accent">{targetFps} fps</span>
                </div>
                <div className="flex gap-2">
                  {[24, 30, 48, 60].map((fps) => (
                    <button
                      key={fps}
                      onClick={() => setTargetFps(fps)}
                      disabled={isApplyingEdit}
                      className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                        targetFps === fps
                          ? 'bg-accent text-white'
                          : 'bg-background text-foreground-secondary hover:text-foreground hover:bg-background-secondary'
                      }`}
                    >
                      {fps}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-foreground-secondary">
                  {targetFps === 24 && 'Cinematic (film standard)'}
                  {targetFps === 30 && 'Standard (web/TV)'}
                  {targetFps === 48 && 'High frame rate'}
                  {targetFps === 60 && 'Smooth motion (gaming)'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-border">
              <button
                onClick={handleApplySpeedFps}
                disabled={isApplyingEdit || (speedFactor === 1 && targetFps === 30)}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                {isApplyingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Gauge className="w-3.5 h-3.5" />
                    Apply Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}

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
              disabled={isProcessing || isApplyingEdit}
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
                    disabled={isProcessing || isApplyingEdit}
                  >
                    {d}s
                  </button>
                ))}
              </div>
              <button
                onClick={handleExtendSubmit}
                disabled={!extendPrompt.trim() || isProcessing || isApplyingEdit}
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
                  disabled={isProcessing || isApplyingEdit}
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRemixSubmit}
                    disabled={!remixPrompt.trim() || isProcessing || isApplyingEdit}
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
                  disabled={isProcessing || isApplyingEdit}
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
                  disabled={isProcessing || isApplyingEdit}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground-secondary">
                New duration: {(trimEnd - trimStart).toFixed(1)}s
              </span>
              <button
                onClick={handleTrimSubmit}
                disabled={isProcessing || isApplyingEdit}
                className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
              >
                {isApplyingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Trimming...
                  </>
                ) : (
                  <>
                    <Scissors className="w-3.5 h-3.5" />
                    Apply Trim
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {editMode === 'timeline' && (
          <div className="text-sm text-foreground-secondary text-center py-2">
            Click on the timeline to seek. Drag segment edges to resize. Use the tabs above to edit.
          </div>
        )}
      </div>
    </div>
  )
}
