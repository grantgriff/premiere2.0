'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { getCurrentUser, onAuthStateChange, type AuthUser } from '@/lib/auth'
import { useAppStore, Conversation, Video, Message } from '@/lib/store'
import { fetchConversations, fetchConversationDetails } from '@/lib/api'

type AuthContextType = {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  loadConversations: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  loadConversations: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const setStoreUser = useAppStore((state) => state.setUser)
  const setConversations = useAppStore((state) => state.setConversations)

  // Load conversations from database
  const loadConversations = useCallback(async () => {
    if (!user?.id) return

    try {
      const dbConversations = await fetchConversations(user.id)

      // Transform to store format
      const conversations: Conversation[] = await Promise.all(
        dbConversations.map(async (conv) => {
          // Fetch full details for each conversation
          const details = await fetchConversationDetails(conv.id, user.id)

          const messages: Message[] = (details?.messages || []).map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
            videoId: m.videoId || undefined,
          }))

          const videos: Video[] = (details?.videos || []).map(v => ({
            id: v.id,
            prompt: v.prompt,
            model: v.model,
            duration: v.duration,
            status: v.status,
            videoUrl: v.videoUrl,
            thumbnailUrl: v.thumbnailUrl,
            qualityScore: v.qualityScore,
            qualityReport: v.qualityReport as Video['qualityReport'],
            isVerifying: false,
            createdAt: new Date(v.createdAt),
            completedAt: v.completedAt ? new Date(v.completedAt) : null,
          }))

          return {
            id: conv.id,
            title: conv.title,
            messages,
            videos,
            createdAt: new Date(conv.createdAt),
            updatedAt: new Date(conv.updatedAt),
          }
        })
      )

      setConversations(conversations)
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }, [user?.id, setConversations])

  // Load conversations when user changes
  useEffect(() => {
    if (user) {
      // Update store user
      setStoreUser({
        id: user.id,
        name: user.name || 'User',
        email: user.email || '',
        avatarUrl: user.avatarUrl || null,
        credits: 100, // This should ideally come from the database
      })

      // Load conversations
      loadConversations()
    } else {
      // Clear conversations on logout
      setConversations([])
    }
  }, [user, setStoreUser, setConversations, loadConversations])

  useEffect(() => {
    // Get initial user
    getCurrentUser().then((user) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, loadConversations }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
