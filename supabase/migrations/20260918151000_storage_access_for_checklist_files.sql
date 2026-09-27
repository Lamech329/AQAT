-- Storage access for checklist attachments.
-- Object paths are stored as <checklist_id>/<filename>.
drop policy if exists "Admins can read all checklist attachments" on storage.objects;
create policy "Admins can read all checklist attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'aqat-attachments'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Users can read own checklist attachments" on storage.objects;
create policy "Users can read own checklist attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'aqat-attachments'
    and exists (
      select 1
      from public.checklists
      where checklists.id::text = split_part(name, '/', 1)
      and checklists.owner = auth.uid()
    )
  );

drop policy if exists "Users can upload own checklist attachments" on storage.objects;
create policy "Users can upload own checklist attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'aqat-attachments'
    and exists (
      select 1
      from public.checklists
      where checklists.id::text = split_part(name, '/', 1)
      and checklists.owner = auth.uid()
    )
  );
