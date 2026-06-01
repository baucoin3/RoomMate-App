import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CRON_SECRET } from '@/lib/config'
import { getBillRemindersForToday, sendBillReminderEmails } from '@/lib/services/billReminderEmails'

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const targets = await getBillRemindersForToday(supabase)
    await sendBillReminderEmails(targets)
    return NextResponse.json({ sent: targets.length })
  } catch (err) {
    console.error('[cron/bill-reminders] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
