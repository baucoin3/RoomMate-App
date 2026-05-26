import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveGuests, createGuest } from '@/lib/services/guests'
import { GUESTS, ERRORS } from '@/locales/en'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: GUESTS.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: GUESTS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getActiveGuests(supabase, householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      household_id: string
      name: string
      email?: string | null
      expires_at?: string | null
    }

    if (!body.household_id) {
      return NextResponse.json({ error: GUESTS.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: GUESTS.ERRORS.NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', body.household_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: GUESTS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await createGuest(supabase, body.household_id, membership.id, {
      name: body.name,
      email: body.email,
      expires_at: body.expires_at,
    })

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
