import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Server-side Supabase client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Client-side Supabase client (for use in components)
export const createBrowserClient = () => {
  return createClientComponentClient()
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
