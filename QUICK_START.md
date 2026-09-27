# Quick Start: Deploying Supabase Backend

## Pre-Flight Checklist ✅

- [ ] You have Supabase CLI installed (`supabase --version`)
- [ ] You have access to your Supabase project
- [ ] Project ref: `qiarhrcankopijakeifr`
- [ ] You're in the project directory: `C:\Users\lamec\Desktop\aqat`

## 3-Step Setup

### Step 1: Create Storage Bucket (5 minutes)

**In Supabase Dashboard:**

1. Go to https://app.supabase.com → Your Project → Storage
2. Click **"New bucket"**
3. Name: `checklist-files`
4. Privacy: **Private** ✅ (RLS policies control access)
5. Click **Create**

### Step 2: Run Migration (2 minutes)

**Option A: Using Supabase CLI (Recommended)**

```bash
cd C:\Users\lamec\Desktop\aqat
supabase link --project-ref qiarhrcankopijakeifr
supabase db push
```

**Option B: SQL Editor (Manual)**

1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Click **"New query"**
3. Paste contents of: `supabase/migrations/20260907125400_create_checklist_tables.sql`
4. Click **"Run"** (or press Ctrl+Enter)

### Step 3: Verify Setup (2 minutes)

**Verify tables exist:**
1. Go to **Tables** in Supabase Dashboard
2. Look for `checklists` and `files` tables ✅

**Verify RLS is enabled:**
1. Click `checklists` → **Policies** tab
2. Should see 4 policies ✅
3. Click `files` → **Policies** tab
4. Should see 3 policies ✅

**Verify indexes exist:**
1. Click `checklists` → **Indexes** tab
2. Should see 3 indexes ✅
3. Click `files` → **Indexes** tab
4. Should see 1 index ✅

## Testing Connection

1. Open app: http://localhost:5173 (or your dev server)
2. Click ⚙️ (Settings, top right)
3. Change **Mode** to `supabase`
4. Sign in with your email (Supabase Auth)
5. Click **"Test Connection"** button
6. Should see: ✅ "Connected to Supabase."

## Creating First Checklist

1. Fill in "Subject details" (all required fields)
2. Complete checklist items (at least one)
3. Click **"Submit"**
4. Go to Dashboard → Verify it appears in the list
5. Refresh page → Verify data persists

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Table does not exist" | Run migration (Step 2) |
| "Access denied" when inserting | RLS policies not applied; re-run migration |
| Login screen won't accept credentials | Verify email in Supabase Auth (Dashboard → Authentication) |
| Files won't upload | Verify `checklist-files` bucket exists (Step 1) |
| Data disappears after refresh | Check you're in `supabase` mode in Settings |

## Rollback (if needed)

To remove the database schema and start over:

```bash
# In Supabase Dashboard → SQL Editor
-- WARNING: This deletes all data!
drop table if exists files;
drop table if exists checklists;
```

Then re-run Step 2.

## What's Next

✅ Backend is ready. Try:
- [ ] Create multiple checklists
- [ ] Upload files to checklist items
- [ ] Submit a checklist
- [ ] Refresh and verify data persists
- [ ] Switch to `local` mode and back to `supabase` mode
- [ ] Sign out and back in

---

**Documentation:**
- Full setup guide: `SUPABASE_SETUP.md`
- Migration details: `MIGRATION_REVIEW.md`
- Questions? Check Supabase docs: https://supabase.com/docs
