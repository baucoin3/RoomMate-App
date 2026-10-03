import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { updateExercise, deleteExercise } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'
import type { FitnessExercise } from '@/lib/types/fitness'

export async function PATCH(
  request: Request,
  { params }: { params: { householdId: string; exerciseId: string } },
) {
  try {
    const { householdId, exerciseId } = params
    const body = await request.json() as Partial<Pick<FitnessExercise, 'name' | 'sets' | 'reps' | 'weight' | 'weight_unit' | 'sort_order'>>

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.UPDATE_EXERCISE }, { status: 403 })
    }

    const exercise = await updateExercise(supabase, exerciseId, body)
    return NextResponse.json({ data: exercise })
  } catch (err) {
    console.error('[fitness/exercises PATCH]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.UPDATE_EXERCISE }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { householdId: string; exerciseId: string } },
) {
  try {
    const { householdId, exerciseId } = params
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.DELETE_EXERCISE }, { status: 403 })
    }

    await deleteExercise(supabase, exerciseId)
    return NextResponse.json({ data: null })
  } catch (err) {
    console.error('[fitness/exercises DELETE]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.DELETE_EXERCISE }, { status: 500 })
  }
}
