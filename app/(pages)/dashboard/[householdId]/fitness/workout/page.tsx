import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import WorkoutSession from '@/components/fitness/WorkoutSession'

interface WorkoutPageProps {
  params: { householdId: string }
}

export default async function WorkoutPage({ params }: WorkoutPageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  return <WorkoutSession householdId={params.householdId} userId={user.id} />
}
