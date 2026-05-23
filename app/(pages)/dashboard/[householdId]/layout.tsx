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

  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', params.householdId)
    .single()

  const userName = (user.user_metadata?.full_name as string | undefined) ?? null
  const userInitial = (userName ?? user.email ?? '?').charAt(0).toUpperCase()

  return (
    <HouseholdShell
      householdId={params.householdId}
      householdName={household?.name ?? ''}
      userInitial={userInitial}
      userEmail={user.email ?? ''}
      userName={userName}
    >
      {children}
    </HouseholdShell>
  )
}
