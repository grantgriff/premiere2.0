import { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseUrl, getPublicKey } from './supabase'

/**
 * Create server client for API routes and Server Components
 * Uses cookies from next/headers for session management
 *
 * NOTE: This file can only be imported server-side (API routes, Server Components)
 * Do NOT import this in client components - it will cause build errors
 */
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
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
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
