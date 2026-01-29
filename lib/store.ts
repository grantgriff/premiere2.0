// Global State Management with Zustand
import { create } from 'zustand'
import { DEMO_USER } from './db'

// Types
export type VideoModel = 'veo3_1' | 'runway' | 'luma' | 'sora' | 'odyssey' | 'world_labs'
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  videoId?: string
}

export interface Video {
  id: string
  prompt: string
  model: VideoModel
  duration: number
  status: VideoStatus
  videoUrl: string | null
  thumbnailUrl: string | null
  qualityScore: number | null
  createdAt: Date
  completedAt: Date | null
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  videos: Video[]
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  credits: number
}

interface AppState {
  // User
  user: User | null
  setUser: (user: User | null) => void

  // Conversations
  conversations: Conversation[]
  activeConversationId: string | null
  setActiveConversation: (id: string | null) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void

  // Messages
  addMessage: (conversationId: string, message: Message) => void

  // Videos
  currentVideo: Video | null
  setCurrentVideo: (video: Video | null) => void
  addVideo: (conversationId: string, video: Video) => void
  updateVideo: (conversationId: string, videoId: string, updates: Partial<Video>) => void

  // Generation state
  isGenerating: boolean
  setIsGenerating: (value: boolean) => void
  generationProgress: number
  setGenerationProgress: (value: number) => void

  // UI State
  selectedModel: VideoModel
  setSelectedModel: (model: VideoModel) => void
  selectedDuration: number
  setSelectedDuration: (duration: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // User - default to demo user
  user: {
    id: DEMO_USER,
    name: 'Demo User',
    email: 'demo@videocraft.ai',
    avatarUrl: null,
    credits: 100,
  },
  setUser: (user) => set({ user }),

  // Conversations
  conversations: [],
  activeConversationId: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    })),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      ),
    })),

  // Messages
  addMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message], updatedAt: new Date() }
          : c
      ),
    })),

  // Videos
  currentVideo: null,
  setCurrentVideo: (video) => set({ currentVideo: video }),
  addVideo: (conversationId, video) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, videos: [...c.videos, video], updatedAt: new Date() }
          : c
      ),
    })),
  updateVideo: (conversationId, videoId, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              videos: c.videos.map((v) =>
                v.id === videoId ? { ...v, ...updates } : v
              ),
            }
          : c
      ),
      currentVideo:
        state.currentVideo?.id === videoId
          ? { ...state.currentVideo, ...updates }
          : state.currentVideo,
    })),

  // Generation state
  isGenerating: false,
  setIsGenerating: (value) => set({ isGenerating: value }),
  generationProgress: 0,
  setGenerationProgress: (value) => set({ generationProgress: value }),

  // UI State
  selectedModel: 'veo3_1',
  setSelectedModel: (model) => set({ selectedModel: model }),
  selectedDuration: 5,
  setSelectedDuration: (duration) => set({ selectedDuration: duration }),
}))

// Selectors
export const useActiveConversation = () => {
  const conversations = useAppStore((state) => state.conversations)
  const activeId = useAppStore((state) => state.activeConversationId)
  return conversations.find((c) => c.id === activeId) || null
}

export const useUserCredits = () => {
  return useAppStore((state) => state.user?.credits ?? 0)
}
