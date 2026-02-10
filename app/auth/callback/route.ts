import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription || error)}`)
  }

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    )

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
    }

    // Ensure user record exists in public.users table
    if (sessionData?.user) {
      try {
        const adminClient = getSupabaseAdmin()
        const { data: existingUser } = await adminClient
          .from('users')
          .select('id')
          .eq('id', sessionData.user.id)
          .single()

        // If user doesn't exist in public.users, create it
        if (!existingUser) {
          // Extract provider ID for google_id column
          const providerId = sessionData.user.identities?.[0]?.id
            || sessionData.user.id

          const { error: insertError } = await adminClient
            .from('users')
            .insert({
              id: sessionData.user.id,
              email: sessionData.user.email || '',
              name: sessionData.user.user_metadata?.full_name
                || sessionData.user.user_metadata?.name
                || sessionData.user.email?.split('@')[0]
                || 'User',
              avatar_url: sessionData.user.user_metadata?.avatar_url
                || sessionData.user.user_metadata?.picture
                || null,
              google_id: providerId,
            })

          if (insertError) {
            console.error('Failed to create user record:', insertError)
            // Don't block login, trigger will handle it
          } else {
            console.log('[Auth] Created user record for:', sessionData.user.email)
          }
        }
      } catch (error) {
        console.error('[Auth] Error checking/creating user record:', error)
        // Don't block login
      }
    }

    // Successfully authenticated - redirect to home
    return NextResponse.redirect(`${origin}/`)
  }

  // No code provided - redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
