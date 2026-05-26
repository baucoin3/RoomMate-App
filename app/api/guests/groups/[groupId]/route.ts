import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateGuestGroup, deleteGuestGroup } from '@/lib/services/guests'
import { GUESTS, ERRORS } from '@/locales/en'

async function getMembership(supabase: ReturnType<typeof createClient>, groupId: string, userId: string) {
  const { data: group } = await supabase
    .from('household_guest_groups')
    .select('household_id')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) return null

  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', (group as { household_id: string }).household_id)
    .eq('user_id', userId)
    .maybeSingle()

  return membership
}

export async function PATCH(
  request: Request,
  { params }: { params: { groupId: string } },
) {
  try {
    const { groupId } = params
    const body = await request.json() as {
      name?: string
      expires_at?: string | null
      guest_ids?: string[]
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const membership = await getMembership(supabase, groupId, user.id)
    if (!membership) return NextResponse.json({ error: GUESTS.ERRORS.FORBIDDEN }, { status: 403 })

    const { data, error } = await updateGuestGroup(supabase, groupId, body)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { groupId: string } },
) {
  try {
    const { groupId } = params
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })

    const membership = await getMembership(supabase, groupId, user.id)
    if (!membership) return NextResponse.json({ error: GUESTS.ERRORS.FORBIDDEN }, { status: 403 })

    const { error } = await deleteGuestGroup(supabase, groupId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
