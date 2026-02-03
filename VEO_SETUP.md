# Veo 3.1 Setup Guide (Vertex AI)

Veo 3.1 is available through Google Cloud's **Vertex AI**, not AI Studio. This requires special configuration.

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Vertex AI API** enabled
3. **API Key** or Service Account credentials

## Step-by-Step Setup

### 1. Create/Select Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project or select an existing one
3. Note your **Project ID** (e.g., `my-premiere-project-123`)

### 2. Enable Vertex AI API

1. Go to: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
2. Click **Enable**
3. Wait for it to complete

### 3. Enable Billing

1. Go to: https://console.cloud.google.com/billing
2. Link a billing account to your project
3. Veo requires a paid account (no free tier)

### 4. Get Your API Key

**Option A: Use API Key (Simpler)**
1. Go to: https://aistudio.google.com/apikey
2. Create an API key
3. Copy the key

**Option B: Use Service Account (More Secure)**
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Create a service account
3. Grant it "Vertex AI User" role
4. Download JSON key file

### 5. Add Environment Variables to Vercel

Add these to your Vercel project settings:

```bash
GOOGLE_CLOUD_PROJECT_ID="your-project-id"  # From step 1
GOOGLE_AI_API_KEY="your-api-key"            # From step 4
```

### 6. Test in Vertex AI Studio

Before using in your app, test that Veo works:

1. Go to: https://console.cloud.google.com/vertex-ai/generative/multimodal/create/veo
2. Try generating a test video
3. If it works there, it should work in your app

## Common Issues

### ❌ "Project ID not configured"
**Solution:** Add `GOOGLE_CLOUD_PROJECT_ID` to Vercel environment variables

### ❌ "Veo model not found"
**Solutions:**
- Make sure Vertex AI API is enabled
- Check that you're using the correct project ID
- Veo might not be available in your region (try us-central1)

### ❌ "Access denied" or 403 error
**Solutions:**
- Enable billing on your Google Cloud project
- Make sure Vertex AI API is enabled
- Check that your API key has the right permissions

### ❌ "Image URL is not a GCS URI" warning
**Problem:** Veo in Vertex AI requires images to be in Google Cloud Storage (gs:// URLs), not HTTP URLs.

**Solution:** You'll need to upload character images to a GCS bucket first, OR use the base64 option (coming soon).

## Image Upload for Character References

For character references to work with Veo, images need to be in Google Cloud Storage:

### Option 1: Upload to GCS (Recommended)

1. Create a GCS bucket:
   ```bash
   gsutil mb gs://your-premiere-images
   ```

2. Upload images:
   ```bash
   gsutil cp character.jpg gs://your-premiere-images/
   ```

3. Make bucket publicly readable:
   ```bash
   gsutil iam ch allUsers:objectViewer gs://your-premiere-images
   ```

### Option 2: Use Base64 (Alternative - Coming Soon)

We can add support for base64-encoded images which don't require GCS.

## Pricing

Veo 3.1 pricing (as of 2025):
- **Text-to-Video**: ~$0.10-0.20 per second of video
- **Image-to-Video**: ~$0.15-0.25 per second of video

For 4-8 second videos, expect $0.80-2.00 per generation.

## Documentation Links

- [Veo on Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo)
- [Vertex AI API Reference](https://cloud.google.com/vertex-ai/docs/reference/rest)
- [Google Cloud Console](https://console.cloud.google.com)

## Still Not Working?

Check your Vercel logs for detailed error messages:
```
[Veo] Vertex AI Request: { ... }
[Veo] Vertex AI error: { status: XXX, ... }
```

Share these logs for more specific help!
