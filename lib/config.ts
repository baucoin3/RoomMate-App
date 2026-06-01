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

/** Max tokens allocated for a receipt analysis response */
export const RECEIPT_ANALYSIS_MAX_TOKENS = 1800

/**
 * Static portion of the receipt-analysis system prompt.
 * The dynamic category instruction is appended at call time.
 */
export const RECEIPT_ANALYSIS_SYSTEM_PROMPT = `You are a receipt parser. Extract structured data from the receipt image and return ONLY valid JSON — no markdown, no code fences, no explanation.

If the image is NOT a purchase receipt (e.g. a photo, meme, screenshot, blank image, or unrelated document), return ONLY:
{"is_receipt": false}
Do not include any other fields.

If it IS a purchase receipt, return a JSON object with "is_receipt": true and this shape (omit any field that is not clearly visible on the receipt):
{
  "is_receipt": true,
  "merchant_name": string,
  "receipt_date": string (YYYY-MM-DD),
  "subtotal": number,
  "tax": number,
  "total": number,
  "suggested_category_name": string,
  "line_items": [{
    "description": string (verbatim from receipt),
    "amount": number,
    "quantity": number,
    "normalized_name": string (short household-friendly name),
    "suggested_category_name": string (from provided category list),
    "probable_names": string[] (3–5 short household-friendly names, generic to specific)
  }]
}

When is_receipt is true, "line_items" is required; all other fields are optional.
For each line item: "description" must stay verbatim from the receipt; "normalized_name" is best-effort household vocabulary. For each line item, return "probable_names": an array of 3–5 short, common household names for the item, from most generic to most specific (e.g. ["gum", "chewing gum", "spearmint gum"]). These are used to match against the household's item catalog — prefer simple, lowercase, common vocabulary.`

/** Appended to RECEIPT_ANALYSIS_SYSTEM_PROMPT when expense categories are available */
export const RECEIPT_CATEGORY_WITH_OPTIONS = (categories: string[]) =>
  `Set receipt-level "suggested_category_name" to one of: ${categories.join(', ')}. Omit the field if none fit. For each line item, set "suggested_category_name" from the same list when applicable.`

/** Appended to RECEIPT_ANALYSIS_SYSTEM_PROMPT when no expense categories exist */
export const RECEIPT_CATEGORY_NONE = 'Omit all "suggested_category_name" fields.'

// ─── Email (Resend) ────────────────────────────────────────────────────────

export const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'splits@roommate-app.com'

// ─── Cron ──────────────────────────────────────────────────────────────────

/** Secret used to authenticate Vercel Cron requests to /api/cron/* routes. */
export const CRON_SECRET = process.env.CRON_SECRET ?? ''

// ─── Auth ──────────────────────────────────────────────────────────────────

/** Minimum password length enforced on the client before submitting */
export const PASSWORD_MIN_LENGTH = 8

// ─── App ───────────────────────────────────────────────────────────────────

export const APP_NAME = 'Roommate App'
export const APP_DESCRIPTION = 'Find and manage your roommates'

/** Default pagination page size for list queries */
export const DEFAULT_PAGE_SIZE = 20
