# Supabase Data Setup Guide for AQAT Checklist App

## Overview

This guide walks you through setting up the Supabase database and Storage for the AQAT Checklist application. The frontend uses the signed-in browser Supabase client directly; the optional Express server does not perform checklist or file data operations.

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

Supabase mode calls the Data and Storage APIs directly with the signed-in user's session:
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

**data.items contains:** (object mapping item ID → {status, comments, attachment, attachments})
- status: 'yes' | 'no' | 'na' | ''
- `attachment`: legacy unlabelled attachment retained for existing records
- `attachments`: for marked assessments, separate `lowest`, `median`, and `highest` attachments
- comments: string

**data.footer contains:**
- reviewerComments, additionalNotes

### files
```
Column         | Type        | Notes
---------------+-------------+------------------------------------------
id             | uuid        | Primary key
checklist_id   | uuid        | Foreign key to checklists(id)
path           | text        | Storage path in 'aqat-attachments' bucket
item_id        | text        | Checklist item ID for this upload
copy_slot      | text        | lowest, median, or highest for marked assessments
name           | text        | Original filename
content_type   | text        | MIME type
size           | int8        | File size in bytes
uploaded_by    | uuid        | References auth.users(id)
uploaded_at    | timestamptz | Auto-set on creation
```

## Roles and Row-Level Security (RLS)

The only application roles are `staff` and `admin`. New profiles default to `staff`; creating an account through the app cannot grant Admin access. Promote a trusted account through a controlled database action. Authenticated clients can read their own profile but cannot update profiles or roles.

**checklists table:**
- SELECT: `owner = auth.uid()`; Admin can view all checklists
- INSERT: `owner = auth.uid()`
- UPDATE: `owner = auth.uid()` (both USING and WITH CHECK)
- DELETE: owner can delete only their own `draft`; Admin can delete any checklist

**files table:**
- SELECT: Parent checklist owner = auth.uid()
- INSERT: Parent checklist owner = auth.uid() AND uploaded_by = auth.uid()
- DELETE: owner can delete file metadata for their own drafts; Admin can delete any file metadata

Storage policies separately authorize attachment access. Submission is rejected by a database trigger unless all three labelled copy slots exist for every marked assessment (`4`, `5`, `6`, `7`, and `9` in the current checklist catalog). Each slot must have a corresponding `files` metadata row and a Storage object. This supplements UI validation and does not rely on client-side checks.

## Setup Steps

### Step 1: Create the Supabase Storage Bucket

1. Go to your Supabase Dashboard → Storage
2. Create a new bucket named `aqat-attachments`
3. Set the bucket to **Private** (RLS is handled by policies)
4. Click Create

### Step 2: Review and Apply the Migrations

Review all pending migrations and their SQL before applying them to a linked project. The current role/copy-slot migration converts existing profiles, updates the profile constraint and Admin policies, adds file item/slot metadata, and installs the submit validation trigger.

```bash
supabase migration list --linked
supabase db push --linked --dry-run
# After review and approval:
supabase db push --linked
```

Do not apply a migration to production until its SQL has been reviewed and approved.

### Step 3: Verify the Setup

In Supabase Dashboard:

1. **Check Tables:**
   - Go to Tables
   - Verify `checklists` table exists with all columns
   - Verify `files` table exists with all columns

2. **Check RLS Policies:**
   - Click on `checklists` table → Policies tab
   - Confirm operation-specific owner policies and Admin read/delete policies
   - Click on `files` table → Policies tab
   - Confirm owner/Admin operation-specific policies

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
5. **Create a new checklist** to test the full flow. The Admin portal requires Supabase authentication; Local mode is staff-only.

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
- **supabase** mode: Uses the authenticated browser Supabase client directly; RLS authorizes database and Storage requests

When mode is set to `supabase`, the app:
1. Requires authentication via Supabase Auth
2. Queries checklists owned by the authenticated user
3. Uploads files to the `aqat-attachments` storage bucket
4. Tracks files in the `files` database table
5. Respects RLS policies (staff see their data; Admin reviews all records)

## Troubleshooting

### "Access denied" errors
- **Cause:** RLS policies not applied correctly
- **Fix:** Re-run the migration or manually apply policies via SQL Editor

### Files not uploading
- **Cause:** `aqat-attachments` bucket doesn't exist or has wrong permissions
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
- The browser never uses a service-role key
- All data access is controlled by RLS policies
- Users can only see/edit their own checklists
- Owners can delete only their own draft checklists; Admin can delete any checklist
- Profile role changes are not available to authenticated clients
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
5. Verify Staff/Admin portal mismatch rejection
6. Verify submission is blocked until each marked assessment has lowest-, median-, and highest-mark files

For production:
- Configure email verification settings in Supabase Auth
- Promote trusted Staff accounts to Admin directly through the database
- Monitor database usage in Supabase dashboard
- Set up backups
- Test disaster recovery procedures
