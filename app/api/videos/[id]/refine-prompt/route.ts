import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/videos/[id]/refine-prompt - Refine prompt using Gemini based on comments
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const videoId = (await params).id
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { originalPrompt, comments } = body

    if (!originalPrompt || !Array.isArray(comments)) {
      return NextResponse.json(
        { error: 'Missing required fields: originalPrompt, comments' },
        { status: 400 }
      )
    }

    // Build Gemini prompt
    const feedbackSummary = comments
      .map((c: any) => {
        const timeStr = formatTime(c.timestamp)
        const locationStr = c.boundingBox
          ? ` (focused on area at ${Math.round(c.boundingBox.x)}%, ${Math.round(c.boundingBox.y)}%)`
          : ''
        return `- At ${timeStr}${locationStr}: ${c.text}`
      })
      .join('\n')

    const geminiPrompt = `You are an expert video generation prompt engineer. Your task is to refine and improve a video generation prompt based on user feedback from specific timestamps.

Original Prompt:
"${originalPrompt}"

User Feedback:
${feedbackSummary}

Please create an improved, detailed video generation prompt that:
1. Incorporates all the user's feedback points
2. Maintains the core concept and style of the original
3. Adds specific details where the user highlighted areas or timestamps
4. Uses clear, descriptive language suitable for AI video generation
5. Keeps the prompt concise but comprehensive (2-4 sentences)

Return ONLY the refined prompt text, without any explanations or meta-commentary.`

    // Call Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      console.error('[Refine Prompt] GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'Gemini API not configured' },
        { status: 500 }
      )
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: geminiPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text()
      console.error('[Refine Prompt] Gemini API error:', error)
      return NextResponse.json(
        { error: 'Failed to refine prompt with Gemini' },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()
    const refinedPrompt =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || originalPrompt

    return NextResponse.json({ refinedPrompt: refinedPrompt.trim() })
  } catch (error) {
    console.error('[Refine Prompt] Exception:', error)
    return NextResponse.json(
      { error: 'Failed to refine prompt' },
      { status: 500 }
    )
  }
}

// Helper to format timestamp
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
