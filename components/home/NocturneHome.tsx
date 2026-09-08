'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { DailyTask, NocturneCalendarData, NocturneCalendarEvent, TaskScope, WeeklyRate, TaskStruggleStat } from '@/lib/types/dailyTasks'
import type { TaskCategoryRecord } from '@/lib/types/taskCategories'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { DAILY_TASKS } from '@/locales/en'
import { SoundEngine } from './SoundEngine'
import TodayPanel from './TodayPanel'
import CalendarFilmStrip from './CalendarFilmStrip'
import WheelPanel from './WheelPanel'
import TaskSlideOver, { type TaskDraft } from './TaskSlideOver'
import ManageTasksSlideOver from './ManageTasksSlideOver'
import AddCategoryModal from './AddCategoryModal'
import JackpotOverlay from './JackpotOverlay'

type Tab = 'today' | 'calendar' | 'wheel'

interface NocturneHomeProps {
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

export default function NocturneHome({
  householdId, initialTasks, initialEvents, initialCategories, initialWeeklyRate, initialStruggleStats,
}: NocturneHomeProps) {
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

  // categoryMap derived from categories; 'meals' hardcoded for recipe calendar events
  const categoryMap = useMemo<Record<string, string>>(() => ({
    ...Object.fromEntries(categories.map((c) => [c.name, c.color])),
    meals: 'oklch(0.72 0.15 170)',
  }), [categories])

  // Auto-reset at next 9am boundary
  useEffect(() => {
    const n = new Date()
    const next9 = new Date(n)
    next9.setHours(9, 0, 0, 0)
    if (n >= next9) next9.setDate(next9.getDate() + 1)
    const timer = setTimeout(() => {
      apiClient.get<{ data: DailyTask[] }>(`/api/dashboard/${householdId}/tasks`)
        .then((res) => setTasks(res.data.data))
        .catch((err) => console.error('[NocturneHome/9amReset]', err))
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
      console.error('[NocturneHome.handleComplete]', err)
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
      console.error('[NocturneHome.handleUncomplete]', err)
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: true } : t))
      setEvents((prev) => ({
        ...prev,
        [todayISO]: (prev[todayISO] ?? []).map((ev) => ev.taskId === taskId ? { ...ev, done: true } : ev),
      }))
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  // Toggle a task from the calendar (specific date, may be past/future)
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
      console.error('[NocturneHome.handleCalendarTaskToggle]', err)
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
      console.error('[NocturneHome.handleReset]', err)
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
      showToast(`"${newTask.title}" added to wheel`)
    } catch (err) {
      console.error('[NocturneHome.handleSave]', err)
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
    // Remove any calendar events for this task
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
    soundRef.current?.playSwipe()
    setEvents((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).map((ev) => ev.eventId === eventId ? { ...ev, done: !currentlyDone } : ev),
    }))
    try {
      await apiClient.patch(`/api/dashboard/${householdId}/events/${eventId}`, { completed: !currentlyDone })
      showToast(currentlyDone ? DAILY_TASKS.TOAST_CALENDAR_UNDONE : DAILY_TASKS.TOAST_CALENDAR_DONE)
    } catch (err) {
      console.error('[NocturneHome.handleCalendarEventToggle]', err)
      setEvents((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).map((ev) => ev.eventId === eventId ? { ...ev, done: currentlyDone } : ev),
      }))
      showToast(DAILY_TASKS.ERRORS.UPDATE_FAILED, '#d97777')
    }
  }

  // ── Edit task from calendar ──────────────────────────────────────────────────

  function handleEditTaskFromCalendar(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    setEditingTask(task)
  }

  // ── Tab / panel helpers ──────────────────────────────────────────────────────

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

  function openCreating() { soundRef.current?.playOpenPanel(); setCreating(true) }
  function closeCreating() { soundRef.current?.playClosePanel(); setCreating(false) }
  function closeEditing() { soundRef.current?.playClosePanel(); setEditingTask(null) }

  const taskSlideOpen = creating || !!editingTask

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 32px 0', flexShrink: 0 }}>
        {tabs.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              style={{
                height: 34, padding: '0 18px', borderRadius: 20, cursor: 'pointer',
                fontSize: 13, fontWeight: 400,
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

        {/* Reset day */}
        <button
          onClick={handleReset}
          disabled={resetting}
          title="Clear all completions for today"
          style={{ height: 34, padding: '0 14px', borderRadius: 20, cursor: resetting ? 'default' : 'pointer', fontSize: 12, background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#595d6c', opacity: resetting ? 0.5 : 1, transition: 'all .25s ease', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {DAILY_TASKS.RESET_DAY}
        </button>

        {/* Manage tasks */}
        <button
          onClick={() => setManaging(true)}
          style={{ height: 34, padding: '0 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', transition: 'all .25s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#9397ab'; e.currentTarget.style.borderColor = 'rgba(233,233,237,0.2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#75798c'; e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
        >
          {DAILY_TASKS.MANAGE_TASKS}
        </button>

        {/* Add category */}
        <button
          onClick={() => setShowAddCategory(true)}
          title="Add category"
          style={{ width: 42, height: 42, borderRadius: 20, cursor: 'pointer', fontSize: 20, background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.12)', color: '#75798c', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.1)'; e.currentTarget.style.color = '#b5abfc' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(233,233,237,0.05)'; e.currentTarget.style.color = '#75798c' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
          </svg>
        </button>

        {/* Add task */}
        <button
          onClick={openCreating}
          style={{ height: 42, padding: '0 20px', borderRadius: 20, cursor: 'pointer', fontSize: 15, fontWeight: 500, background: 'rgba(145,132,217,0.18)', border: '1px solid rgba(145,132,217,0.45)', color: '#b5abfc', boxShadow: '0 0 12px rgba(145,132,217,0.12)', transition: 'all .25s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.28)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.18)' }}
        >
          + {DAILY_TASKS.NEW_TASK}
        </button>
      </div>

      {/* Panel area */}
      <div style={{ flex: 1, position: 'relative', padding: '20px 32px 0', overflow: 'hidden' }}>
        {/* Today */}
        <div style={{ position: 'absolute', inset: '20px 32px 0', opacity: tab === 'today' ? 1 : 0, transform: tab === 'today' ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.985)', pointerEvents: tab === 'today' ? 'auto' : 'none', transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)' }}>
          <TodayPanel tasks={tasks} events={todayEvents} weeklyRate={weeklyRate} categoryMap={categoryMap} now={now} struggleStats={struggleStats} />
        </div>

        {/* Calendar */}
        <div style={{ position: 'absolute', inset: '20px 32px 0', opacity: tab === 'calendar' ? 1 : 0, transform: tab === 'calendar' ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.985)', pointerEvents: tab === 'calendar' ? 'auto' : 'none', transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)' }}>
          <CalendarFilmStrip
            events={events}
            now={now}
            isActive={tab === 'calendar'}
            categoryMap={categoryMap}
            onScroll={() => soundRef.current?.playDetent()}
            onAddEvent={handleCreateCalendarEvent}
            onEditTask={handleEditTaskFromCalendar}
            onDeleteEvent={handleDeleteCalendarEvent}
            onTaskToggled={handleCalendarTaskToggle}
            onEventToggled={handleCalendarEventToggle}
          />
        </div>

        {/* Wheel */}
        <div style={{ position: 'absolute', inset: '20px 32px 0', opacity: tab === 'wheel' ? 1 : 0, transform: tab === 'wheel' ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.985)', pointerEvents: tab === 'wheel' ? 'auto' : 'none', transition: 'opacity .45s ease, transform .55s cubic-bezier(.2,.8,.2,1)' }}>
          <WheelPanel
            tasks={tasks}
            now={now}
            isActive={tab === 'wheel'}
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

      {/* Task slide-over (create + edit) */}
      <TaskSlideOver
        open={taskSlideOpen}
        categories={categories}
        editTask={editingTask}
        onClose={creating ? closeCreating : closeEditing}
        onSave={editingTask
          ? (draft) => handleUpdate(editingTask.id, draft)
          : handleSave
        }
        onDeleteTask={editingTask ? handleDeleteTask : undefined}
        soundRef={soundRef}
      />

      {/* Manage tasks */}
      <ManageTasksSlideOver
        open={managing}
        tasks={tasks}
        categoryMap={categoryMap}
        onClose={() => setManaging(false)}
        onEditTask={(task) => { setManaging(false); setEditingTask(task) }}
        onDeleteTask={handleDeleteTask}
      />

      {/* Add category modal */}
      <AddCategoryModal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSave={handleCreateCategory}
      />

      {/* Jackpot overlay */}
      {jackpot && <JackpotOverlay onDone={() => setJackpot(false)} />}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 32, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(22,24,38,0.96)',
            border: `1px solid ${toast.color}`,
            borderRadius: 30, padding: '10px 22px',
            fontSize: 14, color: '#e9e9ed',
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
