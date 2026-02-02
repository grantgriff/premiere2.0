# Migration Guide: Add GenerationJob Table

## Overview
This migration adds the `generation_jobs` table to enable proper serverless persistence for video generation jobs across all models (Sora, Luma, Runway, Veo).

## Why This Is Needed
In Vercel's serverless environment, in-memory state (like the `activeJobs` Map) is lost between function invocations. This causes videos to get stuck in "processing" state when different requests hit different function instances.

The `generation_jobs` table persists the external job ID (from Sora/Luma/Runway/Veo APIs) to the database, allowing any serverless instance to resume polling for status.

## How to Apply the Migration

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `prisma/migrations/add_generation_jobs_table.sql`
4. Paste and run the SQL

### Option 2: Via Vercel Postgres CLI
If you're using Vercel Postgres:
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Connect to your database
vercel postgres connect

# Run the migration
\i prisma/migrations/add_generation_jobs_table.sql
```

### Option 3: Via Prisma Migrate (Advanced)
If you have Prisma configured locally:
```bash
# Create a new migration
npx prisma migrate dev --name add_generation_jobs_table

# Deploy to production
npx prisma migrate deploy
```

## After Migration
Once the table exists in production:
1. The workaround try-catch blocks in `app/api/generate/route.ts` can be removed
2. All video generation will have proper serverless persistence
3. Videos will no longer get stuck in "processing" state on cold starts

## Rollback
If you need to rollback:
```sql
DROP TABLE IF EXISTS generation_jobs CASCADE;
```

## Verify Migration
After applying, verify the table was created:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'generation_jobs';
```

You should see 10 columns: id, video_id, status, attempts, last_error, external_job_id, webhook_payload, created_at, started_at, completed_at
