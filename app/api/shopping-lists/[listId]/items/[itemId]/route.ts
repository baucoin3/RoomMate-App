import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, SHOPPING, ERRORS } from '@/locales/en'

interface RouteParams {
  params: { listId: string; itemId: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const body: unknown = await request.json()
    const { is_checked, name, quantity, unit } = body as {
      is_checked?: boolean
      name?: string
      quantity?: number | null
      unit?: string | null
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const updates: Record<string, unknown> = {}
    if (is_checked !== undefined) updates.is_checked = is_checked
    if (name !== undefined) updates.name = name.trim()
    if (quantity !== undefined) updates.quantity = quantity
    if (unit !== undefined) updates.unit = unit?.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('shopping_list_items')
      .update(updates)
      .eq('id', params.itemId)
      .eq('shopping_list_id', params.listId)
      .select('id, shopping_list_id, name, quantity, unit, is_checked, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data) return NextResponse.json({ error: SHOPPING.ERRORS.NOT_FOUND }, { status: 404 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', params.itemId)
      .eq('shopping_list_id', params.listId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: { id: params.itemId } })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
