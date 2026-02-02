import { NextResponse } from 'next/server'

const LUMA_API_BASE = 'https://api.lumalabs.ai/dream-machine/v1'

export async function GET() {
  const apiKey = process.env.LUMA_API_KEY

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    keyConfigured: !!apiKey,
    keyPrefix: apiKey ? `${apiKey.slice(0, 8)}...` : null,
  }

  if (!apiKey) {
    return NextResponse.json({
      ...result,
      error: 'LUMA_API_KEY not configured in environment',
    }, { status: 500 })
  }

  try {
    // Test the API by listing generations (lightweight call)
    const response = await fetch(`${LUMA_API_BASE}/generations?limit=1`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
    })

    const responseText = await response.text()

    result.apiStatus = response.status
    result.apiOk = response.ok

    if (response.ok) {
      result.success = true
      result.message = 'Luma API connection successful'
      try {
        result.response = JSON.parse(responseText)
      } catch {
        result.response = responseText
      }
    } else {
      result.success = false
      result.error = `API returned ${response.status}`
      result.response = responseText
    }

    return NextResponse.json(result, { status: response.ok ? 200 : 500 })
  } catch (error) {
    result.success = false
    result.error = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(result, { status: 500 })
  }
}
