'use client'

import { useState } from 'react'
import Link from 'next/link'
import ErrorBanner from '@/components/ErrorBanner'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { AUTH } from '@/locales/en'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [inviteWarning, setInviteWarning] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInviteWarning('')
    setInviteMessage('')
    setLoading(true)

    try {
      const res = await apiClient.post<{
        message: string
        inviteWarning?: string
        inviteMessage?: string
      }>('/api/auth/register', { name: name.trim(), email, password, inviteCode: inviteCode.trim() || undefined })

      if (res.data.inviteWarning) setInviteWarning(res.data.inviteWarning)
      if (res.data.inviteMessage) setInviteMessage(res.data.inviteMessage)
      setSuccess(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 mb-4">
            We sent a confirmation link to <span className="font-medium text-gray-700">{email}</span>.
            Click it to activate your account.
          </p>

          {inviteMessage && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 text-left">
              {inviteMessage}
            </div>
          )}

          {inviteWarning && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 text-left">
              {inviteWarning}
            </div>
          )}

          <Link
            href="/login"
            className="inline-block text-sm text-indigo-600 hover:underline font-medium"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <>
      <ErrorBanner message={error} />
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Create account</h1>
          <p className="text-sm text-gray-500 mb-6">Get started — it only takes a moment</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                {AUTH.LABELS.DISPLAY_NAME}
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={AUTH.LABELS.DISPLAY_NAME_PLACEHOLDER}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {AUTH.LABELS.EMAIL}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={AUTH.LABELS.EMAIL_PLACEHOLDER}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {AUTH.LABELS.PASSWORD}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Min. 6 characters"
              />
            </div>

            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
                {AUTH.LABELS.INVITE_CODE}
              </label>
              <input
                id="inviteCode"
                type="text"
                autoComplete="off"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={AUTH.LABELS.INVITE_CODE_PLACEHOLDER}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2 text-sm transition-colors"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            {AUTH.MESSAGES.ALREADY_HAVE_ACCOUNT}{' '}
            <Link href="/login" className="text-indigo-600 hover:underline font-medium">
              {AUTH.LINKS.SIGN_IN}
            </Link>
          </p>
        </div>
      </main>
    </>
  )
}
