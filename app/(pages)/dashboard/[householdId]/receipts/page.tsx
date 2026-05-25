import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { RECEIPTS } from '@/locales/en'
import { getReceiptLedger } from '@/lib/services/receipts'
import LedgerHeader from '@/components/receipts/LedgerHeader'
import ReceiptCard from '@/components/receipts/ReceiptCard'

interface ReceiptsPageProps {
  params: { householdId: string }
}

export default async function ReceiptsPage({ params }: ReceiptsPageProps) {
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

  const { data: receipts, error: ledgerError } = await getReceiptLedger(
    supabase,
    params.householdId,
  )
  if (ledgerError) {
    console.error('[ReceiptsPage] getReceiptLedger', ledgerError)
  }
  const items = receipts ?? []

  return (
    <div className="flex flex-col pt-1 pb-24 md:pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">{RECEIPTS.TITLE}</h1>
        <Link
          href={ROUTES.RECEIPT_NEW(params.householdId)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 transition-colors"
        >
          + {RECEIPTS.SCAN_TITLE}
        </Link>
      </div>

      {ledgerError && (
        <p className="text-red-400 text-sm mb-4" role="alert">
          {RECEIPTS.ERRORS.LOAD}
        </p>
      )}

      {items.length > 0 && <LedgerHeader receipts={items} />}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <p>{RECEIPTS.EMPTY}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((receipt) => (
            <ReceiptCard key={receipt.id} receipt={receipt} />
          ))}
        </div>
      )}
    </div>
  )
}
