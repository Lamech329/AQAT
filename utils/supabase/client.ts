/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js'

// Vite (not Next.js) — env vars must be prefixed VITE_ and read via import.meta.env.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Supabase client: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)