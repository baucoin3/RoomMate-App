'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { HOUSEHOLD_NAV } from '@/lib/config/nav'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { ROUTES } from '@/lib/constants/routes'
import { NAV } from '@/locales/en'
import ScanReceiptFab from '@/components/receipts/ScanReceiptFab'

interface HouseholdShellProps {
  children: React.ReactNode
  householdId: string
  householdName: string
  userInitial: string
  userEmail: string
  userName: string | null
  userNickname: string | null
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HouseholdShell({
  children,
  householdId,
  householdName,
  userInitial,
  userEmail,
  userName,
  userNickname,
}: HouseholdShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const displayName = userNickname ?? userName ?? userEmail.split('@')[0]
  const greeting = `${getGreeting()}, ${displayName}`

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !mobileMenuRef.current?.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError('')
    try {
      await apiClient.post('/api/auth/logout')
      router.push(ROUTES.LOGIN)
      router.refresh()
    } catch (err) {
      setSignOutError(getErrorMessage(err))
      setSigningOut(false)
    }
  }

  function isActive(href: string): boolean {
    if (href === ROUTES.HOUSEHOLD(householdId)) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen bg-[#0f0f14] text-white overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-[#0f0f14] border-r border-white/5 py-4 px-3">
        <div className="flex flex-col gap-1 flex-1 mt-2">
          {HOUSEHOLD_NAV.map((item) => {
            const active = isActive(item.href(householdId))
            return (
              <Link
                key={item.key}
                href={item.href(householdId)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
                )}
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* User avatar at bottom */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={NAV.PROFILE_ARIA}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-500 text-white text-xs font-semibold shrink-0">
              {userInitial}
            </span>
            <span className="text-sm font-medium whitespace-nowrap truncate">{displayName}</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-full bottom-0 ml-3 w-48 rounded-xl border border-white/10 bg-[#1c1c24] py-1 shadow-xl z-50"
            >
              <div className="border-b border-white/10 px-4 py-2">
                <p className="truncate text-xs font-medium text-white">{displayName}</p>
                <p className="truncate text-xs text-white/50">{userEmail}</p>
              </div>
              {signOutError && (
                <p className="px-4 py-2 text-xs text-red-400">{signOutError}</p>
              )}
              <button
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60"
              >
                {signingOut ? NAV.ACTIONS.SIGNING_OUT : NAV.ACTIONS.SIGN_OUT}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top strip */}
        <header className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h1 className="text-base font-semibold text-white leading-tight">{householdName}</h1>
            <p className="text-xs text-white/50 mt-0.5">{greeting}</p>
          </div>
          <div className="relative md:hidden" ref={mobileMenuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={NAV.PROFILE_ARIA}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {userInitial}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#1c1c24] py-1 shadow-xl z-50"
              >
                <div className="border-b border-white/10 px-4 py-2">
                  <p className="truncate text-xs font-medium text-white">{displayName}</p>
                  {userName && (
                    <p className="truncate text-xs text-white/50">{userEmail}</p>
                  )}
                </div>
                {signOutError && (
                  <p className="px-4 py-2 text-xs text-red-400">{signOutError}</p>
                )}
                <button
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60"
                >
                  {signingOut ? NAV.ACTIONS.SIGNING_OUT : NAV.ACTIONS.SIGN_OUT}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto px-4 pb-6 md:px-5">
          {children}
        </main>
      </div>

      <ScanReceiptFab householdId={householdId} />

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-[#0f0f14] border-t border-white/5 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-around h-14">
          {HOUSEHOLD_NAV.map((item) => {
            const active = isActive(item.href(householdId))
            return (
              <Link
                key={item.key}
                href={item.href(householdId)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  active ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
