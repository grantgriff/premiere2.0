'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  Plus,
  Upload,
  User,
  Loader2,
  Sparkles,
  Search,
  Wand2,
  ImageIcon,
  Zap,
  Video,
} from 'lucide-react'
import { useAppStore, Character } from '@/lib/store'
import { CharacterCard } from './CharacterCard'
import { generateId } from '@/lib/utils'
import { useAuth } from '@/components/AuthProvider'

interface CharacterManagerProps {
  isOpen: boolean
  onClose: () => void
  onSelectCharacters?: (characters: Character[]) => void
  selectionMode?: boolean
}

type ViewMode = 'grid' | 'create' | 'edit'
type CreateMode = 'upload' | 'generate' | 'ai-decide'

export function CharacterManager({
  isOpen,
  onClose,
  onSelectCharacters,
  selectionMode = false,
}: CharacterManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [createMode, setCreateMode] = useState<CreateMode>('upload')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Generate mode state
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auth
  const { user } = useAuth()

  // Store
  const characters = useAppStore((state) => state.characters)
  const addCharacter = useAppStore((state) => state.addCharacter)
  const setCharacters = useAppStore((state) => state.setCharacters)
  const updateCharacterInStore = useAppStore((state) => state.updateCharacter)
  const deleteCharacterFromStore = useAppStore((state) => state.deleteCharacter)
  const selectedCharacterIds = useAppStore((state) => state.selectedCharacterIds)
  const toggleCharacterSelection = useAppStore((state) => state.toggleCharacterSelection)
  const clearCharacterSelection = useAppStore((state) => state.clearCharacterSelection)

  // Load characters from API on mount
  useEffect(() => {
    if (user?.id && isOpen) {
      loadCharactersFromAPI()
    }
  }, [user?.id, isOpen])

  const loadCharactersFromAPI = async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/characters?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.characters) {
          setCharacters(data.characters.map((c: Record<string, unknown>) => ({
            ...c,
            createdAt: new Date(c.createdAt as string),
          })))
        }
      }
    } catch (error) {
      console.error('Failed to load characters:', error)
    }
  }

  // API helper functions
  const createCharacterAPI = async (character: Character) => {
    if (!user?.id) return false

    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: character.name,
          description: character.description,
          referenceImageUrl: character.referenceImageUrl,
          thumbnailUrl: character.thumbnailUrl,
        }),
      })
      return response.ok
    } catch (error) {
      console.error('Failed to create character:', error)
      return false
    }
  }

  const updateCharacterAPI = async (id: string, updates: Partial<Character>) => {
    if (!user?.id) return false

    try {
      const response = await fetch('/api/characters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          userId: user.id,
          ...updates,
        }),
      })
      return response.ok
    } catch (error) {
      console.error('Failed to update character:', error)
      return false
    }
  }

  const deleteCharacterAPI = async (id: string) => {
    if (!user?.id) return false

    try {
      const response = await fetch(`/api/characters?id=${id}&userId=${user.id}`, {
        method: 'DELETE',
      })
      return response.ok
    } catch (error) {
      console.error('Failed to delete character:', error)
      return false
    }
  }

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
    setCreateMode('upload')
    setGeneratePrompt('')
    setGeneratedImage(null)
  }

  // Handle create
  const handleCreate = async () => {
    if (!name.trim() || !user?.id) return

    setIsUploading(true)

    const newCharacter: Character = {
      id: generateId(),
      name: name.trim(),
      description: description.trim(),
      referenceImageUrl: imagePreview,
      thumbnailUrl: imagePreview,
      embeddingStatus: 'processing',
      createdAt: new Date(),
      usageCount: 0,
    }

    // Save to API first
    const success = await createCharacterAPI(newCharacter)

    if (success) {
      // Add to local store
      addCharacter(newCharacter)

      // Simulate embedding processing
      setTimeout(() => {
        updateCharacterInStore(newCharacter.id, { embeddingStatus: 'ready' })
        updateCharacterAPI(newCharacter.id, { embeddingStatus: 'ready' })
      }, 3000)
    }

    setIsUploading(false)
    resetForm()
  }

  // Handle AI generate character
  const handleGenerate = async () => {
    if (!name.trim() || !generatePrompt.trim() || !user?.id) return

    setIsGenerating(true)

    // Simulate AI image generation
    await new Promise((resolve) => setTimeout(resolve, 2500))

    // For demo, use a placeholder generated image
    const placeholderImage = `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(name + generatePrompt)}&backgroundColor=b6e3f4,c0aede,d1d4f9`

    const newCharacter: Character = {
      id: generateId(),
      name: name.trim(),
      description: description.trim() || generatePrompt.trim(),
      referenceImageUrl: placeholderImage,
      thumbnailUrl: placeholderImage,
      embeddingStatus: 'processing',
      createdAt: new Date(),
      usageCount: 0,
    }

    // Save to API
    const success = await createCharacterAPI(newCharacter)

    if (success) {
      addCharacter(newCharacter)

      // Simulate embedding processing
      setTimeout(() => {
        updateCharacterInStore(newCharacter.id, { embeddingStatus: 'ready' })
        updateCharacterAPI(newCharacter.id, { embeddingStatus: 'ready' })
      }, 3000)
    }

    setIsGenerating(false)
    resetForm()
  }

  // Handle AI Decide - creates a placeholder that will auto-capture from video
  const handleAiDecide = async () => {
    if (!name.trim() || !user?.id) return

    setIsUploading(true)

    const newCharacter: Character = {
      id: generateId(),
      name: name.trim(),
      description: description.trim() || `Auto-captured character - will be extracted from first video frame`,
      referenceImageUrl: null,
      thumbnailUrl: null,
      embeddingStatus: 'pending',
      createdAt: new Date(),
      usageCount: 0,
    }

    // Save to API
    const success = await createCharacterAPI(newCharacter)

    if (success) {
      addCharacter(newCharacter)
    }

    setIsUploading(false)
    resetForm()
  }

  // Handle edit
  const handleEdit = async () => {
    if (!editingCharacter || !name.trim() || !user?.id) return

    setIsUploading(true)

    const updates: Partial<Character> = {
      name: name.trim(),
      description: description.trim(),
      ...(imagePreview && imagePreview !== editingCharacter.referenceImageUrl
        ? {
            referenceImageUrl: imagePreview,
            thumbnailUrl: imagePreview,
            embeddingStatus: 'processing' as const,
          }
        : {}),
    }

    // Save to API
    const success = await updateCharacterAPI(editingCharacter.id, updates)

    if (success) {
      updateCharacterInStore(editingCharacter.id, updates)

      // If image changed, simulate re-processing
      if (imagePreview && imagePreview !== editingCharacter.referenceImageUrl) {
        setTimeout(() => {
          updateCharacterInStore(editingCharacter.id, { embeddingStatus: 'ready' })
          updateCharacterAPI(editingCharacter.id, { embeddingStatus: 'ready' })
        }, 3000)
      }
    }

    setIsUploading(false)
    resetForm()
  }

  // Handle delete with API
  const handleDelete = async (id: string) => {
    const success = await deleteCharacterAPI(id)
    if (success) {
      deleteCharacterFromStore(id)
    }
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
                      onDelete={() => handleDelete(character.id)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Create/Edit form */
            <div className="space-y-6">
              {/* Mode selector - only show in create mode, not edit */}
              {viewMode === 'create' && (
                <div className="space-y-3">
                  <div className="flex rounded-lg bg-background-secondary p-1">
                    <button
                      onClick={() => setCreateMode('upload')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        createMode === 'upload'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-foreground-secondary hover:text-foreground'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                    <button
                      onClick={() => setCreateMode('generate')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        createMode === 'generate'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-foreground-secondary hover:text-foreground'
                      }`}
                    >
                      <Wand2 className="w-4 h-4" />
                      Generate
                    </button>
                    <button
                      onClick={() => setCreateMode('ai-decide')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        createMode === 'ai-decide'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-foreground-secondary hover:text-foreground'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      Let AI Decide
                    </button>
                  </div>

                  {/* Mode description */}
                  <p className="text-xs text-foreground-secondary text-center">
                    {createMode === 'upload' && 'Upload your own photo for the character'}
                    {createMode === 'generate' && 'Describe the character and AI will generate them'}
                    {createMode === 'ai-decide' && 'AI generates character during video creation and maintains consistency'}
                  </p>
                </div>
              )}

              {/* Image upload - show in upload mode or edit mode */}
              {(createMode === 'upload' || viewMode === 'edit') && (
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
              )}

              {/* AI Generation prompt - only in generate mode */}
              {createMode === 'generate' && viewMode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Character Description
                  </label>
                  <textarea
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                    placeholder="Describe the character you want to generate...&#10;&#10;e.g., 'A young woman with curly red hair, green eyes, freckles, and a warm smile. Professional headshot style.'"
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-background-secondary border border-border text-sm focus:outline-none focus:border-accent resize-none"
                  />
                  <p className="mt-2 text-xs text-foreground-secondary">
                    Be specific about facial features, hair, expression, and style for best results.
                  </p>

                  {/* Preview of generated image */}
                  {generatedImage && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Generated Preview
                      </label>
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                        <img
                          src={generatedImage}
                          alt="Generated preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Let AI Decide mode */}
              {createMode === 'ai-decide' && viewMode === 'create' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-br from-accent/10 to-purple-500/10 border border-accent/20">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Video className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Auto-Capture Mode</p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        When your video generates, we'll automatically capture the first character
                        that appears and save their face for consistency in future frames and videos.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-lg bg-background-secondary/50 border border-border">
                    <h4 className="text-sm font-medium text-foreground">How it works:</h4>
                    <ol className="space-y-2 text-sm text-foreground-secondary">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                        <span>Generate your video with a character in the prompt</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                        <span>AI detects and extracts the character's face from frame 1</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                        <span>Character is saved with face embedding for future use</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                        <span>Reference @{name || 'name'} in future prompts for consistency</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}

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

              {/* Info - hide for ai-decide since it has its own explanation */}
              {createMode !== 'ai-decide' && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/5 border border-accent/20">
                  <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-foreground font-medium">
                      {createMode === 'generate' && viewMode === 'create'
                        ? 'AI Character Generation'
                        : 'AI Face Embedding'}
                    </p>
                    <p className="text-foreground-secondary mt-1">
                      {createMode === 'generate' && viewMode === 'create' ? (
                        <>
                          We'll generate a unique character based on your description, then extract
                          facial features for consistency. Use @{name || 'name'} in your prompts.
                        </>
                      ) : (
                        <>
                          When you save this character, we'll extract facial features to maintain
                          consistency across your video generations. Use @{name || 'name'} in your prompts.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
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
                disabled={isUploading || isGenerating}
              >
                Cancel
              </button>
              <button
                onClick={
                  viewMode === 'edit'
                    ? handleEdit
                    : createMode === 'generate'
                    ? handleGenerate
                    : createMode === 'ai-decide'
                    ? handleAiDecide
                    : handleCreate
                }
                disabled={
                  !name.trim() ||
                  isUploading ||
                  isGenerating ||
                  (createMode === 'generate' && viewMode === 'create' && !generatePrompt.trim())
                }
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {isUploading || isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isGenerating ? 'Generating...' : viewMode === 'create' ? 'Creating...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {viewMode === 'edit' ? (
                      'Save Changes'
                    ) : createMode === 'generate' ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Character
                      </>
                    ) : createMode === 'ai-decide' ? (
                      <>
                        <Zap className="w-4 h-4" />
                        Enable Auto-Capture
                      </>
                    ) : (
                      'Create Character'
                    )}
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
