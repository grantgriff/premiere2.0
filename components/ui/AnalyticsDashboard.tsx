'use client'

import { useState } from 'react'
import {
  Video,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Youtube,
  Users,
  BarChart3,
  Activity,
  Sparkles,
  ChevronRight,
  Calendar,
  Zap,
} from 'lucide-react'
import { useAnalytics, useAppStore, VideoModel, Video as VideoType } from '@/lib/store'

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'accent',
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: { value: number; label: string }
  color?: 'accent' | 'green' | 'red' | 'yellow' | 'purple' | 'blue'
}) {
  const colorClasses = {
    accent: 'from-accent/20 to-accent/5 border-accent/20 text-accent',
    green: 'from-green-500/20 to-green-500/5 border-green-500/20 text-green-500',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20 text-red-500',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/20 text-yellow-500',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-500',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-500',
  }

  return (
    <div
      className={`p-5 rounded-xl bg-gradient-to-br ${colorClasses[color]} border transition-all hover:scale-[1.02]`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground-secondary">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-foreground-secondary mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-background/50`}>{icon}</div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 text-xs">
          <TrendingUp className="w-3 h-3" />
          <span className={trend.value >= 0 ? 'text-green-500' : 'text-red-500'}>
            {trend.value >= 0 ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-foreground-secondary">{trend.label}</span>
        </div>
      )}
    </div>
  )
}

// Mini Bar Chart Component
function MiniBarChart({
  data,
  maxValue,
}: {
  data: { label: string; value: number; color?: string }[]
  maxValue: number
}) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-foreground-secondary">{item.label}</span>
            <span className="text-foreground font-medium">{item.value}</span>
          </div>
          <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                item.color || 'bg-accent'
              }`}
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Activity Chart Component
function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex-1 flex items-end">
            <div
              className="w-full bg-accent/80 rounded-t transition-all duration-500 hover:bg-accent"
              style={{
                height: `${maxCount > 0 ? (day.count / maxCount) * 100 : 0}%`,
                minHeight: day.count > 0 ? '8px' : '0px',
              }}
            />
          </div>
          <span className="text-xs text-foreground-secondary">{day.date}</span>
        </div>
      ))}
    </div>
  )
}

// Recent Video Item
function RecentVideoItem({ video }: { video: VideoType }) {
  const statusColors = {
    pending: 'bg-yellow-500',
    processing: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-background-secondary/50 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center flex-shrink-0">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <Video className="w-5 h-5 text-foreground-secondary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{video.prompt.slice(0, 40)}...</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-foreground-secondary">{video.model}</span>
          <span className="text-foreground-secondary/30">•</span>
          <span className="text-xs text-foreground-secondary">{video.duration}s</span>
          {video.qualityScore && (
            <>
              <span className="text-foreground-secondary/30">•</span>
              <span className="text-xs text-green-500">{video.qualityScore}%</span>
            </>
          )}
        </div>
      </div>
      <div className={`w-2 h-2 rounded-full ${statusColors[video.status]}`} />
    </div>
  )
}

// Model Labels
const MODEL_LABELS: Record<VideoModel, string> = {
  veo3_1: 'Veo 3.1',
  runway: 'Runway',
  luma: 'Luma',
  sora: 'Sora',
  odyssey: 'Odyssey',
  world_labs: 'World Labs',
}

const MODEL_COLORS: Record<VideoModel, string> = {
  veo3_1: 'bg-blue-500',
  runway: 'bg-purple-500',
  luma: 'bg-green-500',
  sora: 'bg-orange-500',
  odyssey: 'bg-pink-500',
  world_labs: 'bg-cyan-500',
}

export function AnalyticsDashboard() {
  const analytics = useAnalytics()
  const user = useAppStore((state) => state.user)

  // Prepare model usage data for chart
  const modelUsageData = Object.entries(analytics.modelUsage)
    .map(([model, count]) => ({
      label: MODEL_LABELS[model as VideoModel] || model,
      value: count,
      color: MODEL_COLORS[model as VideoModel] || 'bg-accent',
    }))
    .sort((a, b) => b.value - a.value)

  const maxModelUsage = Math.max(...modelUsageData.map((d) => d.value), 1)

  // Prepare quality data
  const qualityData = Object.entries(analytics.modelAvgQuality)
    .map(([model, score]) => ({
      label: MODEL_LABELS[model as VideoModel] || model,
      value: Math.round(score),
      color: MODEL_COLORS[model as VideoModel] || 'bg-accent',
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-foreground-secondary mt-1">
            Track your video generation performance
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground-secondary">
          <Calendar className="w-4 h-4" />
          Last 7 days
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          title="Total Videos"
          value={analytics.totalVideos}
          subtitle={`${analytics.completedVideos} completed`}
          icon={<Video className="w-5 h-5" />}
          color="accent"
        />
        <StatsCard
          title="Total Duration"
          value={`${analytics.totalDuration}s`}
          subtitle={`~${Math.round(analytics.totalDuration / 60)} minutes`}
          icon={<Clock className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          title="Avg Quality"
          value={`${Math.round(analytics.avgQualityScore)}%`}
          subtitle="AI verification score"
          icon={<Sparkles className="w-5 h-5" />}
          color="green"
        />
        <StatsCard
          title="Credits"
          value={user?.credits ?? 0}
          subtitle="Remaining balance"
          icon={<Zap className="w-5 h-5" />}
          color="yellow"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatsCard
          title="YouTube Uploads"
          value={analytics.totalUploads}
          subtitle={`${analytics.publishedUploads} published`}
          icon={<Youtube className="w-5 h-5 text-red-500" />}
          color="red"
        />
        <StatsCard
          title="Characters"
          value={analytics.totalCharacters}
          subtitle={`${analytics.readyCharacters} ready`}
          icon={<Users className="w-5 h-5" />}
          color="purple"
        />
        <StatsCard
          title="Success Rate"
          value={
            analytics.totalVideos > 0
              ? `${Math.round((analytics.completedVideos / analytics.totalVideos) * 100)}%`
              : 'N/A'
          }
          subtitle={`${analytics.failedVideos} failed`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Activity Chart */}
        <div className="p-5 rounded-xl bg-background-secondary/50 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              Generation Activity
            </h3>
          </div>
          {analytics.dailyGenerations.some((d) => d.count > 0) ? (
            <ActivityChart data={analytics.dailyGenerations} />
          ) : (
            <div className="h-32 flex items-center justify-center text-foreground-secondary text-sm">
              No activity in the last 7 days
            </div>
          )}
        </div>

        {/* Model Usage */}
        <div className="p-5 rounded-xl bg-background-secondary/50 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" />
              Model Usage
            </h3>
          </div>
          {modelUsageData.length > 0 ? (
            <MiniBarChart data={modelUsageData} maxValue={maxModelUsage} />
          ) : (
            <div className="h-32 flex items-center justify-center text-foreground-secondary text-sm">
              No videos generated yet
            </div>
          )}
        </div>
      </div>

      {/* Quality by Model */}
      {qualityData.length > 0 && (
        <div className="p-5 rounded-xl bg-background-secondary/50 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Quality by Model
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {qualityData.map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-lg bg-background border border-border"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-secondary">{item.label}</span>
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{item.value}%</p>
                <div className="h-1.5 bg-background-secondary rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Videos */}
      <div className="p-5 rounded-xl bg-background-secondary/50 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-accent" />
            Recent Videos
          </h3>
          <button className="text-sm text-accent flex items-center gap-1 hover:underline">
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {analytics.recentVideos.length > 0 ? (
          <div className="space-y-1">
            {analytics.recentVideos.slice(0, 5).map((video) => (
              <RecentVideoItem key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-foreground-secondary text-sm">
            No videos in the last 7 days
          </div>
        )}
      </div>
    </div>
  )
}
