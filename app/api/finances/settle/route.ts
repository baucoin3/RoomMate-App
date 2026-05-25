import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { split_ids, household_id } = body as {
      split_ids?: unknown
      household_id?: string
    }

    if (!Array.isArray(split_ids) || split_ids.length === 0 || !household_id) {
      return NextResponse.json({ error: FINANCES.ERRORS.SPLIT_IDS_REQUIRED }, { status: 400 })
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

    const { data: splitRows, error: fetchErr } = await supabase
      .from('expense_splits')
      .select(`
        id,
        expenses!inner ( paid_by_member_id )
      `)
      .in('id', split_ids as string[])

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 })

    type SplitVerifyRow = { id: string; expenses: { paid_by_member_id: string } }
    const unauthorized = (splitRows as unknown as SplitVerifyRow[]).some(
      (s) => s.expenses.paid_by_member_id !== currentMemberId,
    )
    if (unauthorized) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_YOUR_EXPENSE }, { status: 403 })
    }

    const { error: updateErr } = await supabase
      .from('expense_splits')
      .update({ is_settled: true })
      .in('id', split_ids as string[])
      .eq('is_settled', false)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
