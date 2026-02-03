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
    // Use Gemini 2.5 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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

1. ${hasCharacters && params.hasCharacterImages ? `The character ${params.characters![0].name} is the main subject. Create a DETAILED prompt (aim for 500-800 characters) that includes: (a) ${params.characters![0].name} and what they're doing, (b) Specific movements and actions in detail, (c) Character's style and appearance, (d) Camera movements and framing, (e) Environment and atmosphere. Example: "${params.characters![0].name} climbs the rocky mountain face at sunset, reaching upward with both hands to grip the next ledge, muscles tensing with effort. Camera slowly tracks alongside ${params.characters![0].name} from a side angle, capturing their expression as golden hour light illuminates the scene..."` : hasCharacters ? `START with full character introduction: "A detailed video of ${params.characters![0].name}, ${params.characters![0].description}, [performing detailed action]..."` : 'Keep and expand upon the core action/scene from the original prompt'}

2. Add rich visual details:
   - Camera movement and angles
   - Lighting and atmosphere
   - Color palette and mood
   - Environmental details

3. Specify motion and cinematography:
   - How subjects move through the scene
   - Camera techniques (tracking, panning, static, etc.)
   - Pacing and energy level

4. Be DETAILED and DESCRIPTIVE (aim for 400-900 characters total):
   - Use vivid, specific language
   - Include sensory details (visual, sound, movement)
   - Describe the full scene with rich imagery

5. Use present tense and active voice

6. ${hasCharacters ? `Describe the character naturally within the scene - focus on their actions, emotions, and role in the narrative` : 'Focus on creating a vivid, film-like scene with cinematic details'}

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
