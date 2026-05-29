import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS } from '@/locales/en'
import { getDashboardData } from '@/lib/services/dashboard'

interface RouteParams {
  params: { householdId: string }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('[dashboard/membership]', membershipError)
      return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    }

    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getDashboardData(supabase, params.householdId)

    if (error || !data) {
      return NextResponse.json({ error: error ?? ERRORS.INTERNAL }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[dashboard/GET]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
