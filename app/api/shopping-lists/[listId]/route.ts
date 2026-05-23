import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, SHOPPING, ERRORS } from '@/locales/en'

interface RouteParams {
  params: { listId: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const body: unknown = await request.json()
    const { name } = body as { name?: string }

    if (!name?.trim()) {
      return NextResponse.json({ error: SHOPPING.ERRORS.NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('shopping_lists')
      .select('id, owner_type, user_id, household_id')
      .eq('id', params.listId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: SHOPPING.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('shopping_lists')
      .update({ name: name.trim() })
      .eq('id', params.listId)
      .select('id, name, owner_type, user_id, household_id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

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

    const { data: existing, error: fetchError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('id', params.listId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: SHOPPING.ERRORS.NOT_FOUND }, { status: 404 })
    }

    // Items are deleted via cascade (FK on shopping_list_items.shopping_list_id)
    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', params.listId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data: { id: params.listId } })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
