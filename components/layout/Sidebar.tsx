'use client'

import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Video,
  MoreHorizontal,
  Trash2,
  Pencil,
  Sparkles,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday']))
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Global state
  const user = useAppStore((state) => state.user)
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const setActiveConversation = useAppStore((state) => state.setActiveConversation)
  const deleteConversation = useAppStore((state) => state.deleteConversation)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)

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

  const handleNewConversation = () => {
    setCurrentVideo(null)
    setActiveConversation(null)
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
      {/* Header with New Chat */}
      <div className="p-3">
        <button
          onClick={handleNewConversation}
          className="w-full h-10 rounded-lg border border-[#3a3a3a] hover:bg-[#2a2a2a] flex items-center justify-center gap-2 text-sm text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          New video
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:border-[#3a3a3a]"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
        {groupedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Video className="w-10 h-10 text-foreground-secondary mb-3 opacity-50" />
            <p className="text-sm text-foreground-secondary">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
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

                {/* Conversations */}
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
            <p className="text-xs text-foreground-secondary flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {user?.credits ?? 0} credits
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
