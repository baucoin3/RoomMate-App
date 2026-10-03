import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, SHOPPING, ERRORS } from '@/locales/en'
import { getCommonShoppingItems, createCommonShoppingItem } from '@/lib/services/shopping'
import { getMemberIdForUser } from '@/lib/services/finances'

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

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: SHOPPING.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getCommonShoppingItems(supabase, householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    const body: unknown = await request.json()
    const { name, color } = body as { name?: string; color?: string }

    if (!householdId) {
      return NextResponse.json({ error: SHOPPING.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: SHOPPING.ERRORS.ITEM_NAME_REQUIRED }, { status: 400 })
    }
    if (!color?.trim()) {
      return NextResponse.json({ error: SHOPPING.ERRORS.CREATE_COMMON_ITEM }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: SHOPPING.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await createCommonShoppingItem(supabase, {
      household_id: householdId,
      name: name.trim(),
      color: color.trim(),
      created_by: user.id,
    })
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
