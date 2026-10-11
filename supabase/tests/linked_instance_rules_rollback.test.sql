begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a3300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'instance-test-staff@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a3300000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'instance-test-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles
set role = 'admin'
where id = 'a3300000-0000-0000-0000-000000000002';

insert into public.checklists (id, owner, data, status)
values (
  'a3300000-0000-4000-8000-000000000105',
  'a3300000-0000-0000-0000-000000000001',
  '{"items":{"4":{"status":"na"},"5":{"status":"na"},"6":{"status":"na"},"7":{"status":"yes","attachments":{"lowest":{"name":"legacy-low.pdf","path":"a3300000-0000-4000-8000-000000000105/legacy-low.pdf"},"median":{"name":"legacy-mid.pdf","path":"a3300000-0000-4000-8000-000000000105/legacy-mid.pdf"},"highest":{"name":"legacy-high.pdf","path":"a3300000-0000-4000-8000-000000000105/legacy-high.pdf"}}},"9":{"status":"na"}}}',
  'draft'
);

insert into storage.buckets (id, name, public)
values ('aqat-attachments', 'aqat-attachments', false)
on conflict (id) do nothing;

insert into public.files (checklist_id, path, name, content_type, size, uploaded_by, item_id, copy_slot)
values
  ('a3300000-0000-4000-8000-000000000105', 'a3300000-0000-4000-8000-000000000105/legacy-low.pdf', 'legacy-low.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'lowest'),
  ('a3300000-0000-4000-8000-000000000105', 'a3300000-0000-4000-8000-000000000105/legacy-mid.pdf', 'legacy-mid.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'median'),
  ('a3300000-0000-4000-8000-000000000105', 'a3300000-0000-4000-8000-000000000105/legacy-high.pdf', 'legacy-high.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'highest');

insert into storage.objects (bucket_id, name, owner)
values
  ('aqat-attachments', 'a3300000-0000-4000-8000-000000000105/legacy-low.pdf', 'a3300000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a3300000-0000-4000-8000-000000000105/legacy-mid.pdf', 'a3300000-0000-0000-0000-000000000001'),
  ('aqat-attachments', 'a3300000-0000-4000-8000-000000000105/legacy-high.pdf', 'a3300000-0000-0000-0000-000000000001');

alter table public.files
  add column if not exists assessment_instance_id text;

update public.files
set assessment_instance_id = 'instance-1'
where copy_slot is not null
  and assessment_instance_id is null;

alter table public.files
  drop constraint if exists files_assessment_instance_check;

alter table public.files
  add constraint files_assessment_instance_check
  check (copy_slot is null or assessment_instance_id is not null);

drop index if exists public.idx_files_checklist_item_copy_slot;

create unique index if not exists idx_files_checklist_item_instance_copy_slot
  on public.files (checklist_id, item_id, assessment_instance_id, copy_slot)
  where copy_slot is not null;

create index if not exists idx_files_checklist_item_instance
  on public.files (checklist_id, item_id, assessment_instance_id)
  where assessment_instance_id is not null;

update public.checklists as checklist
set data = jsonb_set(
  coalesce(checklist.data, '{}'::jsonb),
  '{items}',
  (case
    when jsonb_typeof(checklist.data->'items') = 'object' then checklist.data->'items'
    else '{}'::jsonb
  end) || (
    select coalesce(
      jsonb_object_agg(
        assessment.id,
        case
          when jsonb_typeof(checklist.data->'items'->assessment.id->'assessmentInstances') = 'array'
            then checklist.data->'items'->assessment.id
          else coalesce(checklist.data->'items'->assessment.id, '{}'::jsonb) || jsonb_build_object(
            'assessmentInstances',
            jsonb_build_array(jsonb_build_object(
              'id', 'instance-1',
              'label',
                case assessment.id
                  when '4' then 'Assignment 1'
                  when '5' then 'Lab assignment 1'
                  when '6' then 'Quiz 1'
                  when '7' then 'Test 1'
                  when '9' then 'Final exam 1'
                end,
              'attachments',
                jsonb_build_object(
                  'lowest', checklist.data->'items'->assessment.id->'attachments'->'lowest',
                  'median', checklist.data->'items'->assessment.id->'attachments'->'median',
                  'highest', checklist.data->'items'->assessment.id->'attachments'->'highest'
                )
            ))
          )
        end
      ),
      '{}'::jsonb
    )
    from unnest(array['4', '5', '6', '7', '9']) as assessment(id)
  ),
  true
)
where checklist.id = 'a3300000-0000-4000-8000-000000000105';

create or replace function public.require_marked_assessment_copies()
returns trigger
language plpgsql
as $$
declare
  assessment_id text;
  assessment_instance jsonb;
  assessment_instances jsonb;
  required_slot text;
begin
  if new.status <> 'submitted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new;
  end if;

  foreach assessment_id in array array['4', '5', '6', '7', '9'] loop
    if new.data->'items'->assessment_id->>'status' = 'na' then
      continue;
    end if;

    assessment_instances := new.data->'items'->assessment_id->'assessmentInstances';
    if jsonb_typeof(assessment_instances) is distinct from 'array' then
      raise exception 'Checklist cannot be submitted: assessment % requires at least one assessment instance.',
        assessment_id
        using errcode = '23514';
    end if;

    if jsonb_array_length(assessment_instances) = 0 then
      raise exception 'Checklist cannot be submitted: assessment % requires at least one assessment instance.',
        assessment_id
        using errcode = '23514';
    end if;

    for assessment_instance in
      select instance.value
      from jsonb_array_elements(assessment_instances) as instance(value)
    loop
      if nullif(assessment_instance->>'id', '') is null then
        raise exception 'Checklist cannot be submitted: assessment % has an instance without an id.',
          assessment_id
          using errcode = '23514';
      end if;

      foreach required_slot in array array['lowest', 'median', 'highest'] loop
        if not exists (
          select 1
          from public.files as checklist_file
          where checklist_file.checklist_id = new.id
            and checklist_file.item_id = assessment_id
            and checklist_file.assessment_instance_id = assessment_instance->>'id'
            and checklist_file.copy_slot = required_slot
            and checklist_file.path <> ''
            and exists (
              select 1
              from storage.objects
              where bucket_id = 'aqat-attachments'
                and name = checklist_file.path
            )
        ) then
          raise exception 'Checklist cannot be submitted: assessment % instance % is missing its % mark copy.',
            assessment_id, assessment_instance->>'label', required_slot
            using errcode = '23514';
        end if;
      end loop;
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

select plan(9);

insert into public.checklists (id, owner, data, status)
values
  (
    'a3300000-0000-4000-8000-000000000101',
    'a3300000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[{"id":"test-1","label":"Test 1"},{"id":"test-2","label":"Test 2"}]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a3300000-0000-4000-8000-000000000102',
    'a3300000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[{"id":"test-1","label":"Test 1"}]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a3300000-0000-4000-8000-000000000103',
    'a3300000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"na","assessmentInstances":[]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  ),
  (
    'a3300000-0000-4000-8000-000000000104',
    'a3300000-0000-0000-0000-000000000001',
    '{"items":{"4":{"status":"na","assessmentInstances":[]},"5":{"status":"na","assessmentInstances":[]},"6":{"status":"na","assessmentInstances":[]},"7":{"status":"yes","assessmentInstances":[]},"9":{"status":"na","assessmentInstances":[]}}}',
    'draft'
  );

insert into public.files (
  checklist_id, path, name, content_type, size, uploaded_by, item_id, assessment_instance_id, copy_slot
)
values
  ('a3300000-0000-4000-8000-000000000101', 'a3300000-0000-4000-8000-000000000101/test-1-low.pdf', 'test-1-low.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-1', 'lowest'),
  ('a3300000-0000-4000-8000-000000000101', 'a3300000-0000-4000-8000-000000000101/test-1-mid.pdf', 'test-1-mid.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-1', 'median'),
  ('a3300000-0000-4000-8000-000000000101', 'a3300000-0000-4000-8000-000000000101/test-1-high.pdf', 'test-1-high.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-1', 'highest'),
  ('a3300000-0000-4000-8000-000000000101', 'a3300000-0000-4000-8000-000000000101/test-2-low.pdf', 'test-2-low.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-2', 'lowest'),
  ('a3300000-0000-4000-8000-000000000101', 'a3300000-0000-4000-8000-000000000101/test-2-mid.pdf', 'test-2-mid.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-2', 'median'),
  ('a3300000-0000-4000-8000-000000000101', 'a3300000-0000-4000-8000-000000000101/test-2-high.pdf', 'test-2-high.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-2', 'highest'),
  ('a3300000-0000-4000-8000-000000000102', 'a3300000-0000-4000-8000-000000000102/low.pdf', 'low.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-1', 'lowest'),
  ('a3300000-0000-4000-8000-000000000102', 'a3300000-0000-4000-8000-000000000102/high.pdf', 'high.pdf', 'application/pdf', 1, 'a3300000-0000-0000-0000-000000000001', '7', 'test-1', 'highest');

insert into storage.objects (bucket_id, name, owner)
select 'aqat-attachments', path, 'a3300000-0000-0000-0000-000000000001'
from public.files
where checklist_id in (
  'a3300000-0000-4000-8000-000000000101',
  'a3300000-0000-4000-8000-000000000102'
);

select is(
  (
    select count(*)
    from public.files
    where checklist_id = 'a3300000-0000-4000-8000-000000000105'
      and assessment_instance_id = 'instance-1'
  ),
  3::bigint,
  'legacy file metadata is backfilled to instance-1'
);

select is(
  (
    select data->'items'->'7'->'assessmentInstances'->0->>'id'
    from public.checklists
    where id = 'a3300000-0000-4000-8000-000000000105'
  ),
  'instance-1',
  'legacy checklist data is backfilled as its first instance'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3300000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a3300000-0000-4000-8000-000000000101'$$,
  'two assessment instances with all six files can submit'
);

select throws_ok(
  $$update public.checklists set status = 'submitted' where id = 'a3300000-0000-4000-8000-000000000102'$$,
  '23514',
  'Checklist cannot be submitted: assessment 7 instance Test 1 is missing its median mark copy.',
  'one instance missing a copy cannot submit'
);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a3300000-0000-4000-8000-000000000103'$$,
  'N/A criteria with no files can submit'
);

select throws_ok(
  $$update public.checklists set status = 'submitted' where id = 'a3300000-0000-4000-8000-000000000104'$$,
  '23514',
  'Checklist cannot be submitted: assessment 7 requires at least one assessment instance.',
  'a non-N/A criterion with zero instances cannot submit'
);

select lives_ok(
  $$update public.checklists set status = 'submitted' where id = 'a3300000-0000-4000-8000-000000000105'$$,
  'backfilled legacy single-set files still permit submission'
);

with deleted as (
  delete from public.checklists
  where id = 'a3300000-0000-4000-8000-000000000101'
  returning 1
)
select is(
  (select count(*) from deleted),
  0::bigint,
  'the owner cannot delete a submitted checklist'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3300000-0000-0000-0000-000000000002', true);

select is(
  (select count(*) from public.checklists where id = 'a3300000-0000-4000-8000-000000000101'),
  1::bigint,
  'an admin can read the staff submission'
);

reset role;
create temporary table linked_test_results as
select * from finish();

do $$
declare
  result_row record;
  passed_tests integer := 0;
begin
  for result_row in select * from linked_test_results loop
    if to_jsonb(result_row)::text like '%"not ok %' then
      raise exception 'Linked rollback test assertion failed: %', to_jsonb(result_row);
    end if;
    if to_jsonb(result_row)::text like '%"ok %' then
      passed_tests := passed_tests + 1;
    end if;
  end loop;

  if passed_tests <> 9 then
    raise exception 'Expected 9 successful linked rollback assertions, observed %.', passed_tests;
  end if;
end;
$$;

rollback;
