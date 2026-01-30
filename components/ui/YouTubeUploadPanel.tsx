'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Youtube,
  Upload,
  Loader2,
  Sparkles,
  Calendar,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Link2,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Clock,
  Tag,
  FileText,
  Wand2,
} from 'lucide-react'
import {
  useAppStore,
  Video,
  YouTubeVisibility,
  YouTubeUpload,
} from '@/lib/store'
import { generateId } from '@/lib/utils'

interface YouTubeUploadPanelProps {
  isOpen: boolean
  onClose: () => void
  video: Video | null
}

type UploadStep = 'metadata' | 'review' | 'uploading' | 'complete'

export function YouTubeUploadPanel({
  isOpen,
  onClose,
  video,
}: YouTubeUploadPanelProps) {
  const [step, setStep] = useState<UploadStep>('metadata')
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [visibility, setVisibility] = useState<YouTubeVisibility>('private')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null)

  // Store
  const youtubeChannel = useAppStore((state) => state.youtubeChannel)
  const addYouTubeUpload = useAppStore((state) => state.addYouTubeUpload)

  // Initialize with video info
  useEffect(() => {
    if (video && isOpen) {
      setTitle(video.prompt.slice(0, 100))
      setStep('metadata')
      setUploadProgress(0)
      setUploadError(null)
      setYoutubeUrl(null)
    }
  }, [video, isOpen])

  // Generate AI metadata
  const handleGenerateMetadata = async () => {
    if (!video) return

    setIsGeneratingMetadata(true)

    try {
      const response = await fetch('/api/youtube/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoPrompt: video.prompt,
          tone: 'professional',
          includeHashtags: true,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate metadata')

      const data = await response.json()

      if (data.success && data.metadata) {
        // Use the first suggested title
        setTitle(data.metadata.titles[0] || video.prompt.slice(0, 100))
        setDescription(data.metadata.description)
        setTags(data.metadata.tags)
      }
    } catch (error) {
      console.error('Metadata generation error:', error)
    } finally {
      setIsGeneratingMetadata(false)
    }
  }

  // Add tag
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  // Start upload
  const handleUpload = async () => {
    if (!video || !video.videoUrl) return

    setStep('uploading')
    setUploadProgress(0)
    setUploadError(null)

    try {
      // Initiate upload
      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: video.videoUrl,
          title,
          description,
          tags,
          visibility: scheduleEnabled ? 'private' : visibility,
          scheduledPublishAt: scheduleEnabled
            ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
            : null,
        }),
      })

      if (!response.ok) throw new Error('Failed to initiate upload')

      const data = await response.json()

      // Simulate upload progress
      for (let i = 0; i <= 100; i += 5) {
        await new Promise((resolve) => setTimeout(resolve, 150))
        setUploadProgress(i)
      }

      // Create upload record
      // When scheduling, YouTube requires 'private' visibility until scheduled time
      const upload: YouTubeUpload = {
        id: generateId(),
        videoId: video.id,
        youtubeVideoId: data.youtubeVideoId,
        youtubeUrl: `https://youtube.com/watch?v=${data.youtubeVideoId}`,
        title,
        description,
        tags,
        visibility: scheduleEnabled ? 'private' : visibility,
        scheduledPublishAt: scheduleEnabled
          ? new Date(`${scheduledDate}T${scheduledTime}`)
          : null,
        status: scheduleEnabled ? 'scheduled' : 'published',
        uploadProgress: 100,
        error: null,
        createdAt: new Date(),
        publishedAt: scheduleEnabled ? null : new Date(),
      }

      addYouTubeUpload(upload)
      setYoutubeUrl(upload.youtubeUrl)
      setStep('complete')
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      setStep('review')
    }
  }

  const visibilityOptions: {
    value: YouTubeVisibility
    label: string
    icon: React.ReactNode
    description: string
  }[] = [
    {
      value: 'public',
      label: 'Public',
      icon: <Globe className="w-4 h-4" />,
      description: 'Anyone can search and view',
    },
    {
      value: 'unlisted',
      label: 'Unlisted',
      icon: <Link2 className="w-4 h-4" />,
      description: 'Anyone with the link can view',
    },
    {
      value: 'private',
      label: 'Private',
      icon: <Lock className="w-4 h-4" />,
      description: 'Only you can view',
    },
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl max-h-[85vh] bg-background rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Youtube className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {step === 'complete' ? 'Upload Complete!' : 'Upload to YouTube'}
              </h2>
              <p className="text-sm text-foreground-secondary">
                {step === 'metadata' && 'Configure your video details'}
                {step === 'review' && 'Review before uploading'}
                {step === 'uploading' && 'Uploading to YouTube...'}
                {step === 'complete' && 'Your video is live!'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background-secondary text-foreground-secondary hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'metadata' && (
            <div className="space-y-5">
              {/* AI Generate button */}
              <button
                onClick={handleGenerateMetadata}
                disabled={isGeneratingMetadata}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-accent/20 to-purple-500/20 border border-accent/30 text-accent hover:from-accent/30 hover:to-purple-500/30 transition-all disabled:opacity-50"
              >
                {isGeneratingMetadata ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate AI Metadata
                  </>
                )}
              </button>

              {/* Title */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <FileText className="w-4 h-4" />
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="Enter video title..."
                  className="w-full h-10 px-4 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-foreground-secondary mt-1">
                  {title.length}/100 characters
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={5000}
                  rows={5}
                  placeholder="Enter video description..."
                  className="w-full px-4 py-3 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent resize-none"
                />
                <p className="text-xs text-foreground-secondary mt-1">
                  {description.length}/5000 characters
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a tag..."
                    className="flex-1 h-10 px-4 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="px-4 h-10 rounded-lg bg-accent text-white text-sm disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background-secondary text-xs text-foreground-secondary"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Visibility */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Eye className="w-4 h-4" />
                  Visibility
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setVisibility(option.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                        visibility === option.value
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-foreground-secondary/50'
                      }`}
                    >
                      <span
                        className={
                          visibility === option.value
                            ? 'text-accent'
                            : 'text-foreground-secondary'
                        }
                      >
                        {option.icon}
                      </span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule for later
                  </span>
                </label>

                {scheduleEnabled && (
                  <div className="flex gap-3 mt-2">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 h-10 px-4 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="flex-1 h-10 px-4 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {uploadError && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-500">Upload Failed</p>
                    <p className="text-sm text-red-400 mt-1">{uploadError}</p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-background-secondary space-y-3">
                <div>
                  <p className="text-xs text-foreground-secondary">Title</p>
                  <p className="text-sm text-foreground font-medium">{title}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-secondary">Visibility</p>
                  <p className="text-sm text-foreground capitalize">{visibility}</p>
                </div>
                {scheduleEnabled && scheduledDate && scheduledTime && (
                  <div>
                    <p className="text-xs text-foreground-secondary">Scheduled for</p>
                    <p className="text-sm text-foreground">
                      {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-foreground-secondary">Tags</p>
                  <p className="text-sm text-foreground">
                    {tags.length > 0 ? tags.join(', ') : 'No tags'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-background-secondary" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-red-500 border-t-transparent animate-spin"
                  style={{
                    transform: `rotate(${(uploadProgress / 100) * 360}deg)`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">
                    {uploadProgress}%
                  </span>
                </div>
              </div>
              <p className="text-foreground font-medium">Uploading to YouTube...</p>
              <p className="text-sm text-foreground-secondary mt-2">
                Please don't close this window
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-lg font-medium text-foreground mb-2">
                Upload Successful!
              </p>
              <p className="text-sm text-foreground-secondary text-center mb-6">
                {scheduleEnabled
                  ? 'Your video has been scheduled for publication.'
                  : 'Your video is now live on YouTube.'}
              </p>

              {youtubeUrl && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                  View on YouTube
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background-secondary/50">
          {step === 'metadata' && (
            <>
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!title.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Continue
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button onClick={() => setStep('metadata')} className="btn-secondary">
                Back
              </button>
              <button onClick={handleUpload} className="btn-primary flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Now
              </button>
            </>
          )}

          {step === 'uploading' && (
            <div className="w-full text-center text-sm text-foreground-secondary">
              Uploading... {uploadProgress}%
            </div>
          )}

          {step === 'complete' && (
            <button onClick={onClose} className="btn-primary w-full">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
