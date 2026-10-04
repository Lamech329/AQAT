begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1100000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'checklist-delete-owner@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1100000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'checklist-delete-other@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1100000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'checklist-delete-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

update public.profiles
set role = 'admin'
where id = 'a1100000-0000-0000-0000-000000000003';

insert into public.checklists (id, owner, data, status)
values
  ('checklist-delete-owner-draft', 'a1100000-0000-0000-0000-000000000001', '{}', 'draft'),
  ('checklist-delete-owner-file-draft', 'a1100000-0000-0000-0000-000000000001', '{}', 'draft'),
  ('checklist-delete-owner-submitted', 'a1100000-0000-0000-0000-000000000001', '{}', 'draft'),
  ('checklist-delete-other-draft', 'a1100000-0000-0000-0000-000000000002', '{}', 'draft');

insert into public.files (checklist_id, path, name, content_type, size, uploaded_by)
values
  ('checklist-delete-owner-file-draft', 'checklist-delete-owner-file-draft/file.pdf', 'file.pdf', 'application/pdf', 1, 'a1100000-0000-0000-0000-000000000001'),
  ('checklist-delete-other-draft', 'checklist-delete-other-draft/file.pdf', 'file.pdf', 'application/pdf', 1, 'a1100000-0000-0000-0000-000000000002');

insert into storage.buckets (id, name, public)
values ('aqat-attachments', 'aqat-attachments', false)
on conflict (id) do nothing;

insert into public.files (checklist_id, path, name, content_type, size, uploaded_by, item_id, copy_slot)
select
  'checklist-delete-owner-submitted',
  'checklist-delete-owner-submitted/' || assessment.item_id || '-' || slots.copy_slot || '.pdf',
  assessment.item_id || '-' || slots.copy_slot || '.pdf',
  'application/pdf',
  1,
  'a1100000-0000-0000-0000-000000000001',
  assessment.item_id,
  slots.copy_slot
from unnest(array['4', '5', '6', '7', '9']) as assessment(item_id)
cross join unnest(array['lowest', 'median', 'highest']) as slots(copy_slot);

insert into storage.objects (bucket_id, name, owner)
select
  'aqat-attachments',
  'checklist-delete-owner-submitted/' || assessment.item_id || '-' || slots.copy_slot || '.pdf',
  'a1100000-0000-0000-0000-000000000001'
from unnest(array['4', '5', '6', '7', '9']) as assessment(item_id)
cross join unnest(array['lowest', 'median', 'highest']) as slots(copy_slot);

update public.checklists
set status = 'submitted'
where id = 'checklist-delete-owner-submitted';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

with deleted as (
  delete from public.checklists
  where id = 'checklist-delete-owner-draft'
  returning 1
)
select is(
  (select count(*) from deleted),
  1::bigint,
  'an owner can delete their own draft checklist'
);

with deleted as (
  delete from public.checklists
  where id = 'checklist-delete-owner-submitted'
  returning 1
)
select is(
  (select count(*) from deleted),
  0::bigint,
  'an owner cannot delete their submitted checklist'
);

with deleted as (
  delete from public.files
  where checklist_id = 'checklist-delete-owner-file-draft'
  returning 1
)
select is(
  (select count(*) from deleted),
  1::bigint,
  'an owner can delete file metadata from their own draft checklist'
);

with deleted as (
  delete from public.files
  where checklist_id = 'checklist-delete-owner-submitted'
  returning 1
)
select is(
  (select count(*) from deleted),
  0::bigint,
  'an owner cannot delete file metadata from a submitted checklist'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1100000-0000-0000-0000-000000000003', true);

with deleted as (
  delete from public.checklists
  where id = 'checklist-delete-other-draft'
  returning 1
)
select is(
  (select count(*) from deleted),
  1::bigint,
  'an admin can delete another users draft checklist'
);

with deleted as (
  delete from public.files
  where checklist_id = 'checklist-delete-owner-submitted'
  returning 1
)
select is(
  (select count(*) from deleted),
  15::bigint,
  'an admin can delete all file metadata from any checklist'
);

with deleted as (
  delete from public.checklists
  where id = 'checklist-delete-owner-submitted'
  returning 1
)
select is(
  (select count(*) from deleted),
  1::bigint,
  'an admin can delete a submitted checklist'
);

select * from finish();
rollback;
