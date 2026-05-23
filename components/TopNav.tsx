'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { ROUTES } from '@/lib/constants/routes'
import { NAV } from '@/locales/en'
import { useNavbar } from '@/lib/context/navbar-context'

interface TopNavProps {
  userEmail: string
  userName?: string | null
}

export default function TopNav({ userEmail, userName }: TopNavProps) {
  const router = useRouter()
  const { householdName } = useNavbar()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = userName ?? userEmail
  const initials = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    setError('')
    try {
      await apiClient.post('/api/auth/logout')
      router.push(ROUTES.LOGIN)
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err))
      setSigningOut(false)
    }
  }

  return (
    <header className="animated-gradient w-full shadow-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <span className="text-sm font-bold tracking-wide text-white drop-shadow-sm">
          {householdName ?? NAV.APP_NAME}
        </span>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-label={NAV.PROFILE_ARIA}
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 rounded-full px-2 py-1 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/30 text-sm font-semibold text-white ring-2 ring-white/60 backdrop-blur-sm">
              {initials}
            </span>
            <span className="hidden max-w-[160px] truncate text-sm font-medium text-white drop-shadow-sm sm:block">
              {displayName}
            </span>
            <svg
              className={`h-4 w-4 text-white/80 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-lg ring-1 ring-black/5"
            >
              <div className="border-b border-gray-100 px-4 py-2">
                <p className="truncate text-xs font-medium text-gray-900">{displayName}</p>
                {userName && (
                  <p className="truncate text-xs text-gray-500">{userEmail}</p>
                )}
              </div>
              {error && (
                <p className="px-4 py-2 text-xs text-red-600">{error}</p>
              )}
              <button
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                <svg
                  className="h-4 w-4 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                {signingOut ? NAV.ACTIONS.SIGNING_OUT : NAV.ACTIONS.SIGN_OUT}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
