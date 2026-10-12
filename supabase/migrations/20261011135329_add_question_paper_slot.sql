-- Require a question paper in addition to the three marked copies for each
-- marked-assessment instance. Existing submitted records are not revalidated.

alter table public.files
  drop constraint if exists files_copy_slot_check;

alter table public.files
  add constraint files_copy_slot_check
  check (
    copy_slot is null
    or (
      item_id is not null
      and item_id in ('4', '5', '6', '7', '9')
      and copy_slot in ('question_paper', 'lowest', 'median', 'highest')
    )
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
  if tg_op = 'INSERT' then
    return new;
  end if;

  if old.status is distinct from 'draft' or new.status is distinct from 'submitted' then
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

      foreach required_slot in array array['question_paper', 'lowest', 'median', 'highest'] loop
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
          if required_slot = 'question_paper' then
            raise exception 'Checklist cannot be submitted: assessment % instance % is missing its question paper.',
              assessment_id, assessment_instance->>'label'
              using errcode = '23514';
          else
            raise exception 'Checklist cannot be submitted: assessment % instance % is missing its % mark copy.',
              assessment_id, assessment_instance->>'label', required_slot
              using errcode = '23514';
          end if;
        end if;
      end loop;
    end loop;
  end loop;

  return new;
end;
$$;