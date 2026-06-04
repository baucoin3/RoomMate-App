import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS } from '@/locales/en'

interface RouteParams {
  params: { householdId: string; eventId: string }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    }
    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { error } = await supabase
      .from('household_events')
      .delete()
      .eq('id', params.eventId)
      .eq('household_id', params.householdId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: { id: params.eventId } })
  } catch (err) {
    console.error('[dashboard/events/DELETE]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
