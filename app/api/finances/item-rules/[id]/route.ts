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
    const { name, category_id, item_group, split_overrides } = body as {
      name?: string
      category_id?: string | null
      item_group?: string | null
      split_overrides?: { member_id: string; percentage: number }[] | null
    }

    if (Array.isArray(split_overrides) && split_overrides.length > 0) {
      const total = split_overrides.reduce((sum, s) => sum + Number(s.percentage), 0)
      if (Math.abs(total - 100) > 0.01) {
        return NextResponse.json({ error: FINANCES.ERRORS.SPLITS_SUM }, { status: 422 })
      }
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from('household_item_rules')
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

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (category_id !== undefined) updates.category_id = category_id
    if (item_group !== undefined) updates.item_group = item_group
    if (split_overrides !== undefined) updates.split_overrides = split_overrides

    const { data, error } = await supabase
      .from('household_item_rules')
      .update(updates)
      .eq('id', params.id)
      .select('id, household_id, category_id, name, item_group, split_overrides')
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
      .from('household_item_rules')
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

    const { error } = await supabase.from('household_item_rules').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
