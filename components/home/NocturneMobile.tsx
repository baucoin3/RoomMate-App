'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { DailyTask, NocturneCalendarData, NocturneCalendarEvent, TaskScope, WeeklyRate, TaskStruggleStat } from '@/lib/types/dailyTasks'
import type { TaskCategoryRecord } from '@/lib/types/taskCategories'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { DAILY_TASKS } from '@/locales/en'
import { SoundEngine } from './SoundEngine'
import MobileTodayPanel from './MobileTodayPanel'
import MobileCalendarStrip from './MobileCalendarStrip'
import MobileTaskCard from './MobileTaskCard'
import MobileTaskSheet from './MobileTaskSheet'
import MobileManageSheet from './MobileManageSheet'
import AddCategoryModal from './AddCategoryModal'
import JackpotOverlay from './JackpotOverlay'
import type { TaskDraft } from './TaskSlideOver'

type Tab = 'today' | 'calendar' | 'wheel'

interface NocturneMobileProps {
  householdId: string
  initialTasks: DailyTask[]
  initialEvents: NocturneCalendarData
  initialCategories: TaskCategoryRecord[]
  initialWeeklyRate: WeeklyRate
  initialStruggleStats: TaskStruggleStat[]
}

function sortTasks(list: DailyTask[]): DailyTask[] {
  return [...list].sort((a, b) => {
    if (!a.timeOfDay) return 1
    if (!b.timeOfDay) return -1
    return a.timeOfDay.localeCompare(b.timeOfDay)
  })
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: DAILY_TASKS.TAB_TODAY },
  { key: 'calendar', label: DAILY_TASKS.TAB_CALENDAR },
  { key: 'wheel', label: DAILY_TASKS.MOBILE_TAB_TASKS },
]

export default function NocturneMobile({
  householdId, initialTasks, initialEvents, initialCategories, initialWeeklyRate, initialStruggleStats,
}: NocturneMobileProps) {
  const [tab, setTab] = useState<Tab>('today')
  const [tasks, setTasks] = useState<DailyTask[]>(initialTasks)
  const [events, setEvents] = useState<NocturneCalendarData>(initialEvents)
  const [categories, setCategories] = useState<TaskCategoryRecord[]>(initialCategories)
  const [weeklyRate, setWeeklyRate] = useState<WeeklyRate>(initialWeeklyRate)
  const [struggleStats, setStruggleStats] = useState<TaskStruggleStat[]>(initialStruggleStats)

  const [creating, setCreating] = useState(false)
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null)
  const [managing, setManaging] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [jackpot, setJackpot] = useState(false)
  const [resetting, setResetting] = useState(false)

  const [now] = useState(() => new Date())
  const todayISO = now.toLocaleDateString('en-CA')

  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [springNonce, setSpringNonce] = useState(0)
  const [springIndex, setSpringIndex] = useState(0)

  const soundRef = useRef<SoundEngine | null>(null)
  useEffect(() => { soundRef.current = new SoundEngine() }, [])

  const categoryMap = useMemo<Record<string, string>>(() => ({
    ...Object.fromEntries(categories.map((c) => [c.name, c.color])),
    meals: 'oklch(0.72 0.15 170)',
  }), [categories])

  // Auto-reset at next 9am
  useEffect(() => {
    const n = new Date()
    const next9 = new Date(n)
    next9.setHours(9, 0, 0, 0)
    if (n >= next9) next9.setDate(next9.getDate() + 1)
    const timer = setTimeout(() => {
      apiClient.get<{ data: DailyTask[] }>(`/api/dashboard/${householdId}/tasks`)
        .then((res) => setTasks(res.data.data))
        .catch((err) => console.error('[NocturneMobile/9amReset]', err))
    }, next9.getTime() - n.getTime())
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg: string, color = '#9184d9') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, color })
    toastTimerRef.current = setTimeout(() => setToast(null), 3200)
  }

  // ── Task completion ──────────────────────────────────────────────────────────

  async function handleComplete(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: true } : t))
    setEvents((prev) => ({
      ...prev,
      [todayISO]: (prev[todayISO] ?? []).map((ev) => ev.taskId === taskId ? { ...ev, done: true } : ev),
    }))
    try {
      await apiClient.post(`/api/dashboard/${householdId}/tasks/${taskId}/complete`)
      showToast(DAILY_TASKS.TOAST_COMPLETED, categoryMap[task.category] ?? '#9184d9')
    } catch (err) {
      console.error('[NocturneMobile.handleComplete]', err)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: false } : t))
      setEvents((prev) => ({
        ...prev,
        [todayISO]: (prev[todayISO] ?? []).map((ev) => ev.taskId === taskId ? { ...ev, done: false } : ev),
      }))
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  async function handleUncomplete(taskId: string) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: false } : t))
    setEvents((prev) => ({
      ...prev,
      [todayISO]: (prev[todayISO] ?? []).map((ev) => ev.taskId === taskId ? { ...ev, done: false } : ev),
    }))
    try {
      await apiClient.delete(`/api/dashboard/${householdId}/tasks/${taskId}/complete`)
    } catch (err) {
      console.error('[NocturneMobile.handleUncomplete]', err)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: true } : t))
      setEvents((prev) => ({
        ...prev,
        [todayISO]: (prev[todayISO] ?? []).map((ev) => ev.taskId === taskId ? { ...ev, done: true } : ev),
      }))
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  async function handleCalendarTaskToggle(taskId: string, date: string, currentlyDone: boolean) {
    soundRef.current?.playSwipe()
    setEvents((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).map((ev) => ev.taskId === taskId ? { ...ev, done: !currentlyDone } : ev),
    }))
    if (date === todayISO) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: !currentlyDone } : t))
    }
    try {
      if (currentlyDone) {
        await apiClient.delete(`/api/dashboard/${householdId}/tasks/${taskId}/complete?date=${date}`)
      } else {
        await apiClient.post(`/api/dashboard/${householdId}/tasks/${taskId}/complete`, { date })
      }
      showToast(currentlyDone ? DAILY_TASKS.TOAST_CALENDAR_UNDONE : DAILY_TASKS.TOAST_CALENDAR_DONE)
    } catch (err) {
      console.error('[NocturneMobile.handleCalendarTaskToggle]', err)
      setEvents((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).map((ev) => ev.taskId === taskId ? { ...ev, done: currentlyDone } : ev),
      }))
      if (date === todayISO) {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: currentlyDone } : t))
      }
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  async function handleReset() {
    if (resetting) return
    setResetting(true)
    const prevTasks = tasks
    setTasks((prev) => prev.map((t) => ({ ...t, done: false })))
    const liveToday = new Date().toLocaleDateString('en-CA')
    setEvents((prev) => ({
      ...prev,
      [liveToday]: (prev[liveToday] ?? []).map((ev) => ev.type === 'task' ? { ...ev, done: false } : ev),
    }))
    soundRef.current?.playFlush()
    try {
      await apiClient.delete(`/api/dashboard/${householdId}/tasks/reset`)
      showToast(DAILY_TASKS.TOAST_RESET, 'oklch(0.734 0.125 175)')
    } catch (err) {
      console.error('[NocturneMobile.handleReset]', err)
      setTasks(prevTasks)
      showToast(DAILY_TASKS.ERRORS.RESET_FAILED, '#d97777')
    } finally {
      setResetting(false)
    }
  }

  // ── Create task ──────────────────────────────────────────────────────────────

  async function handleSave(draft: TaskDraft) {
    if (!draft.category) return
    try {
      const res = await apiClient.post<{ data: DailyTask }>(`/api/dashboard/${householdId}/tasks`, {
        title: draft.title,
        category: draft.category,
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
      showToast(DAILY_TASKS.MOBILE_TOAST_TASK_ADDED(newTask.title))
    } catch (err) {
      console.error('[NocturneMobile.handleSave]', err)
      showToast(getErrorMessage(err), '#d97777')
    }
  }

  // ── Update task ──────────────────────────────────────────────────────────────

  async function handleUpdate(taskId: string, draft: TaskDraft) {
    if (!draft.category) return
    const res = await apiClient.patch<{ data: DailyTask }>(`/api/dashboard/${householdId}/tasks/${taskId}`, {
      title: draft.title,
      category: draft.category,
      timeOfDay: draft.time || null,
      logsToCalendar: draft.logsToCalendar,
      scope: draft.scope,
    })
    const updated = res.data.data
    setTasks((prev) => sortTasks(prev.map((t) => t.id === taskId ? updated : t)))
    setEditingTask(null)
    showToast(DAILY_TASKS.TOAST_TASK_UPDATED)
  }

  // ── Delete task ──────────────────────────────────────────────────────────────

  async function handleDeleteTask(taskId: string) {
    await apiClient.delete(`/api/dashboard/${householdId}/tasks/${taskId}`)
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setEvents((prev) => {
      const next = { ...prev }
      for (const [date, evs] of Object.entries(next)) {
        next[date] = evs.filter((ev) => ev.taskId !== taskId)
      }
      return next
    })
    setEditingTask(null)
    showToast(DAILY_TASKS.TOAST_TASK_DELETED, '#d97777')
  }

  // ── Categories ───────────────────────────────────────────────────────────────

  async function handleCreateCategory(name: string, color: string) {
    const res = await apiClient.post<{ data: TaskCategoryRecord }>(
      `/api/dashboard/${householdId}/task-categories`,
      { name, color },
    )
    const newCat = res.data.data
    setCategories((prev) => [...prev, newCat])
    setShowAddCategory(false)
    showToast(DAILY_TASKS.TOAST_CATEGORY_ADDED(name), color)
  }

  async function handleDeleteCategory(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId)
    await apiClient.delete(`/api/dashboard/${householdId}/task-categories/${categoryId}`)
    setCategories((prev) => prev.filter((c) => c.id !== categoryId))
    if (cat) showToast(DAILY_TASKS.TOAST_CATEGORY_DELETED(cat.name), '#d97777')
  }

  // ── Calendar events ──────────────────────────────────────────────────────────

  async function handleCreateCalendarEvent(date: string, title: string, scope: TaskScope) {
    const res = await apiClient.post<{ data: { id: string; date: string; title: string } }>(
      `/api/dashboard/${householdId}/events`,
      { date, title, scope },
    )
    const ev = res.data.data
    const newEvent: NocturneCalendarEvent = { type: 'event', time: '—', title: ev.title, cat: 'home', eventId: ev.id }
    setEvents((prev) => ({ ...prev, [date]: [...(prev[date] ?? []), newEvent] }))
    showToast(DAILY_TASKS.TOAST_EVENT_ADDED)
  }

  async function handleDeleteCalendarEvent(eventId: string, date: string) {
    await apiClient.delete(`/api/dashboard/${householdId}/events/${eventId}`)
    setEvents((prev) => {
      const evs = (prev[date] ?? []).filter((ev) => ev.eventId !== eventId)
      return { ...prev, [date]: evs }
    })
    showToast(DAILY_TASKS.TOAST_EVENT_DELETED)
  }

  async function handleCalendarEventToggle(eventId: string, date: string, currentlyDone: boolean) {
    setEvents((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).map((ev) => ev.eventId === eventId ? { ...ev, done: !currentlyDone } : ev),
    }))
    try {
      await apiClient.patch(`/api/dashboard/${householdId}/events/${eventId}`, { completed: !currentlyDone })
      showToast(currentlyDone ? DAILY_TASKS.TOAST_CALENDAR_UNDONE : DAILY_TASKS.TOAST_CALENDAR_DONE)
    } catch (err) {
      console.error('[NocturneMobile.handleCalendarEventToggle]', err)
      setEvents((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).map((ev) => ev.eventId === eventId ? { ...ev, done: currentlyDone } : ev),
      }))
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  function handleEditTaskFromCalendar(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    setEditingTask(task)
  }

  // ── Panel visibility helpers ─────────────────────────────────────────────────

  function switchTab(t: Tab) {
    if (t === tab) return
    soundRef.current?.playOpenPanel()
    setTab(t)
  }

  function openCreating() { soundRef.current?.playOpenPanel(); setCreating(true) }
  function closeCreating() { soundRef.current?.playClosePanel(); setCreating(false) }
  function closeEditing() { soundRef.current?.playClosePanel(); setEditingTask(null) }

  const sheetOpen = creating || !!editingTask
  const todayEvents = events[todayISO] ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent' }}>

      {/* Row 1: Tab switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 16px 0', flexShrink: 0 }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              style={{
                height: 32, padding: '0 18px', borderRadius: 20, cursor: 'pointer',
                fontSize: 13, fontWeight: 400,
                background: active ? 'rgba(145,132,217,0.16)' : 'transparent',
                border: `1px solid ${active ? '#9184d9' : 'rgba(233,233,237,0.1)'}`,
                color: active ? '#e9e9ed' : '#75798c',
                boxShadow: active ? '0 0 18px rgba(145,132,217,0.25)' : 'none',
                transition: 'all .25s ease',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Row 2: Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 0', flexShrink: 0 }}>
        {/* Add task */}
        <button
          onClick={openCreating}
          style={{ flex: 1, height: 30, borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 500, background: 'rgba(145,132,217,0.18)', border: '1px solid rgba(145,132,217,0.45)', color: '#b5abfc', transition: 'all .25s ease' }}
        >
          {DAILY_TASKS.MOBILE_NEW_BTN}
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          disabled={resetting}
          title="Clear all completions for today"
          style={{ flex: 1, height: 30, borderRadius: 20, cursor: resetting ? 'default' : 'pointer', fontSize: 12, background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#595d6c', opacity: resetting ? 0.4 : 1, transition: 'all .25s ease' }}
        >
          {DAILY_TASKS.MOBILE_RESET_BTN}
        </button>

        {/* Manage */}
        <button
          onClick={() => setManaging(true)}
          style={{ flex: 1, height: 30, borderRadius: 20, cursor: 'pointer', fontSize: 12, background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', transition: 'all .25s ease' }}
        >
          {DAILY_TASKS.MOBILE_MANAGE_BTN}
        </button>
      </div>

      {/* Panel area */}
      <div style={{ flex: 1, position: 'relative', padding: '14px 16px 0', overflow: 'hidden' }}>
        {/* Today */}
        <div style={{ position: 'absolute', inset: '14px 16px 0', opacity: tab === 'today' ? 1 : 0, transform: tab === 'today' ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.985)', pointerEvents: tab === 'today' ? 'auto' : 'none', transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)' }}>
          <MobileTodayPanel
            tasks={tasks}
            events={todayEvents}
            weeklyRate={weeklyRate}
            categoryMap={categoryMap}
            now={now}
            struggleStats={struggleStats}
          />
        </div>

        {/* Calendar */}
        <div style={{ position: 'absolute', inset: '14px 16px 0', opacity: tab === 'calendar' ? 1 : 0, transform: tab === 'calendar' ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.985)', pointerEvents: tab === 'calendar' ? 'auto' : 'none', transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)' }}>
          <MobileCalendarStrip
            events={events}
            now={now}
            categoryMap={categoryMap}
            onAddEvent={handleCreateCalendarEvent}
            onDeleteEvent={handleDeleteCalendarEvent}
            onEditTask={handleEditTaskFromCalendar}
            onTaskToggled={handleCalendarTaskToggle}
            onEventToggled={handleCalendarEventToggle}
          />
        </div>

        {/* Tasks (wheel) */}
        <div style={{ position: 'absolute', inset: '14px 16px 0', opacity: tab === 'wheel' ? 1 : 0, transform: tab === 'wheel' ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.985)', pointerEvents: tab === 'wheel' ? 'auto' : 'none', transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)' }}>
          <MobileTaskCard
            tasks={tasks}
            now={now}
            categoryMap={categoryMap}
            soundRef={soundRef}
            springNonce={springNonce}
            springIndex={springIndex}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onJackpot={() => setJackpot(true)}
          />
        </div>
      </div>

      {/* Task bottom sheet (create + edit) */}
      <MobileTaskSheet
        open={sheetOpen}
        categories={categories}
        editTask={editingTask}
        onClose={creating ? closeCreating : closeEditing}
        onSave={editingTask ? (draft) => handleUpdate(editingTask.id, draft) : handleSave}
        onDeleteTask={editingTask ? handleDeleteTask : undefined}
        soundRef={soundRef}
      />

      {/* Manage sheet */}
      <MobileManageSheet
        open={managing}
        tasks={tasks}
        categoryMap={categoryMap}
        onClose={() => setManaging(false)}
        onEditTask={(task) => { setManaging(false); setEditingTask(task) }}
        onDeleteTask={handleDeleteTask}
      />

      {/* Add category modal (reused as-is) */}
      <AddCategoryModal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSave={handleCreateCategory}
      />

      {/* Jackpot overlay (reused as-is) */}
      {jackpot && <JackpotOverlay onDone={() => setJackpot(false)} />}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 80, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(22,24,38,0.96)',
            border: `1px solid ${toast.color}`,
            borderRadius: 30, padding: '9px 20px',
            fontSize: 13, color: '#e9e9ed',
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
