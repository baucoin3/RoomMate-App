'use client'

import { GUESTS } from '@/locales/en'
import AddParticipantsControl from './AddParticipantsControl'
import type { HouseholdGuest } from '@/lib/types/guests'

interface Props {
  householdId: string
  selectedGuests: HouseholdGuest[]
  onChange: (guests: HouseholdGuest[]) => void
  onNext: () => void
  onBack: () => void
  availableGuests: HouseholdGuest[]
  onGuestCreated?: (guest: HouseholdGuest) => void
}

export default function GuestStepPanel({
  householdId,
  selectedGuests,
  onChange,
  onNext,
  onBack,
  availableGuests,
  onGuestCreated,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{GUESTS.WIZARD_STEP.TITLE}</h2>
        <p className="text-sm text-white/50 mt-1">{GUESTS.WIZARD_STEP.SUBTITLE}</p>
      </div>

      <AddParticipantsControl
        householdId={householdId}
        availableGuests={availableGuests}
        selectedGuests={selectedGuests}
        onChange={onChange}
        onGuestCreated={onGuestCreated}
      />

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
          onClick={onNext}
          className="flex-1 py-2.5 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition-colors text-sm"
        >
          {selectedGuests.length > 0
            ? GUESTS.WIZARD_STEP.CONTINUE_WITH(selectedGuests.length)
            : GUESTS.WIZARD_STEP.SKIP}
        </button>
      </div>
    </div>
  )
}
