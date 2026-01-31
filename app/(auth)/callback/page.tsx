'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function CallbackRedirect() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // Redirect to the server-side callback handler with all query params
    // This ensures PKCE code verifier is properly read from cookies
    const params = searchParams.toString()
    const redirectUrl = `/auth/callback${params ? `?${params}` : ''}`
    window.location.href = redirectUrl
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Signing you in...
        </h2>
        <p className="text-foreground-secondary">
          Please wait while we complete authentication
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
      <CallbackRedirect />
    </Suspense>
  )
}
