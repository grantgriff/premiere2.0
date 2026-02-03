// Prompt Enhancement Service using Gemini 2.5 Pro
// Enhances user prompts for better video generation, especially with characters

import { GoogleGenerativeAI } from '@google/generative-ai'

export interface Character {
  id: string
  name: string
  description: string
  reference_image_url?: string | null
  gcs_image_uri?: string | null
}

export interface PromptEnhancementParams {
  originalPrompt: string
  characters?: Character[]
  hasCharacterImages?: boolean  // NEW: Indicates if character images will be sent to the model
  hasStyleReference?: boolean
  styleReferenceType?: 'image' | 'video'
  model: string
  duration: number
  aspectRatio?: string
}

export interface EnhancedPromptResult {
  success: boolean
  enhancedPrompt?: string
  error?: string
  originalPrompt: string
}

/**
 * Enhances a user's prompt for video generation using Gemini 2.5 Pro
 *
 * This function:
 * - Incorporates character information (name, description) into the prompt
 * - Adds cinematography details for better video quality
 * - Makes prompts more specific and descriptive
 * - Ensures character consistency when character images are provided
 * - Optimizes prompts for the specific video model being used
 */
export async function enhancePromptWithGemini(
  params: PromptEnhancementParams
): Promise<EnhancedPromptResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    console.warn('[PromptEnhancer] No Gemini API key found, returning original prompt')
    return {
      success: false,
      error: 'Gemini API key not configured',
      originalPrompt: params.originalPrompt,
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // Build context for the enhancement
    const hasCharacters = params.characters && params.characters.length > 0
    const characterInfo = hasCharacters
      ? params.characters!.map(c => `- ${c.name}: ${c.description}`).join('\n')
      : ''

    // Create the enhancement prompt
    const enhancementPrompt = `You are an expert video generation prompt engineer. Your task is to enhance user prompts for AI video generation to produce the best possible results.

${hasCharacters ? `IMPORTANT: This video features the following character(s):
${characterInfo}

The character image(s) will be provided to the video model. Your enhanced prompt MUST explicitly reference the character by name and integrate them naturally into the scene.` : ''}

Original user prompt: "${params.originalPrompt}"

Video generation settings:
- Model: ${params.model}
- Duration: ${params.duration} seconds
- Aspect ratio: ${params.aspectRatio || '16:9'}
${params.hasStyleReference ? `- Style reference: ${params.styleReferenceType} (will be provided to the model)` : ''}

Please enhance this prompt following these guidelines:

1. ${hasCharacters && params.hasCharacterImages ? `The character ${params.characters![0].name} is visible in the provided image. Focus your prompt on MOTION, ACTION, and CAMERA MOVEMENT rather than describing the character's appearance. Start with "${params.characters![0].name} [action verb]..." and emphasize what happens, not what the character looks like. Example: "${params.characters![0].name} dances gracefully through rain puddles, spinning and leaping..." NOT "A video of ${params.characters![0].name}, a magical fox with glowing fur, dancing..."` : hasCharacters ? `START the prompt by identifying the character(s) by name and brief description (e.g., "A video of ${params.characters![0].name}, ${params.characters![0].description}, dancing...")` : 'Keep the core action/scene from the original prompt'}

2. Add rich visual details:
   - Camera movement and angles
   - Lighting and atmosphere
   - Color palette and mood
   - Environmental details

3. Specify motion and cinematography:
   - How subjects move through the scene
   - Camera techniques (tracking, panning, static, etc.)
   - Pacing and energy level

4. Keep it concise but descriptive (2-4 sentences max)

5. Use present tense and active voice

6. ${hasCharacters ? `Ensure the character description matches what will be in the reference image (appearance, style, etc.)` : 'Focus on creating a vivid, film-like scene'}

7. Avoid:
   - Multiple scenes or cuts
   - Text overlays or titles
   - Abstract concepts without visual grounding
   - Contradictions with the character image${params.hasStyleReference ? ' or style reference' : ''}

Output ONLY the enhanced prompt text, nothing else. No explanations, no preamble, no quotation marks.`

    console.log('[PromptEnhancer] Sending prompt to Gemini 2.5 Pro for enhancement...')

    const result = await model.generateContent(enhancementPrompt)
    const response = result.response
    const enhancedPrompt = response.text().trim()

    console.log('[PromptEnhancer] Original prompt:', params.originalPrompt)
    console.log('[PromptEnhancer] Enhanced prompt:', enhancedPrompt)

    return {
      success: true,
      enhancedPrompt,
      originalPrompt: params.originalPrompt,
    }
  } catch (error) {
    console.error('[PromptEnhancer] Error enhancing prompt:', error)

    // If enhancement fails, return original prompt so generation can continue
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      originalPrompt: params.originalPrompt,
    }
  }
}

/**
 * Helper function to safely get enhanced prompt or fallback to original
 */
export function getPromptToUse(result: EnhancedPromptResult): string {
  return result.success && result.enhancedPrompt
    ? result.enhancedPrompt
    : result.originalPrompt
}
