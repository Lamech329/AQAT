begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

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
  (
    'a2200000-0000-4000-8000-000000000101',
    'a2200000-0000-0000-0000-000000000001',
    '{"header":{"subjectCode":"TEST-101","subjectName":"Test Subject","department":"Science","staffName":"Test Staff"},"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[{"id":"test-1","label":"Test 1"},{"id":"test-2","label":"Test 2"}]},"9":{"status":"na","assessmentInstances":[]}},"footer":{}}',
    'draft'
  ),
  (
    'a2200000-0000-4000-8000-000000000102',
    'a2200000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[{"id":"test-1","label":"Test 1"}]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a2200000-0000-4000-8000-000000000103',
    'a2200000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"na","assessmentInstances":[]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a2200000-0000-4000-8000-000000000104',
    'a2200000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  );

insert into storage.buckets (id, name, public)
values ('aqat-attachments', 'aqat-attachments', false)
on conflict (id) do nothing;

insert into public.files (
  checklist_id, path, name, content_type, size, uploaded_by, item_id, assessment_instance_id, copy_slot
)
values
  ('a2200000-0000-4000-8000-000000000101', 'a2200000-0000-4000-8000-000000000101/test-1-low.pdf', 'test-1-low.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-1', 'lowest'),
  ('a2200000-0000-4000-8000-000000000101', 'a2200000-0000-4000-8000-000000000101/test-1-mid.pdf', 'test-1-mid.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-1', 'median'),
  ('a2200000-0000-4000-8000-000000000101', 'a2200000-0000-4000-8000-000000000101/test-1-high.pdf', 'test-1-high.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-1', 'highest'),
  ('a2200000-0000-4000-8000-000000000101', 'a2200000-0000-4000-8000-000000000101/test-2-low.pdf', 'test-2-low.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-2', 'lowest'),
  ('a2200000-0000-4000-8000-000000000101', 'a2200000-0000-4000-8000-000000000101/test-2-mid.pdf', 'test-2-mid.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-2', 'median'),
  ('a2200000-0000-4000-8000-000000000101', 'a2200000-0000-4000-8000-000000000101/test-2-high.pdf', 'test-2-high.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-2', 'highest'),
  ('a2200000-0000-4000-8000-000000000102', 'a2200000-0000-4000-8000-000000000102/low.pdf', 'low.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-1', 'lowest'),
  ('a2200000-0000-4000-8000-000000000102', 'a2200000-0000-4000-8000-000000000102/high.pdf', 'high.pdf', 'application/pdf', 1, 'a2200000-0000-0000-0000-000000000001', '7', 'test-1', 'highest');

insert into storage.objects (bucket_id, name, owner)
values
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000101/test-1-low.pdf', 'a2200000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000101/test-1-mid.pdf', 'a2200000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000101/test-1-high.pdf', 'a2200000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000101/test-2-low.pdf', 'a2200000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000101/test-2-mid.pdf', 'a2200000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000101/test-2-high.pdf', 'a2200000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000102/low.pdf', 'a2200000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a2200000-0000-4000-8000-000000000102/high.pdf', 'a2200000-0000-0000-0000-000000000001');

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
  $$update public.checklists set status = 'submitted' where id = 'a2200000-0000-4000-8000-000000000102'$$,
  '23514',
  'Checklist cannot be submitted: assessment 7 instance Test 1 is missing its median mark copy.',
  'submission is rejected when one instance misses a copy'
);

select throws_ok(
  $$update public.checklists set status = 'submitted' where id = 'a2200000-0000-4000-8000-000000000104'$$,
  '23514',
  'Checklist cannot be submitted: assessment 7 requires at least one assessment instance.',
  'a non-N/A criterion cannot be submitted with zero instances'
);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a2200000-0000-4000-8000-000000000101'$$,
  'submission succeeds when two tests each have three copies'
);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a2200000-0000-4000-8000-000000000103'$$,
  'N/A criteria with no files can be submitted'
);

with deleted as (
  delete from public.checklists
  where id = 'a2200000-0000-4000-8000-000000000101'
  returning 1
)
select is(
  (select count(*) from deleted),
  0::bigint,
  'an owner cannot delete a submitted checklist'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2200000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.checklists where id = 'a2200000-0000-4000-8000-000000000101'),
  1::bigint,
  'Admin can see a staff submission for dashboard reporting'
);

select is(
  (select count(*) from public.files where checklist_id = 'a2200000-0000-4000-8000-000000000101'),
  6::bigint,
  'Admin can see all assessment-instance copy attachments'
);

select * from finish();
rollback;
