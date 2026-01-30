// Global State Management with Zustand
import { create } from 'zustand'
import { DEMO_USER } from './db'
import { QualityReport } from './models/types'

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
  qualityReport: QualityReport | null
  isVerifying: boolean
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

export interface Character {
  id: string
  name: string
  description: string
  referenceImageUrl: string | null
  thumbnailUrl: string | null
  embeddingStatus: 'pending' | 'processing' | 'ready' | 'failed'
  createdAt: Date
  usageCount: number
}

// YouTube types
export type YouTubeUploadStatus = 'pending' | 'uploading' | 'processing' | 'published' | 'scheduled' | 'failed'
export type YouTubeVisibility = 'public' | 'unlisted' | 'private'

export interface YouTubeUpload {
  id: string
  videoId: string
  youtubeVideoId: string | null
  youtubeUrl: string | null
  title: string
  description: string
  tags: string[]
  visibility: YouTubeVisibility
  scheduledPublishAt: Date | null
  status: YouTubeUploadStatus
  uploadProgress: number
  error: string | null
  createdAt: Date
  publishedAt: Date | null
}

export interface YouTubeChannel {
  id: string
  channelId: string
  channelName: string
  channelThumbnail: string | null
  subscriberCount: number
  isConnected: boolean
  connectedAt: Date | null
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
  deleteConversation: (id: string) => void

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

  // Characters
  characters: Character[]
  setCharacters: (characters: Character[]) => void
  addCharacter: (character: Character) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  deleteCharacter: (id: string) => void
  selectedCharacterIds: string[]
  toggleCharacterSelection: (id: string) => void
  clearCharacterSelection: () => void

  // YouTube
  youtubeChannel: YouTubeChannel | null
  setYouTubeChannel: (channel: YouTubeChannel | null) => void
  youtubeUploads: YouTubeUpload[]
  addYouTubeUpload: (upload: YouTubeUpload) => void
  updateYouTubeUpload: (id: string, updates: Partial<YouTubeUpload>) => void
  deleteYouTubeUpload: (id: string) => void
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
  deleteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId:
        state.activeConversationId === id ? null : state.activeConversationId,
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

  // Characters
  characters: [],
  setCharacters: (characters) => set({ characters }),
  addCharacter: (character) =>
    set((state) => ({
      characters: [character, ...state.characters],
    })),
  updateCharacter: (id, updates) =>
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteCharacter: (id) =>
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== id),
      selectedCharacterIds: state.selectedCharacterIds.filter((cid) => cid !== id),
    })),
  selectedCharacterIds: [],
  toggleCharacterSelection: (id) =>
    set((state) => ({
      selectedCharacterIds: state.selectedCharacterIds.includes(id)
        ? state.selectedCharacterIds.filter((cid) => cid !== id)
        : [...state.selectedCharacterIds, id],
    })),
  clearCharacterSelection: () => set({ selectedCharacterIds: [] }),

  // YouTube
  youtubeChannel: null,
  setYouTubeChannel: (channel) => set({ youtubeChannel: channel }),
  youtubeUploads: [],
  addYouTubeUpload: (upload) =>
    set((state) => ({
      youtubeUploads: [upload, ...state.youtubeUploads],
    })),
  updateYouTubeUpload: (id, updates) =>
    set((state) => ({
      youtubeUploads: state.youtubeUploads.map((u) =>
        u.id === id ? { ...u, ...updates } : u
      ),
    })),
  deleteYouTubeUpload: (id) =>
    set((state) => ({
      youtubeUploads: state.youtubeUploads.filter((u) => u.id !== id),
    })),
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
