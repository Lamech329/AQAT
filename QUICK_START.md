# Quick Start: AQAT with Supabase Auth

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
3. Name: `aqat-attachments`
4. Privacy: **Private** ✅ (RLS policies control access)
5. Click **Create**

### Step 2: Review and apply database migrations

```bash
cd C:\Users\lamec\Desktop\aqat
supabase migration list --linked
supabase db push --linked --dry-run
# Review the SQL and get approval before applying to production.
supabase db push --linked
```

The current role/copy-slot migration sets roles to `staff` and `admin`, blocks authenticated profile role updates, and requires labelled marked-assessment attachments before submission.

### Step 3: Verify Setup (2 minutes)

**Verify tables exist:**
1. Go to **Tables** in Supabase Dashboard
2. Look for `checklists` and `files` tables ✅

**Verify RLS is enabled:**
1. Click `checklists` and `files` → **Policies** tabs
2. Confirm separate owner policies and Admin read/delete policies are present
3. Confirm owners can delete only their own draft checklists

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

1. Select the **Staff** portal and sign in.
2. Fill in the subject details and checklist items.
3. For each marked assessment, upload distinct **Lowest mark**, **Median mark**, and **Highest mark** files.
4. Submit after all required fields, statuses, and copy slots are complete.
5. Refresh the Staff dashboard and verify submission and slot progress.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Table does not exist" | Run migration (Step 2) |
| "Access denied" when inserting | RLS policies not applied; re-run migration |
| Login screen won't accept credentials | Verify email in Supabase Auth (Dashboard → Authentication) |
| Files won't upload | Verify `aqat-attachments` bucket exists (Step 1) |
| Data disappears after refresh | Check you're in `supabase` mode in Settings |
| Admin portal rejects an account | Confirm its `public.profiles.role` is `admin`; portal selection does not grant access |
| Submission is blocked | Upload the missing lowest-, median-, and highest-mark slots listed on the checklist |

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

✅ After the reviewed migrations and Storage bucket are configured, try:
- [ ] Create multiple checklists
- [ ] Upload all three labelled copies for marked assessments
- [ ] Submit a checklist
- [ ] Refresh and verify data persists
- [ ] Switch to `local` mode and back to `supabase` mode
- [ ] Sign out and back in
- [ ] Confirm Staff cannot access `/admin` and cannot change their own role

---

**Documentation:**
- Full setup guide: `SUPABASE_SETUP.md`
- Migration details: `MIGRATION_REVIEW.md`
- Questions? Check Supabase docs: https://supabase.com/docs
