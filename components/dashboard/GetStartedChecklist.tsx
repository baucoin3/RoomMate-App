import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'
import type { GetStartedStatus } from '@/lib/types/dashboard'

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" />
    </svg>
  )
}

interface ChecklistItemProps {
  label: string
  done: boolean
  href: string
}

function ChecklistItem({ label, done, href }: ChecklistItemProps) {
  return (
    <Link
      href={done ? '#' : href}
      className={`flex items-center gap-3 py-2.5 group ${done ? 'pointer-events-none' : ''}`}
      tabIndex={done ? -1 : 0}
    >
      <span className={done ? 'text-emerald-400' : 'text-white/30 group-hover:text-white/60 transition-colors'}>
        {done ? <CheckIcon /> : <CircleIcon />}
      </span>
      <span className={`text-sm ${done ? 'text-white/40 line-through' : 'text-white/80 group-hover:text-white transition-colors'}`}>
        {label}
      </span>
    </Link>
  )
}

interface GetStartedChecklistProps {
  data: GetStartedStatus
  householdId: string
}

export default function GetStartedChecklist({ data, householdId }: GetStartedChecklistProps) {
  const allDone = data.hasHouseholdName && data.hasRecurringBills && data.hasMultipleMembers
  if (allDone) return null

  const items: ChecklistItemProps[] = [
    {
      label: HOUSEHOLD_DASHBOARD.GET_STARTED.HOUSEHOLD_NAME,
      done: data.hasHouseholdName,
      href: ROUTES.HOUSEHOLD_SETTINGS(householdId),
    },
    {
      label: HOUSEHOLD_DASHBOARD.GET_STARTED.RECURRING_BILLS,
      done: data.hasRecurringBills,
      href: ROUTES.HOUSEHOLD_FINANCES(householdId),
    },
    {
      label: HOUSEHOLD_DASHBOARD.GET_STARTED.INVITE_MEMBERS,
      done: data.hasMultipleMembers,
      href: ROUTES.HOUSEHOLD_SETTINGS(householdId),
    },
  ]

  return (
    <div className="rounded-2xl bg-[#1c1c24] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">
        {HOUSEHOLD_DASHBOARD.GET_STARTED.TITLE}
      </p>
      <div className="divide-y divide-white/5">
        {items.map((item) => (
          <ChecklistItem key={item.label} {...item} />
        ))}
      </div>
    </div>
  )
}
