# Code Changes After Migration

After running the `add_generation_jobs_table.sql` migration, apply these changes to remove the workaround try-catch blocks:

## Changes to app/api/generate/route.ts

### 1. POST Handler - Lines 224-237
**REMOVE** the try-catch wrapper:
```typescript
// BEFORE (with workaround):
try {
  await prisma.generationJob.create({
    data: {
      videoId,
      externalJobId: genResult.jobId,
      status: 'processing',
      startedAt: new Date(),
    },
  })
} catch (dbError) {
  console.warn('[Generate] Could not persist to GenerationJob table (table may not exist):', dbError instanceof Error ? dbError.message : dbError)
}

// AFTER (clean):
await prisma.generationJob.create({
  data: {
    videoId,
    externalJobId: genResult.jobId,
    status: 'processing',
    startedAt: new Date(),
  },
})
```

### 2. GET Handler - Lines 298-318
**REMOVE** the try-catch wrapper:
```typescript
// BEFORE (with workaround):
try {
  const dbJob = await prisma.generationJob.findUnique({
    where: { videoId },
  })

  if (dbJob && dbJob.externalJobId) {
    console.log(`[Status] Restored job from database: ${dbJob.externalJobId}`)
    activeJob = {
      model: (video as { model: VideoModelId }).model,
      externalJobId: dbJob.externalJobId,
      status: dbJob.status as 'pending' | 'processing' | 'completed' | 'failed',
      startedAt: dbJob.startedAt?.getTime() || Date.now(),
    }
    activeJobs.set(videoId, activeJob)
  }
} catch (dbError) {
  console.warn('[Status] Could not query GenerationJob table (table may not exist):', dbError instanceof Error ? dbError.message : dbError)
}

// AFTER (clean):
const dbJob = await prisma.generationJob.findUnique({
  where: { videoId },
})

if (dbJob && dbJob.externalJobId) {
  console.log(`[Status] Restored job from database: ${dbJob.externalJobId}`)
  activeJob = {
    model: (video as { model: VideoModelId }).model,
    externalJobId: dbJob.externalJobId,
    status: dbJob.status as 'pending' | 'processing' | 'completed' | 'failed',
    startedAt: dbJob.startedAt?.getTime() || Date.now(),
  }
  activeJobs.set(videoId, activeJob)
}
```

### 3. GET Handler (Completion) - Lines 337-348
**REMOVE** the try-catch wrapper:
```typescript
// BEFORE (with workaround):
try {
  await prisma.generationJob.update({
    where: { videoId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  })
} catch (dbError) {
  // Ignore if table doesn't exist
}

// AFTER (clean):
await prisma.generationJob.update({
  where: { videoId },
  data: {
    status: 'completed',
    completedAt: new Date(),
  },
})
```

### 4. GET Handler (Failure) - Lines 360-371
**REMOVE** the try-catch wrapper:
```typescript
// BEFORE (with workaround):
try {
  await prisma.generationJob.update({
    where: { videoId },
    data: {
      status: 'failed',
      lastError: modelStatus.error,
    },
  })
} catch (dbError) {
  // Ignore if table doesn't exist
}

// AFTER (clean):
await prisma.generationJob.update({
  where: { videoId },
  data: {
    status: 'failed',
    lastError: modelStatus.error,
  },
})
```

## How to Apply
1. Run the SQL migration first (see MIGRATION_GUIDE.md)
2. Verify the table exists
3. Apply these changes to remove workarounds
4. Commit and deploy

This gives you the proper serverless-ready solution without band-aid try-catch blocks.
