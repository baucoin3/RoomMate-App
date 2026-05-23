import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'

interface RouteContext {
  params: { id: string }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: recurring, error: fetchErr } = await supabase
      .from('recurring_expenses')
      .select(`
        id,
        household_id,
        category_id,
        description,
        amount,
        paid_by_member_id,
        recurring_expense_splits ( household_member_id, percentage )
      `)
      .eq('id', params.id)
      .eq('is_active', true)
      .maybeSingle()

    if (fetchErr || !recurring) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const memberId = await getMemberIdForUser(supabase, recurring.household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    type RecurringRow = {
      id: string
      household_id: string
      category_id: string | null
      description: string
      amount: number
      paid_by_member_id: string
      recurring_expense_splits: { household_member_id: string; percentage: number }[]
    }

    const rec = recurring as unknown as RecurringRow

    const { data: expense, error: expenseErr } = await supabase
      .from('expenses')
      .insert({
        household_id: rec.household_id,
        category_id: rec.category_id,
        description: rec.description,
        total_amount: rec.amount,
        paid_by_member_id: rec.paid_by_member_id,
        date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single()

    if (expenseErr || !expense) {
      return NextResponse.json({ error: expenseErr?.message ?? ERRORS.INTERNAL }, { status: 400 })
    }

    const splitRows = rec.recurring_expense_splits.map((s) => ({
      expense_id: expense.id,
      household_member_id: s.household_member_id,
      percentage_override: s.percentage,
      calculated_amount: Math.round((Number(s.percentage) / 100) * Number(rec.amount) * 100) / 100,
      is_settled: s.household_member_id === rec.paid_by_member_id,
    }))

    const { error: splitsErr } = await supabase.from('expense_splits').insert(splitRows)
    if (splitsErr) {
      await supabase.from('expenses').delete().eq('id', expense.id)
      return NextResponse.json({ error: splitsErr.message }, { status: 400 })
    }

    return NextResponse.json({ data: { expense_id: expense.id } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
