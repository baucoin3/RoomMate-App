import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'
import { upsertAlias } from '@/lib/services/householdItems'

interface RouteContext {
  params: { id: string }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body: unknown = await request.json()
    const { display_text } = body as { display_text?: string }

    if (!display_text?.trim()) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: item } = await supabase
      .from('household_items')
      .select('id, household_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!item) {
      return NextResponse.json({ error: FINANCES.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const memberId = await getMemberIdForUser(supabase, item.household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await upsertAlias(supabase, {
      household_id: item.household_id,
      household_item_id: item.id,
      display_text: display_text.trim(),
    })

    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
