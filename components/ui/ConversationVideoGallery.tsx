'use client'

import { Video as VideoType } from '@/lib/store'
import { Play, Clock } from 'lucide-react'
import { useMemo } from 'react'

interface ConversationVideoGalleryProps {
  videos: VideoType[]
  currentVideoId: string | null
  onVideoSelect: (video: VideoType) => void
}

interface VideoGroup {
  id: string
  prompt: string
  timestamp: Date
  videos: VideoType[]
}

export function ConversationVideoGallery({
  videos,
  currentVideoId,
  onVideoSelect,
}: ConversationVideoGalleryProps) {
  // Group videos by generation batch (videos created within 10 seconds of each other)
  const videoGroups = useMemo(() => {
    const completed = videos
      .filter((v) => v.status === 'completed' && v.videoUrl)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const groups: VideoGroup[] = []

    completed.forEach((video) => {
      const videoTime = new Date(video.createdAt).getTime()

      // Try to find an existing group within 10 seconds
      const existingGroup = groups.find((group) => {
        const groupTime = group.timestamp.getTime()
        return Math.abs(videoTime - groupTime) < 10000 // 10 seconds
      })

      if (existingGroup) {
        existingGroup.videos.push(video)
      } else {
        groups.push({
          id: video.id,
          prompt: video.prompt,
          timestamp: new Date(video.createdAt),
          videos: [video],
        })
      }
    })

    return groups
  }, [videos])

  if (videoGroups.length === 0) {
    return null
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString()
  }

  const getModelDisplayName = (model: string) => {
    const modelMap: Record<string, string> = {
      'veo3_1': 'Veo 3.1',
      'veo_3': 'Veo 3',
      'luma_1_6': 'Luma 1.6',
      'runway_gen3': 'Runway Gen-3',
      'sora': 'Sora',
    }
    return modelMap[model] || model
  }

  return (
    <div className="border-b border-border bg-background-secondary">
      <div className="px-4 py-3">
        <h3 className="text-xs font-medium text-foreground-secondary mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Generation History
        </h3>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {videoGroups.map((group) => (
            <div
              key={group.id}
              className="flex-shrink-0 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 min-w-[280px] max-w-[400px]"
            >
              {/* Group Header */}
              <div className="mb-2">
                <p className="text-xs text-foreground-secondary mb-0.5">
                  {group.videos.length > 1 ? 'Multi-Model' : getModelDisplayName(group.videos[0].model)} • {formatTime(group.timestamp)}
                </p>
                <p className="text-sm text-foreground line-clamp-1">
                  {group.prompt}
                </p>
              </div>

              {/* Video Thumbnails */}
              <div className="flex gap-2">
                {group.videos.map((video) => {
                  const isSelected = video.id === currentVideoId
                  return (
                    <button
                      key={video.id}
                      onClick={() => onVideoSelect(video)}
                      className={`relative flex-1 aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                        isSelected
                          ? 'border-accent ring-2 ring-accent/50'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-accent/10 to-purple-500/10 flex items-center justify-center">
                          <Play className="w-6 h-6 text-accent/50" />
                        </div>
                      )}

                      {/* Model Badge */}
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-medium text-center truncate">
                          {getModelDisplayName(video.model)}
                        </div>
                      </div>

                      {/* Duration Badge */}
                      {video.duration && (
                        <div className="absolute top-1 right-1 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white">
                          {video.duration}s
                        </div>
                      )}

                      {/* Selected Indicator */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-accent/10 pointer-events-none" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
