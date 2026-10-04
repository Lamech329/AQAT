-- Consolidate application roles and require three labelled uploads for
-- every marked assessment before a checklist can be submitted.

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = 'staff'
where role = 'user';

update public.profiles
set role = 'admin'
where role = 'super_admin';

alter table public.profiles
  alter column role set default 'staff';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('staff', 'admin'));

-- Profiles are readable by their owner but role writes remain database-only.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Admins can view all checklists" on public.checklists;
create policy "Admins can view all checklists"
  on public.checklists for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can view all files" on public.files;
create policy "Admins can view all files"
  on public.files for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can view activity logs" on public.activity_logs;
create policy "Admins can view activity logs"
  on public.activity_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can delete any checklist" on public.checklists;
create policy "Admins can delete any checklist"
  on public.checklists for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can delete any file" on public.files;
create policy "Admins can delete any file"
  on public.files for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can read all checklist attachments" on storage.objects;
create policy "Admins can read all checklist attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'aqat-attachments'
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Authenticated users can delete their own attachment files" on storage.objects;
drop policy if exists "Admins can delete all checklist attachments" on storage.objects;
create policy "Admins can delete all checklist attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'aqat-attachments'
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

alter table public.files
  add column if not exists item_id text,
  add column if not exists copy_slot text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.files'::regclass
      and conname = 'files_copy_slot_check'
  ) then
    alter table public.files
      add constraint files_copy_slot_check
      check (
        copy_slot is null
        or (
          item_id is not null
          and item_id in ('4', '5', '6', '7', '9')
          and copy_slot in ('lowest', 'median', 'highest')
        )
      );
  end if;
end;
$$;

create unique index if not exists idx_files_checklist_item_copy_slot
  on public.files (checklist_id, item_id, copy_slot)
  where copy_slot is not null;

create unique index if not exists idx_files_checklist_path
  on public.files (checklist_id, path);

create or replace function public.require_marked_assessment_copies()
returns trigger
language plpgsql
as $$
declare
  assessment_id text;
  required_slot text;
begin
  if new.status <> 'submitted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;

  foreach assessment_id in array array['4', '5', '6', '7', '9'] loop
    foreach required_slot in array array['lowest', 'median', 'highest'] loop
      if not exists (
        select 1
        from public.files as checklist_file
        where checklist_file.checklist_id::text = new.id::text
          and checklist_file.item_id = assessment_id
          and checklist_file.copy_slot = required_slot
          and checklist_file.path <> ''
          and exists (
            select 1
            from storage.objects
            where bucket_id = 'aqat-attachments'
              and name = checklist_file.path
          )
      ) then
        raise exception 'Checklist cannot be submitted: assessment % is missing its % mark copy.',
          assessment_id, required_slot
          using errcode = '23514';
      end if;
    end loop;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_require_marked_assessment_copies on public.checklists;
create trigger trg_require_marked_assessment_copies
  before insert or update of status on public.checklists
  for each row
  execute function public.require_marked_assessment_copies();