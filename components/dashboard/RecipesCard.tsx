import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'

function BookIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

interface RecipesCardProps {
  householdId: string
}

export default function RecipesCard({ householdId }: RecipesCardProps) {
  return (
    <Link
      href={ROUTES.HOUSEHOLD_RECIPES(householdId)}
      className="flex items-center gap-4 rounded-2xl bg-[#1c1c24] p-5 hover:bg-white/5 transition-colors group"
    >
      <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors shrink-0">
        <BookIcon />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{HOUSEHOLD_DASHBOARD.RECIPES.TITLE}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{HOUSEHOLD_DASHBOARD.RECIPES.SUBTITLE}</p>
      </div>
      <span className="text-[11px] text-indigo-400 group-hover:text-indigo-300 transition-colors shrink-0">
        {HOUSEHOLD_DASHBOARD.RECIPES.VIEW_ALL}
      </span>
    </Link>
  )
}
