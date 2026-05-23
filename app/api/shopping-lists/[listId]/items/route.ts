import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, SHOPPING, ERRORS } from '@/locales/en'
import { getItemsForList } from '@/lib/services/shopping'

interface RouteParams {
  params: { listId: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await getItemsForList(supabase, params.listId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body: unknown = await request.json()
    const { name, quantity, unit } = body as {
      name?: string
      quantity?: number | null
      unit?: string | null
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: SHOPPING.ERRORS.ITEM_NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        shopping_list_id: params.listId,
        name: name.trim(),
        quantity: quantity ?? null,
        unit: unit?.trim() || null,
        is_checked: false,
      })
      .select('id, shopping_list_id, name, quantity, unit, is_checked, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
