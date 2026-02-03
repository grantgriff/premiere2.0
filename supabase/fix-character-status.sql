-- Fix existing characters with images that are stuck in 'pending' status
-- Run this in your Supabase SQL Editor

-- Update all characters that have a reference_image_url but are still 'pending'
-- Set them to 'ready' since they have images uploaded
UPDATE characters
SET
  embedding_status = 'ready',
  updated_at = NOW()
WHERE
  embedding_status = 'pending'
  AND reference_image_url IS NOT NULL
  AND reference_image_url != '';

-- Show the updated characters
SELECT
  id,
  name,
  embedding_status,
  reference_image_url IS NOT NULL as has_image
FROM characters
ORDER BY created_at DESC;
