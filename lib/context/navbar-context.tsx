'use client'

import { createContext, useContext, useState } from 'react'

interface NavbarContextValue {
  householdName: string | null
  setHouseholdName: (name: string | null) => void
}

const NavbarContext = createContext<NavbarContextValue | null>(null)

export function NavbarProvider({ children }: { children: React.ReactNode }) {
  const [householdName, setHouseholdName] = useState<string | null>(null)

  return (
    <NavbarContext.Provider value={{ householdName, setHouseholdName }}>
      {children}
    </NavbarContext.Provider>
  )
}

export function useNavbar(): NavbarContextValue {
  const ctx = useContext(NavbarContext)
  if (!ctx) throw new Error('useNavbar must be used within a NavbarProvider')
  return ctx
}
