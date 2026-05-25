import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { ERRORS } from '@/locales/en'
import { getReceiptDetail } from '@/lib/services/receipts'
import ReceiptDetailClient from '@/components/receipts/ReceiptDetailClient'

interface ReceiptDetailPageProps {
  params: { householdId: string; receiptId: string }
}

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', params.householdId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect(ROUTES.DASHBOARD)

  const receipt = await getReceiptDetail(supabase, params.householdId, params.receiptId)

  if (!receipt) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/40">
        <p>{ERRORS.NOT_FOUND}</p>
      </div>
    )
  }

  return (
    <ReceiptDetailClient receipt={receipt} householdId={params.householdId} />
  )
}
