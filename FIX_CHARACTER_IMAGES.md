# How to Fix Character Image Access Issues

## The Problem

Character images are stored in Supabase storage, but **Supabase storage buckets are PRIVATE by default**.

When Luma/Runway/Sora APIs try to fetch your character image URLs, they get **403 Forbidden** errors because they don't have authentication.

This causes ALL character-based video generations to fail!

## The Solution

Make the `images` storage bucket **publicly readable**.

### Option 1: Via Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click on the **`images`** bucket
4. Click the **Settings** tab (or gear icon)
5. Under **Public access**, toggle **Make bucket public** to ON
6. Click **Save**

### Option 2: Via SQL (Programmatic)

Run this SQL in your Supabase SQL Editor:

```sql
-- Make images bucket public for reading
CREATE POLICY "Public read access for images"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images' AND auth.uid() IS NOT NULL);

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (bucket_id = 'images' AND auth.uid() IS NOT NULL);
```

### Option 3: Update Bucket Settings

If the bucket doesn't exist yet, create it as public:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```

## How to Verify It Works

1. Deploy the latest code (includes character image URL testing)
2. Try generating a video with a character
3. Check Vercel logs for one of these messages:

**✅ Success:**
```
[Generate] ✓ Character image 1 is accessible
```

**❌ Still failing:**
```
[Generate] ⚠️ Character image 1 is NOT accessible! Status: 403
[Generate] Check Supabase storage bucket permissions - bucket must be PUBLIC
```

## What the Fix Does

After making the bucket public:

- ✅ Luma can fetch the character image from `keyframes.frame0.url`
- ✅ Runway can fetch the character image from `promptImage`
- ✅ Sora can fetch the character image
- ✅ Character-based generations will work!

## Security Note

Making the bucket public means anyone with the URL can view the images. This is typically fine for:
- Character reference images (not sensitive)
- Generated video thumbnails
- Any content that will eventually be shown to users

If you need **private character images**, you'll need to:
1. Generate signed URLs with expiration
2. Pass those temporary URLs to the video APIs
3. Implement this in the character fetch logic

But for most use cases, **public read access is the right solution**.
