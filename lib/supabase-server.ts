// Server-only Supabase client with user auth context
// This file uses next/headers and can ONLY be imported in server components/routes

import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseUrl, getPublicKey } from './supabase'

// Create server client with user's auth context from cookies (for API routes)
// This respects RLS policies based on the authenticated user
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRServerClient(
    getSupabaseUrl(),
    getPublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component - can be ignored
          }
        },
      },
    }
  )
}
