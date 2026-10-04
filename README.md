# AQAT Subject File Checklist

A static React/Vite checklist for PNG University of Technology subject-file compliance. By default, checklist data is saved in the browser's local storage. Department administrators can optionally configure an external REST API from the in-app Settings panel.

## Setup and local development

1. Install Node.js 20 or later.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   Vite prints the local address, normally `http://localhost:5173`.

## Production build

Create a production-ready static site with:

```bash
npm run build
```

The generated files are placed in `dist/`. Preview that exact production build locally with:

```bash
npm run preview
```

## Optional environment configuration

Copy `.env.example` to `.env` to provide a build-time default for the remote API Base URL:

```bash
copy .env.example .env
```

`VITE_DEFAULT_API_BASE_URL` only pre-fills the Settings panel. Local storage remains the default mode, so the site is fully usable without this variable or any backend.

## Static deployment

No server-side application is required. After running `npm run build`, upload the **contents** of `dist/` to any static host.

For Netlify, create a new site from the project repository and set:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |

The deployed site works immediately in Local storage mode. To use a department API, open the gear icon in the app and enter its URL and authentication settings. That API must expose the endpoints used by `src/api/checklistApi.js` and allow requests from the deployed site's origin.

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured, Supabase is the default data source for new browsers. Checklist and attachment requests go directly from the browser Supabase client using the signed-in user's session, so database and Storage RLS policies authorize them. The app is a static frontend and does not require a backend server. The sign-in page separates Staff and Admin portals, but the selected portal never grants access: `public.profiles.role` is checked after authentication. New accounts always receive the `staff` role. Promote trusted accounts to `admin` through the database; profile role updates are not available to authenticated clients.

## Dashboard access

Staff and Admin have separate dashboards and protected route namespaces:

- `staff` can access `/staff/*`, manage their own drafts, and submit checklists.
- `admin` can access `/admin/*`, review all submissions, export data, view/print/download files, and delete any checklist.

The Admin portal requires Supabase authentication. Local mode is staff-only because it has no trusted database role. Route guards redirect an authenticated user to their own portal, and a portal/account mismatch signs the user out.

Each marked assessment requires separate **Lowest mark**, **Median mark**, and **Highest mark** uploads. The submit action and a database trigger both enforce these slots. Existing unlabelled uploads are retained but do not satisfy a labelled slot.

Apply reviewed migrations before using the current role and attachment schema. The current forward migration is `supabase/migrations/20261004033606_consolidate_staff_admin_roles_and_copy_slots.sql`.
