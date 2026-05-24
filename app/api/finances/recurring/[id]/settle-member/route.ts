import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'

interface RouteContext {
  params: { id: string }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body: unknown = await request.json()
    const { household_id, member_id } = body as { household_id?: string; member_id?: string }

    if (!household_id || !member_id) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const currentMemberId = await getMemberIdForUser(supabase, household_id, user.id)
    if (!currentMemberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    // Verify this recurring expense belongs to this household and the current user is the payer
    const { data: recurring, error: recurringErr } = await supabase
      .from('recurring_expenses')
      .select('id, household_id, description, category_id, paid_by_member_id')
      .eq('id', params.id)
      .eq('household_id', household_id)
      .eq('is_active', true)
      .maybeSingle()

    if (recurringErr || !recurring) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    if (recurring.paid_by_member_id !== currentMemberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    // Find the most recently confirmed expense matching this recurring bill
    const { data: latestExpense, error: expenseErr } = await supabase
      .from('expenses')
      .select('id')
      .eq('household_id', household_id)
      .eq('description', recurring.description)
      .eq('paid_by_member_id', recurring.paid_by_member_id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (expenseErr || !latestExpense) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const { error: settleErr } = await supabase
      .from('expense_splits')
      .update({ is_settled: true })
      .eq('expense_id', latestExpense.id)
      .eq('household_member_id', member_id)

    if (settleErr) {
      return NextResponse.json({ error: settleErr.message }, { status: 400 })
    }

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
