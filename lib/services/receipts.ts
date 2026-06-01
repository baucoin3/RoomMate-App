import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  RECEIPT_ANALYSIS_MAX_TOKENS,
  RECEIPT_ANALYSIS_SYSTEM_PROMPT,
  RECEIPT_CATEGORY_NONE,
  RECEIPT_CATEGORY_WITH_OPTIONS,
} from '@/lib/config'
import { resolveNewHouseholdItemsForReceipt, upsertAliasesBatch } from '@/lib/services/householdItems'
import { RECEIPTS } from '@/locales/en'
import type { ReceiptAnalysis, ReceiptDetail, ReceiptLedgerItem, SaveReceiptPayload } from '@/lib/types/receipts'

type ReceiptAnalysisRaw = Partial<ReceiptAnalysis> & { is_receipt?: boolean }

export type AnalyzeReceiptResult = {
  data: ReceiptAnalysis | null
  notReceipt: boolean
}

export async function analyzeReceipt(
  imageUrl: string,
  categoryNames: string[],
): Promise<AnalyzeReceiptResult> {
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

    const categoryInstruction = categoryNames.length > 0
      ? RECEIPT_CATEGORY_WITH_OPTIONS(categoryNames)
      : RECEIPT_CATEGORY_NONE

    const anthropicInput = {
      model: ANTHROPIC_MODEL,
      max_tokens: RECEIPT_ANALYSIS_MAX_TOKENS,
      system: `${RECEIPT_ANALYSIS_SYSTEM_PROMPT} ${categoryInstruction}`,
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'image' as const, source: { type: 'url' as const, url: imageUrl } }],
        },
      ],
    }

    const message = await client.messages.create(anthropicInput)

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return { data: emptyResult, notReceipt: false }
    }

    const input = JSON.parse(textBlock.text) as ReceiptAnalysisRaw
    if (input.is_receipt === false) {
      return { data: null, notReceipt: true }
    }

    return {
      data: {
        merchant_name: input.merchant_name ?? null,
        receipt_date: input.receipt_date ?? null,
        subtotal: input.subtotal ?? null,
        tax: input.tax ?? null,
        total: input.total ?? null,
        suggested_category_name: input.suggested_category_name ?? null,
        line_items: input.line_items ?? [],
      },
      notReceipt: false,
    }
  } catch (err) {
    console.error('[analyzeReceipt]', err)
    return { data: emptyResult, notReceipt: false }
  }
}

export async function saveReceipt(
  supabase: SupabaseClient,
  payload: SaveReceiptPayload,
): Promise<{ data: { receipt_id: string; expense_id: string } | null; error: string | null }> {
  const hasMemberPayer = Boolean(payload.paid_by_member_id)
  const hasGuestPayer = Boolean(payload.paid_by_guest_id)
  if (hasMemberPayer === hasGuestPayer) {
    return { data: null, error: RECEIPTS.ERRORS.PAYER_REQUIRED }
  }

  if (payload.new_household_items?.length) {
    const { data: resolved, error: itemError } = await resolveNewHouseholdItemsForReceipt(
      supabase,
      payload.household_id,
      payload.new_household_items,
    )
    if (itemError) return { data: null, error: itemError }

    const aliasesToInsert = (resolved ?? []).flatMap((item) =>
      item.initial_aliases.map((display_text) => ({
        household_item_id: item.id,
        display_text,
      })),
    )
    if (aliasesToInsert.length > 0) {
      const { error: aliasError } = await upsertAliasesBatch(supabase, payload.household_id, aliasesToInsert)
      if (aliasError) {
        console.error('[saveReceipt] initial alias insert failed', aliasError)
      }
    }
  }

  const { data: receiptRow, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      household_id: payload.household_id,
      uploaded_by_member_id: payload.uploaded_by_member_id,
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
      paid_by_member_id: payload.paid_by_member_id ?? null,
      paid_by_guest_id: payload.paid_by_guest_id ?? null,
      date: payload.receipt_date ?? new Date().toISOString().slice(0, 10),
      receipt_id: receiptRow.id,
    })
    .select('id')
    .single()

  if (expenseError) return { data: null, error: expenseError.message }

  if (payload.splits.length > 0) {
    const splitRows = payload.splits.map((s) => ({
      expense_id: expenseRow.id,
      household_member_id: s.household_member_id ?? null,
      guest_id: s.guest_id ?? null,
      percentage_override: s.percentage,
      calculated_amount: s.calculated_amount,
    }))

    const { error: splitError } = await supabase.from('expense_splits').insert(splitRows)
    if (splitError) return { data: null, error: splitError.message }
  }

  if (payload.alias_inserts && payload.alias_inserts.length > 0) {
    const { error: aliasError } = await upsertAliasesBatch(
      supabase,
      payload.household_id,
      payload.alias_inserts,
    )
    if (aliasError) {
      console.error('[saveReceipt] alias upsert failed', aliasError)
    }
  }

  return { data: { receipt_id: receiptRow.id, expense_id: expenseRow.id }, error: null }
}

type ReceiptRow = {
  id: string
  household_id: string
  uploaded_by_member_id: string
  image_url: string
  merchant_name: string | null
  receipt_date: string | null
  raw_total: number | null
  created_at: string
  ai_extracted_data: ReceiptAnalysis | null
}

type ExpenseRow = {
  id: string
  receipt_id: string | null
  category_id: string | null
  expense_categories: { name: string } | Array<{ name: string }> | null
}

function extractCategoryName(
  expenseCategories: { name: string } | Array<{ name: string }> | null,
): string | null {
  if (!expenseCategories) return null
  if (Array.isArray(expenseCategories)) return expenseCategories[0]?.name ?? null
  return expenseCategories.name ?? null
}

function ledgerMerchantName(row: ReceiptRow): string | null {
  return row.merchant_name ?? row.ai_extracted_data?.merchant_name ?? null
}

function ledgerReceiptDate(row: ReceiptRow): string | null {
  return row.receipt_date ?? row.ai_extracted_data?.receipt_date ?? null
}

export async function getReceiptLedger(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: ReceiptLedgerItem[] | null; error: string | null }> {
  const { data: receiptRows, error: receiptError } = await supabase
    .from('receipts')
    .select(
      'id, household_id, uploaded_by_member_id, image_url, merchant_name, receipt_date, raw_total, created_at, ai_extracted_data',
    )
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  if (receiptError) return { data: null, error: receiptError.message }

  const receipts = (receiptRows ?? []) as ReceiptRow[]
  if (receipts.length === 0) return { data: [], error: null }

  const receiptIds = receipts.map((r) => r.id)

  const { data: expenseRows, error: expenseError } = await supabase
    .from('expenses')
    .select('id, receipt_id, category_id, expense_categories(name)')
    .in('receipt_id', receiptIds)

  if (expenseError) return { data: null, error: expenseError.message }

  const expenseByReceiptId = (expenseRows ?? []).reduce<Record<string, ExpenseRow>>(
    (acc, row) => {
      const expense = row as ExpenseRow
      if (expense.receipt_id && !acc[expense.receipt_id]) {
        acc[expense.receipt_id] = expense
      }
      return acc
    },
    {},
  )

  const items: ReceiptLedgerItem[] = receipts.map((row) => {
    const expense = expenseByReceiptId[row.id] ?? null
    return {
      id: row.id,
      household_id: row.household_id,
      uploaded_by_member_id: row.uploaded_by_member_id,
      image_url: row.image_url,
      merchant_name: ledgerMerchantName(row),
      receipt_date: ledgerReceiptDate(row),
      raw_total: row.raw_total,
      created_at: row.created_at,
      expense_id: expense?.id ?? null,
      category_name: expense ? extractCategoryName(expense.expense_categories) : null,
    }
  })

  return { data: items, error: null }
}

type ReceiptDetailRow = {
  id: string
  image_url: string | null
  merchant_name: string | null
  receipt_date: string | null
  raw_total: number | null
  receipt_line_items: Array<{
    id: string
    description: string
    amount: number
    quantity: number | null
  }>
  expenses: Array<{
    id: string
    total_amount: number
    expense_categories: { name: string } | null
    expense_splits: Array<{
      calculated_amount: number
      household_member_id: string | null
      guest_id: string | null
      household_members: { nickname: string } | null
      household_guests: { name: string } | null
    }>
  }>
}

export async function getReceiptDetail(
  supabase: SupabaseClient,
  householdId: string,
  receiptId: string,
): Promise<ReceiptDetail | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select(
      'id, image_url, merchant_name, receipt_date, raw_total, ' +
      'receipt_line_items(id, description, amount, quantity), ' +
      'expenses(id, total_amount, expense_categories(name), expense_splits(calculated_amount, household_member_id, guest_id, household_members(nickname), household_guests(name)))',
    )
    .eq('id', receiptId)
    .eq('household_id', householdId)
    .single()

  if (error || !data) return null

  const row = data as unknown as ReceiptDetailRow
  const expense = row.expenses[0] ?? null

  return {
    id: row.id,
    imageUrl: row.image_url,
    merchantName: row.merchant_name ?? '',
    receiptDate: row.receipt_date ?? '',
    rawTotal: row.raw_total ?? 0,
    categoryName: expense?.expense_categories?.name ?? null,
    lineItems: row.receipt_line_items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
    })),
    splits: (expense?.expense_splits ?? []).reduce<ReceiptDetail['splits']>((acc, s) => {
      if (s.household_members) {
        acc.push({
          participantType: 'member',
          displayName: s.household_members.nickname,
          amount: s.calculated_amount,
        })
      } else if (s.household_guests) {
        acc.push({
          participantType: 'guest',
          displayName: s.household_guests.name,
          amount: s.calculated_amount,
        })
      }
      return acc
    }, []),
    expenseTotal: expense?.total_amount ?? 0,
  }
}
