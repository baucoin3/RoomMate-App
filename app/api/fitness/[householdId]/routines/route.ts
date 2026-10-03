import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { getRoutines, createRoutine } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function GET(
  _request: Request,
  { params }: { params: { householdId: string } },
) {
  try {
    const { householdId } = params
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_ROUTINES }, { status: 403 })
    }

    const routines = await getRoutines(supabase, householdId, user.id)
    return NextResponse.json({ data: routines })
  } catch (err) {
    console.error('[fitness/routines GET]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.LOAD_ROUTINES }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { householdId: string } },
) {
  try {
    const { householdId } = params
    const body = await request.json() as { name?: string }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: FITNESS.ERRORS.NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.CREATE_ROUTINE }, { status: 403 })
    }

    const routine = await createRoutine(supabase, householdId, user.id, body.name.trim())
    return NextResponse.json({ data: routine }, { status: 201 })
  } catch (err) {
    console.error('[fitness/routines POST]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.CREATE_ROUTINE }, { status: 500 })
  }
}
