import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { removeGuestFromGroup } from '@/lib/services/guests'
import { GUESTS, ERRORS } from '@/locales/en'

export async function DELETE(
  _request: Request,
  { params }: { params: { groupId: string; guestId: string } },
) {
  try {
    const { groupId, guestId } = params

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

    const { error } = await removeGuestFromGroup(supabase, groupId, guestId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
