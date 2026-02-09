-- Create video_comments table
CREATE TABLE video_comments (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp DECIMAL(10, 3) NOT NULL, -- seconds with millisecond precision
  text TEXT NOT NULL,
  frame_url TEXT, -- captured frame at this timestamp
  bounding_box_x DECIMAL(5, 2), -- percentage (0-100)
  bounding_box_y DECIMAL(5, 2), -- percentage (0-100)
  bounding_box_width DECIMAL(5, 2), -- percentage (0-100)
  bounding_box_height DECIMAL(5, 2), -- percentage (0-100)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX idx_video_comments_video_id ON video_comments(video_id);
CREATE INDEX idx_video_comments_user_id ON video_comments(user_id);
CREATE INDEX idx_video_comments_timestamp ON video_comments(video_id, timestamp);

-- Enable Row Level Security
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own video comments"
  ON video_comments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video comments"
  ON video_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video comments"
  ON video_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video comments"
  ON video_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_comments_updated_at
  BEFORE UPDATE ON video_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_video_comments_updated_at();
