'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api/client'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      try {
        await apiClient.get('/api/auth/user')
        router.replace('/dashboard')
      } catch {
        router.replace('/login')
      }
    }

    redirect()
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Loading…</div>
    </main>
  )
}
