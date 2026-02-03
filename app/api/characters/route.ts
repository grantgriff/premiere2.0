import { NextRequest, NextResponse } from 'next/server'
import { createCharacter, getCharacters, updateCharacter, deleteCharacter } from '@/lib/db-supabase'
import { generateId } from '@/lib/utils'

// Create a new character
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, description, referenceImageUrl, thumbnailUrl, embeddingStatus } = body

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name' },
        { status: 400 }
      )
    }

    // Create character in Supabase
    const character = await createCharacter({
      id: generateId(),
      userId,
      name,
      description: description || '',
      referenceImageUrl: referenceImageUrl || null,
      thumbnailUrl: thumbnailUrl || null,
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
    const { id, userId, name, description, referenceImageUrl, thumbnailUrl, embeddingStatus } = body

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
