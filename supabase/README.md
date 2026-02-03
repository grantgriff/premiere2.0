# Supabase Setup Guide

This directory contains SQL scripts for setting up your Premiere 2 Supabase database and storage.

## Initial Setup

### 1. Database Schema

Run `schema.sql` in your Supabase SQL Editor to create all database tables:

```
https://supabase.com/dashboard/project/YOUR_PROJECT/sql
```

This creates:
- `users` - User profiles synced with Supabase Auth
- `conversations` - Chat conversations
- `messages` - Chat messages
- `videos` - Generated videos
- `characters` - User-created characters for consistent generation
- `generation_jobs` - Job tracking for async video generation

### 2. Storage Buckets

Run `storage.sql` in your Supabase SQL Editor to create storage buckets and RLS policies:

This creates:
- `images` bucket - For character images, style references
- `videos` bucket - For generated videos
- `thumbnails` bucket - For video thumbnails

All buckets are public with proper RLS policies.

## Storage Structure

Files are organized by user ID:

```
images/
  {user_id}/
    {file_id}_{original_name}

videos/
  {user_id}/
    {file_id}_{original_name}
  generated/
    sora-{job_id}-{timestamp}.mp4

thumbnails/
  {user_id}/
    {file_id}_{original_name}
```

## RLS Policies Summary

### Database Tables
- Users can only read/update their own data
- Service role has full access
- All operations scoped to authenticated user's `user_id`

### Storage Buckets
- **Upload**: Users can only upload to their own `{user_id}/` folder
- **Read**: Public read access (needed for video generation APIs)
- **Update/Delete**: Users can only modify their own files
- **Service Role**: Can upload anywhere (needed for Sora video downloads)

## Environment Variables

Required environment variables (add to Vercel):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_SECRET_KEY="your-secret-key"

# Database
DATABASE_URL="postgresql://..."

# AI APIs
GOOGLE_AI_API_KEY="your-google-ai-key"
OPENAI_API_KEY="your-openai-key"
LUMA_API_KEY="your-luma-key"
RUNWAY_API_KEY="your-runway-key"

# Other
YOUTUBE_API_KEY="your-youtube-key"
UPSTASH_REDIS_URL="your-redis-url"
UPSTASH_REDIS_TOKEN="your-redis-token"
```

## Troubleshooting

### Character images not uploading
- Ensure the `images` bucket exists
- Verify RLS policies are enabled on `storage.objects`
- Check browser console for specific errors

### Sora videos failing to upload
- Ensure `SUPABASE_SECRET_KEY` env var is set (not just publishable key)
- Verify `videos` bucket exists and has service role upload policy
- Check Vercel logs for detailed error messages

### Videos not accessible
- Verify buckets are public (`public = true`)
- Check that files have public read policy
- Ensure file paths follow the `{user_id}/` structure
