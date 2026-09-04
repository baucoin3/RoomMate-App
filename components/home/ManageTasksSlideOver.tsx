'use client'

import { useState } from 'react'
import type { DailyTask } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

interface ManageTasksSlideOverProps {
  open: boolean
  tasks: DailyTask[]
  categoryMap: Record<string, string>
  onClose: () => void
  onEditTask: (task: DailyTask) => void
  onDeleteTask: (taskId: string) => Promise<void>
}

function formatTime(timeOfDay: string | null): string {
  if (!timeOfDay) return ''
  const [hStr, mStr] = timeOfDay.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

export default function ManageTasksSlideOver({
  open,
  tasks,
  categoryMap,
  onClose,
  onEditTask,
  onDeleteTask,
}: ManageTasksSlideOverProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(taskId: string) {
    setDeletingId(taskId)
    try {
      await onDeleteTask(taskId)
      setConfirmId(null)
    } finally {
      setDeletingId(null)
    }
  }

  function catColor(cat: string): string {
    return categoryMap[cat] ?? 'rgba(233,233,237,0.3)'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(11,12,20,0.66)',
          backdropFilter: 'blur(6px)',
          zIndex: 800,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .35s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 460,
          background: 'linear-gradient(200deg,#232532,#161826)',
          borderLeft: '1px solid rgba(233,233,237,0.08)',
          boxShadow: '-30px 0 80px rgba(0,0,0,0.5)',
          zIndex: 900,
          transform: open ? 'translateX(0)' : 'translateX(30px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .5s cubic-bezier(.2,.85,.2,1), opacity .35s ease',
          display: 'flex', flexDirection: 'column',
          padding: '36px 32px 32px',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 8 }}>
          {DAILY_TASKS.MANAGE_EYEBROW}
        </div>
        <div style={{ fontSize: 24, fontWeight: 300, color: '#e9e9ed', marginBottom: 32 }}>
          {DAILY_TASKS.MANAGE_HEADING}
        </div>

        {tasks.length === 0 ? (
          <div style={{ fontSize: 14, color: '#595d6c', padding: '16px 0' }}>
            {DAILY_TASKS.MANAGE_EMPTY}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tasks.map((task) => {
              const isConfirming = confirmId === task.id
              const isDeleting = deletingId === task.id
              const color = catColor(task.category)

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px',
                    borderRadius: 12,
                    background: isConfirming ? 'rgba(220,38,38,0.08)' : 'rgba(233,233,237,0.03)',
                    border: `1px solid ${isConfirming ? 'rgba(220,38,38,0.2)' : 'rgba(233,233,237,0.06)'}`,
                    transition: 'background .2s ease, border-color .2s ease',
                  }}
                >
                  {/* Category dot */}
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#e9e9ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#595d6c', marginTop: 2, display: 'flex', gap: 8 }}>
                      <span style={{ textTransform: 'capitalize' }}>{task.category}</span>
                      {task.timeOfDay && <span>{formatTime(task.timeOfDay)}</span>}
                      <span style={{ color: '#3d4054' }}>·</span>
                      <span>{task.scope}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {isConfirming ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleDelete(task.id)}
                        disabled={isDeleting}
                        style={{ height: 30, padding: '0 12px', borderRadius: 8, cursor: isDeleting ? 'default' : 'pointer', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', fontSize: 12, opacity: isDeleting ? 0.5 : 1 }}
                      >
                        {isDeleting ? '…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        style={{ height: 30, padding: '0 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 12 }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {/* Edit */}
                      <button
                        onClick={() => { onEditTask(task) }}
                        title="Edit task"
                        style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.08)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.14)'; e.currentTarget.style.color = '#b5abfc' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(233,233,237,0.05)'; e.currentTarget.style.color = '#9397ab' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setConfirmId(task.id)}
                        title="Delete task"
                        style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.08)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.12)'; e.currentTarget.style.color = '#f87171' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(233,233,237,0.05)'; e.currentTarget.style.color = '#9397ab' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={onClose}
          style={{ marginTop: 24, height: 46, borderRadius: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.12)', color: '#75798c', fontSize: 14 }}
        >
          Done
        </button>
      </div>
    </>
  )
}
