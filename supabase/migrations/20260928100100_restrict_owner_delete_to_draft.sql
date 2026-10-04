-- Restrict owner DELETE to draft checklists only.
-- Users should not be able to delete submitted checklists for audit purposes.

drop policy if exists "Users can delete their own checklists" on public.checklists;
create policy "Users can delete their own checklists"
  on public.checklists for delete
  to authenticated
  using (
    (select auth.uid()) = owner
    and status = 'draft'
  );

-- File metadata must follow the parent checklist's delete rules.
drop policy if exists "Users can delete files from their own checklists" on public.files;
create policy "Users can delete files from their own checklists"
  on public.files for delete
  to authenticated
  using (
    exists (
      select 1
      from public.checklists
      where checklists.id = files.checklist_id
        and checklists.owner = (select auth.uid())
        and checklists.status = 'draft'
    )
  );

-- Replace the broader Storage owner policy so submitted checklist attachments
-- cannot be removed by their owner. Admins retain access to every attachment.
drop policy if exists "Authenticated users can delete their own attachment files" on storage.objects;
drop policy if exists "Admins can delete all checklist attachments" on storage.objects;
create policy "Admins can delete all checklist attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'aqat-attachments'
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Users can delete own checklist attachments" on storage.objects;
create policy "Users can delete own checklist attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'aqat-attachments'
    and exists (
      select 1
      from public.checklists
      where checklists.id::text = split_part(storage.objects.name, '/', 1)
        and checklists.owner = (select auth.uid())
        and checklists.status = 'draft'
    )
  );
