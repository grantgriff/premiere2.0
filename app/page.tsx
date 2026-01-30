'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { VideoPanel } from '@/components/layout/VideoPanel'
import { ChatPanel } from '@/components/layout/ChatPanel'
import { AnalyticsDashboard } from '@/components/ui/AnalyticsDashboard'
import { Video, BarChart3, LogOut, User } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { signOut } from '@/lib/auth'

export default function Home() {
  const [activeView, setActiveView] = useState<'studio' | 'analytics'>('studio')
  const { user, loading } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Sidebar - 240px fixed */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View Toggle Header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background-secondary/30">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-background-secondary">
            <button
              onClick={() => setActiveView('studio')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeView === 'studio'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              <Video className="w-4 h-4" />
              Studio
            </button>
            <button
              onClick={() => setActiveView('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeView === 'analytics'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
          </div>

          {/* User Menu */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-accent" />
                  </div>
                )}
                <span className="text-sm text-foreground-secondary hidden sm:inline">
                  {user.name}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-md text-foreground-secondary hover:text-foreground hover:bg-background-secondary transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Content based on active view */}
        <div className="flex-1 flex overflow-hidden">
          {activeView === 'studio' ? (
            <>
              {/* Center Panel - Flexible */}
              <VideoPanel />

              {/* Right Sidebar - 360px fixed */}
              <ChatPanel />
            </>
          ) : (
            <div className="flex-1 overflow-hidden">
              <AnalyticsDashboard />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
