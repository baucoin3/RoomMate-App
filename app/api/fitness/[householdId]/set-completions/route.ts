import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { upsertSetCompletion } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function PUT(
  request: Request,
  { params }: { params: { householdId: string } },
) {
  try {
    const { householdId } = params
    const body = await request.json() as {
      session_id?: string
      exercise_id?: string
      set_number?: number
      actual_reps?: number | null
      actual_weight?: number | null
    }

    if (!body.session_id || !body.exercise_id || body.set_number == null) {
      return NextResponse.json({ error: FITNESS.ERRORS.SAVE_SET }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.SAVE_SET }, { status: 403 })
    }

    const completion = await upsertSetCompletion(supabase, {
      session_id: body.session_id,
      exercise_id: body.exercise_id,
      set_number: body.set_number,
      actual_reps: body.actual_reps ?? null,
      actual_weight: body.actual_weight ?? null,
    })
    return NextResponse.json({ data: completion })
  } catch (err) {
    console.error('[fitness/set-completions PUT]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.SAVE_SET }, { status: 500 })
  }
}
