'use client'

import { useState, useEffect, useRef } from 'react'
import type { DailyTask, NocturneCalendarData } from '@/lib/types/dailyTasks'
import type { TaskCategory } from '@/lib/types/dailyTasks'
import { apiClient } from '@/lib/api/client'
import { DAILY_TASKS } from '@/locales/en'
import { SoundEngine } from './SoundEngine'
import TodayPanel from './TodayPanel'
import CalendarFilmStrip from './CalendarFilmStrip'
import WheelPanel from './WheelPanel'
import TaskSlideOver, { type TaskDraft } from './TaskSlideOver'

type Tab = 'today' | 'calendar' | 'wheel'

interface NocturneHomeProps {
  householdId: string
  initialTasks: DailyTask[]
  initialEvents: NocturneCalendarData
  initialStreak: number
  initialStreakDays: boolean[]
}

export default function NocturneHome({
  householdId,
  initialTasks,
  initialEvents,
  initialStreak,
  initialStreakDays,
}: NocturneHomeProps) {
  const [tab, setTab] = useState<Tab>('wheel')
  const [tasks, setTasks] = useState<DailyTask[]>(initialTasks)
  const [events] = useState<NocturneCalendarData>(initialEvents)
  const [streak, setStreak] = useState(initialStreak)
  const [streakDays, setStreakDays] = useState(initialStreakDays)
  const [creating, setCreating] = useState(false)
  const [now] = useState(() => new Date())

  // Toast
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Spring nonce for WheelPanel external navigation
  const [springNonce, setSpringNonce] = useState(0)
  const [springIndex, setSpringIndex] = useState(0)

  // Sound engine — created lazily on first user interaction
  const soundRef = useRef<SoundEngine | null>(null)
  useEffect(() => {
    soundRef.current = new SoundEngine()
  }, [])

  function showToast(msg: string, color = '#9184d9') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, color })
    toastTimerRef.current = setTimeout(() => setToast(null), 3200)
  }

  const todayISO = now.toLocaleDateString('en-CA')

  async function handleComplete(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    try {
      await apiClient.post(`/api/dashboard/${householdId}/tasks/${taskId}/complete`)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: true } : t))
      if (task.category === 'fitness' && task.logsToCalendar && !streakDays[6]) {
        const newStreak = streak + 1
        setStreak(newStreak)
        setStreakDays((prev) => {
          const next = [...prev]
          next[6] = true
          return next
        })
        const dateLabel = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        showToast(DAILY_TASKS.TOAST_LOGGED(dateLabel, newStreak), 'oklch(0.734 0.125 289.2)')
      } else {
        showToast('Task completed!')
      }
    } catch {
      // revert on failure
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: false } : t))
    }
  }

  async function handleUncomplete(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    try {
      await apiClient.delete(`/api/dashboard/${householdId}/tasks/${taskId}/complete`)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: false } : t))
      if (task.category === 'fitness' && task.logsToCalendar && streakDays[6]) {
        setStreak((s) => Math.max(0, s - 1))
        setStreakDays((prev) => {
          const next = [...prev]
          next[6] = false
          return next
        })
      }
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: true } : t))
    }
  }

  async function handleSave(draft: TaskDraft) {
    if (!draft.category) return
    const res = await apiClient.post<{ data: DailyTask }>(`/api/dashboard/${householdId}/tasks`, {
      title: draft.title,
      category: draft.category as TaskCategory,
      timeOfDay: draft.time,
      logsToCalendar: draft.logsToCalendar,
    })
    const newTask = res.data.data
    const next = [...tasks, newTask].sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay))
    const idx = next.findIndex((t) => t.id === newTask.id)
    setTasks(next)
    setSpringIndex(idx)
    setSpringNonce((n) => n + 1)
    setCreating(false)
    setTab('wheel')
    showToast(`"${newTask.title}" added to wheel`)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'today', label: DAILY_TASKS.TAB_TODAY },
    { key: 'calendar', label: DAILY_TASKS.TAB_CALENDAR },
    { key: 'wheel', label: DAILY_TASKS.TAB_WHEEL },
  ]

  const todayEvents = events[todayISO] ?? []

  function switchTab(t: Tab) {
    if (t === tab) return
    soundRef.current?.playOpenPanel()
    setTab(t)
  }

  function openCreating() {
    soundRef.current?.playOpenPanel()
    setCreating(true)
  }

  function closeCreating() {
    soundRef.current?.playClosePanel()
    setCreating(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'transparent',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '18px 32px 0',
          flexShrink: 0,
        }}
      >
        {tabs.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              style={{
                height: 34,
                padding: '0 18px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 400,
                background: active ? 'rgba(145,132,217,0.16)' : 'transparent',
                border: `1px solid ${active ? '#9184d9' : 'rgba(233,233,237,0.1)'}`,
                color: active ? '#e9e9ed' : '#75798c',
                boxShadow: active ? '0 0 22px rgba(145,132,217,0.3)' : 'none',
                transition: 'all .25s ease',
              }}
            >
              {label}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={openCreating}
          style={{
            height: 34,
            padding: '0 16px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 13,
            background: 'rgba(145,132,217,0.1)',
            border: '1px solid rgba(145,132,217,0.3)',
            color: '#b5abfc',
            transition: 'all .25s ease',
          }}
        >
          + {DAILY_TASKS.NEW_TASK}
        </button>
      </div>

      {/* Panel area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          padding: '20px 32px 0',
          overflow: 'hidden',
        }}
      >
        {/* Today panel */}
        <div
          style={{
            position: 'absolute',
            inset: '20px 32px 0',
            opacity: tab === 'today' ? 1 : 0,
            transform:
              tab === 'today'
                ? 'translateY(0) scale(1)'
                : 'translateY(16px) scale(0.985)',
            pointerEvents: tab === 'today' ? 'auto' : 'none',
            transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          <TodayPanel
            tasks={tasks}
            events={todayEvents}
            streak={streak}
            streakDays={streakDays}
            now={now}
          />
        </div>

        {/* Calendar panel */}
        <div
          style={{
            position: 'absolute',
            inset: '20px 32px 0',
            opacity: tab === 'calendar' ? 1 : 0,
            transform:
              tab === 'calendar'
                ? 'translateY(0) scale(1)'
                : 'translateY(16px) scale(0.985)',
            pointerEvents: tab === 'calendar' ? 'auto' : 'none',
            transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          <CalendarFilmStrip events={events} now={now} />
        </div>

        {/* Wheel panel */}
        <div
          style={{
            position: 'absolute',
            inset: '20px 32px 0',
            opacity: tab === 'wheel' ? 1 : 0,
            transform:
              tab === 'wheel'
                ? 'translateY(0) scale(1)'
                : 'translateY(16px) scale(0.985)',
            pointerEvents: tab === 'wheel' ? 'auto' : 'none',
            transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          <WheelPanel
            tasks={tasks}
            soundRef={soundRef}
            springNonce={springNonce}
            springIndex={springIndex}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
          />
        </div>
      </div>

      {/* Task slide-over */}
      <TaskSlideOver
        open={creating}
        onClose={closeCreating}
        onSave={handleSave}
        soundRef={soundRef}
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(22,24,38,0.96)',
            border: `1px solid ${toast.color}`,
            borderRadius: 30,
            padding: '10px 22px',
            fontSize: 14,
            color: '#e9e9ed',
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 16px ${toast.color}40`,
            zIndex: 1000,
            animation: 'toastIn .4s cubic-bezier(.2,.8,.2,1)',
            whiteSpace: 'nowrap',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
