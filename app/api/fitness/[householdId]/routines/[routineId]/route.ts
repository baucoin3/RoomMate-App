import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { updateRoutine, deleteRoutine } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function PATCH(
  request: Request,
  { params }: { params: { householdId: string; routineId: string } },
) {
  try {
    const { householdId, routineId } = params
    const body = await request.json() as { name?: string; is_active?: boolean }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.UPDATE_ROUTINE }, { status: 403 })
    }

    const routine = await updateRoutine(supabase, routineId, user.id, body)
    return NextResponse.json({ data: routine })
  } catch (err) {
    console.error('[fitness/routines PATCH]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.UPDATE_ROUTINE }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { householdId: string; routineId: string } },
) {
  try {
    const { householdId, routineId } = params
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.DELETE_ROUTINE }, { status: 403 })
    }

    await deleteRoutine(supabase, routineId, user.id)
    return NextResponse.json({ data: null })
  } catch (err) {
    console.error('[fitness/routines DELETE]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.DELETE_ROUTINE }, { status: 500 })
  }
}
