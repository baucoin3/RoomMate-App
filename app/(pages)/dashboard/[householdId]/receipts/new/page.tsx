import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getCategoriesForHousehold } from '@/lib/services/finances'
import { getHouseholdItemsForHousehold } from '@/lib/services/householdItems'
import ScanReceiptWizard from '@/components/receipts/ScanReceiptWizard'
import type { ExpenseCategory } from '@/lib/types/finances'
import type { HouseholdItem } from '@/lib/types/householdItems'

interface NewReceiptPageProps {
  params: { householdId: string }
}

export default async function NewReceiptPage({ params }: NewReceiptPageProps) {
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

  const [{ data: rawCategories }, { data: householdItems }, { data: rawMembers }] =
    await Promise.all([
      getCategoriesForHousehold(supabase, params.householdId),
      getHouseholdItemsForHousehold(supabase, params.householdId),
      supabase
        .from('household_members')
        .select('id, nickname')
        .eq('household_id', params.householdId),
    ])

  const categories = (rawCategories ?? []).map((cat: ExpenseCategory) => ({
    id: cat.id,
    name: cat.name,
    splits: (cat.splits ?? []).map((s) => ({
      household_member_id: s.household_member_id,
      percentage: s.percentage,
      nickname: s.member?.nickname ?? null,
    })),
  }))

  const items: HouseholdItem[] = householdItems ?? []

  const members = (rawMembers ?? []).map((m) => ({
    id: m.id,
    name: m.nickname ?? m.id.slice(0, 8),
  }))

  return (
    <ScanReceiptWizard
      householdId={params.householdId}
      memberId={membership.id}
      categories={categories}
      householdItems={items}
      members={members}
    />
  )
}
