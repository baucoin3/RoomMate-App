import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { createExercise } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'
import type { FitnessExercise } from '@/lib/types/fitness'

export async function POST(
  request: Request,
  { params }: { params: { householdId: string } },
) {
  try {
    const { householdId } = params
    const body = await request.json() as Partial<Omit<FitnessExercise, 'id' | 'created_at'>>

    if (!body.name?.trim()) {
      return NextResponse.json({ error: FITNESS.ERRORS.NAME_REQUIRED }, { status: 400 })
    }
    if (!body.routine_id) {
      return NextResponse.json({ error: FITNESS.ERRORS.CREATE_EXERCISE }, { status: 400 })
    }
    if ((body.sets ?? 0) < 1) {
      return NextResponse.json({ error: FITNESS.ERRORS.SETS_INVALID }, { status: 400 })
    }
    if ((body.reps ?? 0) < 1) {
      return NextResponse.json({ error: FITNESS.ERRORS.REPS_INVALID }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.CREATE_EXERCISE }, { status: 403 })
    }

    const exercise = await createExercise(supabase, {
      routine_id: body.routine_id,
      name: body.name.trim(),
      sets: body.sets ?? 3,
      reps: body.reps ?? 10,
      weight: body.weight ?? null,
      weight_unit: body.weight_unit ?? 'lbs',
      sort_order: body.sort_order ?? 0,
    })
    return NextResponse.json({ data: exercise }, { status: 201 })
  } catch (err) {
    console.error('[fitness/exercises POST]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.CREATE_EXERCISE }, { status: 500 })
  }
}
