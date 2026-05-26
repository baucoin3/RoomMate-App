import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateGuest, deleteGuest } from '@/lib/services/guests'
import { GUESTS, ERRORS } from '@/locales/en'

export async function PATCH(
  request: Request,
  { params }: { params: { guestId: string } },
) {
  try {
    const { guestId } = params
    const body = await request.json() as {
      name?: string
      email?: string | null
      expires_at?: string | null
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const { data: guest } = await supabase
      .from('household_guests')
      .select('household_id')
      .eq('id', guestId)
      .maybeSingle()

    if (!guest) return NextResponse.json({ error: GUESTS.ERRORS.NOT_FOUND }, { status: 404 })

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', (guest as { household_id: string }).household_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ error: GUESTS.ERRORS.FORBIDDEN }, { status: 403 })

    const { data, error } = await updateGuest(supabase, guestId, body)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { guestId: string } },
) {
  try {
    const { guestId } = params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const { data: guest } = await supabase
      .from('household_guests')
      .select('household_id')
      .eq('id', guestId)
      .maybeSingle()

    if (!guest) return NextResponse.json({ error: GUESTS.ERRORS.NOT_FOUND }, { status: 404 })

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', (guest as { household_id: string }).household_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ error: GUESTS.ERRORS.FORBIDDEN }, { status: 403 })

    const { error } = await deleteGuest(supabase, guestId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
