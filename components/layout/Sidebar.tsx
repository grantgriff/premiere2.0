'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  Search,
  Video,
  MoreHorizontal,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Youtube,
} from 'lucide-react'
import { useAppStore, Conversation } from '@/lib/store'
import { YouTubeConnect } from '@/components/ui/YouTubeConnect'
import { deleteConversationApi } from '@/lib/api'

// Group conversations by date
function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const groups: { label: string; conversations: Conversation[] }[] = [
    { label: 'Today', conversations: [] },
    { label: 'Yesterday', conversations: [] },
    { label: 'Previous 7 Days', conversations: [] },
    { label: 'Previous 30 Days', conversations: [] },
    { label: 'Older', conversations: [] },
  ]

  conversations.forEach((conv) => {
    const convDate = new Date(conv.updatedAt)
    if (convDate >= today) {
      groups[0].conversations.push(conv)
    } else if (convDate >= yesterday) {
      groups[1].conversations.push(conv)
    } else if (convDate >= lastWeek) {
      groups[2].conversations.push(conv)
    } else if (convDate >= lastMonth) {
      groups[3].conversations.push(conv)
    } else {
      groups[4].conversations.push(conv)
    }
  })

  return groups.filter((g) => g.conversations.length > 0)
}

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<'conversations' | 'movies'>('conversations')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday']))
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [newDropdownOpen, setNewDropdownOpen] = useState(false)

  // Global state - Conversations
  const user = useAppStore((state) => state.user)
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const setActiveConversation = useAppStore((state) => state.setActiveConversation)
  const deleteConversation = useAppStore((state) => state.deleteConversation)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)
  const setMultiModelMode = useAppStore((state) => state.setMultiModelMode)

  // Global state - Movies
  const movies = useAppStore((state) => state.movies)
  const activeMovieId = useAppStore((state) => state.activeMovieId)
  const setActiveMovie = useAppStore((state) => state.setActiveMovie)
  const deleteMovie = useAppStore((state) => state.deleteMovie)

  // Filter and group conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const query = searchQuery.toLowerCase()
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.messages.some((m) => m.content.toLowerCase().includes(query))
    )
  }, [conversations, searchQuery])

  const groupedConversations = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newDropdownOpen && !(e.target as Element).closest('.new-dropdown-container')) {
        setNewDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [newDropdownOpen])

  const handleNewClip = () => {
    // Clear current state
    setCurrentVideo(null)
    setActiveConversation(null)
    setMultiModelMode(false)

    // Switch to conversations tab
    setActiveTab('conversations')
    setNewDropdownOpen(false)
  }

  const handleNewMovie = async () => {
    if (!user?.id) return

    const newMovie = {
      id: crypto.randomUUID(),
      userId: user.id,
      title: `Movie ${movies.length + 1}`,
      description: null,
      thumbnailUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      clips: []
    }

    // Clear current video and switch to empty state for new query
    setCurrentVideo(null)
    setActiveConversation(null)
    setMultiModelMode(false)

    // Add to local store
    useAppStore.getState().addMovie(newMovie)

    // Create in API
    try {
      await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newMovie.title,
        }),
      })
    } catch (error) {
      console.error('[Sidebar] Failed to create movie:', error)
    }

    setActiveTab('movies')
    setNewDropdownOpen(false)
  }

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id)
    setMenuOpenId(null)
    const conversation = conversations.find((c) => c.id === id)
    if (conversation && conversation.videos.length > 0) {
      const latestVideo = conversation.videos[conversation.videos.length - 1]
      if (latestVideo.status === 'completed' && latestVideo.videoUrl) {
        setCurrentVideo(latestVideo)
      } else {
        setCurrentVideo(null)
      }
    } else {
      setCurrentVideo(null)
    }
  }

  const handleSelectMovie = (movieId: string) => {
    setActiveMovie(movieId)
    setMultiModelMode(false)

    // Find the most recent conversation associated with this movie's clips
    const movie = movies.find(m => m.id === movieId)
    if (movie && movie.clips.length > 0) {
      // Get video IDs from clips, ordered by position (last = most recent)
      const clipVideoIds = movie.clips
        .sort((a, b) => b.position - a.position)
        .map(c => c.videoId)

      // Find the conversation containing the most recent clip's video
      for (const videoId of clipVideoIds) {
        const conv = conversations.find(c => c.videos.some(v => v.id === videoId))
        if (conv) {
          setActiveConversation(conv.id)
          // Show the latest completed video from that conversation
          const latestVideo = [...conv.videos].reverse().find(v => v.status === 'completed' && v.videoUrl)
          setCurrentVideo(latestVideo || null)
          return
        }
      }
    }
  }

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()

    // Delete from database
    if (user?.id) {
      deleteConversationApi(id, user.id)
    }

    // Delete from local store
    deleteConversation(id)
    setMenuOpenId(null)
    if (activeConversationId === id) {
      setActiveConversation(null)
      setCurrentVideo(null)
    }
  }

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <aside className="w-64 h-full flex flex-col bg-[#171717] border-r border-[#2a2a2a]">
      {/* Header with New Dropdown */}
      <div className="p-3 relative new-dropdown-container">
        <button
          onClick={() => setNewDropdownOpen(!newDropdownOpen)}
          className="w-full h-10 rounded-lg border border-[#3a3a3a] hover:bg-[#2a2a2a] flex items-center px-4 gap-2 text-sm text-foreground transition-colors"
          data-onboarding="new-button"
        >
          <Plus className="w-4 h-4" />
          New
          <ChevronDown className="w-3 h-3 ml-auto" />
        </button>

        {/* Dropdown Menu */}
        {newDropdownOpen && (
          <div className="absolute top-14 left-3 right-3 z-50 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden new-dropdown-container">
            <button
              onClick={handleNewClip}
              className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              New Clip
            </button>
            <button
              onClick={handleNewMovie}
              className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-[#2a2a2a] transition-colors flex items-center gap-2 border-t border-[#2a2a2a]"
            >
              <Plus className="w-4 h-4" />
              New Movie
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a]">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'conversations'
                ? 'bg-[#2a2a2a] text-foreground'
                : 'text-foreground-secondary hover:text-foreground'
            }`}
          >
            Clips
          </button>
          <button
            onClick={() => setActiveTab('movies')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'movies'
                ? 'bg-[#2a2a2a] text-foreground'
                : 'text-foreground-secondary hover:text-foreground'
            }`}
          >
            Movies
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
          <input
            type="text"
            placeholder={activeTab === 'conversations' ? 'Search conversations...' : 'Search movies...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:border-[#3a3a3a]"
          />
        </div>
      </div>

      {/* Clips Tab */}
      {activeTab === 'conversations' && (
        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
          {groupedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Video className="w-10 h-10 text-foreground-secondary mb-3 opacity-50" />
            <p className="text-sm text-foreground-secondary">
              {searchQuery ? 'No matching clips' : 'No clips yet'}
            </p>
            <p className="text-xs text-foreground-secondary mt-1 opacity-70">
              {searchQuery ? 'Try a different search' : 'Start creating videos!'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {groupedConversations.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-foreground-secondary hover:text-foreground w-full"
                >
                  {expandedGroups.has(group.label) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {group.label}
                  <span className="ml-auto text-foreground-secondary/50">
                    {group.conversations.length}
                  </span>
                </button>

                {/* Clips */}
                {expandedGroups.has(group.label) && (
                  <div className="mt-1 space-y-0.5">
                    {group.conversations.map((convo) => (
                      <div
                        key={convo.id}
                        className="relative"
                        onMouseEnter={() => setHoveredId(convo.id)}
                        onMouseLeave={() => {
                          setHoveredId(null)
                          if (menuOpenId === convo.id) setMenuOpenId(null)
                        }}
                      >
                        <button
                          onClick={() => handleSelectConversation(convo.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2 transition-all group ${
                            activeConversationId === convo.id
                              ? 'bg-[#2a2a2a]'
                              : 'hover:bg-[#1f1f1f]'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm truncate ${
                                activeConversationId === convo.id
                                  ? 'text-foreground'
                                  : 'text-foreground-secondary'
                              }`}
                            >
                              {convo.title}
                            </p>
                            <p className="text-xs text-foreground-secondary/60 mt-0.5">
                              {formatTime(convo.updatedAt)}
                              {convo.videos.length > 0 && (
                                <span className="ml-1.5">
                                  · {convo.videos.length} video{convo.videos.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Actions */}
                          {(hoveredId === convo.id || menuOpenId === convo.id) && (
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenId(menuOpenId === convo.id ? null : convo.id)
                                }}
                                className="p-1 rounded hover:bg-[#3a3a3a] text-foreground-secondary hover:text-foreground"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </button>

                        {/* Dropdown menu */}
                        {menuOpenId === convo.id && (
                          <div className="absolute right-2 top-full mt-1 z-50 bg-[#1f1f1f] border border-[#3a3a3a] rounded-lg shadow-lg py-1 min-w-[140px]">
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 text-left text-sm text-foreground-secondary hover:bg-[#2a2a2a] hover:text-foreground flex items-center gap-2"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Rename
                            </button>
                            <button
                              onClick={(e) => handleDeleteConversation(e, convo.id)}
                              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#2a2a2a] flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/* Movies Tab */}
      {activeTab === 'movies' && (
        <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
          {movies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Video className="w-10 h-10 text-foreground-secondary mb-3 opacity-50" />
              <p className="text-sm text-foreground-secondary">
                No movies yet
              </p>
              <p className="text-xs text-foreground-secondary mt-1 opacity-70">
                Create your first commercial!
              </p>
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {movies.map((movie) => (
                <div
                  key={movie.id}
                  className="relative"
                  onMouseEnter={() => setHoveredId(movie.id)}
                  onMouseLeave={() => {
                    setHoveredId(null)
                    if (menuOpenId === movie.id) setMenuOpenId(null)
                  }}
                >
                  <button
                    onClick={() => handleSelectMovie(movie.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2 transition-all group ${
                      activeMovieId === movie.id
                        ? 'bg-[#2a2a2a]'
                        : 'hover:bg-[#1f1f1f]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm truncate ${
                          activeMovieId === movie.id
                            ? 'text-foreground'
                            : 'text-foreground-secondary'
                        }`}
                      >
                        {movie.title}
                      </p>
                      <p className="text-xs text-foreground-secondary/60 mt-0.5">
                        {formatTime(movie.updatedAt)}
                        {movie.clips.length > 0 && (
                          <span className="ml-1.5">
                            · {movie.clips.length} clip{movie.clips.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      {/* Clip thumbnail strip */}
                      {movie.clips.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {movie.clips.slice(0, 4).map((clip, i) => (
                            <div key={clip.id} className="w-8 h-5 rounded overflow-hidden bg-[#0a0a0a] border border-[#2a2a2a]">
                              {clip.video?.thumbnailUrl ? (
                                <img src={clip.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-accent/10 to-purple-500/10" />
                              )}
                            </div>
                          ))}
                          {movie.clips.length > 4 && (
                            <div className="w-8 h-5 rounded bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center">
                              <span className="text-[8px] text-foreground-secondary">+{movie.clips.length - 4}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {(hoveredId === movie.id || menuOpenId === movie.id) && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === movie.id ? null : movie.id)
                          }}
                          className="p-1 rounded hover:bg-[#3a3a3a]"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </button>

                  {/* Context menu */}
                  {menuOpenId === movie.id && (
                    <div className="absolute right-2 top-12 z-10 w-36 rounded-lg bg-[#1a1a1a] border border-[#3a3a3a] shadow-xl overflow-hidden">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 text-left text-sm text-foreground-secondary hover:bg-[#2a2a2a] hover:text-foreground flex items-center gap-2"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (user?.id) {
                            await fetch(`/api/movies?id=${movie.id}&userId=${user.id}`, {
                              method: 'DELETE',
                            })
                          }
                          deleteMovie(movie.id)
                          setMenuOpenId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#2a2a2a] flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* YouTube Connection */}
      <div className="px-3 py-2 border-t border-[#2a2a2a]">
        <YouTubeConnect compact />
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-[#2a2a2a]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#1f1f1f] cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/60 to-accent flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-white">
              {(user?.name || 'G').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.name || 'Guest'}
            </p>
            <p className="text-xs text-foreground-secondary truncate">
              {user?.email || ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
