# Troubleshooting Veo 3.1 "Model Not Found" Error

You're getting: **"Veo model not found. The Veo API may not be available in your region."**

## Root Cause Options

### 1. Veo 3.1 Requires Vertex AI (Most Likely)

The current code uses **Google AI Studio API** (`generativelanguage.googleapis.com`), but Veo 3.1 might only be available through **Vertex AI API**.

**To check:**
- Go to: https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/veo
- See if Veo 3.1 is listed there
- If yes, you need to enable Vertex AI API and use a service account

**What needs to change:**
```typescript
// Current (AI Studio API)
const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const VEO_MODEL = 'veo-3.1-fast-generate-preview'

// Should be (Vertex AI API)
const VEO_API_BASE = 'https://{REGION}-aiplatform.googleapis.com/v1'
const VEO_MODEL = 'projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/veo-3.1'
```

### 2. Model Name is Wrong

Try these alternative model names:
- `veo-3` (older version)
- `veo-002` (internal name)
- `imagen-3-video-001` (if Veo is rebranded)

### 3. Allowlist Required

Veo 3.1 might require:
- Explicit allowlist access request
- Trusted Tester program enrollment
- Enterprise/premium tier

### 4. Region Restriction

Veo might only be available in specific regions:
- US (us-central1, us-west1)
- Europe (europe-west4)

## Quick Fixes to Try

### Fix 1: Check Your Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/library
2. Search for "Vertex AI API"
3. Make sure it's ENABLED
4. Check if "Generative Language API" is also enabled

### Fix 2: Check Vertex AI Model Garden

1. Go to: https://console.cloud.google.com/vertex-ai/model-garden
2. Search for "veo"
3. See if it appears and what the exact model name is

### Fix 3: Verify API Key Type

The code currently uses an AI Studio API key (`GOOGLE_AI_API_KEY`). Vertex AI requires:
- Service Account JSON key
- OAuth 2.0 token
- Application Default Credentials

## What to Check in Vercel Logs

When you generate with Veo, check the logs for:
```
[Veo] API Endpoint: https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:generateVideos
[Veo] API Key present: true, length: XX
[Veo] API error response: { status: 404, ... }
```

Share these logs with me and I can provide more specific guidance.

## Next Steps

1. **Check your Google Cloud Console** - See if Veo is in Vertex AI Model Garden
2. **Try with Gemini 2.0** - Use `gemini-2.0-flash-exp` model for video as a test
3. **Contact Google Support** - Ask about Veo 3.1 availability in your project

If Veo requires Vertex AI, I'll need to refactor the code to use service account authentication instead of API keys.
