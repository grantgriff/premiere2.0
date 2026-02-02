// Supabase Database Integration
// Uses user's auth session from cookies for RLS-protected operations

import { createServerClient } from './supabase-server'

// Types matching our schema
export interface DbUser {
  id: string
  email: string
  name: string
  avatar_url: string | null
  credits: number
  created_at: string
  updated_at: string
}

export interface DbCharacter {
  id: string
  user_id: string
  name: string
  description: string
  reference_image_url: string | null
  thumbnail_url: string | null
  embedding_status: 'pending' | 'processing' | 'ready' | 'failed'
  created_at: string
  updated_at: string
}

export interface DbVideo {
  id: string
  user_id: string
  conversation_id: string | null
  prompt: string
  model: string
  duration: number
  video_url: string | null
  thumbnail_url: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  quality_score: number | null
  quality_report: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

export interface DbConversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

// Character operations
export async function createCharacter(data: {
  id: string
  userId: string
  name: string
  description: string
  referenceImageUrl?: string | null
  thumbnailUrl?: string | null
}): Promise<DbCharacter | null> {
  const supabase = await createServerClient()

  const { data: character, error } = await supabase
    .from('characters')
    .insert({
      id: data.id,
      user_id: data.userId,
      name: data.name,
      description: data.description,
      reference_image_url: data.referenceImageUrl || null,
      thumbnail_url: data.thumbnailUrl || null,
      embedding_status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating character:', error)
    return null
  }

  return character
}

export async function getCharacters(userId: string): Promise<DbCharacter[]> {
  const supabase = await createServerClient()

  const { data: characters, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching characters:', error)
    return []
  }

  return characters || []
}

export async function updateCharacter(
  id: string,
  userId: string,
  data: Partial<{
    name: string
    description: string
    referenceImageUrl: string | null
    thumbnailUrl: string | null
    embeddingStatus: 'pending' | 'processing' | 'ready' | 'failed'
  }>
): Promise<DbCharacter | null> {
  const supabase = await createServerClient()

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.referenceImageUrl !== undefined) updateData.reference_image_url = data.referenceImageUrl
  if (data.thumbnailUrl !== undefined) updateData.thumbnail_url = data.thumbnailUrl
  if (data.embeddingStatus !== undefined) updateData.embedding_status = data.embeddingStatus
  updateData.updated_at = new Date().toISOString()

  const { data: character, error } = await supabase
    .from('characters')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating character:', error)
    return null
  }

  return character
}

export async function deleteCharacter(id: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting character:', error)
    return false
  }

  return true
}

// User operations
export async function getOrCreateUser(authUser: {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}): Promise<DbUser | null> {
  const supabase = await createServerClient()

  // Try to get existing user
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (existingUser) {
    return existingUser
  }

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      avatar_url: authUser.avatarUrl,
      credits: 100,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating user:', error)
    return null
  }

  return newUser
}

export async function getUserCredits(userId: string): Promise<number> {
  const supabase = await createServerClient()

  const { data: user } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single()

  return user?.credits ?? 0
}

export async function updateUserCredits(
  userId: string,
  creditChange: number
): Promise<number | null> {
  const supabase = await createServerClient()

  const { data: user } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single()

  if (!user) return null

  const newCredits = Math.max(0, user.credits + creditChange)

  const { error } = await supabase
    .from('users')
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    console.error('Error updating credits:', error)
    return null
  }

  return newCredits
}

// Message type for database
export interface DbMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  video_id: string | null
  created_at: string
}

// Conversation operations
export async function createConversation(data: {
  id: string
  userId: string
  title: string
}): Promise<DbConversation | null> {
  const supabase = await createServerClient()

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      id: data.id,
      user_id: data.userId,
      title: data.title,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    return null
  }

  return conversation
}

export async function getConversations(userId: string): Promise<DbConversation[]> {
  const supabase = await createServerClient()

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }

  return conversations || []
}

export async function getConversationWithDetails(
  conversationId: string,
  userId: string
): Promise<{ conversation: DbConversation; messages: DbMessage[]; videos: DbVideo[] } | null> {
  const supabase = await createServerClient()

  // Get conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single()

  if (convError || !conversation) {
    console.error('Error fetching conversation:', convError)
    return null
  }

  // Get messages
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (msgError) {
    console.error('Error fetching messages:', msgError)
  }

  // Get videos
  const { data: videos, error: vidError } = await supabase
    .from('videos')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })

  if (vidError) {
    console.error('Error fetching videos:', vidError)
  }

  return {
    conversation,
    messages: messages || [],
    videos: videos || [],
  }
}

export async function updateConversation(
  id: string,
  userId: string,
  data: Partial<{ title: string }>
): Promise<DbConversation | null> {
  const supabase = await createServerClient()

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (data.title !== undefined) updateData.title = data.title

  const { data: conversation, error } = await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating conversation:', error)
    return null
  }

  return conversation
}

export async function deleteConversation(id: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient()

  // Delete messages first (cascade)
  await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', id)

  // Delete videos
  await supabase
    .from('videos')
    .delete()
    .eq('conversation_id', id)

  // Delete conversation
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting conversation:', error)
    return false
  }

  return true
}

// Message operations
export async function createMessage(data: {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  videoId?: string | null
}): Promise<DbMessage | null> {
  const supabase = await createServerClient()

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      id: data.id,
      conversation_id: data.conversationId,
      role: data.role,
      content: data.content,
      video_id: data.videoId || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating message:', error)
    return null
  }

  // Update conversation's updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', data.conversationId)

  return message
}

export async function getMessages(conversationId: string): Promise<DbMessage[]> {
  const supabase = await createServerClient()

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }

  return messages || []
}

// Video operations (extend existing)
export async function createVideo(data: {
  id: string
  userId: string
  conversationId: string | null
  prompt: string
  model: string
  duration: number
  status?: 'pending' | 'processing' | 'completed' | 'failed'
}): Promise<DbVideo | null> {
  const supabase = await createServerClient()

  const { data: video, error } = await supabase
    .from('videos')
    .insert({
      id: data.id,
      user_id: data.userId,
      conversation_id: data.conversationId,
      prompt: data.prompt,
      model: data.model,
      duration: data.duration,
      status: data.status || 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating video:', error)
    return null
  }

  return video
}

export async function updateVideo(
  id: string,
  data: Partial<{
    status: 'pending' | 'processing' | 'completed' | 'failed'
    videoUrl: string | null
    thumbnailUrl: string | null
    qualityScore: number | null
    qualityReport: Record<string, unknown> | null
  }>
): Promise<DbVideo | null> {
  const supabase = await createServerClient()

  const updateData: Record<string, unknown> = {}
  if (data.status !== undefined) updateData.status = data.status
  if (data.videoUrl !== undefined) updateData.video_url = data.videoUrl
  if (data.thumbnailUrl !== undefined) updateData.thumbnail_url = data.thumbnailUrl
  if (data.qualityScore !== undefined) updateData.quality_score = data.qualityScore
  if (data.qualityReport !== undefined) updateData.quality_report = data.qualityReport
  if (data.status === 'completed') updateData.completed_at = new Date().toISOString()

  const { data: video, error } = await supabase
    .from('videos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating video:', error)
    return null
  }

  return video
}

export async function getVideos(userId: string): Promise<DbVideo[]> {
  const supabase = await createServerClient()

  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching videos:', error)
    return []
  }

  return videos || []
}
