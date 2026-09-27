# Supabase Backend Setup Guide for AQAT Checklist App

## Overview

This guide walks you through setting up the Supabase backend database and storage for the AQAT Checklist application.

## What's Been Created

### 1. Database Migration
**File:** `supabase/migrations/20260907125400_create_checklist_tables.sql`

This migration creates:
- **checklists** table: Stores checklist header, items, footer, status, and ownership
- **files** table: Tracks file uploads metadata
- **RLS Policies**: Secure row-level access (users see only their own checklists)
- **Indexes**: Performance optimization for common queries
- **Grants**: Access permissions for authenticated users

### 2. API Layer
**File:** `src/api/checklistApi.js` (existing, already compatible)

The existing code already implements Supabase mode correctly:
- ✅ Uses `auth.uid()` to identify current user
- ✅ Stores checklist data as JSONB (header, items, footer)
- ✅ Manages file uploads to Supabase Storage
- ✅ Tracks uploaded files in the `files` table
- ✅ Generates proper UUIDs for checklist IDs
- ✅ Field mapping: camelCase (JS) ↔ snake_case (SQL) is already correct

## Database Schema

### checklists
```
Column         | Type        | Notes
---------------+-------------+------------------------------------------
id             | uuid        | Primary key, auto-generated
owner          | uuid        | References auth.users(id), user who owns it
data           | jsonb       | {header, items, footer} structure
status         | text        | 'draft' or 'submitted'
submitted_at   | timestamptz | When checklist was submitted (nullable)
created_at     | timestamptz | Auto-set on creation
updated_at     | timestamptz | Auto-set on creation
```

**data.header contains:**
- department, staffName, subjectName, subjectCode, semester, year

**data.items contains:** (object mapping item ID → {status, comments, attachment})
- status: 'yes' | 'no' | 'na' | ''
- comments: string
- attachment: { name, type, size, path, uploadedAt }

**data.footer contains:**
- reviewerComments, additionalNotes

### files
```
Column         | Type        | Notes
---------------+-------------+------------------------------------------
id             | uuid        | Primary key
checklist_id   | uuid        | Foreign key to checklists(id)
path           | text        | Storage path in 'checklist-files' bucket
name           | text        | Original filename
content_type   | text        | MIME type
size           | int8        | File size in bytes
uploaded_by    | uuid        | References auth.users(id)
uploaded_at    | timestamptz | Auto-set on creation
```

## Row-Level Security (RLS) Policies

All policies ensure users can only access their own checklists:

**checklists table:**
- SELECT: `owner = auth.uid()`
- INSERT: `owner = auth.uid()`
- UPDATE: `owner = auth.uid()` (both USING and WITH CHECK)
- DELETE: `owner = auth.uid()`

**files table:**
- SELECT: Parent checklist owner = auth.uid()
- INSERT: Parent checklist owner = auth.uid() AND uploaded_by = auth.uid()
- DELETE: Parent checklist owner = auth.uid()

## Setup Steps

### Step 1: Create the Supabase Storage Bucket

1. Go to your Supabase Dashboard → Storage
2. Create a new bucket named `checklist-files`
3. Set the bucket to **Private** (RLS is handled by policies)
4. Click Create

### Step 2: Apply the Migration

**Option A: Using Supabase CLI (Recommended)**

```bash
# Navigate to project directory
cd C:\Users\lamec\Desktop\aqat

# Link to your Supabase project (if not already done)
supabase link --project-ref qiarhrcankopijakeifr

# Push the migration to your Supabase project
supabase db push
```

**Option B: Using Supabase Dashboard SQL Editor (Manual)**

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the entire contents of `supabase/migrations/20260907125400_create_checklist_tables.sql`
4. Paste it into the SQL Editor
5. Click "Run"

### Step 3: Verify the Setup

In Supabase Dashboard:

1. **Check Tables:**
   - Go to Tables
   - Verify `checklists` table exists with all columns
   - Verify `files` table exists with all columns

2. **Check RLS Policies:**
   - Click on `checklists` table → Policies tab
   - Should see 4 policies (select, insert, update, delete)
   - Click on `files` table → Policies tab
   - Should see 3 policies (select, insert, delete)

3. **Check Indexes:**
   - Click on `checklists` table → Indexes tab
   - Should see 3 indexes on owner, status, submitted_at
   - Click on `files` table → Indexes tab
   - Should see 1 index on checklist_id

## Testing the Connection

1. **Open the app** in your browser
2. **Click the Settings gear icon** (top right)
3. **Set Mode to `supabase`**
4. **Test Connection:**
   - If using Supabase mode and not yet signed in, you'll see a login screen
   - Sign in with your Supabase Auth email/password
   - The "Test Connection" button should show: "Connected to Supabase."
5. **Create a new checklist** to test the full flow

## Environment Variables

Your `.env` already has the required variables:
```
VITE_SUPABASE_URL=https://qiarhrcankopijakeifr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_6JRNWtCCcTb0zIW0IGy4Ug_X2rf7pIA
```

These are:
- ✅ **Safe to commit** (publishable key, no secrets)
- ✅ **Already in use** by the AuthGate component
- ✅ **Correct for client-side access** (only anon + authenticated scope)

## API Compatibility

The existing `src/api/checklistApi.js` handles all three modes:

- **local** mode: Stores in browser localStorage (no backend)
- **remote** mode: Makes HTTP requests to your own API
- **supabase** mode: Uses this new backend ✅ (now fully supported)

When mode is set to `supabase`, the app:
1. Requires authentication via Supabase Auth
2. Queries checklists owned by the authenticated user
3. Uploads files to the `checklist-files` storage bucket
4. Tracks files in the `files` database table
5. Respects RLS policies (users only see their data)

## Troubleshooting

### "Access denied" errors
- **Cause:** RLS policies not applied correctly
- **Fix:** Re-run the migration or manually apply policies via SQL Editor

### Files not uploading
- **Cause:** `checklist-files` bucket doesn't exist or has wrong permissions
- **Fix:** Create the bucket as described in Step 1

### "No tables found" when fetching checklists
- **Cause:** Tables not created or not exposed to Data API
- **Fix:** Check Step 2, verify tables exist in Supabase Dashboard

### Login screen appears but won't authenticate
- **Cause:** Supabase Auth not configured or email unconfirmed
- **Fix:** Check your Supabase dashboard Authentication settings

## Security Notes

✅ **Secure:**
- Publishable key is safe to expose (client-side only)
- Service role key is NOT used anywhere in this code
- All data access is controlled by RLS policies
- Users can only see/edit their own checklists
- File uploads are restricted by RLS
- Email verification is required (default Supabase Auth behavior)

⚠️ **Important:**
- Do NOT commit the service role key
- Do NOT change auth.uid() to a hardcoded value
- Do NOT disable RLS on these tables
- Do NOT manually insert records with owner=null

## Next Steps

After setup:
1. Test login and checklist creation
2. Test file uploads
3. Verify data persists after page refresh
4. Test switching between `local` and `supabase` modes
5. Check that submitted checklists show in the list

For production:
- Configure email verification settings in Supabase Auth
- Set up appropriate user roles/RBAC if needed
- Monitor database usage in Supabase dashboard
- Set up backups
- Test disaster recovery procedures
