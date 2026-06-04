import type { SupabaseClient } from '@supabase/supabase-js'
import type { MealLog } from '@/lib/types/recipe'
import type { CalendarData, CalendarCustomEvent, CalendarReceiptDot } from '@/lib/types/dashboard'

export async function createMealLog(
  supabase: SupabaseClient,
  payload: { recipe_id: string; household_id: string; made_at?: string; notes?: string | null },
  userId: string,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const { data: member, error: memberErr } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', payload.household_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberErr || !member) return { data: null, error: 'Not a member of this household.' }

  const madeAt = payload.made_at ?? new Date().toLocaleDateString('en-CA')

  const { data: existing } = await supabase
    .from('meal_logs')
    .select('id')
    .eq('recipe_id', payload.recipe_id)
    .eq('household_id', payload.household_id)
    .eq('made_at', madeAt)
    .maybeSingle()

  if (existing) return { data: { id: existing.id }, error: null }

  const { data, error } = await supabase
    .from('meal_logs')
    .insert({
      recipe_id: payload.recipe_id,
      household_id: payload.household_id,
      made_by_member_id: member.id,
      made_at: madeAt,
      notes: payload.notes ?? null,
    })
    .select('id')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: { id: data.id }, error: null }
}

type MealLogRow = {
  id: string
  household_id: string
  recipe_id: string
  made_by_member_id: string
  made_at: string
  notes: string | null
  recipes: { name: string } | null
  household_members: { nickname: string } | null
}

export async function getMealLogsForRecipe(
  supabase: SupabaseClient,
  recipeId: string,
  limit = 5,
): Promise<{ data: MealLog[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('meal_logs')
    .select('id, household_id, recipe_id, made_by_member_id, made_at, notes, recipes(name), household_members(nickname)')
    .eq('recipe_id', recipeId)
    .order('made_at', { ascending: false })
    .limit(limit)

  if (error) return { data: null, error: error.message }

  const logs: MealLog[] = ((data ?? []) as unknown as MealLogRow[]).map((row) => ({
    id: row.id,
    household_id: row.household_id,
    recipe_id: row.recipe_id,
    recipe_name: row.recipes?.name ?? '',
    made_by_member_id: row.made_by_member_id,
    made_by_name: row.household_members?.nickname ?? 'Someone',
    made_at: row.made_at,
    notes: row.notes,
  }))

  return { data: logs, error: null }
}

type CalendarMealLogRow = {
  made_at: string
  recipes: { name: string } | null
  household_members: { nickname: string } | null
}

type CalendarBillRow = {
  due_day_of_month: number
  description: string
  color: string | null
}

export async function getCalendarData(
  supabase: SupabaseClient,
  householdId: string,
  year: number,
  month: number,
): Promise<{ data: CalendarData | null; error: string | null }> {
  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDayDate = new Date(year, month + 1, 0)
  const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

  const [logsResult, billsResult, receiptsResult, eventsResult] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('made_at, recipes(name), household_members(nickname)')
      .eq('household_id', householdId)
      .gte('made_at', firstDay)
      .lte('made_at', lastDay)
      .order('made_at', { ascending: true }),

    supabase
      .from('recurring_expenses')
      .select('due_day_of_month, description, color')
      .eq('household_id', householdId)
      .eq('is_active', true),

    supabase
      .from('receipts')
      .select('receipt_date, merchant_name')
      .eq('household_id', householdId)
      .not('receipt_date', 'is', null)
      .gte('receipt_date', firstDay)
      .lte('receipt_date', lastDay),

    supabase
      .from('household_events')
      .select('id, date, title, note')
      .eq('household_id', householdId)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .order('date', { ascending: true }),
  ])

  if (logsResult.error) return { data: null, error: logsResult.error.message }
  if (billsResult.error) return { data: null, error: billsResult.error.message }

  const meal_logs = ((logsResult.data ?? []) as unknown as CalendarMealLogRow[]).map((row) => ({
    date: row.made_at,
    recipe_name: row.recipes?.name ?? '',
    made_by_name: row.household_members?.nickname ?? 'Someone',
  }))

  const bill_dots = ((billsResult.data ?? []) as unknown as CalendarBillRow[]).map((row) => ({
    due_day: row.due_day_of_month,
    description: row.description,
    color: row.color ?? '#ef4444',
  }))

  const receipt_dots: CalendarReceiptDot[] = (receiptsResult.data ?? []).map((row) => ({
    date: row.receipt_date as string,
    merchant_name: row.merchant_name as string | null,
  }))

  const custom_events: CalendarCustomEvent[] = (eventsResult.data ?? []).map((row) => ({
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    note: row.note as string | null,
  }))

  return { data: { meal_logs, bill_dots, receipt_dots, custom_events }, error: null }
}
