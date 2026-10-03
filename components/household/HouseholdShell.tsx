'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
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

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed'

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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })
  const menuRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const displayName = userNickname ?? userName ?? userEmail.split('@')[0]
  const greeting = `${getGreeting()}, ${displayName}`

  function playNavSound(direction: 'open' | 'close') {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      const now = ctx.currentTime
      if (direction === 'open') {
        osc.frequency.setValueAtTime(280, now)
        osc.frequency.linearRampToValueAtTime(520, now + 0.12)
      } else {
        osc.frequency.setValueAtTime(520, now)
        osc.frequency.linearRampToValueAtTime(280, now + 0.12)
      }
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
      osc.onended = () => ctx.close()
    } catch {
      // No user gesture yet — skip
    }
  }

  const formatClock = useCallback(() => {
    const d = new Date()
    const h = d.getHours()
    const m = d.getMinutes()
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  }, [])

  const [clockTime, setClockTime] = useState(formatClock)
  const [clockDate, setClockDate] = useState(() => {
    const d = new Date()
    return {
      weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
      long: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }
  })

  useEffect(() => {
    const id = setInterval(() => {
      setClockTime(formatClock())
      const d = new Date()
      setClockDate({
        weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        long: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      })
    }, 60000)
    return () => clearInterval(id)
  }, [formatClock])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
      if (drawerOpen && !drawerRef.current?.contains(event.target as Node)) {
        setDrawerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [drawerOpen])

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }

  async function handleSignOut() {
    setMenuOpen(false)
    setDrawerOpen(false)
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

  const sidebarWidth = sidebarCollapsed ? 64 : 208

  return (
    <div className="flex h-screen bg-[#0f0f14] text-white overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0 border-r py-5 transition-all duration-200"
        style={{
          width: sidebarWidth,
          background: 'rgba(15,15,20,0.55)',
          backdropFilter: 'blur(18px)',
          borderColor: 'rgba(233,233,237,0.06)',
          paddingLeft: sidebarCollapsed ? 0 : 14,
          paddingRight: sidebarCollapsed ? 0 : 14,
        }}
      >
        {/* Brand row + collapse toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'space-between',
            marginBottom: 22,
            paddingLeft: sidebarCollapsed ? 0 : 4,
            paddingRight: sidebarCollapsed ? 0 : 4,
          }}
        >
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'linear-gradient(140deg,#9184d9,#5d5294)',
                  boxShadow: '0 0 18px rgba(145,132,217,0.45)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.14em', color: '#9397ab' }}>
                ROOMMATE
              </span>
            </div>
          )}
          {sidebarCollapsed && (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: 'linear-gradient(140deg,#9184d9,#5d5294)',
                boxShadow: '0 0 18px rgba(145,132,217,0.45)',
              }}
            />
          )}
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center justify-center w-6 h-6 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors focus:outline-none"
            style={{ marginLeft: sidebarCollapsed ? 0 : 4, marginTop: sidebarCollapsed ? 8 : 0 }}
          >
            {sidebarCollapsed ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          {HOUSEHOLD_NAV.map((item) => {
            const active = isActive(item.href(householdId))
            return (
              <Link
                key={item.key}
                href={item.href(householdId)}
                title={sidebarCollapsed ? item.label : undefined}
                className="relative flex items-center rounded-xl transition-colors"
                style={{
                  gap: sidebarCollapsed ? 0 : 12,
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  padding: sidebarCollapsed ? '10px 0' : '10px 12px',
                  background: active ? 'rgba(145,132,217,0.14)' : 'transparent',
                  color: active ? '#e9e9ed' : '#75798c',
                }}
              >
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 2,
                      height: 20,
                      borderRadius: '0 3px 3px 0',
                      background: '#9184d9',
                      boxShadow: '0 0 10px #9184d9',
                    }}
                  />
                )}
                <item.icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Scan receipt link */}
        <div style={{ marginBottom: 4, marginTop: 4 }}>
          <div style={{ height: 1, background: 'rgba(233,233,237,0.06)', marginBottom: 8 }} />
          <Link
            href={ROUTES.RECEIPT_NEW(householdId)}
            title={sidebarCollapsed ? 'Scan Receipt' : undefined}
            className="relative flex items-center rounded-xl transition-colors"
            style={{
              gap: sidebarCollapsed ? 0 : 12,
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '10px 0' : '10px 12px',
              background: pathname === ROUTES.RECEIPT_NEW(householdId) ? 'rgba(145,132,217,0.14)' : 'transparent',
              color: pathname === ROUTES.RECEIPT_NEW(householdId) ? '#e9e9ed' : '#75798c',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
              <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            {!sidebarCollapsed && (
              <span className="text-sm font-medium whitespace-nowrap">Scan Receipt</span>
            )}
          </Link>
        </div>

        {/* User avatar */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={NAV.PROFILE_ARIA}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center w-full rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            style={{
              gap: sidebarCollapsed ? 0 : 12,
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '8px 0' : '8px 12px',
            }}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-500 text-white text-xs font-semibold shrink-0">
              {userInitial}
            </span>
            {!sidebarCollapsed && (
              <span className="text-sm font-medium whitespace-nowrap truncate">{displayName}</span>
            )}
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
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Ambient glows — desktop only */}
        <div
          className="hidden md:block"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 800,
              height: 800,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(145,132,217,0.07),transparent 65%)',
              left: -200,
              top: -200,
              animation: 'drift1 34s ease-in-out infinite alternate',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 600,
              height: 600,
              borderRadius: '50%',
              background: 'radial-gradient(circle,rgba(91,184,217,0.05),transparent 65%)',
              right: -100,
              bottom: -100,
              animation: 'drift2 46s ease-in-out infinite alternate',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 50% 50%,transparent 40%,rgba(11,12,20,0.35) 100%)',
            }}
          />
        </div>

        {/* Top strip */}
        <header className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0" style={{ position: 'relative', zIndex: 20 }}>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 transition-colors focus:outline-none"
              onClick={() => { setDrawerOpen(true); playNavSound('open') }}
              aria-label="Open navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9184d9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              <Link
                href={ROUTES.HOUSEHOLD(householdId)}
                style={{ fontSize: 15, fontWeight: 500, color: '#cfd3e5' }}
                className="leading-tight hover:opacity-80 transition-opacity"
              >
                {householdName}
              </Link>
              <p style={{ fontSize: 13, color: '#75798c' }} className="mt-0.5">{greeting}</p>
            </div>
          </div>

          {/* Desktop clock */}
          <div className="hidden md:flex flex-col items-end">
            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase' }}>
              {clockDate.weekday}
            </div>
            <div style={{ fontSize: 12, color: '#9397ab', marginTop: 1 }}>
              {clockDate.long}
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 300,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                color: '#e9e9ed',
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {clockTime}
            </div>
          </div>

          {/* Mobile user avatar */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={NAV.PROFILE_ARIA}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {userInitial}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-4 top-16 w-48 rounded-xl border border-white/10 bg-[#1c1c24] py-1 shadow-xl z-50"
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
                  onClick={(e) => { e.stopPropagation(); void handleSignOut() }}
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
        <main className="flex-1 overflow-y-auto px-4 pb-6 md:px-5 relative" style={{ zIndex: 1 }}>
          {children}
        </main>
      </div>

      <ScanReceiptFab householdId={householdId} />

      <style jsx global>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes drawerBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Mobile slide-in drawer */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.5)', animation: 'drawerBackdropIn 0.2s ease-out forwards' }}
          aria-modal="true"
        >
          <div
            ref={drawerRef}
            className="absolute left-0 top-0 bottom-0 flex flex-col py-5 px-3.5"
            style={{
              width: 240,
              background: 'rgba(15,15,20,0.97)',
              backdropFilter: 'blur(18px)',
              borderRight: '1px solid rgba(233,233,237,0.06)',
              animation: 'drawerSlideIn 0.2s ease-out forwards',
            }}
          >
            {/* Brand row + X close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, paddingLeft: 4 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: 'linear-gradient(140deg,#9184d9,#5d5294)',
                  boxShadow: '0 0 18px rgba(145,132,217,0.45)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.14em', color: '#9397ab' }}>
                ROOMMATE
              </span>
              {/* X close button — inside drawer top-right */}
              <button
                onClick={() => { setDrawerOpen(false); playNavSound('close') }}
                aria-label="Close navigation"
                className="ml-auto flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 transition-colors focus:outline-none"
                style={{ color: '#9184d9' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9184d9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1 flex-1">
              {HOUSEHOLD_NAV.map((item) => {
                const active = isActive(item.href(householdId))
                return (
                  <Link
                    key={item.key}
                    href={item.href(householdId)}
                    onClick={() => { setDrawerOpen(false); playNavSound('close') }}
                    className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: active ? 'rgba(145,132,217,0.14)' : 'transparent',
                      color: active ? '#e9e9ed' : '#75798c',
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 2,
                          height: 20,
                          borderRadius: '0 3px 3px 0',
                          background: '#9184d9',
                          boxShadow: '0 0 10px #9184d9',
                        }}
                      />
                    )}
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Scan receipt */}
            <div style={{ marginBottom: 4, marginTop: 4 }}>
              <div style={{ height: 1, background: 'rgba(233,233,237,0.06)', marginBottom: 8 }} />
              <Link
                href={ROUTES.RECEIPT_NEW(householdId)}
                onClick={() => setDrawerOpen(false)}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                style={{
                  background: pathname === ROUTES.RECEIPT_NEW(householdId) ? 'rgba(145,132,217,0.14)' : 'transparent',
                  color: pathname === ROUTES.RECEIPT_NEW(householdId) ? '#e9e9ed' : '#75798c',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                  <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span className="text-sm font-medium whitespace-nowrap">Scan Receipt</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
