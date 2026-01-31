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
