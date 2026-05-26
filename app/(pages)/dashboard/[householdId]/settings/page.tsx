'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ExpenseCategory, RecurringExpense, HouseholdMemberSummary } from '@/lib/types/finances'
import type { HouseholdItem } from '@/lib/types/householdItems'
import { FINANCES, SETTINGS, GUESTS } from '@/locales/en'
import CategoriesSection from '../finances/components/settings/CategoriesSection'
import ItemRulesSection from '../finances/components/settings/ItemRulesSection'
import RecurringSection from '../finances/components/settings/RecurringSection'
import GuestsSection from '@/components/guests/GuestsSection'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`h-4 w-4 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

interface AccordionSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function AccordionSection({ title, defaultOpen = false, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl bg-[#1c1c24] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white">{title}</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { householdId } = useParams<{ householdId: string }>()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [householdItems, setHouseholdItems] = useState<HouseholdItem[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [members, setMembers] = useState<HouseholdMemberSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError('')
      try {
        const [catsRes, itemsRes, recurringRes, membersRes] = await Promise.all([
          apiClient.get<{ data: ExpenseCategory[] }>(`/api/finances/categories?householdId=${householdId}`),
          apiClient.get<{ data: HouseholdItem[] }>(`/api/household-items/list?householdId=${householdId}`),
          apiClient.get<{ data: RecurringExpense[] }>(`/api/finances/recurring?householdId=${householdId}`),
          apiClient.get<{ data: HouseholdMemberSummary[] }>(`/api/households/${householdId}/members`),
        ])
        if (!cancelled) {
          setCategories(catsRes.data.data ?? [])
          setHouseholdItems(itemsRes.data.data ?? [])
          setRecurring(recurringRes.data.data ?? [])
          setMembers(membersRes.data.data ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchAll()
    return () => { cancelled = true }
  }, [householdId])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 pt-1 pb-24 md:pb-6">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-white">{SETTINGS.TITLE}</h2>
          <p className="text-xs text-white/40 mt-0.5">{SETTINGS.SUBTITLE}</p>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="pt-1 pb-24 md:pb-6">
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pt-1 pb-24 md:pb-6">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-white">{SETTINGS.TITLE}</h2>
        <p className="text-xs text-white/40 mt-0.5">{SETTINGS.SUBTITLE}</p>
      </div>

      <AccordionSection title={FINANCES.SETTINGS.RECURRING_TITLE}>
        <RecurringSection
          householdId={householdId}
          recurring={recurring}
          members={members}
          onRecurringChanged={(updater) => setRecurring(updater)}
        />
      </AccordionSection>

      <AccordionSection title={FINANCES.SETTINGS.CATEGORIES_TITLE} defaultOpen>
        <CategoriesSection
          householdId={householdId}
          categories={categories}
          members={members}
          onCategoriesChanged={(updater) => setCategories(updater)}
        />
      </AccordionSection>

      <AccordionSection title={FINANCES.SETTINGS.HOUSEHOLD_ITEMS_TITLE}>
        <ItemRulesSection
          householdId={householdId}
          items={householdItems}
          categories={categories}
          members={members}
          onItemsChanged={(updater) => setHouseholdItems(updater)}
        />
      </AccordionSection>

      <AccordionSection title={GUESTS.SECTION_TITLE}>
        <GuestsSection householdId={householdId} />
      </AccordionSection>
    </div>
  )
}
