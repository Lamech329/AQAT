import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? ''
const key = process.env.SUPABASE_KEY ?? ''

let supabase: any
if (!url || !key) {
  console.warn('SUPABASE_URL or SUPABASE_KEY not set; Supabase calls will fail until configured')
  // Minimal stub so imports won't crash; runtime calls will return errors caught by route handlers
  supabase = {
    from: () => ({ error: { message: 'Supabase not configured on server' } }),
    storage: { from: () => ({ upload: async () => ({ error: { message: 'Supabase not configured on server' } }) }) },
  }
} else {
  supabase = createClient(url, key)
}

export { supabase }
