-- Emergency fix for movie/clips functionality
-- Run this SQL directly in your Supabase SQL editor

-- 1. Add the missing foreign key constraint from movie_clips to videos
ALTER TABLE "movie_clips"
ADD CONSTRAINT IF NOT EXISTS "movie_clips_video_id_fkey"
FOREIGN KEY ("video_id")
REFERENCES "videos"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 2. Verify the constraint was added
SELECT
    constraint_name,
    table_name,
    column_name
FROM information_schema.key_column_usage
WHERE table_name = 'movie_clips'
AND constraint_name = 'movie_clips_video_id_fkey';

-- 3. List current movies to verify data
SELECT id, title, created_at, updated_at
FROM movies
ORDER BY created_at DESC
LIMIT 10;
