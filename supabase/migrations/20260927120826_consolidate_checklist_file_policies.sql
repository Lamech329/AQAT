-- Remove broad ALL policies that overlap with the operation-specific owner
-- and admin policies created by the canonical migrations.
--
-- The checklist policies had identical predicates, with the public-targeted
-- policy also applying to anon. Files policies were not identical; their
-- permissive OR behavior allowed inserts that bypassed the stricter
-- parent-checklist and uploaded_by checks.
drop policy if exists "Checklists owner can manage" on public.checklists;
drop policy if exists checklists_owner_manage on public.checklists;
drop policy if exists "Files owner can manage" on public.files;
drop policy if exists files_owner_manage on public.files;