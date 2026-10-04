# AQAT Project Progress Report

**Report date:** 2026-10-04

## Current architecture

- The active UI is the React/Vite application in `src/`.
- Checklist, profile, file metadata, and attachment operations use the signed-in browser Supabase client and are authorized by database and Storage RLS.
- The repository deploys as a static frontend; there is no application backend service.
- Local storage mode remains available for staff workflows. The Admin portal requires Supabase authentication.

## Roles and access

The application uses two roles: `staff` and `admin`. The login portal selector only selects a sign-in view. Supabase authentication reads `public.profiles.role`; a mismatch signs the user out. New accounts are staff by default, and authenticated users cannot update their own profile role. `/staff/*` and `/admin/*` are protected by role-specific route guards.

The forward migration `supabase/migrations/20261004033606_consolidate_staff_admin_roles_and_copy_slots.sql` converts existing profile roles, changes the role constraint/default, updates role-gated RLS policies, adds labelled file metadata, and installs the submit-validation trigger. It revokes profile write privileges from client roles. The migration was reviewed, approved, and applied to the linked Supabase project on 2026-10-04.

## Checklist workflow

Staff can create, edit, and delete their own draft checklists, view submissions, and print summaries. Admin can review all checklists, filter and export CSV, inspect/download/print attachments, and delete any checklist. Owners remain restricted to deleting their own drafts.

Marked assessments are currently checklist items `4`, `5`, `6`, `7`, and `9`. Each requires a separate lowest-, median-, and highest-mark attachment. Existing one-per-item uploads remain preserved as unassigned legacy files and do not satisfy a labelled slot. The UI shows slot status/progress and missing slots; a database trigger prevents submission without all required file metadata and corresponding Storage objects.

## Documentation

The role and workflow documentation is maintained in `README.md`, `SUPABASE_SETUP.md`, and `QUICK_START.md`. This report summarizes the current implementation state.

## Validation status

- Frontend production build: passed after the role, route, staff dashboard, marked-copy, and Admin summary changes.
- Backend TypeScript build: passed.
- `npm test`: passed (4 role-routing, copy-slot, and Admin summary regression tests).
- Linked database checks passed for draft-only owner deletes, Admin deletes, role-update denial, incomplete-submit rejection, and Admin visibility. The SQL checks ran in rollback transactions; no test accounts, checklist rows, file rows, or Storage objects remain.
- The `supabase test db --linked` pgTAP runner could not start because Docker/Podman is unavailable. The direct linked SQL verification completed successfully; the Node regression tests cover role routing/mismatch, copy-slot rules, and Admin summary aggregation.

## Validation status

- Frontend production build: passed.
- Backend TypeScript build: passed.
- `npm test`: passed (4 role-routing, copy-slot, and Admin summary regression tests).
- `git diff --check`: passed.
- The frontend build reports the existing advisory that its minified JavaScript chunk exceeds 500 kB; the build succeeds.

## Remaining verification

- No authenticated browser end-to-end test was run for portal mismatch/sign-out or route redirects. Role selection/redirect helpers are covered by Node tests, and the route guards and sign-out logic are implemented in the frontend.
- Do not commit until explicitly requested.
