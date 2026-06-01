import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'

interface RouteContext {
  params: { id: string }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body: unknown = await request.json()
    const {
      description,
      amount,
      category_id,
      paid_by_member_id,
      due_day_of_month,
      alert_days_before,
      is_active,
      splits,
      color,
    } = body as {
      description?: string
      amount?: number
      category_id?: string | null
      paid_by_member_id?: string
      due_day_of_month?: number
      alert_days_before?: number
      is_active?: boolean
      splits?: { household_member_id: string; percentage: number; amount: number }[]
      color?: string
    }

    if (amount !== undefined && Number(amount) <= 0) {
      return NextResponse.json({ error: FINANCES.ERRORS.AMOUNT_POSITIVE }, { status: 400 })
    }
    if (due_day_of_month !== undefined && (due_day_of_month < 1 || due_day_of_month > 31)) {
      return NextResponse.json({ error: FINANCES.ERRORS.DUE_DAY_RANGE }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from('recurring_expenses')
      .select('id, household_id, amount')
      .eq('id', params.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const memberId = await getMemberIdForUser(supabase, existing.household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    if (Array.isArray(splits) && splits.length > 0) {
      const pctTotal = splits.reduce((sum, s) => sum + Number(s.percentage), 0)
      if (Math.abs(pctTotal - 100) > 0.01) {
        return NextResponse.json({ error: FINANCES.ERRORS.SPLITS_SUM }, { status: 422 })
      }
      const effectiveTotal = amount !== undefined ? Number(amount) : Number(existing.amount)
      const amtTotal = splits.reduce((sum, s) => sum + Number(s.amount), 0)
      if (Math.abs(amtTotal - effectiveTotal) > 0.01) {
        return NextResponse.json({ error: FINANCES.ERRORS.SPLITS_AMOUNT_SUM }, { status: 422 })
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (description !== undefined) updates.description = description.trim()
    if (amount !== undefined) updates.amount = amount
    if (category_id !== undefined) updates.category_id = category_id
    if (paid_by_member_id !== undefined) updates.paid_by_member_id = paid_by_member_id
    if (due_day_of_month !== undefined) updates.due_day_of_month = due_day_of_month
    if (alert_days_before !== undefined) updates.alert_days_before = alert_days_before
    if (is_active !== undefined) updates.is_active = is_active
    if (color !== undefined && /^#[0-9a-fA-F]{6}$/.test(color)) updates.color = color

    const { data, error } = await supabase
      .from('recurring_expenses')
      .update(updates)
      .eq('id', params.id)
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (Array.isArray(splits) && splits.length > 0) {
      const { error: deleteError } = await supabase
        .from('recurring_expense_splits')
        .delete()
        .eq('recurring_expense_id', params.id)

      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

      const splitRows = splits.map((s) => ({
        recurring_expense_id: params.id,
        household_member_id: s.household_member_id,
        percentage: s.percentage,
        amount: s.amount,
      }))

      const { error: insertError } = await supabase.from('recurring_expense_splits').insert(splitRows)
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from('recurring_expenses')
      .select('id, household_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const memberId = await getMemberIdForUser(supabase, existing.household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { error: splitsError } = await supabase
      .from('recurring_expense_splits')
      .delete()
      .eq('recurring_expense_id', params.id)

    if (splitsError) return NextResponse.json({ error: splitsError.message }, { status: 400 })

    const { error } = await supabase
      .from('recurring_expenses')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
