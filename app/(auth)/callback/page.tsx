'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      // Check for error in URL params first
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (errorParam) {
        setError(errorDescription || errorParam)
        return
      }

      // Get the singleton client
      const supabase = createBrowserClient()

      // Check if there's a code in the URL hash (Supabase may put it there)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')

      if (accessToken) {
        // Implicit flow - session is in the hash
        const { data: { session }, error } = await supabase.auth.getSession()
        if (session) {
          window.location.href = '/'
          return
        }
      }

      // Get the code from URL query params (PKCE flow)
      const code = searchParams.get('code')

      if (code) {
        try {
          // Exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Auth callback error:', error)
            // If PKCE verifier not found, clear storage and retry login
            if (error.message.includes('PKCE') || error.message.includes('code verifier')) {
              setError('Session expired. Please try signing in again.')
            } else {
              setError(error.message)
            }
            return
          }

          if (data.session) {
            // Success - redirect to dashboard
            window.location.href = '/'
            return
          }
        } catch (err) {
          console.error('Auth callback exception:', err)
          setError('An unexpected error occurred. Please try again.')
          return
        }
      }

      // No code - check if we already have a session
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        window.location.href = '/'
      } else {
        // No session and no code - redirect to login
        setTimeout(() => {
          window.location.href = '/login'
        }, 1000)
      }
    }

    handleCallback()
  }, [searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Sign in failed
          </h2>
          <p className="text-foreground-secondary mb-6">{error}</p>
          <a
            href="/login"
            className="btn-primary inline-block px-6 py-2"
          >
            Try again
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Signing you in...
        </h2>
        <p className="text-foreground-secondary">
          Please wait while we set up your account
        </p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-accent" />
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
