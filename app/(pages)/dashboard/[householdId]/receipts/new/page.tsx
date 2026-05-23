import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getCategoriesForHousehold } from '@/lib/services/finances'
import ScanReceiptWizard from '@/components/receipts/ScanReceiptWizard'
import type { ExpenseCategory } from '@/lib/types/finances'
import type { HouseholdItemSummary } from '@/lib/types/receipts'

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

  const [{ data: rawCategories }, { data: rawHouseholdItems }] = await Promise.all([
    getCategoriesForHousehold(supabase, params.householdId),
    supabase
      .from('household_items')
      .select('id, name, default_category_id')
      .eq('household_id', params.householdId)
      .order('name', { ascending: true }),
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

  const householdItems: HouseholdItemSummary[] = (rawHouseholdItems ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    default_category_id: item.default_category_id ?? null,
  }))

  return (
    <ScanReceiptWizard
      householdId={params.householdId}
      memberId={membership.id}
      categories={categories}
      householdItems={householdItems}
    />
  )
}
