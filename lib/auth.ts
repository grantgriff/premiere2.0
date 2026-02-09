import { createBrowserClient } from './supabase'
import type { Session } from '@supabase/supabase-js'

export type AuthUser = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

// Sign in with Google OAuth
export async function signInWithGoogle(redirectTo?: string) {
  const supabase = createBrowserClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Use server-side route handler for PKCE code exchange
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('Google sign-in error:', error)
    throw error
  }

  return data
}

// Sign in with GitHub OAuth
export async function signInWithGitHub(redirectTo?: string) {
  const supabase = createBrowserClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      // Use server-side route handler for PKCE code exchange
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('GitHub sign-in error:', error)
    throw error
  }

  return data
}

// Sign out
export async function signOut() {
  const supabase = createBrowserClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Sign-out error:', error)
    throw error
  }

  // Redirect to login page
  window.location.href = '/login'
}

// Get current session
export async function getSession(): Promise<Session | null> {
  const supabase = createBrowserClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Get session error:', error)
    return null
  }

  return session
}

// Get current user (browser/client-side only)
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = createBrowserClient()
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

// Listen to auth state changes
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const supabase = createBrowserClient()

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        const user: AuthUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
          avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
        }
        callback(user)
      } else {
        callback(null)
      }
    }
  )

  return () => subscription.unsubscribe()
}

// Exchange code for session (used in callback)
export async function exchangeCodeForSession(code: string) {
  const supabase = createBrowserClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Code exchange error:', error)
    throw error
  }

  return data
}
