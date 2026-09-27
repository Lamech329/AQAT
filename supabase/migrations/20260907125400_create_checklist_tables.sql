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
  uploaded_by uuid references auth.users (id) on delete set null,
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
create index if not exists idx_checklists_owner on checklists (owner);
create index if not exists idx_checklists_status on checklists (status);
create index if not exists idx_checklists_submitted_at on checklists (submitted_at);
create index if not exists idx_files_checklist_id on files (checklist_id);

-- JSONB and expression indexes for common queries
create index if not exists idx_checklists_data_gin on checklists using gin (data jsonb_path_ops);
create index if not exists idx_checklists_header_subjectname_lower on checklists ((lower((data->'header'->>'subjectName')::text)));
create index if not exists idx_checklists_header_subjectcode on checklists ((data->'header'->>'subjectCode'));

-- Grant access to authenticated users
grant select, insert, update, delete on checklists to authenticated;
grant select, insert, delete on files to authenticated;

-- Ensure pgcrypto extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- Trigger to keep updated_at current
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_checklists_set_updated_at
before update on checklists
for each row
execute function set_updated_at();
