-- Add generation_jobs table for serverless job persistence
-- This table tracks external job IDs from video generation APIs (Sora, Luma, Runway, Veo)
-- to enable status polling across serverless function cold starts

CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  external_job_id VARCHAR(255),
  webhook_payload TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Index for faster lookups by video_id (most common query)
CREATE INDEX IF NOT EXISTS idx_generation_jobs_video_id ON generation_jobs(video_id);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);

-- Index for finding stale jobs
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON generation_jobs(created_at);

-- Comment for documentation
COMMENT ON TABLE generation_jobs IS 'Tracks external video generation job IDs for serverless persistence';
COMMENT ON COLUMN generation_jobs.external_job_id IS 'Job ID from external API (Sora, Luma, Runway, Veo)';
COMMENT ON COLUMN generation_jobs.video_id IS 'Foreign key to videos table';
