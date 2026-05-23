import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'

interface RouteContext {
  params: { id: string }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const body: unknown = await request.json()
    const { splits } = body as {
      splits?: { household_member_id: string; percentage: number }[]
    }

    if (!Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const total = splits.reduce((sum, s) => sum + Number(s.percentage), 0)
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json({ error: FINANCES.ERRORS.SPLITS_SUM }, { status: 422 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: category } = await supabase
      .from('expense_categories')
      .select('id, household_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!category) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const memberId = await getMemberIdForUser(supabase, category.household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('category_splits')
      .delete()
      .eq('category_id', params.id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

    const rows = splits.map((s) => ({
      category_id: params.id,
      household_member_id: s.household_member_id,
      percentage: s.percentage,
    }))

    const { data, error } = await supabase
      .from('category_splits')
      .insert(rows)
      .select('id, category_id, household_member_id, percentage')

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
