import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addGuestToGroup } from '@/lib/services/guests'
import { GUESTS, ERRORS } from '@/locales/en'

export async function POST(
  request: Request,
  { params }: { params: { groupId: string } },
) {
  try {
    const { groupId } = params
    const body = await request.json() as { guest_id: string }

    if (!body.guest_id) {
      return NextResponse.json({ error: GUESTS.ERRORS.NOT_FOUND }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const { data: group } = await supabase
      .from('household_guest_groups')
      .select('household_id')
      .eq('id', groupId)
      .maybeSingle()

    if (!group) return NextResponse.json({ error: GUESTS.ERRORS.NOT_FOUND }, { status: 404 })

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', (group as { household_id: string }).household_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ error: GUESTS.ERRORS.FORBIDDEN }, { status: 403 })

    const { error } = await addGuestToGroup(supabase, groupId, body.guest_id)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
