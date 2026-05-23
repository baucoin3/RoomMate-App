import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getRecurringExpensesForHousehold, getMemberIdForUser } from '@/lib/services/finances'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: FINANCES.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getRecurringExpensesForHousehold(supabase, householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const {
      description,
      amount,
      category_id,
      paid_by_member_id,
      due_day_of_month,
      alert_days_before,
      splits,
      household_id,
    } = body as {
      description?: string
      amount?: number
      category_id?: string | null
      paid_by_member_id?: string
      due_day_of_month?: number
      alert_days_before?: number
      splits?: { household_member_id: string; percentage: number; amount: number }[]
      household_id?: string
    }

    if (!description?.trim() || amount == null || !paid_by_member_id || !due_day_of_month) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }
    if (!household_id) {
      return NextResponse.json({ error: FINANCES.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }
    if (Number(amount) <= 0) {
      return NextResponse.json({ error: FINANCES.ERRORS.AMOUNT_POSITIVE }, { status: 400 })
    }
    if (due_day_of_month < 1 || due_day_of_month > 31) {
      return NextResponse.json({ error: FINANCES.ERRORS.DUE_DAY_RANGE }, { status: 400 })
    }
    if (!Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const pctTotal = splits.reduce((sum, s) => sum + Number(s.percentage), 0)
    if (Math.abs(pctTotal - 100) > 0.01) {
      return NextResponse.json({ error: FINANCES.ERRORS.SPLITS_SUM }, { status: 422 })
    }

    const amtTotal = splits.reduce((sum, s) => sum + Number(s.amount), 0)
    if (Math.abs(amtTotal - Number(amount)) > 0.01) {
      return NextResponse.json({ error: FINANCES.ERRORS.SPLITS_AMOUNT_SUM }, { status: 422 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data: recurringExpense, error: insertError } = await supabase
      .from('recurring_expenses')
      .insert({
        household_id,
        description: description.trim(),
        amount,
        category_id: category_id ?? null,
        paid_by_member_id,
        due_day_of_month,
        alert_days_before: alert_days_before ?? 3,
      })
      .select('id')
      .single()

    if (insertError || !recurringExpense) {
      return NextResponse.json({ error: insertError?.message ?? ERRORS.INTERNAL }, { status: 400 })
    }

    const splitRows = splits.map((s) => ({
      recurring_expense_id: recurringExpense.id,
      household_member_id: s.household_member_id,
      percentage: s.percentage,
      amount: s.amount,
    }))

    const { error: splitsError } = await supabase.from('recurring_expense_splits').insert(splitRows)
    if (splitsError) {
      await supabase.from('recurring_expenses').delete().eq('id', recurringExpense.id)
      return NextResponse.json({ error: splitsError.message }, { status: 400 })
    }

    return NextResponse.json({ data: { id: recurringExpense.id } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
