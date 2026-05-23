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
    const { name, paid_by_member_id } = body as {
      name?: string
      paid_by_member_id?: string | null
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('expense_categories')
      .select('id, household_id')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const memberId = await getMemberIdForUser(supabase, existing.household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (paid_by_member_id !== undefined) updates.paid_by_member_id = paid_by_member_id

    const { data, error } = await supabase
      .from('expense_categories')
      .update(updates)
      .eq('id', params.id)
      .select('id, household_id, name, paid_by_member_id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

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
      .from('expense_categories')
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

    const [{ count: expenseCount }, { count: recurringCount }] = await Promise.all([
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('category_id', params.id),
      supabase.from('recurring_expenses').select('id', { count: 'exact', head: true }).eq('category_id', params.id),
    ])

    if ((expenseCount ?? 0) > 0 || (recurringCount ?? 0) > 0) {
      return NextResponse.json({ error: FINANCES.ERRORS.DELETE_CATEGORY_CONFLICT }, { status: 409 })
    }

    const { error } = await supabase.from('expense_categories').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: null }, { status: 200 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
