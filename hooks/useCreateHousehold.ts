'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/client'
import { HOUSEHOLDS_BUCKET } from '@/lib/config'
import { HOUSEHOLDS } from '@/locales/en'
import type { HouseholdWithMemberCount } from '@/lib/types/household'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getFileExtension(file: File): string {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg'
}

export function useCreateHousehold(onSuccess?: () => void) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createHousehold(name: string, imageFile?: File | null) {
    setLoading(true)
    setError('')
    try {
      const { data: household } = await apiClient.post<{ data: HouseholdWithMemberCount }>(
        '/api/households',
        { name },
      )

      if (imageFile) {
        const supabase = createClient()
        const { id } = household.data
        const ext = getFileExtension(imageFile)
        const slug = slugify(name)
        const path = `${id}/${slug}-${id}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(HOUSEHOLDS_BUCKET)
          .upload(path, imageFile, { upsert: true })

        if (uploadError) {
          console.error('[useCreateHousehold] storage upload failed', uploadError)
          setError(HOUSEHOLDS.ERRORS.IMAGE_UPLOAD)
        } else {
          const { data: urlData } = supabase.storage
            .from(HOUSEHOLDS_BUCKET)
            .getPublicUrl(path)

          try {
            await apiClient.patch(`/api/households/${id}`, { image_url: urlData.publicUrl })
          } catch (patchErr) {
            console.error('[useCreateHousehold] image_url patch failed', patchErr)
            setError(HOUSEHOLDS.ERRORS.IMAGE_UPLOAD)
          }
        }
      }

      router.refresh()
      onSuccess?.()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return { createHousehold, loading, error, clearError: () => setError('') }
}
