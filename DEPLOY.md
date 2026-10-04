# Static frontend deployment

This repository's browser app is a Vite single-page application. Deploy the repository root as a static Vite project; no backend service or server-side environment variables are required.

## Deploy to Vercel

1. Push the repository to GitHub, sign in at [vercel.com](https://vercel.com), choose **Add New… → Project**, and import the AQAT GitHub repository.
2. In project setup, use the repository root as the Root Directory and select **Vite** if Vercel does not detect it automatically. Use:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install` (the default)
3. In **Environment Variables**, add these for Production (and Preview too if you use preview deployments):
   - `VITE_SUPABASE_URL` — your Supabase project URL, such as `https://your-project-ref.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — the project's publishable browser key from the Supabase dashboard

   The app also supports the legacy `VITE_SUPABASE_ANON_KEY` as an alternative to the publishable key. Set one key variable, not both. These are browser-visible credentials; never put a Supabase secret/service-role key in Vite variables. `VITE_DEFAULT_API_BASE_URL` is optional and only prefills the Settings panel's custom API URL.
4. Save the project settings and let Vercel build and deploy. After adding or changing environment variables, trigger a new deployment because Vite embeds them at build time.
5. Copy the deployed production URL (for example, `https://your-project.vercel.app`) and configure Supabase Auth as described below.

`vercel.json` rewrites application paths to `index.html`, so direct visits and refreshes on `/staff`, `/admin`, and `/login` load the client router. `public/_redirects` provides the equivalent fallback if deploying the static `dist/` output to Netlify.

## Update Supabase Auth URLs after deployment

In the Supabase dashboard, open **Authentication → URL Configuration** after you have the live URL:

1. Set **Site URL** to the production origin, for example `https://your-project.vercel.app` (no trailing path). Supabase uses this as the default URL for confirmation emails when the app does not supply a custom redirect.
2. Under **Redirect URLs**, add `https://your-project.vercel.app/**`. If you use a custom domain, add its URL pattern too. Keep `http://localhost:5173/**` only if you still need local development redirects.
3. Save the changes. This ensures confirmation links use the live site as their default instead of localhost.

## Promote an account to Admin manually

Run this yourself in the Supabase SQL Editor, replacing the email with the exact account to promote. It updates only the matching profile and raises an error if exactly one profile was not updated:

```sql
do $$
declare
  updated_count integer;
begin
  update public.profiles as profile
  set role = 'admin'
  from auth.users as auth_user
  where profile.id = auth_user.id
    and lower(auth_user.email) = lower('person@example.com');

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'Expected to promote exactly one profile; updated %.', updated_count;
  end if;
end;
$$;
```

Check current account roles:

```sql
select auth_user.email, profile.role
from auth.users as auth_user
left join public.profiles as profile on profile.id = auth_user.id
order by lower(auth_user.email);
```
