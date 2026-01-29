// Mock Database Layer for Development
// In production, replace with actual Prisma client

import { generateId } from './utils'

// Types
export type MessageRole = 'user' | 'assistant' | 'system'
export type VideoModel = 'veo3_1' | 'runway' | 'luma' | 'sora' | 'odyssey' | 'world_labs'
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  googleId: string
  credits: number
  createdAt: Date
  updatedAt: Date
}

export interface Conversation {
  id: string
  userId: string
  title: string
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  mediaUrls: string[]
  createdAt: Date
}

export interface Video {
  id: string
  conversationId: string
  userId: string
  prompt: string
  model: VideoModel
  duration: number
  videoUrl: string | null
  thumbnailUrl: string | null
  status: VideoStatus
  qualityScore: number | null
  qualityReport: Record<string, unknown> | null
  styleReferenceUrls: string[]
  characterIds: string[]
  metadata: Record<string, unknown> | null
  createdAt: Date
  completedAt: Date | null
}

export interface Character {
  id: string
  userId: string
  name: string
  description: string
  referenceImageUrl: string | null
  embeddingData: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

// In-memory storage
const store = {
  users: new Map<string, User>(),
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, Message>(),
  videos: new Map<string, Video>(),
  characters: new Map<string, Character>(),
}

// Create a demo user on startup
const DEMO_USER_ID = 'demo-user-001'
store.users.set(DEMO_USER_ID, {
  id: DEMO_USER_ID,
  email: 'demo@videocraft.ai',
  name: 'Demo User',
  avatarUrl: null,
  googleId: 'demo-google-id',
  credits: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
})

// Mock Prisma-like interface
export const prisma = {
  user: {
    findUnique: async ({ where, select }: { where: { id?: string; email?: string; googleId?: string }; select?: Record<string, boolean> }) => {
      let user: User | null = null
      if (where.id) user = store.users.get(where.id) || null
      else {
        for (const u of store.users.values()) {
          if (where.email && u.email === where.email) { user = u; break }
          if (where.googleId && u.googleId === where.googleId) { user = u; break }
        }
      }
      if (!user) return null
      if (select) {
        const result: Record<string, unknown> = {}
        for (const key of Object.keys(select)) {
          if (select[key]) result[key] = (user as unknown as Record<string, unknown>)[key]
        }
        return result
      }
      return user
    },
    create: async ({ data }: { data: Partial<User> }) => {
      const user: User = {
        id: data.id || generateId(),
        email: data.email || '',
        name: data.name || '',
        avatarUrl: data.avatarUrl || null,
        googleId: data.googleId || '',
        credits: data.credits ?? 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      store.users.set(user.id, user)
      return user
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const user = store.users.get(where.id)
      if (!user) throw new Error('User not found')

      const credits = data.credits as { increment?: number; decrement?: number } | number | undefined
      if (credits && typeof credits === 'object') {
        if ('increment' in credits) user.credits += credits.increment || 0
        if ('decrement' in credits) user.credits -= credits.decrement || 0
      } else if (typeof credits === 'number') {
        user.credits = credits
      }

      const { credits: _, ...rest } = data
      Object.assign(user, { ...rest, updatedAt: new Date() })
      return user
    },
  },

  conversation: {
    findUnique: async ({ where, include }: { where: { id: string }; include?: { messages?: boolean; videos?: boolean } }) => {
      const conversation = store.conversations.get(where.id)
      if (!conversation) return null

      const result: Conversation & { messages?: Message[]; videos?: Video[] } = { ...conversation }

      if (include?.messages) {
        result.messages = Array.from(store.messages.values())
          .filter(m => m.conversationId === where.id)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      }
      if (include?.videos) {
        result.videos = Array.from(store.videos.values())
          .filter(v => v.conversationId === where.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }

      return result
    },
    findMany: async ({ where, orderBy }: { where?: { userId?: string }; orderBy?: Record<string, 'asc' | 'desc'> }) => {
      let results = Array.from(store.conversations.values())
      if (where?.userId) results = results.filter(c => c.userId === where.userId)
      if (orderBy?.createdAt) {
        results.sort((a, b) => orderBy.createdAt === 'desc'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime())
      }
      if (orderBy?.updatedAt) {
        results.sort((a, b) => orderBy.updatedAt === 'desc'
          ? b.updatedAt.getTime() - a.updatedAt.getTime()
          : a.updatedAt.getTime() - b.updatedAt.getTime())
      }
      return results
    },
    create: async ({ data }: { data: Partial<Conversation> }) => {
      const conversation: Conversation = {
        id: data.id || generateId(),
        userId: data.userId || '',
        title: data.title || 'New Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      store.conversations.set(conversation.id, conversation)
      return conversation
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Conversation> }) => {
      const conversation = store.conversations.get(where.id)
      if (!conversation) throw new Error('Conversation not found')
      Object.assign(conversation, { ...data, updatedAt: new Date() })
      return conversation
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const conversation = store.conversations.get(where.id)
      store.conversations.delete(where.id)
      // Also delete related messages and videos
      for (const [id, msg] of store.messages) {
        if (msg.conversationId === where.id) store.messages.delete(id)
      }
      for (const [id, video] of store.videos) {
        if (video.conversationId === where.id) store.videos.delete(id)
      }
      return conversation
    },
  },

  message: {
    findMany: async ({ where, orderBy }: { where?: { conversationId?: string }; orderBy?: Record<string, 'asc' | 'desc'> }) => {
      let results = Array.from(store.messages.values())
      if (where?.conversationId) results = results.filter(m => m.conversationId === where.conversationId)
      if (orderBy?.createdAt) {
        results.sort((a, b) => orderBy.createdAt === 'desc'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime())
      }
      return results
    },
    create: async ({ data }: { data: Partial<Message> }) => {
      const message: Message = {
        id: data.id || generateId(),
        conversationId: data.conversationId || '',
        role: data.role || 'user',
        content: data.content || '',
        mediaUrls: data.mediaUrls || [],
        createdAt: new Date(),
      }
      store.messages.set(message.id, message)

      // Update conversation's updatedAt
      const conversation = store.conversations.get(message.conversationId)
      if (conversation) {
        conversation.updatedAt = new Date()
      }

      return message
    },
  },

  video: {
    findUnique: async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
      const video = store.videos.get(where.id)
      if (!video) return null
      if (select) {
        const result: Record<string, unknown> = {}
        for (const key of Object.keys(select)) {
          if (select[key]) result[key] = (video as unknown as Record<string, unknown>)[key]
        }
        return result
      }
      return video
    },
    findMany: async ({ where, orderBy }: { where?: { conversationId?: string; userId?: string }; orderBy?: Record<string, 'asc' | 'desc'> }) => {
      let results = Array.from(store.videos.values())
      if (where?.conversationId) results = results.filter(v => v.conversationId === where.conversationId)
      if (where?.userId) results = results.filter(v => v.userId === where.userId)
      if (orderBy?.createdAt) {
        results.sort((a, b) => orderBy.createdAt === 'desc'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime())
      }
      return results
    },
    findFirst: async ({ where }: { where: { metadata?: { path: string[]; equals: string } } }) => {
      // Simplified - in production use proper JSON querying
      return null
    },
    create: async ({ data }: { data: Partial<Video> }) => {
      const video: Video = {
        id: data.id || generateId(),
        conversationId: data.conversationId || '',
        userId: data.userId || '',
        prompt: data.prompt || '',
        model: data.model || 'veo3_1',
        duration: data.duration || 5,
        videoUrl: data.videoUrl || null,
        thumbnailUrl: data.thumbnailUrl || null,
        status: data.status || 'pending',
        qualityScore: data.qualityScore || null,
        qualityReport: data.qualityReport || null,
        styleReferenceUrls: data.styleReferenceUrls || [],
        characterIds: data.characterIds || [],
        metadata: data.metadata || null,
        createdAt: new Date(),
        completedAt: data.completedAt || null,
      }
      store.videos.set(video.id, video)
      return video
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const video = store.videos.get(where.id)
      if (!video) throw new Error('Video not found')
      Object.assign(video, data)
      return video
    },
  },

  character: {
    findUnique: async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
      const character = store.characters.get(where.id)
      if (!character) return null
      if (select) {
        const result: Record<string, unknown> = {}
        for (const key of Object.keys(select)) {
          if (select[key]) result[key] = (character as unknown as Record<string, unknown>)[key]
        }
        return result
      }
      return character
    },
    findMany: async ({ where, orderBy }: { where?: { userId?: string }; orderBy?: Record<string, 'asc' | 'desc'> }) => {
      let results = Array.from(store.characters.values())
      if (where?.userId) results = results.filter(c => c.userId === where.userId)
      if (orderBy?.createdAt) {
        results.sort((a, b) => orderBy.createdAt === 'desc'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime())
      }
      return results
    },
    count: async ({ where }: { where?: { userId?: string } }) => {
      let count = 0
      for (const char of store.characters.values()) {
        if (!where?.userId || char.userId === where.userId) count++
      }
      return count
    },
    create: async ({ data }: { data: Partial<Character> }) => {
      const character: Character = {
        id: data.id || generateId(),
        userId: data.userId || '',
        name: data.name || '',
        description: data.description || '',
        referenceImageUrl: data.referenceImageUrl || null,
        embeddingData: data.embeddingData || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      store.characters.set(character.id, character)
      return character
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Character> }) => {
      const character = store.characters.get(where.id)
      if (!character) throw new Error('Character not found')
      Object.assign(character, { ...data, updatedAt: new Date() })
      return character
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const character = store.characters.get(where.id)
      store.characters.delete(where.id)
      return character
    },
  },
}

// Export demo user ID for development
export const DEMO_USER = DEMO_USER_ID

// Helper to get all data (for debugging)
export const getStore = () => ({
  users: Array.from(store.users.values()),
  conversations: Array.from(store.conversations.values()),
  messages: Array.from(store.messages.values()),
  videos: Array.from(store.videos.values()),
  characters: Array.from(store.characters.values()),
})

export default prisma
