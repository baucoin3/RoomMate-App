'use client'

import { useParams } from 'next/navigation'
import OverviewTab from './components/OverviewTab'

export default function FinancesPage() {
  const { householdId } = useParams<{ householdId: string }>()

  return (
    <div className="flex flex-col gap-4 pt-1 pb-24 md:pb-6">
      <OverviewTab householdId={householdId} />
    </div>
  )
}
