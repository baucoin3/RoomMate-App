import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'
import type { RecurringBillAlert } from '@/lib/types/dashboard'

function WarningIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  )
}

function formatUrgency(daysUntilDue: number): { label: string; className: string } {
  if (daysUntilDue < 0) {
    return { label: HOUSEHOLD_DASHBOARD.BILL_ALERTS.OVERDUE, className: 'text-red-400' }
  }
  if (daysUntilDue === 0) {
    return { label: HOUSEHOLD_DASHBOARD.BILL_ALERTS.DUE_TODAY, className: 'text-amber-400' }
  }
  return {
    label: HOUSEHOLD_DASHBOARD.BILL_ALERTS.DUE_IN(daysUntilDue),
    className: daysUntilDue <= 3 ? 'text-amber-400' : 'text-white/50',
  }
}

function AlertRow({ alert }: { alert: RecurringBillAlert }) {
  const urgency = formatUrgency(alert.daysUntilDue)
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(alert.totalAmount)

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-amber-400 shrink-0"><WarningIcon /></span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{alert.description}</p>
          <p className={`text-[11px] mt-0.5 ${urgency.className}`}>{urgency.label}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-white/70 shrink-0 ml-3">{amount}</span>
    </div>
  )
}

interface RecurringBillAlertsProps {
  alerts: RecurringBillAlert[]
  householdId: string
}

export default function RecurringBillAlerts({ alerts, householdId }: RecurringBillAlertsProps) {
  return (
    <div className="rounded-2xl bg-[#1c1c24] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">
        {HOUSEHOLD_DASHBOARD.BILL_ALERTS.TITLE}
      </p>

      {alerts.length === 0 ? (
        <p className="text-sm text-white/40 py-2">{HOUSEHOLD_DASHBOARD.BILL_ALERTS.ALL_CAUGHT_UP}</p>
      ) : (
        <>
          <div className="divide-y divide-white/5">
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>
          <Link
            href={ROUTES.HOUSEHOLD_FINANCES(householdId)}
            className="block mt-3 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {HOUSEHOLD_DASHBOARD.BILL_ALERTS.VIEW_ALL}
          </Link>
        </>
      )}
    </div>
  )
}
