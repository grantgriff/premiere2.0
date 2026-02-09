import { createServerClient } from './supabase-server'

export type AuthUser = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

/**
 * Get current user (server-side for API routes)
 * 
 * NOTE: This file can only be imported server-side (API routes, Server Components)
 * For client-side auth, use lib/auth.ts instead
 */
export async function getCurrentUserServer(): Promise<AuthUser | null> {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
  }
}
