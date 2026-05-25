import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, ERRORS } from '@/locales/en'
import { confirmRecurringExpenseForCycle } from '@/lib/services/finances'

interface RouteContext {
  params: { id: string }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error, status } = await confirmRecurringExpenseForCycle(
      supabase,
      params.id,
      user.id,
    )

    if (error) {
      return NextResponse.json({ error }, { status: status ?? 400 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
