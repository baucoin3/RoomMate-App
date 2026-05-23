'use client'

import { useState, useEffect } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ExpenseCategory, HouseholdItemRule, RecurringExpense, HouseholdMemberSummary } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import CategoriesSection from './settings/CategoriesSection'
import ItemRulesSection from './settings/ItemRulesSection'
import RecurringSection from './settings/RecurringSection'

interface SettingsTabProps {
  householdId: string
  members: HouseholdMemberSummary[]
}

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

export default function SettingsTab({ householdId, members }: SettingsTabProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [itemRules, setItemRules] = useState<HouseholdItemRule[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError('')
      try {
        const [catsRes, rulesRes, recurringRes] = await Promise.all([
          apiClient.get<{ data: ExpenseCategory[] }>(`/api/finances/categories?householdId=${householdId}`),
          apiClient.get<{ data: HouseholdItemRule[] }>(`/api/finances/item-rules?householdId=${householdId}`),
          apiClient.get<{ data: RecurringExpense[] }>(`/api/finances/recurring?householdId=${householdId}`),
        ])
        if (!cancelled) {
          setCategories(catsRes.data.data ?? [])
          setItemRules(rulesRes.data.data ?? [])
          setRecurring(recurringRes.data.data ?? [])
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
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
        <AccordionSection title={FINANCES.SETTINGS.RECURRING_TITLE}>
        <RecurringSection
          householdId={householdId}
          recurring={recurring}
          categories={categories}
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

      <AccordionSection title={FINANCES.SETTINGS.ITEM_RULES_TITLE}>
        <ItemRulesSection
          householdId={householdId}
          rules={itemRules}
          categories={categories}
          members={members}
          onRulesChanged={(updater) => setItemRules(updater)}
        />
      </AccordionSection>
    </div>
  )
}
