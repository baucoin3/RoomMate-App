import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, SHOPPING, ERRORS } from '@/locales/en'
import { getListsForHousehold } from '@/lib/services/shopping'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: SHOPPING.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await getListsForHousehold(supabase, householdId, user.id)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { name, owner_type, household_id } = body as {
      name?: string
      owner_type?: 'user' | 'household'
      household_id?: string
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: SHOPPING.ERRORS.NAME_REQUIRED }, { status: 400 })
    }
    if (!household_id) {
      return NextResponse.json({ error: SHOPPING.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const resolvedOwnerType = owner_type === 'household' ? 'household' : 'user'

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({
        name: name.trim(),
        owner_type: resolvedOwnerType,
        user_id: resolvedOwnerType === 'user' ? user.id : null,
        household_id,
      })
      .select('id, name, owner_type, user_id, household_id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: { ...data, items: [] } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
