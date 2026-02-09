import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient as createSSRBrowserClient, createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Get the appropriate keys (supports both new and legacy formats)
export const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export const getPublicKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const getServiceRoleKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Server-side Supabase client (basic, no auth context - for client uploads etc)
export const supabase = createClient(
  getSupabaseUrl(),
  getPublicKey()
)

// Service role client for backend operations (bypasses RLS)
// Lazily initialized to avoid build errors when env var not available
let _supabaseAdmin: SupabaseClient | null = null

export const getSupabaseAdmin = (): SupabaseClient => {
  if (_supabaseAdmin) return _supabaseAdmin

  const serviceRoleKey = getServiceRoleKey()
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for admin operations')
  }

  _supabaseAdmin = createClient(
    getSupabaseUrl(),
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  )

  return _supabaseAdmin
}

// Singleton browser client - stored globally to prevent multiple instances
let browserClient: SupabaseClient | null = null

// Create or return the singleton browser client using @supabase/ssr
// This handles PKCE code verifier storage in cookies automatically
export const createBrowserClient = (): SupabaseClient => {
  if (typeof window === 'undefined') {
    // Server-side: create a basic client (no persistence needed)
    return createClient(getSupabaseUrl(), getPublicKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  }

  // Client-side: use @supabase/ssr for proper cookie-based PKCE storage
  if (!browserClient) {
    browserClient = createSSRBrowserClient(
      getSupabaseUrl(),
      getPublicKey()
    )
  }
  return browserClient
}

// Get the singleton client (alias for consistency)
export const getBrowserClient = createBrowserClient

// Create server client for API routes and Server Components
// Uses cookies from next/headers for session management
export async function createServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createSSRServerClient(
    getSupabaseUrl(),
    getPublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  VIDEOS: 'videos',
  IMAGES: 'images',
  THUMBNAILS: 'thumbnails',
} as const

// Upload file to Supabase storage (uses browser client on client-side)
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File | Blob
): Promise<string | null> {
  // Use browser client for uploads (has user auth context)
  const client = typeof window !== 'undefined' ? createBrowserClient() : supabase

  const { data, error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    console.error('Storage upload error:', error)
    return null
  }

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

// Delete file from Supabase storage
export async function deleteFromStorage(bucket: string, path: string): Promise<boolean> {
  const client = typeof window !== 'undefined' ? createBrowserClient() : supabase

  const { error } = await client.storage.from(bucket).remove([path])

  if (error) {
    console.error('Storage delete error:', error)
    return false
  }

  return true
}
