import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getListsForHousehold, getCommonShoppingItems } from '@/lib/services/shopping'
import ShopClient from './ShopClient'

interface ShoppingPageProps {
  params: { householdId: string }
}

export default async function ShoppingPage({ params }: ShoppingPageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const [{ data: lists }, { data: commonItems }] = await Promise.all([
    getListsForHousehold(supabase, params.householdId, user.id),
    getCommonShoppingItems(supabase, params.householdId),
  ])

  return (
    <ShopClient
      initialLists={lists ?? []}
      initialCommonItems={commonItems ?? []}
      householdId={params.householdId}
      currentUserId={user.id}
    />
  )
}
