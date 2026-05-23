'use client'

import { useState } from 'react'
import { HOUSEHOLDS } from '@/locales/en'
import CreateHouseholdModal from '@/components/CreateHouseholdModal'
import JoinHouseholdModal from '@/components/JoinHouseholdModal'

export default function DashboardHeader() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{HOUSEHOLDS.TITLE}</h1>
        <div className="flex items-center gap-6">
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
            {HOUSEHOLDS.ACTIONS.JOIN_VIA_CODE}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {HOUSEHOLDS.ACTIONS.NEW_HOUSEHOLD}
          </button>
        </div>
      </div>
      {showCreateModal && <CreateHouseholdModal onClose={() => setShowCreateModal(false)} />}
      {showJoinModal && <JoinHouseholdModal onClose={() => setShowJoinModal(false)} />}
    </>
  )
}
