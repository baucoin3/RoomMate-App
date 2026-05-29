import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { ERRORS } from '@/locales/en'
import { getDashboardData } from '@/lib/services/dashboard'
import QuickActionsRow from '@/components/dashboard/QuickActionsRow'
import GetStartedChecklist from '@/components/dashboard/GetStartedChecklist'
import RecurringBillAlerts from '@/components/dashboard/RecurringBillAlerts'
import RecipesCard from '@/components/dashboard/RecipesCard'
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed'
import {
  QuickActionsSkeleton,
  GetStartedSkeleton,
  BillAlertsSkeleton,
  ActivitySkeleton,
} from '@/components/dashboard/DashboardSkeleton'

interface HouseholdHubPageProps {
  params: { householdId: string }
}

export default async function HouseholdHubPage({ params }: HouseholdHubPageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', params.householdId)
    .eq('user_id', user.id)
    .maybeSingle()

  const dashboardResult = membership
    ? await getDashboardData(supabase, params.householdId)
    : { data: null, error: null }

  if (!dashboardResult.data) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 mt-4">
        <p className="text-sm text-red-400">{dashboardResult.error ?? ERRORS.GENERIC}</p>
      </div>
    )
  }

  const data = dashboardResult.data

  return (
    <div className="flex flex-col gap-4 pt-1 pb-20 md:pb-4">
      <Suspense fallback={<QuickActionsSkeleton />}>
        <QuickActionsRow householdId={params.householdId} />
      </Suspense>

      <Suspense fallback={<GetStartedSkeleton />}>
        <GetStartedChecklist data={data.getStarted} householdId={params.householdId} />
      </Suspense>

      <Suspense fallback={<BillAlertsSkeleton />}>
        <RecurringBillAlerts alerts={data.recurringAlerts} householdId={params.householdId} />
      </Suspense>

      <RecipesCard householdId={params.householdId} />

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivityFeed data={data.recentActivity} />
      </Suspense>
    </div>
  )
}
