import { NextRequest, NextResponse } from 'next/server'
import { createCharacter, getCharacters, updateCharacter, deleteCharacter } from '@/lib/db-supabase'
import { generateId } from '@/lib/utils'
import { mirrorImageToGCS } from '@/lib/gcs-server'

// Create a new character
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, description, referenceImageUrl, thumbnailUrl, gcsImageUri, embeddingStatus } = body

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name' },
        { status: 400 }
      )
    }

    const characterId = generateId()
    let finalGcsUri = gcsImageUri || null

    // If there's a reference image URL and no GCS URI yet, mirror it to GCS
    if (referenceImageUrl && !finalGcsUri) {
      console.log('[Characters API] Mirroring image to GCS for Veo compatibility...')

      // Generate GCS path: characters/{userId}/{characterId}.jpg
      const imageExtension = referenceImageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg'
      const gcsPath = `characters/${userId}/${characterId}.${imageExtension}`

      const gcsResult = await mirrorImageToGCS(referenceImageUrl, gcsPath)

      if (gcsResult.success && gcsResult.gcsUri) {
        finalGcsUri = gcsResult.gcsUri
        console.log('[Characters API] GCS upload successful:', finalGcsUri)
      } else {
        console.warn('[Characters API] GCS upload failed (non-fatal):', gcsResult.error)
        // Don't fail character creation if GCS upload fails - Veo just won't work
      }
    }

    // Create character in Supabase
    const character = await createCharacter({
      id: characterId,
      userId,
      name,
      description: description || '',
      referenceImageUrl: referenceImageUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      gcsImageUri: finalGcsUri,
      embeddingStatus: embeddingStatus || 'pending',
    })

    if (!character) {
      return NextResponse.json(
        { error: 'Failed to create character' },
        { status: 500 }
      )
    }

    // Transform to frontend format
    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        referenceImageUrl: character.reference_image_url,
        thumbnailUrl: character.thumbnail_url,
        gcsImageUri: character.gcs_image_uri,
        embeddingStatus: character.embedding_status,
        createdAt: character.created_at,
        usageCount: 0,
      },
    })
  } catch (error) {
    console.error('Create character error:', error)
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    )
  }
}

// Get all characters for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
  }

  try {
    const dbCharacters = await getCharacters(userId)

    // Transform to frontend format
    const characters = dbCharacters.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      referenceImageUrl: c.reference_image_url,
      thumbnailUrl: c.thumbnail_url,
      gcsImageUri: c.gcs_image_uri,
      embeddingStatus: c.embedding_status,
      createdAt: c.created_at,
      usageCount: 0,
    }))

    return NextResponse.json({ characters })
  } catch (error) {
    console.error('Get characters error:', error)
    return NextResponse.json(
      { error: 'Failed to get characters' },
      { status: 500 }
    )
  }
}

// Update a character
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, name, description, referenceImageUrl, thumbnailUrl, gcsImageUri, embeddingStatus } = body

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: id, userId' },
        { status: 400 }
      )
    }

    const character = await updateCharacter(id, userId, {
      name,
      description,
      referenceImageUrl,
      thumbnailUrl,
      gcsImageUri,
      embeddingStatus,
    })

    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        referenceImageUrl: character.reference_image_url,
        thumbnailUrl: character.thumbnail_url,
        gcsImageUri: character.gcs_image_uri,
        embeddingStatus: character.embedding_status,
        createdAt: character.created_at,
        usageCount: 0,
      },
    })
  } catch (error) {
    console.error('Update character error:', error)
    return NextResponse.json(
      { error: 'Failed to update character' },
      { status: 500 }
    )
  }
}

// Delete a character
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const userId = searchParams.get('userId')

  if (!id || !userId) {
    return NextResponse.json(
      { error: 'Missing required parameters: id, userId' },
      { status: 400 }
    )
  }

  try {
    const success = await deleteCharacter(id, userId)

    if (!success) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete character error:', error)
    return NextResponse.json(
      { error: 'Failed to delete character' },
      { status: 500 }
    )
  }
}
