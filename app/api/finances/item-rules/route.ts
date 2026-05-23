import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getItemRulesForHousehold, getMemberIdForUser } from '@/lib/services/finances'

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

    const { data, error } = await getItemRulesForHousehold(supabase, householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { name, category_id, item_group, split_overrides, household_id } = body as {
      name?: string
      category_id?: string
      item_group?: string | null
      split_overrides?: { member_id: string; percentage: number }[] | null
      household_id?: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }
    if (!household_id) {
      return NextResponse.json({ error: FINANCES.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
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

    const memberId = await getMemberIdForUser(supabase, household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('household_item_rules')
      .insert({
        household_id,
        name: name.trim(),
        category_id: category_id ?? null,
        item_group: item_group ?? null,
        split_overrides: split_overrides ?? null,
      })
      .select('id, household_id, category_id, name, item_group, split_overrides')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
