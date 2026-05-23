import axios from 'axios'
import { API_BASE_URL } from '@/lib/config'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message ?? 'Something went wrong.'
  }
  return 'Something went wrong. Please try again.'
}
