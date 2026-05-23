import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getReceiptLedger, saveReceipt } from '@/lib/services/receipts'
import { RECEIPTS, ERRORS } from '@/locales/en'
import type { SaveReceiptPayload } from '@/lib/types/receipts'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getReceiptLedger(supabase, householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as SaveReceiptPayload

    if (!body.household_id) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }
    if (!body.raw_total || !body.paid_by_member_id) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', body.household_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await saveReceipt(supabase, body)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
