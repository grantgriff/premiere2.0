# Google Cloud Storage Setup for Veo Character References

This guide will help you set up Google Cloud Storage so character images work with Veo 3.1.

## Why GCS is Needed

Veo 3.1 in Vertex AI **requires** images to be in Google Cloud Storage (`gs://` URIs), not HTTP URLs. Other models (Sora, Luma, Runway) work fine with HTTP URLs from Supabase.

**Solution:** Your app now automatically uploads character images to BOTH:
1. ✅ Supabase Storage (for display in UI)
2. ✅ Google Cloud Storage (for Veo API)

## Setup Steps

### 1. Create a GCS Bucket

```bash
# Using gcloud CLI (recommended)
gcloud storage buckets create gs://your-premiere-characters \
  --location=us-central1 \
  --public-access-prevention

# Or visit: https://console.cloud.google.com/storage/create-bucket
```

**Bucket name suggestions:**
- `premiere-characters`
- `premiere-images-{your-project-id}`
- `{your-project-id}-character-refs`

**Important settings:**
- **Location**: `us-central1` (same as Veo API)
- **Storage class**: Standard
- **Access control**: Uniform (bucket-level)

### 2. Make Bucket Publicly Readable

Veo needs to access the images via public URLs:

```bash
# Make all objects publicly readable
gsutil iam ch allUsers:objectViewer gs://your-premiere-characters
```

Or in Cloud Console:
1. Go to your bucket
2. Click "Permissions" tab
3. Click "+ Grant Access"
4. Principal: `allUsers`
5. Role: "Storage Object Viewer"

### 3. Enable CORS (if needed)

```bash
# Create cors.json
echo '[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]' > cors.json

# Apply CORS
gsutil cors set cors.json gs://your-premiere-characters
```

### 4. Add Environment Variables to Vercel

Add these three variables to your Vercel project:

```bash
GOOGLE_CLOUD_PROJECT_ID="your-project-id"  # e.g., "premiere-prod-2025"
GOOGLE_CLOUD_STORAGE_BUCKET="your-bucket-name"  # e.g., "premiere-characters"
GOOGLE_AI_API_KEY="your-api-key"  # Your existing API key
```

**How to find your Project ID:**
1. Go to: https://console.cloud.google.com
2. Click the project dropdown at the top
3. Your project ID is shown next to the project name

### 5. Run Database Migration

Run this SQL in your Supabase SQL Editor to add the `gcs_image_uri` column:

```sql
-- Add GCS URI column to characters table
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS gcs_image_uri TEXT;

COMMENT ON COLUMN characters.gcs_image_uri IS 'Google Cloud Storage URI (gs://) for Veo API character references';
```

### 6. Deploy and Test!

1. Deploy your branch to Vercel
2. Upload a character image
3. Check Vercel logs - you should see:
   ```
   [Characters API] Mirroring image to GCS for Veo compatibility...
   [Characters API] GCS upload successful: gs://your-bucket/characters/user-id/char-id.jpg
   ```
4. Generate a video with Veo + character selected
5. Check logs for:
   ```
   [Veo] Using GCS URI for character reference (optimal for Veo)
   ```

## Verification Checklist

✅ **Bucket created** in Google Cloud Storage
✅ **Bucket is public** (allUsers has Storage Object Viewer role)
✅ **Three env vars** added to Vercel:
   - `GOOGLE_CLOUD_PROJECT_ID`
   - `GOOGLE_CLOUD_STORAGE_BUCKET`
   - `GOOGLE_AI_API_KEY`
✅ **Database migration** run (gcs_image_uri column added)
✅ **Code deployed** to Vercel

## Testing Character Upload

1. Open Character Manager
2. Upload a photo of yourself
3. Name it "Me" and save
4. Check browser network tab - should see successful POST to `/api/characters`
5. Check Vercel logs:
   - ✅ "Mirroring image to GCS..."
   - ✅ "GCS upload successful: gs://..."

If GCS upload fails, character still works with Luma/Runway/Sora (just not Veo).

## Testing Veo Generation

1. Select your character
2. Type prompt: "walking on a beach"
3. Select Veo 3.1 model
4. Generate video
5. Check Vercel logs:
   - ✅ "Character GCS URIs: 1"
   - ✅ "Using GCS URI for character reference (optimal for Veo)"
   - ✅ Your face should appear in the video!

## Troubleshooting

### ❌ "GCS upload failed: bucket not found"
**Solution:** Make sure bucket name in env var matches the bucket you created.

### ❌ "GCS upload failed: 403 access denied"
**Solution:**
- Verify your API key has permissions
- Try creating the bucket in the same project as your API key

### ❌ Character image not in Veo video
**Possible causes:**
1. GCS upload failed (check logs)
2. Bucket is not public
3. Prompt doesn't mention character explicitly enough
4. Veo's AI just isn't matching well (it happens)

**Check:**
```
[Generate] Character GCS URIs: 1  ← Should be 1 or more
[Veo] Using GCS URI for character reference  ← Should see this
```

### ❌ "Image URL is not a GCS URI" warning
This means the character was created before GCS was set up. Solution:
1. Re-upload the character image (triggers new GCS upload)
2. Or manually upload to GCS and update database

## Cost Estimate

GCS pricing (us-central1):
- **Storage**: $0.020 per GB/month
- **Operations**: ~$0.005 per 10,000 operations
- **Network**: Free within same region

For 100 character images (~5MB each):
- Storage: ~$0.001/month
- Operations: Negligible
- **Total: < $0.01/month** 🎉

## Advanced: Using Service Account (More Secure)

Instead of API keys, you can use service account JSON:

1. Create service account: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Grant roles:
   - Storage Object Admin
   - Vertex AI User
3. Download JSON key
4. Add to Vercel as `GOOGLE_APPLICATION_CREDENTIALS_JSON`
5. Update code to use service account

(This is optional - API keys work fine for now)

## Support

If you're still having issues:
1. Share your Vercel logs (search for `[GCS]` and `[Veo]`)
2. Verify bucket exists: `gsutil ls gs://your-bucket-name`
3. Test API key: `gcloud auth activate-service-account --key-file=key.json`

Character references should now work perfectly with Veo! 🎬✨
