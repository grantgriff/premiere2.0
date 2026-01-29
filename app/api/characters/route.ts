import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateId } from '@/lib/utils'

// Create a new character
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, description, referenceImageUrl } = body

    if (!userId || !name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, description' },
        { status: 400 }
      )
    }

    // Check character limit (20 max per user)
    const characterCount = await prisma.character.count({
      where: { userId },
    })

    if (characterCount >= 20) {
      return NextResponse.json(
        { error: 'Maximum character limit (20) reached' },
        { status: 400 }
      )
    }

    // Create character
    const character = await prisma.character.create({
      data: {
        id: generateId(),
        userId,
        name,
        description,
        referenceImageUrl,
        // embeddingData would be populated by AI feature extraction
        embeddingData: null,
      },
    })

    return NextResponse.json({
      success: true,
      character,
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
    const characters = await prisma.character.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

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
    const { id, userId, name, description, referenceImageUrl } = body

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: id, userId' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await prisma.character.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    const character = await prisma.character.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(referenceImageUrl !== undefined && { referenceImageUrl }),
      },
    })

    return NextResponse.json({
      success: true,
      character,
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
    // Verify ownership
    const existing = await prisma.character.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }

    await prisma.character.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete character error:', error)
    return NextResponse.json(
      { error: 'Failed to delete character' },
      { status: 500 }
    )
  }
}
