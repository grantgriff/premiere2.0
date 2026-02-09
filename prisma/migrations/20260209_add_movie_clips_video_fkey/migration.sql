-- Add foreign key constraint from movie_clips to videos
-- This enables proper joins between movie clips and their video data

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'movie_clips_video_id_fkey'
    ) THEN
        ALTER TABLE "movie_clips"
        ADD CONSTRAINT "movie_clips_video_id_fkey"
        FOREIGN KEY ("video_id")
        REFERENCES "videos"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;
