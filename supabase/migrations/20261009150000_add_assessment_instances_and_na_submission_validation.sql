-- Support multiple named assessment instances for every marked-copy criterion.
-- Existing one-set uploads become the first instance without changing their paths.

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

-- Preserve checklist data and map old attachment maps into the first instance.
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
);

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
