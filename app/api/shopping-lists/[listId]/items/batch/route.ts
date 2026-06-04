import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, SHOPPING, ERRORS } from '@/locales/en'
import { addItemsToList } from '@/lib/services/shopping'

interface RouteParams {
  params: { listId: string }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body: unknown = await request.json()
    const { items } = body as {
      items?: { name?: string; quantity?: number | null; unit?: string | null }[]
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: SHOPPING.ERRORS.BATCH_ADD_FAILED }, { status: 400 })
    }

    const invalid = items.some((item) => !item.name?.trim())
    if (invalid) {
      return NextResponse.json({ error: SHOPPING.ERRORS.ITEM_NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const normalised = items.map((item) => ({
      name: (item.name as string).trim(),
      quantity: item.quantity ?? null,
      unit: item.unit?.trim() || null,
    }))

    const { data, skipped, error } = await addItemsToList(supabase, params.listId, normalised)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data, skipped }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
