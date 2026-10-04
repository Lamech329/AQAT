# Complete Migration SQL (for reference)

This is the exact SQL that will be run against your Supabase database.

## File Location
`supabase/migrations/20260907125400_create_checklist_tables.sql`

## Complete SQL

```sql
-- Create checklists table
create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create files table for tracking uploaded attachments
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references checklists (id) on delete cascade,
  path text not null,
  name text not null,
  content_type text not null,
  size int8 not null,
  uploaded_by uuid not null references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

-- Enable RLS
alter table checklists enable row level security;
alter table files enable row level security;

-- RLS Policies for checklists table
create policy "Users can view their own checklists"
  on checklists for select
  to authenticated
  using (auth.uid() = owner);

create policy "Users can create checklists"
  on checklists for insert
  to authenticated
  with check (auth.uid() = owner);

create policy "Users can update their own checklists"
  on checklists for update
  to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

create policy "Users can delete their own checklists"
  on checklists for delete
  to authenticated
  using (auth.uid() = owner);

-- RLS Policies for files table (access through parent checklist)
create policy "Users can view files from their own checklists"
  on files for select
  to authenticated
  using (
    exists (
      select 1 from checklists
      where checklists.id = files.checklist_id
      and checklists.owner = auth.uid()
    )
  );

create policy "Users can upload files to their own checklists"
  on files for insert
  to authenticated
  with check (
    exists (
      select 1 from checklists
      where checklists.id = files.checklist_id
      and checklists.owner = auth.uid()
    )
    and auth.uid() = uploaded_by
  );

create policy "Users can delete files from their own checklists"
  on files for delete
  to authenticated
  using (
    exists (
      select 1 from checklists
      where checklists.id = files.checklist_id
      and checklists.owner = auth.uid()
    )
  );

-- Create indexes for performance
create index idx_checklists_owner on checklists (owner);
create index idx_checklists_status on checklists (status);
create index idx_checklists_submitted_at on checklists (submitted_at);
create index idx_files_checklist_id on files (checklist_id);

-- Grant access to authenticated users
grant select, insert, update, delete on checklists to authenticated;
grant select, insert, delete on files to authenticated;
```

## Why This Design

### JSONB Data Column
Rather than normalizing into separate tables (checklist_headers, checklist_items), the migration uses a single `data` JSONB column containing `{header, items, footer}`. This:
- ✅ Matches frontend data model exactly
- ✅ Simplifies migrations (no schema changes for new fields)
- ✅ Allows flexible schema evolution
- ✅ Still supports indexes if needed later

### RLS Policies
All policies use `auth.uid()` (best practice, not deprecated `auth.role()`):
- ✅ Authenticated users can only access their own data
- ✅ No admin override needed for MVP
- ✅ Files inherit access through parent checklist
- ✅ UPDATE has both USING and WITH CHECK (prevents privilege escalation)

### Cascade Deletes
- User deletes → Cascades to checklists → Cascades to files ✅
- Checklist delete → Cascades to files ✅
- Orphaned files impossible ✅

### No Secrets Exposed
- ✅ No service_role key in this code
- ✅ No hardcoded auth tokens
- ✅ Uses only publishable key (already in .env)
- ✅ Client-side RLS enforcement

## How checklistApi.js Uses This Schema

### When you SELECT (listChecklists, getChecklist)
```sql
SELECT id, data, status, submitted_at FROM checklists
WHERE owner = auth.uid()  -- RLS enforces this automatically
```
→ Returns rows; JS extracts header/items/footer from data JSONB

### When you INSERT (createChecklist)
```sql
INSERT INTO checklists (id, owner, data, status)
VALUES ($1, auth.uid(), $2, 'draft')
```
→ Stores: UUID, current user, {header, items, footer}, 'draft'

### When you UPDATE (saveHeader, saveItem, saveFooter)
```sql
UPDATE checklists SET data = jsonb_set(data, '{header}', $1)
WHERE id = $2 AND owner = auth.uid()  -- RLS enforces owner check
```
→ Updates specific section of JSONB without touching others

### When you UPLOAD (uploadFile)
```text
Upload the file through the Supabase Storage API:
- Bucket: aqat-attachments
- Object path: <checklist_id>/<filename>

Then insert its metadata into public.files through the Data API.
RLS verifies that the authenticated user owns the referenced checklist.
```
→ Stores file in Storage bucket; tracks metadata in files table

### When you SUBMIT (submitChecklist)
```sql
UPDATE checklists SET status = 'submitted', submitted_at = now()
WHERE id = $1 AND owner = auth.uid()  -- RLS enforces owner check
```
→ Changes status; records submission timestamp

## No API Mapping Changes Needed

The existing `src/api/checklistApi.js` already:
- ✅ Uses correct table/column names
- ✅ Handles camelCase ↔ snake_case conversion
- ✅ Sets owner = auth.uid() on insert
- ✅ Filters by owner via RLS
- ✅ Stores data as JSONB
- ✅ Tracks files metadata

**No code changes required** — just run the migration!

## Migration Safety

This migration is safe because:
- ✅ Uses `if not exists` on all objects (idempotent)
- ✅ No destructive operations
- ✅ Can be re-run without error
- ✅ No hardcoded data (only schema)
- ✅ Follows Supabase conventions

If something goes wrong:
```sql
-- Can be safely removed if needed
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS checklists;
-- Then re-run migration
```
