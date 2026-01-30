'use client'

import { useState, useRef } from 'react'
import {
  X,
  Plus,
  Upload,
  User,
  Loader2,
  Sparkles,
  Search,
} from 'lucide-react'
import { useAppStore, Character } from '@/lib/store'
import { CharacterCard } from './CharacterCard'
import { generateId } from '@/lib/utils'

interface CharacterManagerProps {
  isOpen: boolean
  onClose: () => void
  onSelectCharacters?: (characters: Character[]) => void
  selectionMode?: boolean
}

type ViewMode = 'grid' | 'create' | 'edit'

export function CharacterManager({
  isOpen,
  onClose,
  onSelectCharacters,
  selectionMode = false,
}: CharacterManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Store
  const characters = useAppStore((state) => state.characters)
  const addCharacter = useAppStore((state) => state.addCharacter)
  const updateCharacter = useAppStore((state) => state.updateCharacter)
  const deleteCharacter = useAppStore((state) => state.deleteCharacter)
  const selectedCharacterIds = useAppStore((state) => state.selectedCharacterIds)
  const toggleCharacterSelection = useAppStore((state) => state.toggleCharacterSelection)
  const clearCharacterSelection = useAppStore((state) => state.clearCharacterSelection)

  // Filter characters
  const filteredCharacters = characters.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedCharacters = characters.filter((c) =>
    selectedCharacterIds.includes(c.id)
  )

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Reset form
  const resetForm = () => {
    setName('')
    setDescription('')
    setImageFile(null)
    setImagePreview(null)
    setEditingCharacter(null)
    setViewMode('grid')
  }

  // Handle create
  const handleCreate = async () => {
    if (!name.trim()) return

    setIsUploading(true)

    // Simulate upload and embedding extraction
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const newCharacter: Character = {
      id: generateId(),
      name: name.trim(),
      description: description.trim(),
      referenceImageUrl: imagePreview, // In real app, would upload to storage
      thumbnailUrl: imagePreview,
      embeddingStatus: 'processing',
      createdAt: new Date(),
      usageCount: 0,
    }

    addCharacter(newCharacter)

    // Simulate embedding processing
    setTimeout(() => {
      updateCharacter(newCharacter.id, { embeddingStatus: 'ready' })
    }, 3000)

    setIsUploading(false)
    resetForm()
  }

  // Handle edit
  const handleEdit = async () => {
    if (!editingCharacter || !name.trim()) return

    setIsUploading(true)

    await new Promise((resolve) => setTimeout(resolve, 500))

    updateCharacter(editingCharacter.id, {
      name: name.trim(),
      description: description.trim(),
      ...(imagePreview && imagePreview !== editingCharacter.referenceImageUrl
        ? {
            referenceImageUrl: imagePreview,
            thumbnailUrl: imagePreview,
            embeddingStatus: 'processing' as const,
          }
        : {}),
    })

    // If image changed, simulate re-processing
    if (imagePreview && imagePreview !== editingCharacter.referenceImageUrl) {
      setTimeout(() => {
        updateCharacter(editingCharacter.id, { embeddingStatus: 'ready' })
      }, 3000)
    }

    setIsUploading(false)
    resetForm()
  }

  // Start editing
  const startEdit = (character: Character) => {
    setEditingCharacter(character)
    setName(character.name)
    setDescription(character.description)
    setImagePreview(character.referenceImageUrl)
    setViewMode('edit')
  }

  // Handle selection confirmation
  const handleConfirmSelection = () => {
    if (onSelectCharacters) {
      onSelectCharacters(selectedCharacters)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-background rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {viewMode === 'create'
                  ? 'Create Character'
                  : viewMode === 'edit'
                  ? 'Edit Character'
                  : 'Characters'}
              </h2>
              <p className="text-sm text-foreground-secondary">
                {viewMode === 'grid'
                  ? `${characters.length} character${characters.length !== 1 ? 's' : ''}`
                  : viewMode === 'create'
                  ? 'Add a new character for consistent generation'
                  : 'Update character details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background-secondary text-foreground-secondary hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'grid' ? (
            <>
              {/* Search and Add */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-secondary" />
                  <input
                    type="text"
                    placeholder="Search characters..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={() => setViewMode('create')}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New
                </button>
              </div>

              {/* Character grid */}
              {filteredCharacters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mb-4">
                    <User className="w-8 h-8 text-foreground-secondary/50" />
                  </div>
                  <p className="text-foreground-secondary mb-2">
                    {searchQuery ? 'No characters found' : 'No characters yet'}
                  </p>
                  <p className="text-sm text-foreground-secondary/70">
                    {searchQuery
                      ? 'Try a different search'
                      : 'Create a character to maintain consistency across generations'}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={() => setViewMode('create')}
                      className="btn-primary mt-4 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create your first character
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {filteredCharacters.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      isSelected={selectedCharacterIds.includes(character.id)}
                      onSelect={() => toggleCharacterSelection(character.id)}
                      onEdit={() => startEdit(character)}
                      onDelete={() => deleteCharacter(character.id)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Create/Edit form */
            <div className="space-y-6">
              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reference Image
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-accent/50 cursor-pointer overflow-hidden transition-colors"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground-secondary">
                      <Upload className="w-8 h-8 mb-2" />
                      <p className="text-sm">Click to upload image</p>
                      <p className="text-xs text-foreground-secondary/60 mt-1">
                        Clear face shot recommended
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., John, Main Character"
                  className="w-full h-10 px-4 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the character's appearance, role, or traits"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Info */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/5 border border-accent/20">
                <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-foreground font-medium">AI Face Embedding</p>
                  <p className="text-foreground-secondary mt-1">
                    When you save this character, we'll extract facial features to maintain
                    consistency across your video generations. Use @{name || 'name'} in your prompts.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background-secondary/50">
          {viewMode === 'grid' ? (
            <>
              {selectionMode && selectedCharacterIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-secondary">
                    {selectedCharacterIds.length} selected
                  </span>
                  <button
                    onClick={clearCharacterSelection}
                    className="text-sm text-accent hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
              <div className="flex-1" />
              {selectionMode ? (
                <button
                  onClick={handleConfirmSelection}
                  disabled={selectedCharacterIds.length === 0}
                  className="btn-primary disabled:opacity-50"
                >
                  Use Selected ({selectedCharacterIds.length})
                </button>
              ) : (
                <button onClick={onClose} className="btn-secondary">
                  Close
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={resetForm}
                className="btn-secondary"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={viewMode === 'create' ? handleCreate : handleEdit}
                disabled={!name.trim() || isUploading}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {viewMode === 'create' ? 'Creating...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {viewMode === 'create' ? 'Create Character' : 'Save Changes'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
