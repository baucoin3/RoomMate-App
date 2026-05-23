import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { category_id, with_member_id, household_id } = body as {
      category_id?: string
      with_member_id?: string
      household_id?: string
    }

    if (!category_id || !with_member_id || !household_id) {
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

    const { data: expenseIds, error: expFetchErr } = await supabase
      .from('expenses')
      .select('id')
      .eq('household_id', household_id)
      .eq('category_id', category_id)
      .eq('paid_by_member_id', with_member_id)

    if (expFetchErr) return NextResponse.json({ error: expFetchErr.message }, { status: 400 })

    const ids = (expenseIds ?? []).map((e: { id: string }) => e.id)

    if (ids.length > 0) {
      const { error: updateErr } = await supabase
        .from('expense_splits')
        .update({ is_settled: true })
        .in('expense_id', ids)
        .eq('household_member_id', currentMemberId)
        .eq('is_settled', false)

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
