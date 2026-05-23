import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeReceipt } from '@/lib/services/receipts'
import { RECEIPTS } from '@/locales/en'
import { ERRORS } from '@/locales/en'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { image_url?: string; household_id?: string }
    const { image_url, household_id } = body

    if (!household_id) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }
    if (!image_url) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.IMAGE_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: RECEIPTS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data: categories, error: catError } = await supabase
      .from('expense_categories')
      .select('id, name')
      .eq('household_id', household_id)

    if (catError) {
      return NextResponse.json({ error: catError.message }, { status: 400 })
    }

    const categoryNames = (categories ?? []).map((c: { id: string; name: string }) => c.name)
    const analysis = await analyzeReceipt(image_url, categoryNames)

    return NextResponse.json({ data: analysis })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
