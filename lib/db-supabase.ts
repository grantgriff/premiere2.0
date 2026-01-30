// Real Supabase Database Layer
// Uses Supabase tables for persistent storage

import { supabase, createServerClient } from './supabase'
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
  avatar_url: string | null
  credits: number
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  media_urls: string[]
  created_at: string
}

export interface Video {
  id: string
  conversation_id: string
  user_id: string
  prompt: string
  model: VideoModel
  duration: number
  video_url: string | null
  thumbnail_url: string | null
  status: VideoStatus
  quality_score: number | null
  quality_report: Record<string, unknown> | null
  style_reference_urls: string[]
  character_ids: string[]
  metadata: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

export interface Character {
  id: string
  user_id: string
  name: string
  description: string
  reference_image_url: string | null
  embedding_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// Database operations
export const db = {
  // User operations
  user: {
    async findById(id: string): Promise<User | null> {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) return null
      return data as User
    },

    async findByEmail(email: string): Promise<User | null> {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error || !data) return null
      return data as User
    },

    async create(userData: Partial<User>): Promise<User> {
      const user = {
        id: userData.id || generateId(),
        email: userData.email || '',
        name: userData.name || '',
        avatar_url: userData.avatar_url || null,
        credits: userData.credits ?? 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single()

      if (error) {
        console.error('Error creating user:', error)
        throw new Error('Failed to create user')
      }

      return data as User
    },

    async update(id: string, updates: Partial<User>): Promise<User> {
      const { data, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating user:', error)
        throw new Error('Failed to update user')
      }

      return data as User
    },

    async updateCredits(id: string, delta: number): Promise<User> {
      // Get current credits first
      const user = await this.findById(id)
      if (!user) throw new Error('User not found')

      const newCredits = Math.max(0, user.credits + delta)
      return this.update(id, { credits: newCredits })
    },

    async upsertFromAuth(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): Promise<User> {
      const existing = await this.findById(authUser.id)

      if (existing) {
        // Update existing user
        return this.update(authUser.id, {
          email: authUser.email || existing.email,
          name: (authUser.user_metadata?.full_name as string) || (authUser.user_metadata?.name as string) || existing.name,
          avatar_url: (authUser.user_metadata?.avatar_url as string) || (authUser.user_metadata?.picture as string) || existing.avatar_url,
        })
      }

      // Create new user
      return this.create({
        id: authUser.id,
        email: authUser.email || '',
        name: (authUser.user_metadata?.full_name as string) || (authUser.user_metadata?.name as string) || authUser.email?.split('@')[0] || 'User',
        avatar_url: (authUser.user_metadata?.avatar_url as string) || (authUser.user_metadata?.picture as string) || null,
        credits: 100, // Welcome credits
      })
    },
  },

  // Conversation operations
  conversation: {
    async findById(id: string): Promise<Conversation | null> {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) return null
      return data as Conversation
    },

    async findByUser(userId: string): Promise<Conversation[]> {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching conversations:', error)
        return []
      }

      return (data || []) as Conversation[]
    },

    async create(conversationData: Partial<Conversation>): Promise<Conversation> {
      const conversation = {
        id: conversationData.id || generateId(),
        user_id: conversationData.user_id || '',
        title: conversationData.title || 'New Conversation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert(conversation)
        .select()
        .single()

      if (error) {
        console.error('Error creating conversation:', error)
        throw new Error('Failed to create conversation')
      }

      return data as Conversation
    },

    async update(id: string, updates: Partial<Conversation>): Promise<Conversation> {
      const { data, error } = await supabase
        .from('conversations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating conversation:', error)
        throw new Error('Failed to update conversation')
      }

      return data as Conversation
    },

    async delete(id: string): Promise<void> {
      // Delete related messages and videos first
      await supabase.from('messages').delete().eq('conversation_id', id)
      await supabase.from('videos').delete().eq('conversation_id', id)

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting conversation:', error)
        throw new Error('Failed to delete conversation')
      }
    },
  },

  // Message operations
  message: {
    async findByConversation(conversationId: string): Promise<Message[]> {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
        return []
      }

      return (data || []) as Message[]
    },

    async create(messageData: Partial<Message>): Promise<Message> {
      const message = {
        id: messageData.id || generateId(),
        conversation_id: messageData.conversation_id || '',
        role: messageData.role || 'user',
        content: messageData.content || '',
        media_urls: messageData.media_urls || [],
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single()

      if (error) {
        console.error('Error creating message:', error)
        throw new Error('Failed to create message')
      }

      // Update conversation's updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', message.conversation_id)

      return data as Message
    },
  },

  // Video operations
  video: {
    async findById(id: string): Promise<Video | null> {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) return null
      return data as Video
    },

    async findByUser(userId: string): Promise<Video[]> {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching videos:', error)
        return []
      }

      return (data || []) as Video[]
    },

    async findByConversation(conversationId: string): Promise<Video[]> {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching videos:', error)
        return []
      }

      return (data || []) as Video[]
    },

    async create(videoData: Partial<Video>): Promise<Video> {
      const video = {
        id: videoData.id || generateId(),
        conversation_id: videoData.conversation_id || '',
        user_id: videoData.user_id || '',
        prompt: videoData.prompt || '',
        model: videoData.model || 'veo3_1',
        duration: videoData.duration || 5,
        video_url: videoData.video_url || null,
        thumbnail_url: videoData.thumbnail_url || null,
        status: videoData.status || 'pending',
        quality_score: videoData.quality_score || null,
        quality_report: videoData.quality_report || null,
        style_reference_urls: videoData.style_reference_urls || [],
        character_ids: videoData.character_ids || [],
        metadata: videoData.metadata || null,
        created_at: new Date().toISOString(),
        completed_at: videoData.completed_at || null,
      }

      const { data, error } = await supabase
        .from('videos')
        .insert(video)
        .select()
        .single()

      if (error) {
        console.error('Error creating video:', error)
        throw new Error('Failed to create video')
      }

      return data as Video
    },

    async update(id: string, updates: Partial<Video>): Promise<Video> {
      const { data, error } = await supabase
        .from('videos')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating video:', error)
        throw new Error('Failed to update video')
      }

      return data as Video
    },
  },

  // Character operations
  character: {
    async findById(id: string): Promise<Character | null> {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) return null
      return data as Character
    },

    async findByUser(userId: string): Promise<Character[]> {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching characters:', error)
        return []
      }

      return (data || []) as Character[]
    },

    async count(userId: string): Promise<number> {
      const { count, error } = await supabase
        .from('characters')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) {
        console.error('Error counting characters:', error)
        return 0
      }

      return count || 0
    },

    async create(characterData: Partial<Character>): Promise<Character> {
      const character = {
        id: characterData.id || generateId(),
        user_id: characterData.user_id || '',
        name: characterData.name || '',
        description: characterData.description || '',
        reference_image_url: characterData.reference_image_url || null,
        embedding_data: characterData.embedding_data || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('characters')
        .insert(character)
        .select()
        .single()

      if (error) {
        console.error('Error creating character:', error)
        throw new Error('Failed to create character')
      }

      return data as Character
    },

    async update(id: string, updates: Partial<Character>): Promise<Character> {
      const { data, error } = await supabase
        .from('characters')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating character:', error)
        throw new Error('Failed to update character')
      }

      return data as Character
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting character:', error)
        throw new Error('Failed to delete character')
      }
    },
  },
}

export default db
