// Video generation model types and interfaces

export type VideoModelId = 'veo3_1' | 'runway' | 'luma' | 'sora' | 'odyssey' | 'world_labs'

export interface GenerationParams {
  prompt: string
  duration: number // seconds
  aspectRatio?: '16:9' | '9:16' | '1:1'
  stylePreset?: 'realistic' | 'cinematic' | 'animated' | 'abstract'
  styleReferenceUrl?: string
  styleInfluence?: number // 0-100
  characterEmbeddings?: Record<string, unknown>[]
  negativePrompt?: string
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
  overallScore: number // 0-10
  dimensions: {
    accuracy: number
    facialQuality: number
    objectCoherence: number
    lightingConsistency: number
    motionSmoothness: number
  }
  issues: QualityIssue[]
  biasFlags: BiasFlag[]
}

export interface QualityIssue {
  type: 'distortion' | 'artifact' | 'inconsistency' | 'blur' | 'flickering'
  severity: 'low' | 'medium' | 'high'
  timestamp?: number
  description: string
}

export interface BiasFlag {
  type: 'gender' | 'racial' | 'age' | 'other'
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface VideoModel {
  id: VideoModelId
  name: string
  maxDuration: number
  supportedInputs: ('text' | 'image' | 'video')[]
  estimatedTime: string
  costPer10Seconds: number
  generate: (params: GenerationParams) => Promise<GenerationResult>
  checkStatus: (jobId: string) => Promise<GenerationStatus>
}

// Model metadata for UI
export const MODEL_INFO: Record<VideoModelId, Omit<VideoModel, 'generate' | 'checkStatus'>> = {
  veo3_1: {
    id: 'veo3_1',
    name: 'Google Veo 3.1',
    maxDuration: 30,
    supportedInputs: ['text', 'image', 'video'],
    estimatedTime: '45-60s',
    costPer10Seconds: 0.5,
  },
  runway: {
    id: 'runway',
    name: 'Runway Gen-3',
    maxDuration: 18,
    supportedInputs: ['text', 'image'],
    estimatedTime: '30-45s',
    costPer10Seconds: 0.5,
  },
  luma: {
    id: 'luma',
    name: 'Luma AI',
    maxDuration: 5,
    supportedInputs: ['text'],
    estimatedTime: '5-10s',
    costPer10Seconds: 2.0,
  },
  sora: {
    id: 'sora',
    name: 'OpenAI Sora',
    maxDuration: 60,
    supportedInputs: ['text'],
    estimatedTime: '30-60s',
    costPer10Seconds: 1.0,
  },
  odyssey: {
    id: 'odyssey',
    name: 'Odyssey',
    maxDuration: 30,
    supportedInputs: ['text', 'image'],
    estimatedTime: '20-40s',
    costPer10Seconds: 0.6,
  },
  world_labs: {
    id: 'world_labs',
    name: 'World Labs',
    maxDuration: 10,
    supportedInputs: ['text'],
    estimatedTime: '30-45s',
    costPer10Seconds: 0.75,
  },
}
