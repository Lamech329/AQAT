-- Supabase schema for AQAT checklists

-- Extensions
create extension if not exists "pgcrypto";

-- Checklists table
create table if not exists public.checklists (
  id text primary key,
  data jsonb not null,
  status text not null default 'draft',
  submitted_at timestamptz,
  owner uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at on public.checklists;
create trigger trg_set_updated_at
before update on public.checklists
for each row execute function public.set_updated_at();

-- Files metadata table
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  checklist_id text references public.checklists(id) on delete cascade,
  path text not null,
  name text,
  content_type text,
  size int,
  uploaded_at timestamptz default now(),
  uploaded_by uuid references auth.users(id)
);

-- Indexes
create index if not exists idx_checklists_submitted_at on public.checklists (submitted_at desc);
create index if not exists idx_files_checklist_id on public.files (checklist_id);

-- Row-level security and policies
alter table public.checklists enable row level security;

create policy if not exists "Checklists owner can manage" on public.checklists
  using (owner = auth.uid())
  with check (owner = auth.uid());

alter table public.files enable row level security;
create policy if not exists "Files owner can manage" on public.files
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());
