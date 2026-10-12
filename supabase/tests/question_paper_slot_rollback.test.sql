begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'a5500000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'question-paper-test@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);

insert into storage.buckets (id, name, public)
values ('aqat-attachments', 'aqat-attachments', false)
on conflict (id) do nothing;

insert into public.checklists (id, owner, data, status)
values
  (
    'a5500000-0000-4000-8000-000000000201',
    'a5500000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[{"id":"test-1","label":"Test 1"},{"id":"test-2","label":"Test 2"}]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a5500000-0000-4000-8000-000000000202',
    'a5500000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[{"id":"test-1","label":"Test 1"},{"id":"test-2","label":"Test 2"}]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a5500000-0000-4000-8000-000000000203',
    'a5500000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"na","assessmentInstances":[]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a5500000-0000-4000-8000-000000000204',
    'a5500000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[{"id":"legacy-test","label":"Legacy Test"}]},"9":{"status":"na","assessmentInstances":[]}}}',
    'submitted'
  );

insert into public.files (
  checklist_id, path, name, content_type, size, uploaded_by,
  item_id, assessment_instance_id, copy_slot
)
select
  checklist.id,
  checklist.id || '/' || checklist.instance_id || '-' || slot.copy_slot || '.pdf',
  checklist.instance_id || '-' || slot.copy_slot || '.pdf',
  'application/pdf',
  1,
  'a5500000-0000-0000-0000-000000000001',
  '7',
  checklist.instance_id,
  slot.copy_slot
from (values
  ('a5500000-0000-4000-8000-000000000201', 'test-1'),
  ('a5500000-0000-4000-8000-000000000201', 'test-2'),
  ('a5500000-0000-4000-8000-000000000202', 'test-1'),
  ('a5500000-0000-4000-8000-000000000202', 'test-2')
) as checklist(id, instance_id)
cross join (values
  ('question_paper'),
  ('lowest'),
  ('median'),
  ('highest')
) as slot(copy_slot)
where not (checklist.id = 'a5500000-0000-4000-8000-000000000202' and checklist.instance_id = 'test-2' and slot.copy_slot = 'question_paper');

insert into storage.objects (bucket_id, name, owner)
select 'aqat-attachments', path, 'a5500000-0000-0000-0000-000000000001'
from public.files
where checklist_id in (
  'a5500000-0000-4000-8000-000000000201',
  'a5500000-0000-4000-8000-000000000202'
);

select is(
  (
    select count(*)
    from public.files
    where copy_slot = 'question_paper'
      and checklist_id = 'a5500000-0000-4000-8000-000000000201'
  ),
  2::bigint,
  'the copy-slot constraint accepts one question paper per instance'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a5500000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a5500000-0000-4000-8000-000000000201'$$,
  'two instances with all four files each can submit'
);

select throws_ok(
  $$update public.checklists set status = 'submitted' where id = 'a5500000-0000-4000-8000-000000000202'$$,
  '23514',
  'Checklist cannot be submitted: assessment 7 instance Test 2 is missing its question paper.',
  'an instance missing its question paper cannot submit'
);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a5500000-0000-4000-8000-000000000203'$$,
  'N/A marked-copy criteria remain exempt from all four file requirements'
);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a5500000-0000-4000-8000-000000000204'$$,
  'a checklist already submitted without a question paper is not revalidated'
);

select * from finish();
rollback;
