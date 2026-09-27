-- Allow admin roles to read all checklist and file metadata.
drop policy if exists "Admins can view all checklists" on public.checklists;
create policy "Admins can view all checklists"
  on public.checklists for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Admins can view all files" on public.files;
create policy "Admins can view all files"
  on public.files for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  checklist_id text not null references public.checklists(id) on delete cascade,
  action text not null check (action in ('edited', 'reopened')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

drop policy if exists "Admins can view activity logs" on public.activity_logs;
create policy "Admins can view activity logs"
  on public.activity_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Users can create own activity logs" on public.activity_logs;
create policy "Users can create own activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (actor_id = auth.uid());

create index if not exists idx_activity_logs_checklist_created
  on public.activity_logs (checklist_id, created_at desc);
