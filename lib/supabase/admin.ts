/**
 * Admin Supabase client using the service role key.
 * Bypasses RLS entirely — use only in server-side Route Handlers for
 * privileged operations (e.g. inserting a new member after registration).
 * Never import this in client components or expose the key to the browser.
 */
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '@/lib/config'

export function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}
