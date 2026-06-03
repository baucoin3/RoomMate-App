import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH, ERRORS, HOUSEHOLDS, FINANCES } from '@/locales/en'
import { getMemberIdForUser, getSettledExpenses } from '@/lib/services/finances'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const householdId = request.nextUrl.searchParams.get('householdId')
    if (!householdId) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getSettledExpenses(supabase, householdId, memberId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[finances/settled/GET]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
