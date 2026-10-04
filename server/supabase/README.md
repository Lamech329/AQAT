The Express server no longer reads or writes checklist, file, or activity data.
The app uses the browser Supabase client and the signed-in user's session so
Postgres and Storage RLS policies authorize each request.

Apply database changes from the canonical migrations in `../../supabase/migrations`
using the normal reviewed migration workflow. Do not run this legacy schema file
as a replacement for those migrations. Create the private `aqat-attachments`
Storage bucket in Supabase; authenticated browser uploads are authorized by
the Storage policies in the migrations.

The Express server only exposes `GET /ping` as a health check and does not need
or accept a Supabase service-role key.
