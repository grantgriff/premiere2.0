import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

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
// Use this for automated backend tasks like uploading Veo base64 videos
export const supabaseAdmin = createClient(
  getSupabaseUrl(),
  getServiceRoleKey(),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
)

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
