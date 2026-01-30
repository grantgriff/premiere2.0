'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createBrowserClient()

      // Check for error in URL params
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (errorParam) {
        setError(errorDescription || errorParam)
        return
      }

      // Get the code from URL
      const code = searchParams.get('code')

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Auth callback error:', error)
            setError(error.message)
            return
          }

          // Success - redirect to dashboard
          window.location.href = '/'
        } catch (err) {
          console.error('Auth callback exception:', err)
          setError('An unexpected error occurred. Please try again.')
        }
      } else {
        // No code - check if we already have a session (redirect from OAuth)
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          window.location.href = '/'
        } else {
          // No session and no code - redirect to login
          window.location.href = '/login'
        }
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
