Supabase setup for AQAT backend

Commands to run locally (after installing supabase CLI and logging in):

1. Login and link project
   supabase login
   supabase projects list
   supabase link --project-ref <your-project-ref>

2. Apply DB schema
   supabase db query ./server/supabase/schema.sql

3. Create storage bucket for checklist files (private recommended)
   supabase storage create-bucket checklist-files --public false

4. (Optional) Make bucket public if you want direct public URLs
   supabase storage update-bucket checklist-files --public true

Notes:
- The schema creates public.checklists and public.files tables and enables RLS policies so users can only access their own data using auth.uid().
- Ensure SUPABASE_URL and SUPABASE_KEY (service role or a key with appropriate privileges) are added to server/.env before running server operations that require Supabase.
- If you want, grant the server a service role key in an environment variable; keep it secret.
