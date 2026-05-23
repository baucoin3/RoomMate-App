/**
 * Central config and environment variable access.
 * This is the ONLY place process.env.* should be read.
 * All other files import from here.
 */

// ─── API ───────────────────────────────────────────────────────────────────

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000'

// ─── Supabase ──────────────────────────────────────────────────────────────

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
/** Service role key — server-only, never expose to the browser. Bypasses RLS. */
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Storage bucket that holds household cover photos */
export const HOUSEHOLDS_BUCKET = 'households'

/** Maximum file size for household cover photo uploads (5 MB) */
export const HOUSEHOLD_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Storage bucket that holds recipe images */
export const RECIPES_BUCKET = 'recipes'

/** Maximum file size for recipe image uploads (5 MB) */
export const RECIPE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Storage bucket for receipt images */
export const RECEIPTS_BUCKET = 'receipts'

/** Maximum file size for receipt image uploads (10 MB) */
export const RECEIPT_IMAGE_MAX_BYTES = 10 * 1024 * 1024

/** Anthropic API key — server-only, never expose to the browser */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

/** Claude model used for receipt analysis */
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6'

// ─── Auth ──────────────────────────────────────────────────────────────────

/** Minimum password length enforced on the client before submitting */
export const PASSWORD_MIN_LENGTH = 8

// ─── App ───────────────────────────────────────────────────────────────────

export const APP_NAME = 'Roommate App'
export const APP_DESCRIPTION = 'Find and manage your roommates'

/** Default pagination page size for list queries */
export const DEFAULT_PAGE_SIZE = 20
