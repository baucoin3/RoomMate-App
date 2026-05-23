import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getListsForHousehold } from '@/lib/services/shopping'
import ShopClient from './ShopClient'

interface ShoppingPageProps {
  params: { householdId: string }
}

export default async function ShoppingPage({ params }: ShoppingPageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const { data: lists } = await getListsForHousehold(supabase, params.householdId, user.id)

  return (
    <ShopClient
      initialLists={lists ?? []}
      householdId={params.householdId}
      currentUserId={user.id}
    />
  )
}
