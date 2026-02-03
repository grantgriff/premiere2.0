-- Add GCS URI column to characters table
-- This stores the Google Cloud Storage URI (gs://bucket/path) for Veo API

ALTER TABLE characters
ADD COLUMN IF NOT EXISTS gcs_image_uri TEXT;

COMMENT ON COLUMN characters.gcs_image_uri IS 'Google Cloud Storage URI (gs://) for Veo API character references';

-- Show updated schema
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'characters'
ORDER BY ordinal_position;
