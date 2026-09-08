import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS } from '@/locales/en'

interface RouteParams {
  params: { householdId: string; eventId: string }
}

async function getMembership(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, userId: string) {
  return supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle()
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const body = await request.json() as { completed?: unknown }
    if (typeof body.completed !== 'boolean') {
      return NextResponse.json({ error: 'completed must be a boolean' }, { status: 400 })
    }

    const { data: membership, error: membershipError } = await getMembership(supabase, params.householdId, user.id)
    if (membershipError) return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    if (!membership) return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })

    const { error } = await supabase
      .from('household_events')
      .update({ completed: body.completed })
      .eq('id', params.eventId)
      .eq('household_id', params.householdId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: { id: params.eventId, completed: body.completed } })
  } catch (err) {
    console.error('[dashboard/events/PATCH]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const { data: membership, error: membershipError } = await getMembership(supabase, params.householdId, user.id)
    if (membershipError) return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    if (!membership) return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })

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
