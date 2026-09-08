import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS } from '@/locales/en'
import { getTaskStruggleStats } from '@/lib/services/dailyTasks'

interface RouteParams {
  params: { householdId: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getTaskStruggleStats(supabase, params.householdId, user.id)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ stats: data })
  } catch (err) {
    console.error('[task-stats/GET]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
