import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createServerClient } from '@/lib/supabase-server'

const ADMIN_EMAILS = ['grant.griffith.12@gmail.com']
const MAX_VIDEOS_PER_USER = 10

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = ADMIN_EMAILS.includes(user.email || '')

    const videoCount = await prisma.video.count({
      where: { userId: user.id },
    })

    return NextResponse.json({
      videoCount,
      maxVideos: isAdmin ? null : MAX_VIDEOS_PER_USER,
      isAdmin,
      remaining: isAdmin ? null : Math.max(0, MAX_VIDEOS_PER_USER - videoCount),
    })
  } catch (error) {
    console.error('Usage check error:', error)
    return NextResponse.json({ error: 'Failed to check usage' }, { status: 500 })
  }
}
