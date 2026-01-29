'use client'

import { Plus, MessageSquare, Settings, LogOut, Sparkles, Trash2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function Sidebar() {
  // Global state from store
  const user = useAppStore((state) => state.user)
  const conversations = useAppStore((state) => state.conversations)
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const setActiveConversation = useAppStore((state) => state.setActiveConversation)
  const addConversation = useAppStore((state) => state.addConversation)
  const deleteConversation = useAppStore((state) => state.deleteConversation)
  const setCurrentVideo = useAppStore((state) => state.setCurrentVideo)

  const handleNewConversation = () => {
    // Clear current video when starting new conversation
    setCurrentVideo(null)
    // Set active conversation to null to show empty state
    setActiveConversation(null)
  }

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id)
    // Find the conversation and set its latest video as current
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

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteConversation(id)
    if (activeConversationId === id) {
      setActiveConversation(null)
      setCurrentVideo(null)
    }
  }

  return (
    <aside className="w-60 h-full flex flex-col panel">
      {/* User Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-accent font-medium">
                {(user?.name || 'G').charAt(0).toUpperCase()}
              </span>
            )}
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

      {/* New Conversation Button */}
      <div className="p-4">
        <button
          onClick={handleNewConversation}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Video
        </button>
      </div>

      {/* Conversation History */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-2">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-foreground-secondary text-sm">
            No conversations yet.
            <br />
            Start creating!
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => handleSelectConversation(convo.id)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors group ${
                  activeConversationId === convo.id
                    ? 'bg-accent/20 text-foreground'
                    : 'text-foreground-secondary hover:bg-background-secondary hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate text-sm flex-1">{convo.title}</span>
                <Trash2
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400 transition-opacity flex-shrink-0"
                  onClick={(e) => handleDeleteConversation(e, convo.id)}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <button className="w-full btn-ghost flex items-center gap-2 text-sm">
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button className="w-full btn-ghost flex items-center gap-2 text-sm text-foreground-secondary">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
