# Supabase Migration Review

## ✅ What's Being Created

### 1. CHECKLISTS TABLE

```sql
create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Purpose:** Store all checklist data (header, items, footer)

**Column Mapping:**
| SQL Column   | JS Field       | Usage |
|--------------|----------------|-------|
| id           | checklist.id   | Unique identifier |
| owner        | N/A (implicit) | User who owns this checklist (from auth.uid()) |
| data         | checklist.*    | JSONB containing {header, items, footer} |
| status       | checklist.status | 'draft' or 'submitted' |
| submitted_at | checklist.submittedAt | Timestamp when submitted |
| created_at   | N/A (implicit) | Auto-tracked |
| updated_at   | N/A (implicit) | Auto-tracked |

**data.header (JSONB):**
```javascript
{
  department: "string",
  staffName: "string",
  subjectName: "string",
  subjectCode: "string",
  semester: "1" | "2",
  year: "number"
}
```

**data.items (JSONB):**
```javascript
{
  "1": { status: "yes"|"no"|"na"|"", comments: "string", attachment: null|{...} },
  "2": { status: "yes"|"no"|"na"|"", comments: "string", attachment: null|{...} },
  // ... one entry per checklist item
}
```

**data.footer (JSONB):**
```javascript
{
  reviewerComments: "string",
  additionalNotes: "string"
}
```

### 2. FILES TABLE

```sql
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
```

**Purpose:** Track file uploads metadata for audit/retrieval

**Usage Flow:**
1. User uploads file via ChecklistItem component
2. `uploadFile()` in checklistApi.js:
   - Uploads file to Supabase Storage bucket `checklist-files`
   - Inserts metadata row into `files` table
3. Returns file metadata to update checklist.items[itemId].attachment

---

## ✅ Row-Level Security (RLS)

### checklists Table Policies

**1. SELECT Policy**
```sql
create policy "Users can view their own checklists"
  on checklists for select
  to authenticated
  using (auth.uid() = owner);
```
→ Only the owner can fetch their checklist

**2. INSERT Policy**
```sql
create policy "Users can create checklists"
  on checklists for insert
  to authenticated
  with check (auth.uid() = owner);
```
→ When creating a checklist, the owner must be the current user

**3. UPDATE Policy**
```sql
create policy "Users can update their own checklists"
  on checklists for update
  to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
```
→ SELECT check (USING): Can only update your own checklists
→ WRITE check (WITH CHECK): Can't change ownership after update

**4. DELETE Policy**
```sql
create policy "Users can delete their own checklists"
  on checklists for delete
  to authenticated
  using (auth.uid() = owner);
```
→ Only the owner can delete their checklist

### files Table Policies

**1. SELECT Policy (via parent checklist)**
```sql
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
```
→ Can only view files from checklists you own

**2. INSERT Policy (with ownership check)**
```sql
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
```
→ Can only upload to your own checklists AND you must be the uploader

**3. DELETE Policy (via parent checklist)**
```sql
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
```
→ Can only delete files from checklists you own

---

## ✅ Performance Indexes

```sql
create index idx_checklists_owner on checklists (owner);
create index idx_checklists_status on checklists (status);
create index idx_checklists_submitted_at on checklists (submitted_at);
create index idx_files_checklist_id on files (checklist_id);
```

**Why these indexes?**
- `owner` → listChecklists() filters by owner (RLS applies this)
- `status` → Listing may filter by status in future
- `submitted_at` → Listing sorts by submission timestamp
- `checklist_id` → RLS policies join on this column

---

## ✅ API Mapping Verification

### Current checklistApi.js is Already Compatible ✅

**Key functions that already work:**

#### 1. listChecklists()
```javascript
// Current code (Supabase mode)
const { data, error } = await supabase
  .from('checklists')
  .select('id, data, status, submitted_at')
  .order('submitted_at', { ascending: false })
```
✅ Returns rows from `checklists` table
✅ RLS automatically filters to current user (owner = auth.uid())
✅ Field names match (snake_case in SQL → camelCase in JS)

#### 2. getChecklist(id)
```javascript
// Current code
const row = await fetchChecklistRow(id)  // SELECT * WHERE id = ?
return rowToChecklist(row)
```
✅ Converts SQL row → JS checklist object
✅ Extracts header/items/footer from data JSONB

#### 3. createChecklist(checklist)
```javascript
// Current code
const ownerId = await getCurrentUserId()
const { error } = await supabase.from('checklists').insert({
  id: record.id,
  data: { header: record.header, items: record.items, footer: record.footer },
  status: 'draft',
  owner: ownerId,
})
```
✅ Sets owner = auth.uid() ✅
✅ Generates UUID via crypto.randomUUID() ✅
✅ Stores data as JSONB ✅

#### 4. saveHeader(id, header)
```javascript
// Current code
const row = await fetchChecklistRow(id)
const newData = { ...row.data, ...{ header } }
await supabase
  .from('checklists')
  .update({ data: newData })
  .eq('id', id)
```
✅ Merges new header with existing data ✅
✅ RLS prevents unauthorized updates ✅

#### 5. saveItem(id, itemId, item)
```javascript
// Current code
const items = { ...row.data?.items, [itemId]: item }
await patchChecklistData(id, { items })
```
✅ Updates specific item in items object ✅

#### 6. uploadFile(id, file)
```javascript
// Current code
const path = `${id}/${Date.now()}-${file.name}`
const { error: uploadError } = await supabase
  .storage.from(FILES_BUCKET)
  .upload(path, file)

const { data, error } = await supabase
  .from('files')
  .insert({
    checklist_id: id,
    path, name: file.name, content_type: file.type, size: file.size,
    uploaded_by: ownerId,
  })
```
✅ Uploads to Supabase Storage ✅
✅ Records metadata in `files` table ✅
✅ Sets uploaded_by = auth.uid() ✅

#### 7. submitChecklist(id)
```javascript
// Current code
const submittedAt = new Date().toISOString()
await supabase
  .from('checklists')
  .update({ status: 'submitted', submitted_at: submittedAt })
  .eq('id', id)
```
✅ Updates status and submitted_at ✅

---

## ⚠️ Important Notes

### No Code Changes Needed
The existing `src/api/checklistApi.js` is already fully compatible with this schema. No modifications are required.

### One Manual Step Required
**Create the Supabase Storage bucket** (not done via SQL):
1. Go to Supabase Dashboard → Storage
2. Create bucket named `checklist-files`
3. Set to Private (RLS handles access control)

### Field Name Casing ✅
- SQL uses `snake_case`: `submitted_at`, `uploaded_by`, `content_type`
- JS/JSON uses `camelCase`: `submittedAt`, `uploadedBy`, `contentType`
- The `rowToChecklist()` function handles conversion correctly

### UUID Generation ✅
- Frontend uses `crypto.randomUUID()` for checklist IDs
- Supabase will accept these as valid UUIDs
- No conflicts with auto-generated UUIDs

---

## Next Steps

1. **Review this document** - Ensure you understand the schema
2. **Create storage bucket** - Manually in Supabase Dashboard (can't be done via SQL)
3. **Run the migration** - Use CLI or SQL Editor (instructions in SUPABASE_SETUP.md)
4. **Test** - Set mode to 'supabase', sign in, create a checklist
5. **Verify** - Check that data persists in Supabase Dashboard

---

## Questions to Verify

- ✅ Do you want users to see only their own checklists? (Yes → RLS policies handle this)
- ✅ Do you need admin override? (Not in current policies, but can be added)
- ✅ Do you want to track who submitted checklists? (Yes → submitted_at + owner)
- ✅ Do you need comment audit trail? (Current schema stores latest comments; full audit requires additional tables)
