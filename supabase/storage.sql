-- Storage Buckets and RLS Policies for Premiere 2
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- =====================================================
-- CREATE STORAGE BUCKETS
-- =====================================================

-- Images bucket (for character images, style references, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Videos bucket (for generated videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Thumbnails bucket (for video thumbnails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE RLS POLICIES - IMAGES BUCKET
-- =====================================================

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Authenticated users can upload images to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role to upload images anywhere (for AI-generated content)
CREATE POLICY "Service role can upload images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'images');

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all images (so they work in video generation APIs)
CREATE POLICY "Public read access for images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');

-- =====================================================
-- STORAGE RLS POLICIES - VIDEOS BUCKET
-- =====================================================

-- Allow authenticated users to upload videos to their own folder
CREATE POLICY "Authenticated users can upload videos to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role to upload videos (for Sora downloads)
CREATE POLICY "Service role can upload videos"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'videos');

-- Allow authenticated users to update their own videos
CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all videos
CREATE POLICY "Public read access for videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

-- =====================================================
-- STORAGE RLS POLICIES - THUMBNAILS BUCKET
-- =====================================================

-- Allow authenticated users to upload thumbnails to their own folder
CREATE POLICY "Authenticated users can upload thumbnails to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own thumbnails
CREATE POLICY "Users can update own thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own thumbnails
CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all thumbnails
CREATE POLICY "Public read access for thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

-- =====================================================
-- NOTES
-- =====================================================
--
-- Bucket settings:
-- - All buckets are public (public = true) which means files can be accessed
--   via public URLs without authentication
-- - RLS policies control who can upload/update/delete
--
-- Security model:
-- - Users upload files to folders named with their user_id: {user_id}/{filename}
-- - Users can only upload/update/delete files in their own folder
-- - Everyone can read all files (needed for video generation APIs)
-- - Service role can upload videos (needed for Sora video downloads)
--
-- File path structure:
-- - images: {user_id}/{file_id}_{original_name}
-- - videos: {user_id}/{file_id}_{original_name} OR generated/{sora_filename}
-- - thumbnails: {user_id}/{file_id}_{original_name}
