'use client'

import { useState, useEffect, useRef } from 'react'
import type { DailyTask, NocturneCalendarData, NocturneCalendarEvent, TaskCategory } from '@/lib/types/dailyTasks'
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

function formatTaskTime(timeOfDay: string | null): string {
  if (!timeOfDay) return '—'
  const [hStr, mStr] = timeOfDay.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

function sortTasks(list: DailyTask[]): DailyTask[] {
  return [...list].sort((a, b) => {
    if (!a.timeOfDay) return 1
    if (!b.timeOfDay) return -1
    return a.timeOfDay.localeCompare(b.timeOfDay)
  })
}

export default function NocturneHome({
  householdId,
  initialTasks,
  initialEvents,
  initialStreak,
  initialStreakDays,
}: NocturneHomeProps) {
  const [tab, setTab] = useState<Tab>('today')
  const [tasks, setTasks] = useState<DailyTask[]>(initialTasks)
  const [events, setEvents] = useState<NocturneCalendarData>(initialEvents)
  const [streak, setStreak] = useState(initialStreak)
  const [streakDays, setStreakDays] = useState(initialStreakDays)
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [now] = useState(() => new Date())

  // Toast
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Spring nonce for WheelPanel external navigation
  const [springNonce, setSpringNonce] = useState(0)
  const [springIndex, setSpringIndex] = useState(0)

  // Sound engine
  const soundRef = useRef<SoundEngine | null>(null)
  useEffect(() => {
    soundRef.current = new SoundEngine()
  }, [])

  // Auto-reset at the next 9am boundary
  useEffect(() => {
    const n = new Date()
    const next9 = new Date(n)
    next9.setHours(9, 0, 0, 0)
    if (n >= next9) next9.setDate(next9.getDate() + 1)
    const msUntil = next9.getTime() - n.getTime()

    const timer = setTimeout(() => {
      apiClient.get<{ data: DailyTask[] }>(`/api/dashboard/${householdId}/tasks`)
        .then((res) => setTasks(res.data.data))
        .catch((err) => console.error('[NocturneHome/9amReset]', err))
    }, msUntil)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Sync calendar immediately if this task logs to calendar
      if (task.logsToCalendar) {
        const liveToday = new Date().toLocaleDateString('en-CA')
        const newEvent: NocturneCalendarEvent = {
          time: formatTaskTime(task.timeOfDay),
          title: task.title + ' — logged',
          cat: task.category as TaskCategory,
        }
        setEvents((prev) => ({
          ...prev,
          [liveToday]: [...(prev[liveToday] ?? []), newEvent],
        }))
      }

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
        showToast(DAILY_TASKS.TOAST_COMPLETED)
      }
    } catch (err) {
      console.error('[NocturneHome.handleComplete]', err)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: false } : t))
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  async function handleUncomplete(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    try {
      await apiClient.delete(`/api/dashboard/${householdId}/tasks/${taskId}/complete`)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: false } : t))

      // Remove from calendar state immediately
      if (task.logsToCalendar) {
        const liveToday = new Date().toLocaleDateString('en-CA')
        setEvents((prev) => {
          const todayEvs = (prev[liveToday] ?? []).filter(
            (ev) => ev.title !== task.title + ' — logged',
          )
          return { ...prev, [liveToday]: todayEvs }
        })
      }

      if (task.category === 'fitness' && task.logsToCalendar && streakDays[6]) {
        setStreak((s) => Math.max(0, s - 1))
        setStreakDays((prev) => {
          const next = [...prev]
          next[6] = false
          return next
        })
      }
    } catch (err) {
      console.error('[NocturneHome.handleUncomplete]', err)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: true } : t))
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  async function handleReset() {
    if (resetting) return
    setResetting(true)
    // Optimistic update
    const prevTasks = tasks
    setTasks((prev) => prev.map((t) => ({ ...t, done: false })))
    // Clear logged task events from today's calendar
    const liveToday = new Date().toLocaleDateString('en-CA')
    setEvents((prev) => ({
      ...prev,
      [liveToday]: (prev[liveToday] ?? []).filter((ev) => !ev.title.endsWith(' — logged')),
    }))
    try {
      await apiClient.delete(`/api/dashboard/${householdId}/tasks/reset`)
      showToast(DAILY_TASKS.TOAST_RESET, 'oklch(0.734 0.125 175)')
    } catch (err) {
      console.error('[NocturneHome.handleReset]', err)
      setTasks(prevTasks)
      showToast(DAILY_TASKS.ERRORS.RESET_FAILED, '#d97777')
    } finally {
      setResetting(false)
    }
  }

  async function handleSave(draft: TaskDraft) {
    if (!draft.category) return
    const res = await apiClient.post<{ data: DailyTask }>(`/api/dashboard/${householdId}/tasks`, {
      title: draft.title,
      category: draft.category as TaskCategory,
      timeOfDay: draft.time || null,
      logsToCalendar: draft.logsToCalendar,
      scope: draft.scope,
    })
    const newTask = res.data.data
    const next = sortTasks([...tasks, newTask])
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
        {/* Reset day button */}
        <button
          onClick={handleReset}
          disabled={resetting}
          title="Clear all completions for today"
          style={{
            height: 34,
            padding: '0 14px',
            borderRadius: 20,
            cursor: resetting ? 'default' : 'pointer',
            fontSize: 12,
            background: 'transparent',
            border: '1px solid rgba(233,233,237,0.1)',
            color: '#595d6c',
            opacity: resetting ? 0.5 : 1,
            transition: 'all .25s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {DAILY_TASKS.RESET_DAY}
        </button>
        {/* Add task button */}
        <button
          onClick={openCreating}
          style={{
            height: 42,
            padding: '0 20px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 500,
            background: 'rgba(145,132,217,0.18)',
            border: '1px solid rgba(145,132,217,0.45)',
            color: '#b5abfc',
            boxShadow: '0 0 12px rgba(145,132,217,0.12)',
            transition: 'all .25s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.28)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.18)' }}
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
          <CalendarFilmStrip
            events={events}
            now={now}
            onScroll={() => soundRef.current?.playDetent()}
          />
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
            now={now}
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
