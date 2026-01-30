'use client'

import { useState } from 'react'
import {
  Youtube,
  ExternalLink,
  Clock,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  Calendar,
  Trash2,
  MoreVertical,
} from 'lucide-react'
import { useAppStore, YouTubeUpload } from '@/lib/store'

interface YouTubeUploadsProps {
  limit?: number
  showHeader?: boolean
}

export function YouTubeUploads({ limit, showHeader = true }: YouTubeUploadsProps) {
  const [showMenu, setShowMenu] = useState<string | null>(null)

  const youtubeUploads = useAppStore((state) => state.youtubeUploads)
  const deleteYouTubeUpload = useAppStore((state) => state.deleteYouTubeUpload)

  const displayedUploads = limit
    ? youtubeUploads.slice(0, limit)
    : youtubeUploads

  const statusConfig = {
    pending: {
      icon: <Clock className="w-4 h-4 text-yellow-400" />,
      label: 'Pending',
      color: 'text-yellow-400',
    },
    uploading: {
      icon: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
      label: 'Uploading',
      color: 'text-blue-400',
    },
    processing: {
      icon: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
      label: 'Processing',
      color: 'text-blue-400',
    },
    published: {
      icon: <Check className="w-4 h-4 text-green-400" />,
      label: 'Published',
      color: 'text-green-400',
    },
    scheduled: {
      icon: <Calendar className="w-4 h-4 text-purple-400" />,
      label: 'Scheduled',
      color: 'text-purple-400',
    },
    failed: {
      icon: <AlertCircle className="w-4 h-4 text-red-400" />,
      label: 'Failed',
      color: 'text-red-400',
    },
  }

  if (youtubeUploads.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-secondary flex items-center justify-center">
          <Youtube className="w-6 h-6 text-foreground-secondary" />
        </div>
        <p className="text-sm text-foreground-secondary">No YouTube uploads yet</p>
        <p className="text-xs text-foreground-secondary/60 mt-1">
          Upload a video to see it here
        </p>
      </div>
    )
  }

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-500" />
            YouTube Uploads
          </h3>
          <span className="text-xs text-foreground-secondary">
            {youtubeUploads.length} video{youtubeUploads.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="divide-y divide-border">
        {displayedUploads.map((upload) => {
          const status = statusConfig[upload.status]

          return (
            <div
              key={upload.id}
              className="p-4 hover:bg-background-secondary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="flex-shrink-0 mt-1">{status.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {upload.title}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs ${status.color}`}>
                      {status.label}
                    </span>

                    {upload.visibility && (
                      <>
                        <span className="text-foreground-secondary/30">•</span>
                        <span className="text-xs text-foreground-secondary capitalize">
                          {upload.visibility}
                        </span>
                      </>
                    )}

                    {upload.scheduledPublishAt && (
                      <>
                        <span className="text-foreground-secondary/30">•</span>
                        <span className="text-xs text-foreground-secondary">
                          {new Date(upload.scheduledPublishAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>

                  {upload.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${upload.uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-foreground-secondary mt-1">
                        {upload.uploadProgress}% complete
                      </p>
                    </div>
                  )}

                  {upload.error && (
                    <p className="text-xs text-red-400 mt-1">{upload.error}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {upload.youtubeUrl && (
                    <a
                      href={upload.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-background text-foreground-secondary hover:text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <div className="relative">
                    <button
                      onClick={() =>
                        setShowMenu(showMenu === upload.id ? null : upload.id)
                      }
                      className="p-2 rounded-lg hover:bg-background text-foreground-secondary hover:text-foreground"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showMenu === upload.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowMenu(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
                          {upload.youtubeUrl && (
                            <a
                              href={upload.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full px-3 py-2 text-left text-sm text-foreground-secondary hover:bg-background-secondary hover:text-foreground flex items-center gap-2"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View on YouTube
                            </a>
                          )}
                          <button
                            onClick={() => {
                              deleteYouTubeUpload(upload.id)
                              setShowMenu(null)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-background-secondary flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {limit && youtubeUploads.length > limit && (
        <div className="px-4 py-3 border-t border-border">
          <button className="text-sm text-accent hover:underline w-full text-center">
            View all {youtubeUploads.length} uploads
          </button>
        </div>
      )}
    </div>
  )
}
