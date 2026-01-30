'use client'

import { useState } from 'react'
import {
  Youtube,
  Loader2,
  Check,
  LogOut,
  Users,
  ExternalLink,
} from 'lucide-react'
import { useAppStore, YouTubeChannel } from '@/lib/store'
import { generateId } from '@/lib/utils'

interface YouTubeConnectProps {
  compact?: boolean
}

export function YouTubeConnect({ compact = false }: YouTubeConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const youtubeChannel = useAppStore((state) => state.youtubeChannel)
  const setYouTubeChannel = useAppStore((state) => state.setYouTubeChannel)

  // Simulate OAuth connection flow
  const handleConnect = async () => {
    setIsConnecting(true)

    // Simulate OAuth popup and authorization
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Simulate successful connection
    const channel: YouTubeChannel = {
      id: generateId(),
      channelId: 'UCdemoChannel123',
      channelName: 'My Creative Channel',
      channelThumbnail: 'https://yt3.googleusercontent.com/demo_thumbnail',
      subscriberCount: 1520,
      isConnected: true,
      connectedAt: new Date(),
    }

    setYouTubeChannel(channel)
    setIsConnecting(false)
  }

  // Disconnect channel
  const handleDisconnect = async () => {
    setIsDisconnecting(true)

    await new Promise((resolve) => setTimeout(resolve, 500))

    setYouTubeChannel(null)
    setIsDisconnecting(false)
  }

  if (compact) {
    if (youtubeChannel?.isConnected) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background-secondary">
          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <Youtube className="w-3 h-3 text-red-500" />
          </div>
          <span className="text-sm text-foreground truncate">
            {youtubeChannel.channelName}
          </span>
          <Check className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
        </div>
      )
    }

    return (
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors disabled:opacity-50"
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Youtube className="w-4 h-4" />
        )}
        <span className="text-sm">Connect YouTube</span>
      </button>
    )
  }

  // Full size component
  if (youtubeChannel?.isConnected) {
    return (
      <div className="p-4 rounded-xl bg-background-secondary border border-border">
        <div className="flex items-start gap-3">
          {/* Channel thumbnail */}
          <div className="relative">
            {youtubeChannel.channelThumbnail ? (
              <img
                src={youtubeChannel.channelThumbnail}
                alt={youtubeChannel.channelName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Youtube className="w-6 h-6 text-red-500" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background-secondary flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>

          {/* Channel info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground truncate">
              {youtubeChannel.channelName}
            </h4>
            <div className="flex items-center gap-1 text-sm text-foreground-secondary">
              <Users className="w-3.5 h-3.5" />
              {youtubeChannel.subscriberCount.toLocaleString()} subscribers
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a
              href={`https://youtube.com/channel/${youtubeChannel.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-background text-foreground-secondary hover:text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="p-2 rounded-lg hover:bg-background text-foreground-secondary hover:text-red-500"
            >
              {isDisconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-foreground-secondary">
            Connected on{' '}
            {youtubeChannel.connectedAt?.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <Youtube className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h4 className="font-medium text-foreground">Connect YouTube</h4>
          <p className="text-sm text-foreground-secondary">
            Upload videos directly to your channel
          </p>
        </div>
      </div>

      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Youtube className="w-4 h-4" />
            Connect with Google
          </>
        )}
      </button>

      <p className="text-xs text-foreground-secondary text-center mt-3">
        We'll request permission to upload videos on your behalf
      </p>
    </div>
  )
}
