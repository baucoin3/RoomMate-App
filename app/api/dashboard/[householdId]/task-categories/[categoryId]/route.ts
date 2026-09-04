import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS, DAILY_TASKS } from '@/locales/en'
import { deleteTaskCategory } from '@/lib/services/taskCategories'

interface RouteParams {
  params: { householdId: string; categoryId: string }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { error, inUse } = await deleteTaskCategory(
      supabase,
      params.householdId,
      params.categoryId,
    )

    if (inUse) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_IN_USE }, { status: 409 })
    }
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: { id: params.categoryId } })
  } catch (err) {
    console.error('[task-categories/DELETE]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
