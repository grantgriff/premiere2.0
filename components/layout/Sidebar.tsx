'use client'

import { useState } from 'react'
import { Plus, MessageSquare, Settings, LogOut, Sparkles } from 'lucide-react'

interface Conversation {
  id: string
  title: string
  updatedAt: Date
}

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)

  // Placeholder user data - will be replaced with Supabase auth
  const user = {
    name: 'Guest User',
    avatarUrl: null,
    credits: 100,
  }

  const handleNewConversation = () => {
    const newConvo: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      updatedAt: new Date(),
    }
    setConversations([newConvo, ...conversations])
    setActiveConversation(newConvo.id)
  }

  return (
    <aside className="w-60 h-full flex flex-col panel">
      {/* User Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-accent font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name}
            </p>
            <p className="text-xs text-foreground-secondary flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {user.credits} credits
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
                onClick={() => setActiveConversation(convo.id)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  activeConversation === convo.id
                    ? 'bg-accent/20 text-foreground'
                    : 'text-foreground-secondary hover:bg-background-secondary hover:text-foreground'
                }`}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate text-sm">{convo.title}</span>
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
