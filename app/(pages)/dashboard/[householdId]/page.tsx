import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { RECEIPTS } from '@/locales/en'
import { MOCK_DASHBOARD_DATA } from '@/lib/mock/dashboard'
import { getDashboardData } from '@/lib/services/dashboard'
import RentStatusCard from '@/components/dashboard/RentStatusCard'
import BalancesCard from '@/components/dashboard/BalancesCard'
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed'
import {
  RentStatusSkeleton,
  BalancesSkeleton,
  ActivitySkeleton,
} from '@/components/dashboard/DashboardSkeleton'

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  )
}

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
    ? await getDashboardData(supabase, params.householdId, membership.id)
    : { data: null, error: null }

  const data = dashboardResult.data ?? MOCK_DASHBOARD_DATA
  // const data = MOCK_DASHBOARD_DATA

  return (
    <div className="flex flex-col gap-4 pt-1 pb-20 md:pb-4">
      <Suspense fallback={<RentStatusSkeleton />}>
        <RentStatusCard data={data.rentStatus} />
      </Suspense>

      <Suspense fallback={<BalancesSkeleton />}>
        <BalancesCard data={data.balances} />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivityFeed data={data.recentActivity} />
      </Suspense>

      <Link
        href={ROUTES.RECEIPT_NEW(params.householdId)}
        aria-label={RECEIPTS.FAB_ARIA}
        className="fixed bottom-24 right-5 md:bottom-6 md:right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-500 transition-all active:scale-95"
      >
        <CameraIcon className="h-6 w-6" />
      </Link>
    </div>
  )
}
