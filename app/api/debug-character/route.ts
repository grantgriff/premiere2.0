import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Debug endpoint to check character data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const characterId = searchParams.get('id')

  if (!characterId) {
    return NextResponse.json({ error: 'Missing character ID' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      character: data,
      hasReferenceImageUrl: !!data?.reference_image_url,
      hasGcsImageUri: !!data?.gcs_image_uri,
      referenceImageUrl: data?.reference_image_url,
      gcsImageUri: data?.gcs_image_uri,
    })
  } catch (error) {
    console.error('[Debug Character] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch character' },
      { status: 500 }
    )
  }
}
