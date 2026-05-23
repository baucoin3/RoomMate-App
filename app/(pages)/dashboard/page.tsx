import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { HOUSEHOLDS } from '@/locales/en'
import HouseholdCard from '@/components/HouseholdCard'
import DashboardHeader from '@/components/DashboardHeader'
import TopNav from '@/components/TopNav'
import { getHouseholdsForUser } from '@/lib/services/households'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const userName = (user.user_metadata?.full_name as string | undefined) ?? null
  
  const { data: households, error } = await getHouseholdsForUser(supabase, user.id)

  return (
    <>
      <TopNav userEmail={user.email ?? ''} userName={userName} />
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <DashboardHeader />
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {HOUSEHOLDS.ERRORS.LOAD}
          </div>
        )}

        {!error && (households ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
              <svg
                className="h-6 w-6 text-indigo-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">{HOUSEHOLDS.EMPTY_STATE}</p>
            <p className="mt-1 text-xs text-gray-500">{HOUSEHOLDS.EMPTY_STATE_CTA}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(households ?? []).map((household) => (
              <HouseholdCard key={household.id} household={household} />
            ))}
          </div>
        )}
      </div>
    </main>
    </>
  )
}
