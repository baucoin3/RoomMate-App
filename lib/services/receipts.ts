/*
 * ============================================================
 * SQL MIGRATION — run this in Supabase Studio before using
 * the receipts feature.
 * ============================================================
 *
 * -- receipts table
 * create table public.receipts (
 *   id uuid primary key default gen_random_uuid(),
 *   household_id uuid not null references public.households(id) on delete cascade,
 *   uploaded_by_member_id uuid not null references public.household_members(id) on delete cascade,
 *   image_url text not null,
 *   merchant_name text,
 *   receipt_date date,
 *   raw_total numeric check (raw_total >= 0),
 *   ai_extracted_data jsonb,
 *   created_at timestamptz not null default now()
 * );
 *
 * alter table public.receipts enable row level security;
 * create policy "members can view household receipts"
 *   on public.receipts for select
 *   using (exists (
 *     select 1 from public.household_members hm
 *     where hm.household_id = receipts.household_id
 *       and hm.user_id = auth.uid()
 *   ));
 * create policy "members can insert receipts"
 *   on public.receipts for insert
 *   with check (exists (
 *     select 1 from public.household_members hm
 *     where hm.household_id = receipts.household_id
 *       and hm.user_id = auth.uid()
 *   ));
 *
 * -- receipt_line_items table
 * create table public.receipt_line_items (
 *   id uuid primary key default gen_random_uuid(),
 *   receipt_id uuid not null references public.receipts(id) on delete cascade,
 *   description text not null,
 *   amount numeric not null check (amount >= 0),
 *   quantity numeric not null default 1
 * );
 *
 * alter table public.receipt_line_items enable row level security;
 * create policy "members can view line items via receipt"
 *   on public.receipt_line_items for select
 *   using (exists (
 *     select 1 from public.receipts r
 *     join public.household_members hm on hm.household_id = r.household_id
 *     where r.id = receipt_line_items.receipt_id
 *       and hm.user_id = auth.uid()
 *   ));
 * create policy "members can insert line items"
 *   on public.receipt_line_items for insert
 *   with check (exists (
 *     select 1 from public.receipts r
 *     join public.household_members hm on hm.household_id = r.household_id
 *     where r.id = receipt_line_items.receipt_id
 *       and hm.user_id = auth.uid()
 *   ));
 * ============================================================
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/config'
import type { ReceiptAnalysis, ReceiptLedgerItem, SaveReceiptPayload } from '@/lib/types/receipts'

// ─── AI Analysis ──────────────────────────────────────────────────────────

export async function analyzeReceipt(
  imageUrl: string,
  categoryNames: string[],
): Promise<ReceiptAnalysis> {
  const emptyResult: ReceiptAnalysis = {
    merchant_name: null,
    receipt_date: null,
    subtotal: null,
    tax: null,
    total: null,
    suggested_category_name: null,
    line_items: [],
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const prompt = `You are a receipt parser. Extract the following from this receipt image and return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "merchant_name": string | null,
  "receipt_date": "YYYY-MM-DD" | null,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "suggested_category_name": string | null,
  "line_items": [{ "description": string, "amount": number, "quantity": number }]
}

Available expense categories: ${categoryNames.join(', ')}

Rules:
- All monetary values must be numbers (not strings).
- receipt_date must be YYYY-MM-DD format or null.
- suggested_category_name must exactly match one of the available categories or be null.
- If a field cannot be determined, use null.
- line_items must be an array (empty array if none found).`

    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return emptyResult

    const parsed = JSON.parse(textBlock.text) as ReceiptAnalysis
    return parsed
  } catch (err) {
    console.error('[analyzeReceipt]', err)
    return emptyResult
  }
}

// ─── Save Receipt ──────────────────────────────────────────────────────────

export async function saveReceipt(
  supabase: SupabaseClient,
  payload: SaveReceiptPayload,
): Promise<{ data: { receipt_id: string; expense_id: string } | null; error: string | null }> {
  if (payload.new_household_items && payload.new_household_items.length > 0) {
    const itemRows = payload.new_household_items.map((item) => ({
      household_id: payload.household_id,
      name: item.name,
      default_category_id: item.default_category_id,
    }))
    const { error: itemError } = await supabase
      .from('household_items')
      .insert(itemRows)
    if (itemError) console.error('[saveReceipt] household_items insert', itemError)
  }

  const { data: receiptRow, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      household_id: payload.household_id,
      uploaded_by_member_id: payload.paid_by_member_id,
      image_url: payload.image_url,
      merchant_name: payload.merchant_name,
      receipt_date: payload.receipt_date,
      raw_total: payload.raw_total,
      ai_extracted_data: payload.ai_extracted_data,
    })
    .select('id')
    .single()

  if (receiptError) return { data: null, error: receiptError.message }

  if (payload.line_items.length > 0) {
    const lineItemRows = payload.line_items.map((item) => ({
      receipt_id: receiptRow.id,
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
    }))

    const { error: lineItemError } = await supabase
      .from('receipt_line_items')
      .insert(lineItemRows)

    if (lineItemError) return { data: null, error: lineItemError.message }
  }

  const { data: expenseRow, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      household_id: payload.household_id,
      category_id: payload.category_id,
      description: payload.description,
      total_amount: payload.raw_total,
      paid_by_member_id: payload.paid_by_member_id,
      date: payload.receipt_date ?? new Date().toISOString().slice(0, 10),
      receipt_id: receiptRow.id,
    })
    .select('id')
    .single()

  if (expenseError) return { data: null, error: expenseError.message }

  if (payload.splits.length > 0) {
    const splitRows = payload.splits.map((s) => ({
      expense_id: expenseRow.id,
      household_member_id: s.household_member_id,
      percentage_override: s.percentage,
      calculated_amount: s.calculated_amount,
    }))

    const { error: splitError } = await supabase.from('expense_splits').insert(splitRows)
    if (splitError) return { data: null, error: splitError.message }
  }

  return { data: { receipt_id: receiptRow.id, expense_id: expenseRow.id }, error: null }
}

// ─── Get Receipt Ledger ────────────────────────────────────────────────────

type ReceiptRow = {
  id: string
  household_id: string
  uploaded_by_member_id: string
  image_url: string
  merchant_name: string | null
  receipt_date: string | null
  raw_total: number | null
  created_at: string
  expenses: Array<{
    id: string
    category_id: string | null
    expense_categories: { name: string } | Array<{ name: string }> | null
  }>
}

function extractCategoryName(
  expenseCategories: { name: string } | Array<{ name: string }> | null,
): string | null {
  if (!expenseCategories) return null
  if (Array.isArray(expenseCategories)) return expenseCategories[0]?.name ?? null
  return expenseCategories.name ?? null
}

export async function getReceiptLedger(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: ReceiptLedgerItem[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('receipts')
    .select(`
      id, household_id, uploaded_by_member_id, image_url,
      merchant_name, receipt_date, raw_total, created_at,
      expenses(id, category_id, expense_categories(name))
    `)
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  const items: ReceiptLedgerItem[] = (data as unknown as ReceiptRow[]).map((row) => {
    const firstExpense = row.expenses?.[0] ?? null
    return {
      id: row.id,
      household_id: row.household_id,
      uploaded_by_member_id: row.uploaded_by_member_id,
      image_url: row.image_url,
      merchant_name: row.merchant_name,
      receipt_date: row.receipt_date,
      raw_total: row.raw_total,
      created_at: row.created_at,
      expense_id: firstExpense?.id ?? null,
      category_name: firstExpense
        ? extractCategoryName(firstExpense.expense_categories)
        : null,
    }
  })

  return { data: items, error: null }
}
