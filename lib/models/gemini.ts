// Gemini 3 Flash - Video Quality Verification
import { QualityReport, QualityIssue, BiasFlag } from './types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiAnalysisRequest {
  contents: {
    role: string
    parts: {
      text?: string
      fileData?: {
        mimeType: string
        fileUri: string
      }
    }[]
  }[]
  generationConfig: {
    temperature: number
    maxOutputTokens: number
    responseMimeType: string
  }
}

const QUALITY_ANALYSIS_PROMPT = `Analyze this AI-generated video for quality and potential issues.

Provide a JSON response with the following structure:
{
  "overallScore": <number 0-10>,
  "dimensions": {
    "accuracy": <number 0-10 - how well it matches the expected output>,
    "facialQuality": <number 0-10 - quality of human faces if present>,
    "objectCoherence": <number 0-10 - consistency of objects>,
    "lightingConsistency": <number 0-10 - lighting stability>,
    "motionSmoothness": <number 0-10 - smoothness of motion>
  },
  "issues": [
    {
      "type": "<distortion|artifact|inconsistency|blur|flickering>",
      "severity": "<low|medium|high>",
      "timestamp": <number in seconds, optional>,
      "description": "<brief description>"
    }
  ],
  "biasFlags": [
    {
      "type": "<gender|racial|age|other>",
      "severity": "<low|medium|high>",
      "description": "<brief description>"
    }
  ]
}

Be thorough but fair in your assessment. Only flag real issues.`

export async function analyzeVideoQuality(videoUrl: string): Promise<QualityReport | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('Gemini API key not configured')
    return null
  }

  try {
    const request: GeminiAnalysisRequest = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                mimeType: 'video/mp4',
                fileUri: videoUrl,
              },
            },
            {
              text: QUALITY_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Gemini API error:', error)
      return null
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      console.error('No content in Gemini response')
      return null
    }

    // Parse the JSON response
    const report: QualityReport = JSON.parse(content)

    // Validate and sanitize the report
    return {
      overallScore: Math.min(10, Math.max(0, report.overallScore || 0)),
      dimensions: {
        accuracy: report.dimensions?.accuracy || 5,
        facialQuality: report.dimensions?.facialQuality || 5,
        objectCoherence: report.dimensions?.objectCoherence || 5,
        lightingConsistency: report.dimensions?.lightingConsistency || 5,
        motionSmoothness: report.dimensions?.motionSmoothness || 5,
      },
      issues: (report.issues || []).map((issue: QualityIssue) => ({
        type: issue.type || 'artifact',
        severity: issue.severity || 'low',
        timestamp: issue.timestamp,
        description: issue.description || 'Unknown issue',
      })),
      biasFlags: (report.biasFlags || []).map((flag: BiasFlag) => ({
        type: flag.type || 'other',
        severity: flag.severity || 'low',
        description: flag.description || 'Unknown flag',
      })),
    }
  } catch (error) {
    console.error('Error analyzing video quality:', error)
    return null
  }
}

// Check if video meets minimum quality threshold
export function meetsQualityThreshold(report: QualityReport, threshold: number = 5): boolean {
  return report.overallScore >= threshold
}

// Get high severity issues
export function getHighSeverityIssues(report: QualityReport): (QualityIssue | BiasFlag)[] {
  const highIssues = report.issues.filter((i) => i.severity === 'high')
  const highBiasFlags = report.biasFlags.filter((f) => f.severity === 'high')
  return [...highIssues, ...highBiasFlags]
}
