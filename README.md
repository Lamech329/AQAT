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

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured, Supabase is the default data source for new browsers. The sign-in page includes self-service sign-up. New Supabase accounts receive the `user` role through the `profiles` trigger; promote trusted accounts to `admin` or `super_admin` directly in `public.profiles` rather than from the browser. Apply the latest migration before using existing Auth users.

## Dashboard access

The header includes role-aware tabs for **Checklists**, **Admin**, and **Super Admin**. Admin tabs are only shown after sign-in:

- `user` can access Checklists.
- `admin` can access Checklists and Admin.
- `super_admin` can access all three tabs.

In Local storage mode, choose the role on the sign-in form for testing. In Supabase mode, roles come from `public.profiles.role`; the route guards enforce the same permissions even if a protected URL is entered directly.
