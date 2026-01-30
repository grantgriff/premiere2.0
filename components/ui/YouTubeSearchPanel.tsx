'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Search,
  Youtube,
  Loader2,
  Check,
  Play,
  Clock,
  ExternalLink,
} from 'lucide-react'

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  thumbnail: string
  channel: string
  publishedAt: string
  url: string
}

interface YouTubeSearchPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelectVideo: (video: YouTubeVideo) => void
  selectedVideos?: YouTubeVideo[]
}

export function YouTubeSearchPanel({
  isOpen,
  onClose,
  onSelectVideo,
  selectedVideos = [],
}: YouTubeSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeVideo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Reset state when panel opens/closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setError(null)
      setHasSearched(false)
    }
  }, [isOpen])

  const searchYouTube = useCallback(async () => {
    if (!query.trim()) return

    setIsSearching(true)
    setError(null)
    setHasSearched(true)

    try {
      const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}&maxResults=12`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Search failed')
      }

      const data = await response.json()
      setResults(data.videos || [])
    } catch (err) {
      console.error('YouTube search error:', err)
      setError(err instanceof Error ? err.message : 'Failed to search YouTube')
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      searchYouTube()
    }
  }

  const isSelected = (videoId: string) =>
    selectedVideos.some(v => v.id === videoId)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-foreground">Search YouTube</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search for reference videos..."
                className="input-field w-full pl-10"
                autoFocus
              />
            </div>
            <button
              onClick={searchYouTube}
              disabled={!query.trim() || isSearching}
              className="btn-primary px-4 flex items-center gap-2"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
          <p className="text-xs text-foreground-secondary mt-2">
            Select a video to use as style reference for your generation
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 mb-2">{error}</p>
              <p className="text-sm text-foreground-secondary">
                Make sure YOUTUBE_API_KEY is configured
              </p>
            </div>
          )}

          {!hasSearched && !error && (
            <div className="text-center py-12 text-foreground-secondary">
              <Youtube className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Search for YouTube videos to use as reference</p>
              <p className="text-sm mt-1">
                The video style will be extracted and used in generation
              </p>
            </div>
          )}

          {hasSearched && results.length === 0 && !isSearching && !error && (
            <div className="text-center py-12 text-foreground-secondary">
              <p>No videos found for "{query}"</p>
              <p className="text-sm mt-1">Try different search terms</p>
            </div>
          )}

          {isSearching && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
              <p className="text-foreground-secondary">Searching YouTube...</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {results.map((video) => (
                <button
                  key={video.id}
                  onClick={() => onSelectVideo(video)}
                  className={`group text-left rounded-lg overflow-hidden border transition-all ${
                    isSelected(video.id)
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-accent/50 hover:bg-background-secondary'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-background-secondary">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {isSelected(video.id) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                      {video.title}
                    </h3>
                    <p className="text-xs text-foreground-secondary mb-1">
                      {video.channel}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(video.publishedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedVideos.length > 0 && (
          <div className="p-4 border-t border-border bg-background-secondary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground-secondary">
                  {selectedVideos.length} video{selectedVideos.length > 1 ? 's' : ''} selected
                </span>
              </div>
              <button
                onClick={onClose}
                className="btn-primary px-4"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
