// Video generation model types and interfaces

export type VideoModelId = 'veo3_1' | 'runway' | 'luma' | 'sora' | 'odyssey' | 'world_labs'

export interface GenerationParams {
  prompt: string
  duration: number // seconds
  aspectRatio?: '16:9' | '9:16' | '1:1'
  stylePreset?: 'realistic' | 'cinematic' | 'animated' | 'abstract'
  styleReferenceUrl?: string
  styleInfluence?: number // 0-100
  characterReferenceUrls?: string[] // Character reference image URLs (HTTP)
  characterGcsUris?: string[] // Character reference GCS URIs (for Veo)
  negativePrompt?: string
  // Frame chaining parameters (for video-to-video continuity)
  firstFrameGcsUri?: string // First frame GCS URI (for Veo frame chaining)
  lastFrameGcsUri?: string // Last frame GCS URI (for Veo frame chaining)
}

export interface GenerationResult {
  success: boolean
  jobId?: string
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
  estimatedTime?: number // seconds
}

export interface GenerationStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number // 0-100
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
}

export interface QualityReport {
  overallScore: number // 0-10, harsh scoring
  dimensions: {
    promptAccuracy: number      // How well video matches the prompt
    anatomicalAccuracy: number  // Correctness of human body/face proportions
    physicsRealism: number      // Realistic physics and motion
    temporalConsistency: number // Consistency across frames
    visualQuality: number       // Resolution, clarity, artifacts
  }
  issues: QualityIssue[]
  risks: RiskFlag[]
  characterComparison?: CharacterComparison
  summary: string // Brief text summary of evaluation
}

export interface QualityIssue {
  type: 'anatomical_error' | 'physics_violation' | 'temporal_glitch' | 'artifact' | 'blur' | 'flickering' | 'uncanny_valley' | 'distortion'
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp?: number
  description: string
}

export interface RiskFlag {
  type: 'violence' | 'inappropriate' | 'bias_gender' | 'bias_racial' | 'bias_age' | 'lack_diversity' | 'stereotyping' | 'misinformation' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation?: string
}

export interface CharacterComparison {
  matchScore: number // 0-10, how well generated character matches reference
  referenceProvided: boolean
  differences: CharacterDifference[]
  overallAssessment: string
}

export interface CharacterDifference {
  aspect: 'face' | 'body' | 'clothing' | 'pose' | 'skin_tone' | 'hair' | 'age_appearance' | 'gender_presentation' | 'other'
  severity: 'minor' | 'moderate' | 'significant'
  description: string
}

// Legacy type alias for backwards compatibility
export interface BiasFlag extends RiskFlag {}

export interface VideoModel {
  id: VideoModelId
  name: string
  maxDuration: number
  allowedDurations: number[] // Specific durations allowed by the API
  supportedInputs: ('text' | 'image' | 'video')[]
  estimatedTime: string
  costPer10Seconds: number
  generate: (params: GenerationParams) => Promise<GenerationResult>
  checkStatus: (jobId: string) => Promise<GenerationStatus>
}

// Model metadata for UI
// Note: 'name' is display name for UI, actual API model names are in model files
export const MODEL_INFO: Record<VideoModelId, Omit<VideoModel, 'generate' | 'checkStatus'>> = {
  veo3_1: {
    id: 'veo3_1',
    name: 'Veo 3.1',  // API model: veo-3.1-fast-generate-preview
    maxDuration: 8,
    allowedDurations: [4, 6, 8], // Veo supports 4s, 6s, and 8s
    supportedInputs: ['text', 'image'],
    estimatedTime: '30-45s',
    costPer10Seconds: 0.5,
  },
  runway: {
    id: 'runway',
    name: 'Runway',  // API models: gen4_turbo (image), gen4_aleph (video), veo3.1 (text)
    maxDuration: 10,
    allowedDurations: [4, 6, 8, 10], // Text: 4,6,8 | Image: 2-10
    supportedInputs: ['text', 'image', 'video'],
    estimatedTime: '30-45s',
    costPer10Seconds: 0.5,
  },
  luma: {
    id: 'luma',
    name: 'Luma',  // API model: ray-flash-2
    maxDuration: 10,
    allowedDurations: [5, 9, 10], // Luma only accepts "5s", "9s", "10s"
    supportedInputs: ['text', 'image', 'video'], // Supports video-to-video via modify
    estimatedTime: '20-40s',
    costPer10Seconds: 2.0,
  },
  sora: {
    id: 'sora',
    name: 'Sora',  // API model: sora-2
    maxDuration: 12,
    allowedDurations: [4, 8, 12], // Sora only allows 4, 8, or 12 seconds
    supportedInputs: ['text', 'image'],
    estimatedTime: '60-120s',
    costPer10Seconds: 1.0,
  },
  odyssey: {
    id: 'odyssey',
    name: 'Odyssey',  // Not yet implemented
    maxDuration: 30,
    allowedDurations: [5, 10, 15, 30],
    supportedInputs: ['text', 'image'],
    estimatedTime: '20-40s',
    costPer10Seconds: 0.6,
  },
  world_labs: {
    id: 'world_labs',
    name: 'World Labs',  // Not yet implemented
    maxDuration: 10,
    allowedDurations: [5, 10],
    supportedInputs: ['text'],
    estimatedTime: '30-45s',
    costPer10Seconds: 0.75,
  },
}
