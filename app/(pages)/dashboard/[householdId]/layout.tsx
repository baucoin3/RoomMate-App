import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import HouseholdShell from '@/components/household/HouseholdShell'

interface HouseholdLayoutProps {
  children: React.ReactNode
  params: { householdId: string }
}

export default async function HouseholdLayout({ children, params }: HouseholdLayoutProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const { data: membership } = await supabase
    .from('household_members')
    .select('id, nickname')
    .eq('household_id', params.householdId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect(ROUTES.DASHBOARD)

  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', params.householdId)
    .single()

  const userName = (user.user_metadata?.full_name as string | undefined) ?? null
  const userNickname = membership.nickname ?? null
  const displayInitial = (userNickname ?? userName ?? user.email ?? '?').charAt(0).toUpperCase()

  return (
    <HouseholdShell
      householdId={params.householdId}
      householdName={household?.name ?? ''}
      userInitial={displayInitial}
      userEmail={user.email ?? ''}
      userName={userName}
      userNickname={userNickname}
    >
      {children}
    </HouseholdShell>
  )
}
