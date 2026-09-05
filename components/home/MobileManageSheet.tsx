'use client'

import { useState } from 'react'
import type { DailyTask } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

function formatTime(timeOfDay: string | null): string {
  if (!timeOfDay) return ''
  const [hStr, mStr] = timeOfDay.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

interface MobileManageSheetProps {
  open: boolean
  tasks: DailyTask[]
  categoryMap: Record<string, string>
  onClose: () => void
  onEditTask: (task: DailyTask) => void
  onDeleteTask: (taskId: string) => Promise<void>
}

export default function MobileManageSheet({
  open, tasks, categoryMap, onClose, onEditTask, onDeleteTask,
}: MobileManageSheetProps) {
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
          background: 'rgba(11,12,20,0.7)',
          backdropFilter: 'blur(5px)',
          zIndex: 800,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg,#232532,#161826)',
          borderTop: '1px solid rgba(233,233,237,0.08)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.55)',
          zIndex: 900,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .45s cubic-bezier(.2,.85,.2,1), opacity .3s ease',
          display: 'flex', flexDirection: 'column',
          maxHeight: '82vh',
          padding: '0 0 env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(233,233,237,0.2)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '6px 22px 14px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 4 }}>
            {DAILY_TASKS.MANAGE_EYEBROW}
          </div>
          <div style={{ fontSize: 20, fontWeight: 300, color: '#e9e9ed' }}>
            {DAILY_TASKS.MANAGE_HEADING}
          </div>
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {tasks.length === 0 ? (
            <div style={{ fontSize: 14, color: '#595d6c', padding: '8px 6px' }}>
              {DAILY_TASKS.MOBILE_MANAGE_EMPTY}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map((task) => {
                const isConfirming = confirmId === task.id
                const isDeleting = deletingId === task.id
                const color = catColor(task.category)

                return (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '12px 13px', borderRadius: 12,
                      background: isConfirming ? 'rgba(220,38,38,0.08)' : 'rgba(233,233,237,0.03)',
                      border: `1px solid ${isConfirming ? 'rgba(220,38,38,0.2)' : 'rgba(233,233,237,0.06)'}`,
                      transition: 'background .2s ease, border-color .2s ease',
                    }}
                  >
                    {/* Category dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />

                    {/* Title + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#e9e9ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#595d6c', marginTop: 2, display: 'flex', gap: 6 }}>
                        <span style={{ textTransform: 'capitalize' }}>{task.category}</span>
                        {task.timeOfDay && <span>{formatTime(task.timeOfDay)}</span>}
                        <span style={{ color: '#3d4054' }}>·</span>
                        <span>{task.scope}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {isConfirming ? (
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          onClick={() => handleDelete(task.id)}
                          disabled={isDeleting}
                          style={{ height: 30, padding: '0 11px', borderRadius: 8, cursor: isDeleting ? 'default' : 'pointer', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', fontSize: 12, opacity: isDeleting ? 0.5 : 1 }}
                        >
                          {isDeleting ? '…' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          style={{ height: 30, padding: '0 9px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => onEditTask(task)}
                          title="Edit task"
                          style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.08)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmId(task.id)}
                          title="Delete task"
                          style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.08)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
        </div>

        {/* Done button */}
        <div style={{ padding: '14px 16px', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ width: '100%', height: 46, borderRadius: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.12)', color: '#75798c', fontSize: 14 }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}
