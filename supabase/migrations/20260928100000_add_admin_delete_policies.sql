-- Add admin DELETE policies for checklists and files.
-- Admins (admin and super_admin roles) can delete any checklist or file record.

drop policy if exists "Admins can delete any checklist" on public.checklists;
create policy "Admins can delete any checklist"
  on public.checklists for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Admins can delete any file" on public.files;
create policy "Admins can delete any file"
  on public.files for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin')
    )
  );
