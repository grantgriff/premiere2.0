import { NextResponse } from 'next/server'

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: await checkDatabase(),
      supabase: checkSupabase(),
      models: {
        googleAI: !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY), // Powers Veo video gen & Gemini quality analysis
        runway: checkRunwayConfig(),
        luma: !!process.env.LUMA_API_KEY,
        sora: !!process.env.OPENAI_API_KEY,
      },
      youtube: !!process.env.YOUTUBE_API_KEY,
    },
  }

  const isHealthy = health.services.database && health.services.supabase

  return NextResponse.json(health, {
    status: isHealthy ? 200 : 503,
  })
}

async function checkDatabase(): Promise<boolean> {
  try {
    // Check if DATABASE_URL is configured
    return !!process.env.DATABASE_URL
  } catch {
    return false
  }
}

function checkSupabase(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}

function checkRunwayConfig(): { configured: boolean; valid: boolean; error?: string } {
  const apiKey = process.env.RUNWAY_API_KEY?.trim()

  if (!apiKey) {
    return { configured: false, valid: false, error: 'RUNWAY_API_KEY not set' }
  }

  if (!apiKey.startsWith('key_')) {
    return { configured: true, valid: false, error: 'API key should start with "key_"' }
  }

  return { configured: true, valid: true }
}
