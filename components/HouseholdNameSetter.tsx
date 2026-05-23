'use client'

import { useEffect } from 'react'
import { useNavbar } from '@/lib/context/navbar-context'

interface HouseholdNameSetterProps {
  name: string
}

export default function HouseholdNameSetter({ name }: HouseholdNameSetterProps) {
  const { setHouseholdName } = useNavbar()

  useEffect(() => {
    setHouseholdName(name)
    return () => setHouseholdName(null)
  }, [name, setHouseholdName])

  return null
}
