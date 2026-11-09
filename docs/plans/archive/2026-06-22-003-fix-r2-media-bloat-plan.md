---
title: Fix R2 Media Sync Bloat
type: fix
status: active
date: 2026-06-22
---

> **Archived 2026-11-08.** Unknown: an operational fix to a sync script outside this repo, so git can't show whether it shipped; baseline ticket 07 gives each site its own staging and production resources.

# Fix R2 Media Sync Bloat

## Overview
During staging deployment verification, it was discovered that 171 media files were uploaded to the staging R2 bucket (`jamesryan-media-staging`). However, the current active database only has 25 local files in the active `jamesryan-media` bucket. The sync script recursively uploaded files from an old historical bucket `my-marketing-media` that was present in the local Miniflare R2 cache from May 2026.

## Proposed Solution
1. **Clean Local R2 Cache**: Delete the old stale local bucket folder (`my-marketing-media`) and its associated SQLite mapping file from the wrangler state directory.
2. **Update Sync Script**: Modify `/home/james/.gemini/antigravity-ide/brain/11a6d531-c333-46c9-b23a-6909d01d6572/scratch/upload_local_r2_to_staging.py` (and any other sync script) to dynamically target only the database file corresponding to the active bucket name (`jamesryan-media`) by calculating its SHA-256 hash.
3. **Re-sync and Purge Staging**: Delete all objects in the remote staging bucket `jamesryan-media-staging` and run the updated sync script to upload only the 25 active local assets.

## Technical Considerations
- **Miniflare Database Hashing**: Miniflare names SQLite files for R2 buckets using the SHA-256 hash of the bucket name. The hash for `jamesryan-media` is `5cf33eedbf8e2d7f94c06e61ed11b82773d758f2edc0e816305729c0a130b49b`.
- **Cloudflare R2 Object Purge**: We will recreate the bucket `jamesryan-media-staging` using wrangler commands to ensure a completely clean slate before running the sync.
- **Rollback & Verification**:
  - Verify that the active staging site `staging.jamesryan.dev` loads all images correctly.
  - Verify that the total remote staging R2 objects match the active local cache (25 objects).

## Acceptance Criteria
- [ ] Old local `my-marketing-media` files and SQLite DB are removed.
- [ ] The media sync script only reads from the active bucket database file (`5cf33eedbf8e2d7f94c06e61ed11b82773d758f2edc0e816305729c0a130b49b.sqlite`).
- [ ] Staging bucket `jamesryan-media-staging` has only the 25 active files.
- [ ] Staging website resolves all media assets successfully (no broken images).

## Implementation Units
1. [Clean local cache & database file]: Delete the stale local miniflare bucket directory and database.
2. [Patch sync script]: Modify python sync script to compute bucket name hash and read the single active SQLite file.
3. [Recreate staging bucket]: Run wrangler commands to recreate the staging R2 bucket.
4. [Sync active media]: Execute the updated sync script to populate staging R2.
5. [Verify staging website]: Visually verify staging site images are fully functional.

## Sources & References
- Active R2 bucket config in [wrangler.jsonc](../../../apps/marketing-site/wrangler.jsonc#L20-L25)
- Local R2 state files: `apps/marketing-site/.wrangler/state/v3/r2/`
- Current media sync script: [/home/james/.gemini/antigravity-ide/brain/11a6d531-c333-46c9-b23a-6909d01d6572/scratch/upload_local_r2_to_staging.py](file:///home/james/.gemini/antigravity-ide/brain/11a6d531-c333-46c9-b23a-6909d01d6572/scratch/upload_local_r2_to_staging.py)
