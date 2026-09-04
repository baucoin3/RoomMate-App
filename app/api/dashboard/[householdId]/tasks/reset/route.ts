import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS } from '@/locales/en'
import { resetDailyTasksForToday } from '@/lib/services/dailyTasks'

interface RouteParams {
  params: { householdId: string }
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

    const { error } = await resetDailyTasksForToday(supabase, params.householdId, user.id)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch (err) {
    console.error('[tasks/reset/DELETE]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
