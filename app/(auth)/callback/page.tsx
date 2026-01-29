'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  useEffect(() => {
    // In production, this would handle the OAuth callback from Supabase
    // Exchange code for session, create user if needed, then redirect

    const handleCallback = async () => {
      // Simulate auth processing
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Redirect to dashboard
      window.location.href = '/'
    }

    handleCallback()
  }, [])

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
