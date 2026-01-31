import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

// Get the appropriate keys (supports both new and legacy formats)
const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || ''

const getPublicKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const getSecretKey = () =>
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Server-side Supabase client (with secret/service role key for admin operations)
export const supabase = createClient(
  getSupabaseUrl(),
  getSecretKey() || getPublicKey()
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

// Get server client with auth context (for API routes)
export const createServerClient = () => {
  return createClient(getSupabaseUrl(), getSecretKey() || getPublicKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  VIDEOS: 'videos',
  IMAGES: 'images',
  THUMBNAILS: 'thumbnails',
} as const

// Upload file to Supabase storage
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File | Blob
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    console.error('Storage upload error:', error)
    return null
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

// Delete file from Supabase storage
export async function deleteFromStorage(bucket: string, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    console.error('Storage delete error:', error)
    return false
  }

  return true
}
