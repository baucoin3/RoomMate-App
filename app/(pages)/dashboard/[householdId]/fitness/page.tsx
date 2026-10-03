import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import FitnessClient from '@/components/fitness/FitnessClient'

interface FitnessPageProps {
  params: { householdId: string }
}

export default async function FitnessPage({ params }: FitnessPageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  return <FitnessClient householdId={params.householdId} userId={user.id} />
}
