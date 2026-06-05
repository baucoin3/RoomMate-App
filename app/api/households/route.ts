import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, HOUSEHOLDS, ERRORS } from '@/locales/en'
import { createHousehold, getHouseholdsForUser } from '@/lib/services/households'

export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await getHouseholdsForUser(supabase, user.id)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { name } = body as { name?: string }

    if (!name?.trim()) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const nickname =
      (user.user_metadata?.full_name as string | undefined)?.trim()
      || user.email?.split('@')[0]
      || 'Member'

    const { data, error } = await createHousehold(supabase, name, nickname)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
