'use client'

import { RECEIPTS } from '@/locales/en'
import AddParticipantsControl from '@/components/receipts/AddParticipantsControl'
import type { LineItemConfig } from '@/lib/types/receipts'
import type { HouseholdGuest } from '@/lib/types/guests'
import type { SplitResolverContext } from '@/lib/utils/receiptLineItems'
import {
  getDisplaySplitsForLineItem,
  getDisplaySplitLines,
  getLineItemStatus,
  lineItemStatusLabel,
  lineItemStatusPillClass,
  usesDefaultEqualSplit,
} from '@/lib/utils/receiptLineItems'

interface Category {
  id: string
  name: string
}

interface Member {
  id: string
  name: string
}

interface SplitsStepProps {
  householdId: string
  description: string
  paidByKey: string
  members: Member[]
  householdGuests: HouseholdGuest[]
  receiptGuests: HouseholdGuest[]
  lineItemConfigs: LineItemConfig[]
  categories: Category[]
  memberCount: number
  splitResolverCtx: SplitResolverContext
  activeCount: number
  saveBlocked: boolean
  saveSplitsError: string
  saveError: string
  saving: boolean
  onDescriptionChange: (v: string) => void
  onPaidByChange: (v: string) => void
  onReceiptGuestsChange: (guests: HouseholdGuest[]) => void
  onGuestCreated: (guest: HouseholdGuest) => void
  onConfirmLineItem: (index: number) => void
  onAddAllToExpense: () => void
  onOpenModal: (index?: number) => void
  onBack: () => void
  onSave: () => void
}

function payerKey(type: 'member' | 'guest', id: string): string {
  return `${type}:${id}`
}

export default function SplitsStep({
  householdId,
  description,
  paidByKey,
  members,
  householdGuests,
  receiptGuests,
  lineItemConfigs,
  categories,
  memberCount,
  splitResolverCtx,
  activeCount,
  saveBlocked,
  saveSplitsError,
  saveError,
  saving,
  onDescriptionChange,
  onPaidByChange,
  onReceiptGuestsChange,
  onGuestCreated,
  onConfirmLineItem,
  onAddAllToExpense,
  onOpenModal,
  onBack,
  onSave,
}: SplitsStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.DESCRIPTION}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
          placeholder="Expense description"
        />
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.PAID_BY}</label>
        <select
          value={paidByKey}
          onChange={(e) => onPaidByChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
        >
          {members.map((m) => (
            <option key={m.id} value={payerKey('member', m.id)}>
              {m.name}
            </option>
          ))}
          {householdGuests.map((g) => (
            <option key={g.id} value={payerKey('guest', g.id)}>
              {g.name}{RECEIPTS.LABELS.PAID_BY_GUEST_SUFFIX}
            </option>
          ))}
        </select>
      </div>

      {lineItemConfigs.length > 0 && (
        <div>
          <label className="block text-xs text-white/50 mb-1">{RECEIPTS.SPLITS.GUESTS_ON_RECEIPT}</label>
          <p className="text-xs text-white/35 mb-2">{RECEIPTS.SPLITS.GUESTS_ON_RECEIPT_HINT}</p>
          <AddParticipantsControl
            householdId={householdId}
            availableGuests={householdGuests}
            selectedGuests={receiptGuests}
            onChange={onReceiptGuestsChange}
            onGuestCreated={onGuestCreated}
          />
        </div>
      )}

      {lineItemConfigs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/50">{RECEIPTS.LABELS.LINE_ITEMS}</label>
            <button
              type="button"
              onClick={onAddAllToExpense}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              {RECEIPTS.ACTIONS.ADD_ALL_TO_EXPENSE}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {lineItemConfigs.map((config, i) => {
              const status = getLineItemStatus(config, memberCount, splitResolverCtx)
              const confirmed = config.active
              const catName = config.categoryId
                ? categories.find((c) => c.id === config.categoryId)?.name
                : null
              const displayRows = getDisplaySplitsForLineItem(config, splitResolverCtx)
              const splitLines = getDisplaySplitLines(displayRows, config.amount)
              const isDefaultSplit = usesDefaultEqualSplit(config, memberCount)

              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => onConfirmLineItem(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onConfirmLineItem(i)
                    }
                  }}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-white/[0.04] to-white/[0.02] border transition-colors cursor-pointer border-white/5 hover:border-white/15 ${
                    !config.active ? 'opacity-50' : ''
                  }`}
                >
                  {confirmed ? (
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    </span>
                  ) : (
                    <span className="shrink-0 w-6 h-6 rounded-full border border-dashed border-white/20" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/75 truncate">{config.description}</p>
                    {config.setupMode === 'item' && config.resolvedItemName && (
                      <p className="text-xs text-indigo-300/70 mt-0.5 truncate">{config.resolvedItemName}</p>
                    )}
                    {catName && (
                      <p className="text-xs text-white/35 mt-0.5">{catName}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 min-w-[100px]">
                    <span className="text-base font-mono text-emerald-400/90">
                      ${config.amount.toFixed(2)}
                    </span>
                    <span
                      className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${lineItemStatusPillClass(status)}`}
                    >
                      {lineItemStatusLabel(status, memberCount)}
                    </span>
                    {(isDefaultSplit || splitLines.length > 0) && (
                      <div className="flex flex-col items-end gap-0.5 mt-0.5">
                        {isDefaultSplit && (
                          <span className="text-sm text-white/35">
                            {RECEIPTS.LABELS.EQUAL_SPLIT}
                          </span>
                        )}
                        {splitLines.map((line) => (
                          <span key={line} className="text-sm text-white/50">
                            {line}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenModal(i)
                      }}
                      className="mt-1 text-[11px] px-2 py-0.5 rounded-md border border-white/10 text-white/40 hover:text-white/70 hover:border-white/25 transition-colors"
                    >
                      {RECEIPTS.ACTIONS.CONFIGURE_ITEM}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {lineItemConfigs.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenModal()}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-indigo-500/10 border border-indigo-400/25 text-indigo-200 hover:bg-indigo-500/15 hover:border-indigo-400/35 hover:text-indigo-100"
        >
          {RECEIPTS.ACTIONS.CONFIGURE_ITEMS}
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">
            {RECEIPTS.ACTIONS.CONFIGURE_ITEMS_COUNT(activeCount)}
          </span>
        </button>
      )}

      {saveSplitsError && (
        <p className="text-red-400 text-sm" role="alert">{saveSplitsError}</p>
      )}
      {saveError && (
        <p className="text-red-400 text-sm" role="alert">{saveError}</p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saveBlocked}
          className={`flex-1 py-2.5 rounded-lg font-semibold transition-all text-sm ${
            saveBlocked
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400/60 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {saving ? RECEIPTS.ACTIONS.SAVING : RECEIPTS.ACTIONS.SAVE}
        </button>
      </div>
    </div>
  )
}
