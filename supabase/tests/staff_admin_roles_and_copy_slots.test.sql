begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

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
  ('00000000-0000-0000-0000-000000000000', 'a2200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'copy-slot-staff@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a2200000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'copy-slot-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles
set role = 'admin'
where id = 'a2200000-0000-0000-0000-000000000002';

insert into public.checklists (id, owner, data, status)
values
  ('copy-slot-missing', 'a2200000-0000-0000-0000-000000000001', '{}', 'draft'),
  ('copy-slot-complete', 'a2200000-0000-0000-0000-000000000001', '{"header":{"subjectCode":"TEST-101","subjectName":"Test Subject","department":"Science","staffName":"Test Staff"},"items":{},"footer":{}}', 'draft');

insert into storage.buckets (id, name, public)
values ('aqat-attachments', 'aqat-attachments', false)
on conflict (id) do nothing;

insert into public.files (checklist_id, path, name, content_type, size, uploaded_by, item_id, copy_slot)
select
  'copy-slot-complete',
  'copy-slot-complete/' || assessment.item_id || '-' || slots.copy_slot || '.pdf',
  assessment.item_id || '-' || slots.copy_slot || '.pdf',
  'application/pdf',
  1,
  'a2200000-0000-0000-0000-000000000001',
  assessment.item_id,
  slots.copy_slot
from unnest(array['4', '5', '6', '7', '9']) as assessment(item_id)
cross join unnest(array['lowest', 'median', 'highest']) as slots(copy_slot);

insert into storage.objects (bucket_id, name, owner)
select
  'aqat-attachments',
  'copy-slot-complete/' || assessment.item_id || '-' || slots.copy_slot || '.pdf',
  'a2200000-0000-0000-0000-000000000001'
from unnest(array['4', '5', '6', '7', '9']) as assessment(item_id)
cross join unnest(array['lowest', 'median', 'highest']) as slots(copy_slot);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2200000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select role from public.profiles where id = 'a2200000-0000-0000-0000-000000000001'),
  'staff',
  'new accounts receive the staff role'
);

select throws_ok(
  $$update public.profiles set role = 'admin' where id = 'a2200000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'staff cannot change their own role'
);

select throws_ok(
  $$update public.checklists set status = 'submitted' where id = 'copy-slot-missing'$$,
  '23514',
  'Checklist cannot be submitted: assessment 4 is missing its lowest mark copy.',
  'submission is rejected when any marked-copy slot is missing'
);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'copy-slot-complete'$$,
  'submission succeeds when every marked assessment has all three distinct attachments'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2200000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.checklists where id = 'copy-slot-complete'),
  1::bigint,
  'Admin can see a staff submission for dashboard reporting'
);

select is(
  (select count(*) from public.files where checklist_id = 'copy-slot-complete'),
  15::bigint,
  'Admin summary data includes all labelled attachment slots'
);

select * from finish();
rollback;
