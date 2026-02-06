# Veo 3.1 Frame Chaining Implementation

## Overview

This document explains the frame-to-frame chaining implementation for Veo 3.1, which enables smooth video transitions by using the last frame of one clip as input for the next clip.

## Architecture

### Two Generation Modes

Veo 3.1 supports two distinct generation modes that **cannot be used simultaneously**:

#### Mode 1: Character Reference (Current Default)
- **Model:** `veo-3.1-generate-preview`
- **Purpose:** Maintain character consistency across videos
- **Parameters:** `referenceImages` array with `referenceType: "asset"`
- **Use case:** First clip in a movie, standalone generations with character references
- **Example:**
```typescript
{
  instances: [{
    prompt: "A person walking down the street",
    referenceImages: [{
      image: { gcsUri: "gs://bucket/character.jpg", mimeType: "image/jpeg" },
      referenceType: "asset"
    }]
  }]
}
```

#### Mode 2: Frame Chaining (New)
- **Model:** `veo-3.1-generate-001` (production) or `veo-3.1-fast-generate-001`
- **Purpose:** Create smooth transitions between sequential clips
- **Parameters:** `image` (first frame) + `lastFrame` (last frame)
- **Use case:** Subsequent clips in a movie sequence
- **Example:**
```typescript
{
  instances: [{
    prompt: "Continue the scene with the person turning left",
    image: {
      gcsUri: "gs://bucket/first_frame.jpg",
      mimeType: "image/jpeg"
    },
    lastFrame: {
      gcsUri: "gs://bucket/last_frame.jpg",
      mimeType: "image/jpeg"
    }
  }]
}
```

### Trade-offs

**When using frame chaining mode:**
- ✅ Smooth visual continuity between clips
- ✅ Natural scene transitions
- ❌ Character reference images are **not supported** (mutually exclusive)
- ⚠️ Visual consistency is maintained through temporal continuity, not character references

**Recommended strategy:**
1. **First clip:** Use Mode 1 (character reference) to establish character appearance
2. **Subsequent clips:** Use Mode 2 (frame chaining) with last frame of previous clip
3. The first clip establishes the character, and frame chaining maintains continuity

## Implementation Details

### 1. Type Definitions

Added frame chaining parameters to `GenerationParams`:

```typescript
// lib/models/types.ts
export interface GenerationParams {
  // ... existing fields
  firstFrameGcsUri?: string  // First frame GCS URI (for Veo frame chaining)
  lastFrameGcsUri?: string   // Last frame GCS URI (for Veo frame chaining)
}
```

### 2. Veo Model Selection

The Veo implementation automatically selects the correct model based on parameters:

```typescript
// lib/models/veo.ts
const useFrameChaining = !!(params.firstFrameGcsUri || params.lastFrameGcsUri)
const selectedModel = useFrameChaining ? VEO_MODEL_FRAME_CHAINING : VEO_MODEL_CHARACTER
```

### 3. GCS Upload Utility

Created `lib/gcsUpload.ts` to handle frame uploads:

```typescript
// Upload a frame from Supabase to GCS
const gcsUri = await downloadAndUploadToGCS(
  'https://supabase.../frame.jpg',  // Source URL
  'my-bucket',                        // GCS bucket
  'frames/user123/video456_last.jpg'  // GCS path
)
// Returns: "gs://my-bucket/frames/user123/video456_last.jpg"
```

### 4. Generation API Integration

The `/api/generate` endpoint now accepts frame URLs:

```typescript
// POST /api/generate
{
  prompt: "...",
  model: "veo3_1",
  duration: 8,
  firstFrameUrl: "https://supabase.../first_frame.jpg",  // Optional
  lastFrameUrl: "https://supabase.../last_frame.jpg",   // Optional
  // ... other params
}
```

The API automatically:
1. Downloads frames from the provided URLs
2. Uploads them to Google Cloud Storage
3. Converts to GCS URIs (gs://...)
4. Passes to Veo in the correct format

### 5. Frame Extraction

Frames are extracted when adding videos to movies:

```typescript
// components/layout/MultiModelVideoPanel.tsx
const { firstFrame, lastFrame } = await extractBothFrames(video.videoUrl)

// Upload to Supabase
const [firstUrl, lastUrl] = await Promise.all([
  uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_first.jpg`, firstFrame),
  uploadToStorage(STORAGE_BUCKETS.IMAGES, `${frameBasePath}_last.jpg`, lastFrame),
])

// Store in database for later use
await fetch(`/api/movies/${movieId}/clips`, {
  method: 'POST',
  body: JSON.stringify({
    videoId: selectedVideo.id,
    position: nextPosition,
    firstFrameUrl: firstUrl,
    lastFrameUrl: lastUrl,
  }),
})
```

## Usage Workflow

### Current Flow (Working)
1. User generates video(s) with character references
2. User adds video to movie → frames extracted and stored
3. Frames stored in `movie_clips` table

### Future Flow (Phase 3 - To Be Implemented)
1. User opens movie editor
2. User clicks "Generate Next Clip" button
3. System fetches last frame URL from previous clip
4. System calls generation API with:
   ```typescript
   {
     prompt: "...",
     model: "veo3_1",
     lastFrameUrl: previousClip.lastFrameUrl,  // Frame chaining mode
     // characterIds will be ignored in frame chaining mode
   }
   ```
5. Veo generates video that smoothly continues from previous clip
6. New video automatically added to movie

## Database Schema

Frame URLs are stored in the `movie_clips` table:

```sql
CREATE TABLE movie_clips (
  id TEXT PRIMARY KEY,
  movie_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  position INT NOT NULL,
  first_frame_url TEXT,  -- Added for frame chaining
  last_frame_url TEXT,   -- Added for frame chaining
  -- ... other fields
)
```

## API Reference

### POST /api/generate

**Request Body:**
```typescript
{
  prompt: string
  model: 'veo3_1' | 'runway' | 'luma' | 'sora'
  duration: number
  conversationId?: string
  characterIds?: string[]      // Used for Mode 1 (character reference)
  firstFrameUrl?: string       // Used for Mode 2 (frame chaining)
  lastFrameUrl?: string        // Used for Mode 2 (frame chaining)
  // ... other params
}
```

**Behavior:**
- If `firstFrameUrl` OR `lastFrameUrl` is provided for Veo: Use frame chaining mode
- If `characterIds` is provided and no frame URLs: Use character reference mode
- Character references and frame chaining are **mutually exclusive**

## Testing

### Test Character Reference Mode (Mode 1)
```bash
curl -X POST /api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A person walking",
    "model": "veo3_1",
    "duration": 8,
    "characterIds": ["char_123"]
  }'
```

### Test Frame Chaining Mode (Mode 2)
```bash
curl -X POST /api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Continue the scene",
    "model": "veo3_1",
    "duration": 8,
    "lastFrameUrl": "https://supabase.../last_frame.jpg"
  }'
```

## Phase 3 Implementation Plan

To enable seamless video chaining in the movie editor:

### 1. Add "Generate Next Clip" Button in Movie Editor
- Shows in movie timeline/sidebar
- Enabled when movie has at least one clip
- Opens generation dialog with context

### 2. Pre-populate Generation Dialog
- Fetch last clip's `lastFrameUrl`
- Pre-fill prompt with continuation context
- Disable character selection (frame chaining takes priority)
- Show preview of last frame

### 3. Automatic Clip Addition
- After generation completes, automatically add to movie
- Position at end of sequence
- Extract frames for future chaining

### 4. UI Indicators
- Show which clips were generated with frame chaining
- Display "Chained from Clip N" indicator
- Visual connection between linked clips

## Limitations

1. **GCS Requirement:** Veo requires Google Cloud Storage URIs (gs://...), not HTTP URLs
2. **Mutual Exclusivity:** Cannot use character references AND frame chaining together
3. **Veo Only:** Frame chaining currently only implemented for Veo 3.1
4. **Cost:** Each frame upload to GCS incurs minimal storage costs

## Future Enhancements

1. **Support frame chaining for other models** (Runway, Luma, Sora)
2. **Hybrid mode:** Use character references for first clip, then switch to frame chaining
3. **Branch from middle:** Allow generating from any clip in sequence, not just the end
4. **Frame preview:** Show frame being used for chaining in generation dialog
5. **Prompt suggestions:** AI-generated continuation prompts based on previous clip

## Troubleshooting

### Frame chaining not working
- Check that `lastFrameUrl` is a valid HTTP(S) URL
- Verify GCS bucket permissions and credentials
- Check logs for GCS upload errors
- Ensure `GOOGLE_APPLICATION_CREDENTIALS_JSON` is configured

### Video doesn't match expected continuity
- Verify correct frame was extracted (use frame preview)
- Check prompt describes continuation appropriately
- Consider frame quality (blur/artifacts affect results)
- Try adjusting prompt to be more specific about transition

### Character appearance changes
- Expected behavior when using frame chaining mode
- First clip establishes character via Mode 1
- Subsequent clips maintain appearance through temporal continuity
- If character drifts, consider re-establishing with character reference

## Documentation References

- [Veo 3.1 API Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo)
- [Frame Extraction Implementation](./lib/frameExtraction.ts)
- [GCS Upload Utility](./lib/gcsUpload.ts)
- [Veo Model Implementation](./lib/models/veo.ts)
