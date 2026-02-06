# Video Concatenator Service

Google Cloud Run service for concatenating multiple videos into one using FFmpeg.

## Features

- ✅ Concatenates multiple MP4 videos
- ✅ Handles different codecs/formats (re-encodes to H.264)
- ✅ Uploads result to Google Cloud Storage
- ✅ Returns public URL for immediate access
- ✅ Auto-cleanup of temporary files
- ✅ Health check endpoint
- ✅ Serverless (Google Cloud Run)

## Prerequisites

1. **Google Cloud Project** with:
   - Cloud Run API enabled
   - Cloud Storage API enabled
   - Billing enabled

2. **Google Cloud CLI** (`gcloud`) installed:
   ```bash
   # Install gcloud CLI
   # https://cloud.google.com/sdk/docs/install

   # Login
   gcloud auth login

   # Set project
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Docker** (for local testing, optional)

## Deployment to Google Cloud Run

### Quick Deploy (Recommended)

```bash
# Navigate to this directory
cd services/video-concatenator

# Deploy to Cloud Run (auto-builds from source)
gcloud run deploy video-concatenator \
  --source . \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 600 \
  --max-instances 10 \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET=premiere-characters-grant
```

**Important Configuration:**
- `--memory 4Gi` - Video processing needs substantial memory
- `--cpu 2` - Multiple CPUs speed up FFmpeg encoding
- `--timeout 600` - 10 minutes max (for long videos)
- `--max-instances 10` - Limit concurrent processing

### Manual Docker Build

```bash
# Build image
docker build -t gcr.io/YOUR_PROJECT_ID/video-concatenator .

# Push to Google Container Registry
docker push gcr.io/YOUR_PROJECT_ID/video-concatenator

# Deploy
gcloud run deploy video-concatenator \
  --image gcr.io/YOUR_PROJECT_ID/video-concatenator \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 600 \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET=premiere-characters-grant
```

### After Deployment

You'll receive a service URL like:
```
https://video-concatenator-XXXXX-uc.a.run.app
```

Save this URL - you'll need it for the main app integration.

## API Reference

### POST /concatenate

Concatenate multiple videos into one.

**Request:**
```json
{
  "videoUrls": [
    "https://storage.googleapis.com/.../video1.mp4",
    "https://storage.googleapis.com/.../video2.mp4",
    "https://storage.googleapis.com/.../video3.mp4"
  ],
  "outputFileName": "my-movie" // Optional, defaults to "concatenated"
}
```

**Response (Success):**
```json
{
  "success": true,
  "outputUrl": "https://storage.googleapis.com/premiere-characters-grant/movies/my-movie_1234567890.mp4"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "video-concatenator"
}
```

## Integration with Main App

Update `/app/api/movies/[id]/export/route.ts`:

```typescript
// At the top of the file
const CONCATENATOR_URL = process.env.CONCATENATOR_SERVICE_URL || 'https://video-concatenator-XXXXX-uc.a.run.app'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ... existing code to fetch movie and clips ...

  // Call concatenation service
  const concatResponse = await fetch(`${CONCATENATOR_URL}/concatenate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrls: videoUrls,
      outputFileName: movie.title.replace(/[^a-z0-9]/gi, '_')
    })
  })

  if (!concatResponse.ok) {
    const error = await concatResponse.json()
    return NextResponse.json(
      { error: error.error || 'Concatenation failed' },
      { status: 500 }
    )
  }

  const { outputUrl } = await concatResponse.json()

  return NextResponse.json({
    success: true,
    exportUrl: outputUrl
  })
}
```

Add environment variable to Vercel:
```
CONCATENATOR_SERVICE_URL=https://video-concatenator-XXXXX-uc.a.run.app
```

## Local Development

### Run Locally with Docker

```bash
# Build
docker build -t video-concatenator .

# Run
docker run -p 8080:8080 \
  -e GCS_BUCKET=premiere-characters-grant \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
  -v /path/to/your/credentials.json:/app/credentials.json:ro \
  video-concatenator
```

### Run with Node.js (requires FFmpeg installed)

```bash
# Install FFmpeg
# macOS: brew install ffmpeg
# Ubuntu: sudo apt-get install ffmpeg

# Install dependencies
npm install

# Run
GCS_BUCKET=premiere-characters-grant npm start
```

### Test the API

```bash
curl -X POST http://localhost:8080/concatenate \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrls": [
      "https://storage.googleapis.com/.../video1.mp4",
      "https://storage.googleapis.com/.../video2.mp4"
    ],
    "outputFileName": "test-concat"
  }'
```

## Performance & Costs

### Performance
- **Processing Time**: ~1-2 seconds per second of video (depends on codecs)
- **Memory Usage**: ~2-4GB for typical videos
- **CPU**: Benefits significantly from multiple CPUs

### Cost Estimates (Google Cloud Run)
- **Compute**: ~$0.10 - $0.50 per export (4GB RAM, 2 CPU, 1-2 min)
- **Storage**: ~$0.02/GB/month for output videos
- **Bandwidth**: First 1GB/month free, then $0.12/GB

Example: 100 movie exports/month = ~$10-50/month

### Optimization Tips
1. **Use same codec**: If all clips use H.264, use `-c copy` (no re-encoding)
2. **Lower quality**: Adjust CRF value (23 = default, higher = smaller/worse)
3. **Reduce instances**: Lower `--max-instances` to control costs
4. **Clean up old exports**: Set GCS lifecycle policy to delete old files

## Monitoring

### View Logs
```bash
gcloud run logs read video-concatenator --region us-central1
```

### View Metrics
```bash
# Open Cloud Console
gcloud run services describe video-concatenator --region us-central1
```

### Set up Alerts
1. Go to Cloud Console > Monitoring
2. Create alert for:
   - Request latency > 5 minutes
   - Error rate > 5%
   - Memory usage > 90%

## Troubleshooting

### "Out of memory" errors
```bash
# Increase memory
gcloud run services update video-concatenator \
  --memory 8Gi \
  --region us-central1
```

### "Deadline exceeded" errors
```bash
# Increase timeout
gcloud run services update video-concatenator \
  --timeout 900 \
  --region us-central1
```

### FFmpeg errors
- Check logs for specific FFmpeg error messages
- Most common: incompatible codecs → solution: re-encode all inputs
- Check that all input videos are valid and accessible

### Permission errors
```bash
# Ensure service account has Storage Admin role
gcloud run services update video-concatenator \
  --region us-central1 \
  --service-account YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com
```

## Security

### Production Recommendations

1. **Enable Authentication**:
   ```bash
   gcloud run services update video-concatenator \
     --no-allow-unauthenticated \
     --region us-central1
   ```

2. **Use Service Accounts** for calling the service from your main app

3. **Add Rate Limiting** to prevent abuse

4. **Validate Input URLs** to prevent SSRF attacks

## Advanced Features (Future)

- [ ] Transition effects between clips
- [ ] Audio track support
- [ ] Subtitles/captions merging
- [ ] Custom encoding profiles
- [ ] Webhook notifications on completion
- [ ] Job queue for very large exports
- [ ] Resume capability for failed jobs

## Support

For issues or questions:
1. Check Cloud Run logs: `gcloud run logs read video-concatenator`
2. Verify FFmpeg is working: `docker run video-concatenator ffmpeg -version`
3. Test locally before deploying
4. Check GCS bucket permissions

## License

Same as parent project.
