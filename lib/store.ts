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
}

export interface Character {
  id: string
  name: string
  description: string
  referenceImageUrl: string | null
  thumbnailUrl: string | null
  gcsImageUri: string | null // Google Cloud Storage URI for Veo API
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

// Movie types
export interface MovieClip {
  id: string
  movieId: string
  videoId: string
  position: number
  firstFrameUrl: string | null
  lastFrameUrl: string | null
  createdAt: Date
  video?: {
    id: string
    videoUrl: string | null
    thumbnailUrl: string | null
    duration: number
    prompt: string
    model: VideoModel
  }
}

export interface Movie {
  id: string
  userId: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  createdAt: Date
  updatedAt: Date
  clips: MovieClip[]
}

interface AppState {
  // User
  user: User | null
  setUser: (user: User | null) => void

  // Conversations
  conversations: Conversation[]
  activeConversationId: string | null
  setConversations: (conversations: Conversation[]) => void
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

  // Movie playlist (for sequential playback)
  moviePlaylist: Video[]
  moviePlaylistIndex: number
  setMoviePlaylist: (videos: Video[], startIndex?: number) => void
  advanceMoviePlaylist: () => Video | null
  clearMoviePlaylist: () => void

  // Generation state
  isGenerating: boolean
  setIsGenerating: (value: boolean) => void
  generationProgress: number
  setGenerationProgress: (value: number) => void

  // Multi-model generation
  multiModelMode: boolean
  setMultiModelMode: (value: boolean) => void
  selectedModels: VideoModel[]
  toggleModelSelection: (model: VideoModel) => void
  clearModelSelection: () => void
  multiModelGenerations: Array<{
    model: VideoModel
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    video?: Video
    error?: string
  }>
  setMultiModelGenerations: (generations: Array<{
    model: VideoModel
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    video?: Video
    error?: string
  }>) => void

  // UI State
  selectedModel: VideoModel
  setSelectedModel: (model: VideoModel) => void
  selectedDuration: number
  setSelectedDuration: (duration: number) => void

  // Responsive UI State
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  activeMobileTab: 'video' | 'chat'
  setActiveMobileTab: (tab: 'video' | 'chat') => void

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

  // Movies
  movies: Movie[]
  activeMovieId: string | null
  setMovies: (movies: Movie[]) => void
  setActiveMovie: (id: string | null) => void
  addMovie: (movie: Movie) => void
  updateMovie: (id: string, updates: Partial<Movie>) => void
  deleteMovie: (id: string) => void
  addClipToMovie: (movieId: string, clip: MovieClip) => void
  removeClipFromMovie: (movieId: string, clipId: string) => void
  reorderClips: (movieId: string, clipOrders: Array<{ clipId: string; position: number }>) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // User - default to demo user
  user: {
    id: DEMO_USER,
    name: 'Demo User',
    email: 'demo@videocraft.ai',
    avatarUrl: null,
  },
  setUser: (user) => set({ user }),

  // Conversations
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
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

  // Movie playlist
  moviePlaylist: [],
  moviePlaylistIndex: 0,
  setMoviePlaylist: (videos, startIndex = 0) => set({
    moviePlaylist: videos,
    moviePlaylistIndex: startIndex,
    currentVideo: videos[startIndex] || null,
  }),
  advanceMoviePlaylist: () => {
    const current = get()
    const nextIndex = current.moviePlaylistIndex + 1
    if (nextIndex < current.moviePlaylist.length) {
      const nextVideo = current.moviePlaylist[nextIndex]
      set({ moviePlaylistIndex: nextIndex, currentVideo: nextVideo })
      return nextVideo
    }
    // End of playlist
    set({ moviePlaylist: [], moviePlaylistIndex: 0 })
    return null
  },
  clearMoviePlaylist: () => set({ moviePlaylist: [], moviePlaylistIndex: 0 }),
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

  // Multi-model generation
  multiModelMode: false,
  setMultiModelMode: (value) => set({ multiModelMode: value }),
  selectedModels: [],
  toggleModelSelection: (model) =>
    set((state) => ({
      selectedModels: state.selectedModels.includes(model)
        ? state.selectedModels.filter((m) => m !== model)
        : [...state.selectedModels, model],
    })),
  clearModelSelection: () => set({ selectedModels: [] }),
  multiModelGenerations: [],
  setMultiModelGenerations: (generations) => set({ multiModelGenerations: generations }),

  // UI State
  selectedModel: 'veo3_1',
  setSelectedModel: (model) => set({ selectedModel: model }),
  selectedDuration: 5,
  setSelectedDuration: (duration) => set({ selectedDuration: duration }),

  // Responsive UI State
  isSidebarOpen: false,
  setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
  activeMobileTab: 'video',
  setActiveMobileTab: (tab) => set({ activeMobileTab: tab }),

  // Characters
  characters: [],
  setCharacters: (characters) =>
    set((state) => {
      // Auto-clean stale selected character IDs
      const validCharacterIds = new Set(characters.map(c => c.id))
      const cleanedSelectedIds = state.selectedCharacterIds.filter(id => validCharacterIds.has(id))

      // Log if we're cleaning stale IDs
      const staleIds = state.selectedCharacterIds.filter(id => !validCharacterIds.has(id))
      if (staleIds.length > 0) {
        console.log(`[Store] Removing ${staleIds.length} stale character ID(s) from selection:`, staleIds)
      }

      return {
        characters,
        selectedCharacterIds: cleanedSelectedIds
      }
    }),
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
    set((state) => {
      // Validate that the character exists before selecting
      const characterExists = state.characters.some(c => c.id === id)

      if (!characterExists && !state.selectedCharacterIds.includes(id)) {
        console.warn(`[Store] Cannot select character ${id} - does not exist in character list`)
        return state // No change
      }

      return {
        selectedCharacterIds: state.selectedCharacterIds.includes(id)
          ? state.selectedCharacterIds.filter((cid) => cid !== id)
          : [...state.selectedCharacterIds, id],
      }
    }),
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

  // Movies
  movies: [],
  activeMovieId: null,
  setMovies: (movies) => set({ movies }),
  setActiveMovie: (id) => set({ activeMovieId: id }),
  addMovie: (movie) =>
    set((state) => ({
      movies: [movie, ...state.movies],
      activeMovieId: movie.id,
    })),
  updateMovie: (id, updates) =>
    set((state) => ({
      movies: state.movies.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m
      ),
    })),
  deleteMovie: (id) =>
    set((state) => ({
      movies: state.movies.filter((m) => m.id !== id),
      activeMovieId: state.activeMovieId === id ? null : state.activeMovieId,
    })),
  addClipToMovie: (movieId, clip) =>
    set((state) => ({
      movies: state.movies.map((m) =>
        m.id === movieId
          ? { ...m, clips: [...m.clips, clip].sort((a, b) => a.position - b.position), updatedAt: new Date() }
          : m
      ),
    })),
  removeClipFromMovie: (movieId, clipId) =>
    set((state) => ({
      movies: state.movies.map((m) =>
        m.id === movieId
          ? {
              ...m,
              clips: m.clips
                .filter((c) => c.id !== clipId)
                .map((c, index) => ({ ...c, position: index })), // Reorder positions
              updatedAt: new Date()
            }
          : m
      ),
    })),
  reorderClips: (movieId, clipOrders) =>
    set((state) => ({
      movies: state.movies.map((m) =>
        m.id === movieId
          ? {
              ...m,
              clips: m.clips.map((clip) => {
                const newOrder = clipOrders.find((o) => o.clipId === clip.id)
                return newOrder ? { ...clip, position: newOrder.position } : clip
              }).sort((a, b) => a.position - b.position),
              updatedAt: new Date(),
            }
          : m
      ),
    })),
}))

// Selectors
export const useActiveConversation = () => {
  const conversations = useAppStore((state) => state.conversations)
  const activeId = useAppStore((state) => state.activeConversationId)
  return conversations.find((c) => c.id === activeId) || null
}

export const useActiveMovie = () => {
  const movies = useAppStore((state) => state.movies)
  const activeId = useAppStore((state) => state.activeMovieId)
  return movies.find((m) => m.id === activeId) || null
}

// Analytics selectors
export const useAnalytics = () => {
  const conversations = useAppStore((state) => state.conversations)
  const youtubeUploads = useAppStore((state) => state.youtubeUploads)
  const characters = useAppStore((state) => state.characters)

  // Flatten all videos from conversations
  const allVideos = conversations.flatMap((c) => c.videos)

  // Total stats
  const totalVideos = allVideos.length
  const completedVideos = allVideos.filter((v) => v.status === 'completed').length
  const failedVideos = allVideos.filter((v) => v.status === 'failed').length
  const totalDuration = allVideos.reduce((sum, v) => sum + v.duration, 0)

  // Quality stats
  const videosWithQuality = allVideos.filter((v) => v.qualityScore !== null)
  const avgQualityScore =
    videosWithQuality.length > 0
      ? videosWithQuality.reduce((sum, v) => sum + (v.qualityScore || 0), 0) /
        videosWithQuality.length
      : 0

  // Model usage
  const modelUsage = allVideos.reduce((acc, v) => {
    acc[v.model] = (acc[v.model] || 0) + 1
    return acc
  }, {} as Record<VideoModel, number>)

  // Model quality scores
  const modelQuality = allVideos.reduce((acc, v) => {
    if (v.qualityScore !== null) {
      if (!acc[v.model]) {
        acc[v.model] = { total: 0, count: 0 }
      }
      acc[v.model].total += v.qualityScore
      acc[v.model].count += 1
    }
    return acc
  }, {} as Record<VideoModel, { total: number; count: number }>)

  const modelAvgQuality = Object.entries(modelQuality).reduce((acc, [model, data]) => {
    acc[model as VideoModel] = data.total / data.count
    return acc
  }, {} as Record<VideoModel, number>)

  // Recent videos (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentVideos = allVideos.filter((v) => new Date(v.createdAt) >= sevenDaysAgo)

  // Daily generation counts for chart
  const dailyGenerations = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const count = allVideos.filter((v) => {
      const created = new Date(v.createdAt)
      return created >= dayStart && created < dayEnd
    }).length

    return {
      date: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      count,
    }
  })

  return {
    totalVideos,
    completedVideos,
    failedVideos,
    totalDuration,
    avgQualityScore,
    modelUsage,
    modelAvgQuality,
    recentVideos,
    dailyGenerations,
    totalUploads: youtubeUploads.length,
    publishedUploads: youtubeUploads.filter((u) => u.status === 'published').length,
    totalCharacters: characters.length,
    readyCharacters: characters.filter((c) => c.embeddingStatus === 'ready').length,
  }
}

