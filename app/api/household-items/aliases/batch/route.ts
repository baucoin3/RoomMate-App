import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { getMemberIdForUser } from '@/lib/services/finances'
import { upsertAliasesBatch } from '@/lib/services/householdItems'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { household_id, aliases } = body as {
      household_id?: string
      aliases?: Array<{ household_item_id: string; display_text: string }>
    }

    if (!household_id) {
      return NextResponse.json({ error: FINANCES.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }

    if (!Array.isArray(aliases)) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, household_id, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { error } = await upsertAliasesBatch(supabase, household_id, aliases)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
