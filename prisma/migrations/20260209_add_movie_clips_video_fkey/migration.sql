-- Add foreign key constraint from movie_clips to videos
-- This enables proper joins between movie clips and their video data

ALTER TABLE "movie_clips"
ADD CONSTRAINT "movie_clips_video_id_fkey"
FOREIGN KEY ("video_id")
REFERENCES "videos"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
