'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signInWithGoogle, signInWithGitHub, getCurrentUser } from '@/lib/auth'

function LoginContent() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) {
      setError(decodeURIComponent(urlError))
    }

    // Check if already authenticated (use getUser for server-side validation)
    getCurrentUser().then((user) => {
      if (user) {
        window.location.href = '/'
      } else {
        setChecking(false)
      }
    })
  }, [searchParams])

  const handleGoogleLogin = async () => {
    setIsLoading('google')
    setError(null)
    try {
      await signInWithGoogle()
    } catch {
      setError('Failed to sign in with Google. Please try again.')
      setIsLoading(null)
    }
  }

  const handleGitHubLogin = async () => {
    setIsLoading('github')
    setError(null)
    try {
      await signInWithGitHub()
    } catch {
      setError('Failed to sign in with GitHub. Please try again.')
      setIsLoading(null)
    }
  }

  if (checking) {
    return (
      <div className="login-page">
        <div className="login-grain" />
        <div className="login-scanlines" />
        <div className="login-center">
          <div className="login-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      {/* Film grain + scanlines */}
      <div className="login-grain" />
      <div className="login-scanlines" />

      {/* Abstract art background */}
      <div className="login-art-layer">
        <div className="login-arc login-arc-1" />
        <div className="login-arc login-arc-2" />
        <div className="login-arc login-arc-3" />
        <div className="login-stray-line login-sl-1" />
        <div className="login-stray-line login-sl-2" />
        <div className="login-stray-line login-sl-3" />
        <div className="login-stray-line login-sl-4" />
        <div className="login-stray-line login-sl-5" />
        <div className="login-stray-line login-sl-6" />
        <div className="login-stray-line login-sl-7" />
        <div className="login-stray-line login-sl-8" />
        <div className="login-geo login-geo-ring" />
        <div className="login-geo login-geo-diamond" />
        <div className="login-geo login-geo-cross" />
        <div className="login-geo login-geo-tri" />
      </div>

      {/* Nav */}
      <nav className="login-nav">
        <a href="#" className="login-logo">
          <span className="login-logo-main">Premiere</span>
          <span className="login-logo-ver">2.0</span>
        </a>
      </nav>

      {/* Main content */}
      <div className="login-center">
        <div className="login-layout">
          {/* Left — branding */}
          <div className="login-left">
            <div className="login-eyebrow">
              <span className="login-eyebrow-line" />
              Next-gen video generation
            </div>
            <h1 className="login-heading">
              One studio.<br />
              <em>Every model.</em><br />
              Your story.
            </h1>
            <p className="login-body">
              The <strong>model-agnostic</strong> AI video platform for creators
              and small businesses. Generate, compare, and edit{' '}
              <strong>hyper-personalized video</strong> across Veo, Runway,
              Sora, Luma — all from one workspace.
            </p>

            {/* Floating model tags */}
            <div className="login-models-strip">
              <span className="login-strip-chip">Luma AI</span>
              <span className="login-strip-chip login-strip-chip-hot">Veo 3.1</span>
              <span className="login-strip-chip">Runway Gen-3</span>
              <span className="login-strip-chip">Sora</span>
              <span className="login-strip-chip">Odyssey</span>
            </div>
          </div>

          {/* Right — login card */}
          <div className="login-right">
            <div className="login-card">
              {/* Decorative circles behind card */}
              <div className="login-card-circle-outer" />
              <div className="login-card-circle-inner" />

              <div className="login-card-content">
                <h2 className="login-card-title">Start Creating</h2>
                <p className="login-card-subtitle">
                  Sign in to access your studio workspace
                </p>

                {error && (
                  <div className="login-error">
                    {error}
                  </div>
                )}

                <div className="login-buttons">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading !== null}
                    className="login-btn login-btn-google"
                  >
                    {isLoading === 'google' ? (
                      <div className="login-spinner-small" />
                    ) : (
                      <svg className="login-btn-icon" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    )}
                    Continue with Google
                  </button>

                  <button
                    onClick={handleGitHubLogin}
                    disabled={isLoading !== null}
                    className="login-btn login-btn-github"
                  >
                    {isLoading === 'github' ? (
                      <div className="login-spinner-small" />
                    ) : (
                      <svg className="login-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                    )}
                    Continue with GitHub
                  </button>
                </div>

                <div className="login-divider" />

                <p className="login-terms">
                  By continuing, you agree to our Terms of Service and Privacy Policy
                </p>

                <div className="login-credits-badge">
                  <span className="login-credits-dot" />
                  100 free credits on signup
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="login-footer">
        <p>&copy; 2025 Premiere 2.0</p>
        <div className="login-footer-links">
          <a href="#">Twitter</a>
          <a href="#">Discord</a>
          <a href="#">GitHub</a>
          <a href="#">Privacy</a>
        </div>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page">
          <div className="login-grain" />
          <div className="login-scanlines" />
          <div className="login-center">
            <div className="login-spinner" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
