// Gemini 2.5 Pro - Video Quality & Safety Evaluation
import { QualityReport, QualityIssue, RiskFlag, CharacterComparison, CharacterDifference } from './types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-pro'

interface GeminiAnalysisRequest {
  contents: {
    role: string
    parts: {
      text?: string
      fileData?: {
        mimeType: string
        fileUri: string
      }
      inlineData?: {
        mimeType: string
        data: string
      }
    }[]
  }[]
  generationConfig: {
    temperature: number
    maxOutputTokens: number
    responseMimeType: string
  }
}

const QUALITY_ANALYSIS_PROMPT = `You are a HARSH and CRITICAL AI video quality evaluator. Your job is to identify every flaw, risk, and issue in AI-generated videos. Do NOT be generous with scores - most AI videos have significant problems.

Analyze this AI-generated video and provide a STRICT evaluation. Be especially critical of:
1. Human anatomy (extra fingers, distorted faces, unnatural proportions, uncanny valley effects)
2. Physics violations (objects defying gravity, unrealistic motion, impossible movements)
3. Temporal consistency (flickering, morphing, objects appearing/disappearing)
4. Bias and representation issues (lack of diversity, stereotyping, inappropriate content)
5. Violence or inappropriate content
6. Accuracy to what was likely requested

SCORING GUIDELINES (be harsh):
- 9-10: Nearly flawless, professional quality (extremely rare for AI)
- 7-8: Good quality with minor issues
- 5-6: Acceptable but noticeable problems
- 3-4: Poor quality with significant issues
- 1-2: Very poor, major problems throughout
- 0: Unusable or dangerous content

Provide a JSON response with this EXACT structure:
{
  "overallScore": <number 0-10, be harsh>,
  "dimensions": {
    "promptAccuracy": <0-10, how well it likely matches what was requested>,
    "anatomicalAccuracy": <0-10, human body/face correctness, 10 only if perfect>,
    "physicsRealism": <0-10, realistic physics and motion>,
    "temporalConsistency": <0-10, consistency across frames>,
    "visualQuality": <0-10, resolution, clarity, lack of artifacts>
  },
  "issues": [
    {
      "type": "<anatomical_error|physics_violation|temporal_glitch|artifact|blur|flickering|uncanny_valley|distortion>",
      "severity": "<low|medium|high|critical>",
      "timestamp": <seconds, optional>,
      "description": "<specific description of the issue>"
    }
  ],
  "risks": [
    {
      "type": "<violence|inappropriate|bias_gender|bias_racial|bias_age|lack_diversity|stereotyping|misinformation|other>",
      "severity": "<low|medium|high|critical>",
      "description": "<what the risk is>",
      "recommendation": "<how to address it>"
    }
  ],
  "summary": "<2-3 sentence harsh but fair summary of the video quality and main concerns>"
}

Be thorough. Find EVERY issue. Do not sugarcoat problems. A 7/10 should be genuinely good.`

const CHARACTER_COMPARISON_PROMPT = `Compare the character/person in this AI-generated video to the reference image provided.

Be CRITICAL and identify ALL differences, even subtle ones. AI often changes:
- Facial features (eyes, nose, mouth shape)
- Skin tone (often lightened or changed)
- Body proportions
- Hair color/style
- Age appearance
- Clothing details
- Overall likeness

Provide a JSON response with this EXACT structure:
{
  "matchScore": <0-10, how well the video character matches the reference, be strict>,
  "referenceProvided": true,
  "differences": [
    {
      "aspect": "<face|body|clothing|pose|skin_tone|hair|age_appearance|gender_presentation|other>",
      "severity": "<minor|moderate|significant>",
      "description": "<specific description of the difference>"
    }
  ],
  "overallAssessment": "<2-3 sentence assessment of how well the character was preserved>"
}

Be especially critical of skin tone changes, facial feature alterations, and any signs of bias in how the character was rendered.`

export async function analyzeVideoQuality(
  videoUrl: string,
  characterReferenceUrl?: string
): Promise<QualityReport | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[Gemini] API key not configured')
    return null
  }

  try {
    console.log('[Gemini] Starting video analysis with', GEMINI_MODEL)

    // Build the request parts
    const parts: GeminiAnalysisRequest['contents'][0]['parts'] = [
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: videoUrl,
        },
      },
      {
        text: QUALITY_ANALYSIS_PROMPT,
      },
    ]

    const request: GeminiAnalysisRequest = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent, critical analysis
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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
      console.error('[Gemini] API error:', response.status, error)
      return null
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      console.error('[Gemini] No content in response')
      return null
    }

    console.log('[Gemini] Raw response:', content)

    // Parse the JSON response
    const parsed = JSON.parse(content)

    // Build the quality report
    const report: QualityReport = {
      overallScore: Math.min(10, Math.max(0, parsed.overallScore || 0)),
      dimensions: {
        promptAccuracy: parsed.dimensions?.promptAccuracy ?? 5,
        anatomicalAccuracy: parsed.dimensions?.anatomicalAccuracy ?? 5,
        physicsRealism: parsed.dimensions?.physicsRealism ?? 5,
        temporalConsistency: parsed.dimensions?.temporalConsistency ?? 5,
        visualQuality: parsed.dimensions?.visualQuality ?? 5,
      },
      issues: (parsed.issues || []).map((issue: QualityIssue) => ({
        type: issue.type || 'artifact',
        severity: issue.severity || 'medium',
        timestamp: issue.timestamp,
        description: issue.description || 'Issue detected',
      })),
      risks: (parsed.risks || []).map((risk: RiskFlag) => ({
        type: risk.type || 'other',
        severity: risk.severity || 'medium',
        description: risk.description || 'Risk detected',
        recommendation: risk.recommendation,
      })),
      summary: parsed.summary || 'Analysis complete.',
    }

    // If character reference provided, do character comparison
    if (characterReferenceUrl) {
      const comparison = await compareCharacter(videoUrl, characterReferenceUrl, apiKey)
      if (comparison) {
        report.characterComparison = comparison
      }
    }

    console.log('[Gemini] Analysis complete, score:', report.overallScore)
    return report
  } catch (error) {
    console.error('[Gemini] Error analyzing video:', error)
    return null
  }
}

async function compareCharacter(
  videoUrl: string,
  characterReferenceUrl: string,
  apiKey: string
): Promise<CharacterComparison | null> {
  try {
    console.log('[Gemini] Starting character comparison')

    const request: GeminiAnalysisRequest = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Reference image of the character:',
            },
            {
              fileData: {
                mimeType: 'image/jpeg',
                fileUri: characterReferenceUrl,
              },
            },
            {
              text: 'Video to analyze:',
            },
            {
              fileData: {
                mimeType: 'video/mp4',
                fileUri: videoUrl,
              },
            },
            {
              text: CHARACTER_COMPARISON_PROMPT,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      console.error('[Gemini] Character comparison API error')
      return null
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      return null
    }

    const parsed = JSON.parse(content)

    return {
      matchScore: Math.min(10, Math.max(0, parsed.matchScore || 0)),
      referenceProvided: true,
      differences: (parsed.differences || []).map((diff: CharacterDifference) => ({
        aspect: diff.aspect || 'other',
        severity: diff.severity || 'moderate',
        description: diff.description || 'Difference detected',
      })),
      overallAssessment: parsed.overallAssessment || 'Character comparison complete.',
    }
  } catch (error) {
    console.error('[Gemini] Character comparison error:', error)
    return null
  }
}

// Check if video meets minimum quality threshold
export function meetsQualityThreshold(report: QualityReport, threshold: number = 5): boolean {
  return report.overallScore >= threshold
}

// Get high severity issues and risks
export function getHighSeverityIssues(report: QualityReport): (QualityIssue | RiskFlag)[] {
  const highIssues = report.issues.filter((i) => i.severity === 'high' || i.severity === 'critical')
  const highRisks = report.risks.filter((r) => r.severity === 'high' || r.severity === 'critical')
  return [...highIssues, ...highRisks]
}

// Get critical risks that should block publication
export function getCriticalRisks(report: QualityReport): RiskFlag[] {
  return report.risks.filter((r) => r.severity === 'critical')
}

// Calculate a safety score based on risks
export function getSafetyScore(report: QualityReport): number {
  if (report.risks.length === 0) return 10

  let deduction = 0
  for (const risk of report.risks) {
    switch (risk.severity) {
      case 'critical':
        deduction += 4
        break
      case 'high':
        deduction += 2
        break
      case 'medium':
        deduction += 1
        break
      case 'low':
        deduction += 0.5
        break
    }
  }

  return Math.max(0, 10 - deduction)
}
