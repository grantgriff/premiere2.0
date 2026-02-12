'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { VideoPanel } from '@/components/layout/VideoPanel'
import { MultiModelVideoPanel } from '@/components/layout/MultiModelVideoPanel'
import { ChatPanel } from '@/components/layout/ChatPanel'
import { AnalyticsDashboard } from '@/components/ui/AnalyticsDashboard'
import { MovieTimeline } from '@/components/ui/MovieTimeline'
import { Video, BarChart3, LogOut, User, Info, Menu, MessageSquare } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { signOut } from '@/lib/auth'
import { useAppStore, useActiveMovie } from '@/lib/store'
import { OnboardingOverlay } from '@/components/ui/OnboardingOverlay'
import { WelcomePromptBar } from '@/components/ui/WelcomePromptBar'
import { useBreakpoint } from '@/hooks/useBreakpoint'

export default function Home() {
  const [activeView, setActiveView] = useState<'studio' | 'analytics'>('studio')
  const { user, loading } = useAuth()
  const setCharacters = useAppStore((state) => state.setCharacters)
  const setMovies = useAppStore((state) => state.setMovies)
  const multiModelMode = useAppStore((state) => state.multiModelMode)
  const multiModelGenerations = useAppStore((state) => state.multiModelGenerations)
  const activeMovie = useActiveMovie()
  const activeConversationId = useAppStore((state) => state.activeConversationId)
  const isGenerating = useAppStore((state) => state.isGenerating)
  const moviePlaylist = useAppStore((state) => state.moviePlaylist)

  // Responsive state
  const { isMobile, isTablet } = useBreakpoint()
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen)
  const setIsSidebarOpen = useAppStore((state) => state.setIsSidebarOpen)
  const activeMobileTab = useAppStore((state) => state.activeMobileTab)
  const setActiveMobileTab = useAppStore((state) => state.setActiveMobileTab)

  // Load characters and movies on app initialization
  useEffect(() => {
    if (user?.id) {
      loadCharacters()
      loadMovies()
    }
  }, [user?.id])

  const loadCharacters = async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/characters?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.characters) {
          setCharacters(data.characters.map((c: Record<string, unknown>) => ({
            ...c,
            createdAt: new Date(c.createdAt as string),
          })))
          console.log(`[App] Loaded ${data.characters.length} character(s) on initialization`)
        }
      }
    } catch (error) {
      console.error('[App] Failed to load characters on initialization:', error)
    }
  }

  const loadMovies = async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/movies?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.movies) {
          setMovies(data.movies.map((m: Record<string, unknown>) => ({
            id: m.id,
            userId: m.user_id ?? m.userId,
            title: m.title,
            description: m.description ?? null,
            thumbnailUrl: m.thumbnail_url ?? m.thumbnailUrl ?? null,
            createdAt: new Date((m.created_at ?? m.createdAt) as string),
            updatedAt: new Date((m.updated_at ?? m.updatedAt) as string),
            clips: ((m.clips as any[]) || []).map((c: any) => ({
              id: c.id,
              movieId: c.movie_id ?? c.movieId,
              videoId: c.video_id ?? c.videoId,
              position: c.position,
              firstFrameUrl: c.first_frame_url ?? c.firstFrameUrl ?? null,
              lastFrameUrl: c.last_frame_url ?? c.lastFrameUrl ?? null,
              createdAt: new Date((c.created_at ?? c.createdAt) as string),
              video: c.video ? {
                id: c.video.id,
                videoUrl: c.video.video_url ?? c.video.videoUrl ?? null,
                thumbnailUrl: c.video.thumbnail_url ?? c.video.thumbnailUrl ?? null,
                duration: c.video.duration,
                prompt: c.video.prompt,
                model: c.video.model,
              } : undefined,
            })),
          })))
          console.log(`[App] Loaded ${data.movies.length} movie(s) on initialization`)
        }
      }
    } catch (error) {
      console.error('[App] Failed to load movies on initialization:', error)
    }
  }

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
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-background">
      {/* Desktop: inline sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile/Tablet: overlay drawer */}
      {isSidebarOpen && (isMobile || isTablet) && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden animate-in slide-in-from-left-full">
            <Sidebar onClose={() => setIsSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View Toggle Header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background-secondary/30">
          {/* Hamburger menu for mobile/tablet */}
          {(isMobile || isTablet) && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-background-secondary rounded-lg mr-2"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
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
              <button
                onClick={() => window.dispatchEvent(new Event('start-onboarding'))}
                className="p-1.5 rounded-md text-foreground-secondary hover:text-foreground hover:bg-background-secondary transition-colors"
                title="How it works"
              >
                <Info className="w-4 h-4" />
              </button>
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
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'studio' ? (
            <>
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Video Panel - responsive visibility */}
                <div className={`
                  flex-1 flex flex-col overflow-hidden
                  ${isMobile && activeMobileTab !== 'video' ? 'hidden' : ''}
                `}>
                  {moviePlaylist.length > 0 ? (
                    /* Movie playlist active — always show VideoPanel */
                    <VideoPanel />
                  ) : !activeConversationId && !isGenerating ? (
                    /* Welcome state - centered prompt bar */
                    <div className="flex-1 flex items-center justify-center bg-background px-4">
                      <WelcomePromptBar onSubmit={(prompt, uploadedFiles) => {
                        // Focus the ChatPanel input and trigger submission
                        // We set the input via a custom event the ChatPanel listens for
                        window.dispatchEvent(new CustomEvent('welcome-prompt-submit', { detail: { prompt, uploadedFiles } }))
                      }} />
                    </div>
                  ) : multiModelMode ? (
                    <MultiModelVideoPanel generations={multiModelGenerations} />
                  ) : (
                    <VideoPanel />
                  )}
                </div>

                {/* Chat Panel - responsive width and visibility */}
                <div className={`
                  w-full lg:w-[360px] flex flex-col
                  ${isMobile && activeMobileTab !== 'chat' ? 'hidden' : ''}
                  ${isTablet ? 'max-h-[50vh] border-t' : ''}
                  ${(!activeConversationId && !isGenerating) || moviePlaylist.length > 0 ? 'sr-only' : ''}
                `}>
                  <ChatPanel />
                </div>
              </div>

              {/* Mobile tab navigation - only on mobile */}
              {isMobile && activeConversationId && (
                <nav className="flex border-t border-border bg-background safe-bottom">
                  <button
                    onClick={() => setActiveMobileTab('video')}
                    className={`flex-1 py-3 text-sm font-medium flex flex-col items-center gap-1 ${
                      activeMobileTab === 'video'
                        ? 'text-accent border-t-2 border-accent'
                        : 'text-foreground-secondary'
                    }`}
                  >
                    <Video className="w-5 h-5" />
                    Video
                  </button>
                  <button
                    onClick={() => setActiveMobileTab('chat')}
                    className={`flex-1 py-3 text-sm font-medium flex flex-col items-center gap-1 ${
                      activeMobileTab === 'chat'
                        ? 'text-accent border-t-2 border-accent'
                        : 'text-foreground-secondary'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    Chat
                  </button>
                </nav>
              )}

              {/* Movie Timeline at bottom */}
              {activeMovie && <MovieTimeline />}
            </>
          ) : (
            <div className="flex-1 overflow-hidden">
              <AnalyticsDashboard />
            </div>
          )}
        </div>
      </div>

      {/* Onboarding for new users */}
      <OnboardingOverlay />
    </div>
  )
}
