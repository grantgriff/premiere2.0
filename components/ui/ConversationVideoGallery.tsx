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

    // Reverse so most recent groups appear on the right
    return groups.reverse()
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
    <div className="border-b border-border bg-background-secondary/50">
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <Clock className="w-3 h-3 text-foreground-secondary" />
          <h3 className="text-[10px] font-medium text-foreground-secondary uppercase tracking-wider">
            History
          </h3>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {videoGroups.map((group) => (
            <div
              key={group.id}
              className="flex-shrink-0 flex items-center gap-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-1.5"
            >
              {/* Video Thumbnails - compact inline */}
              {group.videos.map((video) => {
                const isSelected = video.id === currentVideoId
                return (
                  <button
                    key={video.id}
                    onClick={() => onVideoSelect(video)}
                    className={`relative w-16 h-10 flex-shrink-0 rounded overflow-hidden border transition-all hover:scale-105 ${
                      isSelected
                        ? 'border-accent ring-1 ring-accent/50'
                        : 'border-border/50 hover:border-accent/50'
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
                        <Play className="w-3 h-3 text-accent/50" />
                      </div>
                    )}
                    {video.duration && (
                      <div className="absolute top-0.5 right-0.5 bg-black/80 px-1 rounded text-[8px] text-white leading-tight">
                        {video.duration}s
                      </div>
                    )}
                  </button>
                )
              })}

              {/* Compact label */}
              <div className="min-w-0 max-w-[120px]">
                <p className="text-[10px] text-foreground-secondary truncate">
                  {group.videos.length > 1 ? 'Multi' : getModelDisplayName(group.videos[0].model)} • {formatTime(group.timestamp)}
                </p>
                <p className="text-[11px] text-foreground truncate">
                  {group.prompt}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
