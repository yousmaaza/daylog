import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'

// ── Constants ────────────────────────────────────────────────────────────────

const HOUR_H         = 64
const TIMELINE_START = 0
const TIMELINE_END   = 24
const STORAGE_KEY    = 'dl-tasks-v3'
const AUTH_KEY       = 'dl-auth'
const TEMPLATES_KEY  = 'dl-templates'

// ── Tags ─────────────────────────────────────────────────────────────────────

const DEFAULT_TAGS = [
  { id: 'work',         label: 'Work',         color: '#FFFFFF', bg: '#EDE9FF', border: '#D4CAFC', dot: '#7C5CFC', textColor: '#4C2FB0' },
  { id: 'sport',        label: 'Sport',        color: '#FFFFFF', bg: '#D1FAE5', border: '#A7F3D0', dot: '#10B981', textColor: '#065F46' },
  { id: 'meeting',      label: 'Meeting',      color: '#FFFFFF', bg: '#FFF4D6', border: '#FFE9A0', dot: '#F59E0B', textColor: '#92400E' },
  { id: 'lunch_dinner', label: 'Lunch/Dinner', color: '#FFFFFF', bg: '#E0F7FF', border: '#BAE6FD', dot: '#38BDF8', textColor: '#0369A1' },
  { id: 'commute',      label: 'Commute',      color: '#FFFFFF', bg: '#E0F2FE', border: '#BAE0FF', dot: '#06B6D4', textColor: '#0E7490' },
  { id: 'study',        label: 'Study',        color: '#FFFFFF', bg: '#FCE7F3', border: '#F9C4E0', dot: '#EC4899', textColor: '#9D174D' },
  { id: 'home',         label: 'Home',         color: '#FFFFFF', bg: '#FFE4E1', border: '#FFCDC8', dot: '#F97316', textColor: '#9A3412' },
  { id: 'personal',     label: 'Personal',     color: '#FFFFFF', bg: '#FFE8F3', border: '#FFC6E4', dot: '#F472B6', textColor: '#BE185D' },
  { id: 'other',        label: 'Other',        color: '#FFFFFF', bg: '#F5F3FF', border: '#E8E3FF', dot: '#8078A0', textColor: '#5A527A' },
]

// ── Per-task color palette ────────────────────────────────────────────────────

const TASK_PALETTE = [
  { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.5)',  dot: '#3b82f6' },
  { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.5)', dot: '#10b981' },
  { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.5)', dot: '#f59e0b' },
  { bg: 'rgba(236,72,153,0.18)', border: 'rgba(236,72,153,0.5)', dot: '#ec4899' },
  { bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.5)', dot: '#8b5cf6' },
  { bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.5)', dot: '#f97316' },
  { bg: 'rgba(6,182,212,0.18)',  border: 'rgba(6,182,212,0.5)',  dot: '#06b6d4' },
  { bg: 'rgba(251,113,133,0.18)',border: 'rgba(251,113,133,0.5)',dot: '#fb7185' },
]

const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Utilities ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function getTaskStatus(task) {
  if (task.done) return 'done'
  const last = task.sessions[task.sessions.length - 1]
  if (last && !last.endTime) return 'active'
  return 'idle'
}

function getTotalMs(task, now) {
  return task.sessions.reduce((acc, s) => {
    const end = s.endTime ?? now
    return acc + (end - s.startTime)
  }, 0)
}

function formatLive(ms) {
  if (ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatShort(ms) {
  if (ms < 0) ms = 0
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  if (totalSec > 0) return `${totalSec}s`
  return '0s'
}

function formatHM(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Google Icon ───────────────────────────────────────────────────────────────

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')

  const handleConfirm = () => {
    if (!name.trim()) return
    onLogin({
      name:  name.trim(),
      email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
      photo: null,
    })
  }

  return (
    <div className="login-overlay">
      {/* Decorative blobs */}
      <div className="login-blob login-blob--1" />
      <div className="login-blob login-blob--2" />

      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <span className="login-brand-text">ECHO</span>
          <span className="login-brand-dot" />
        </div>
        <p className="login-tagline">Track your time,<br />one task at a time.</p>

        <div className="login-sep" />

        {/* Buttons */}
        <div className="login-actions">
          <button className="login-google-btn" onClick={() => setShowForm(true)}>
            <GoogleIcon size={18} />
            <span>Continue with Google</span>
          </button>

          <div className="login-or-row">
            <span className="login-or-line" />
            <span className="login-or-label">or</span>
            <span className="login-or-line" />
          </div>

          <button className="login-guest-btn" onClick={() => onLogin({ name: 'Guest', email: '', photo: null })}>
            Continue as Guest
          </button>
        </div>
      </div>

      {/* Google sign-in form modal */}
      {showForm && (
        <div className="login-modal-bg" onClick={() => setShowForm(false)}>
          <div className="login-modal" onClick={e => e.stopPropagation()}>
            <div className="login-modal-header">
              <GoogleIcon size={22} />
              <span className="login-modal-title">Sign in with Google</span>
            </div>
            <p className="login-modal-sub">Enter your Google account details</p>
            <input
              className="login-modal-input"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && email.trim() && handleConfirm()}
            />
            <input
              className="login-modal-input"
              placeholder="Email address (optional)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            />
            <button
              className={`login-modal-submit${name.trim() ? ' login-modal-submit--on' : ''}`}
              onClick={handleConfirm}
              disabled={!name.trim()}
            >
              Sign in
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Analytics Components ─────────────────────────────────────────────────────


function Heatmap({ allTasks, now, mode, selDate }) {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  try {
    const dCount = mode === 'day' ? 1 : 7
    const days = Array(dCount).fill(0).map(() => Array(24).fill(0))
    const nowRef = now ? new Date(now) : new Date()

    if (mode === 'month') {
      const selDateObj = new Date(selDate + 'T12:00:00')
      const year = selDateObj.getFullYear()
      const month = selDateObj.getMonth()
      
      Object.keys(allTasks).forEach(k => {
        const [y, m, d] = k.split('-').map(Number)
        if (y === year && m - 1 === month) {
          const date = new Date(y, m - 1, d)
          // JS scale: 0=Sun, 1=Mon...6=Sat => Map to 0=Mon...6=Sun
          const dayIdx = (date.getDay() + 6) % 7
          const tasks = allTasks[k] ?? []
          tasks.forEach(t => {
            (t.sessions ?? []).forEach(s => {
              const start = new Date(s.startTime).getHours()
              const end   = new Date(s.endTime || nowRef).getHours()
              for (let h = Math.max(0, start); h <= Math.min(23, end); h++) {
                days[dayIdx][h] = (days[dayIdx][h] || 0) + 1
              }
            })
          })
        }
      })
    } else {
      for (let i = 0; i < dCount; i++) {
        const targetDate = new Date(nowRef)
        if (mode !== 'day') targetDate.setDate(targetDate.getDate() - (dCount - 1 - i))
        const key = mode === 'day' ? selDate : toKey(targetDate)
        const tasks = allTasks?.[key] ?? []
        tasks.forEach(t => {
          (t.sessions ?? []).forEach(s => {
            const sT = Number(s.startTime)
            const eT = Number(s.endTime || nowRef)
            if (!sT || isNaN(sT) || isNaN(eT)) return
            const start = new Date(sT).getHours()
            const end   = new Date(eT).getHours()
            for (let h = Math.max(0, start); h <= Math.min(23, end); h++) {
              days[i][h] = (days[i][h] || 0) + 1
            }
          })
        })
      }
    }

    const flat = days.flat()
    const max = Math.max(...flat, 1)

    // DEBUG: console.log('Heatmap Data', { mode, key, val: flat.filter(v => v > 0) })

    return (
      <div className="heatmap-wrap" data-mode={mode}>
        <div className="right-section-title">{mode === 'day' ? 'Daily Rhythm' : 'Weekly Pulse'}</div>
        <div className={mode === 'day' ? 'heatmap-grid-1d' : 'heatmap-grid-7d'}>
          {days.map((row, dIdx) => (
            <div key={dIdx} style={{ display: 'contents' }}>
              {mode !== 'day' && (
                <div className="heatmap-row-header">
                  <span className="heatmap-day-label">
                    {mode === 'month' ? dayNames[dIdx] : dayNames[(nowRef.getDay() - (6 - dIdx) + 6) % 7]}
                  </span>
                </div>
              )}
              {row.map((v, hIdx) => {
                const opacity = 0.08 + (Math.min(v, max) / max) * 0.92
                return (
                  <div 
                    key={hIdx} 
                    className="heatmap-cell" 
                    style={{ 
                      opacity, 
                      background: v > 0 ? 'var(--amber)' : 'rgba(124, 92, 252, 0.14)',
                      height: mode === 'day' ? '18px' : '9px'
                    }} 
                    title={`${hIdx}h: ${v} sessions`}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="heatmap-labels">
          <span style={{ marginLeft: mode === 'day' ? '0' : '24px' }}>0h</span>
          <span>6h</span><span>12h</span><span>18h</span><span>23h</span>
        </div>
      </div>
    )
  } catch (err) {
    return <div className="profile-empty">Stats unavailable</div>
  }
}

function DonutChart({ data, totalMs }) {
  const size = 120
  const r = size * 0.36
  const sw = size * 0.14
  const C = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2

  const safeTotal = totalMs === 0 ? 1 : totalMs
  const trackColor = 'rgba(124, 92, 252, 0.08)'

  let currentOffset = C

  return (
    <div className="donut-wrap">
      <div className="right-section-title">Time Breakdown</div>
      <div className="donut-svg-wrap">
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={sw} />
          {data.map((item, i) => {
            const segmentLen = ((item.ms || 0) / safeTotal) * C
            if (isNaN(segmentLen)) return null
            const segmentOffset = currentOffset
            currentOffset -= segmentLen
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={item.color}
                strokeWidth={sw}
                strokeDasharray={`${segmentLen} ${C - segmentLen}`}
                strokeDashoffset={segmentOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.4s ease' }}
              />
            )
          })}
        </svg>
        <div className="donut-center-text">
          <span className="donut-center-value">{formatShort(totalMs)}</span>
          <span className="donut-center-label">total</span>
        </div>
      </div>
    </div>
  )
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function buildColumns(blocks) {
  const sorted = [...blocks].sort((a, b) => a.startY - b.startY)
  const cols = []

  return sorted.map(block => {
    let colIdx = cols.findIndex(col => {
      const last = col[col.length - 1]
      return last.realEndY <= block.startY + 0.5
    })
    if (colIdx === -1) {
      colIdx = cols.length
      cols.push([])
    }
    cols[colIdx].push({ realEndY: block.realEndY })
    return { ...block, col: colIdx }
  })
}

function Timeline({ allTasks, days, viewMode, now, timelineScrollRef }) {
  const isWeek  = viewMode === 'week'
  const todayKey = toKey(new Date())

  const nowDate  = new Date(now)
  const nowHours = nowDate.getHours() + nowDate.getMinutes() / 60 + nowDate.getSeconds() / 3600
  const nowTop   = (nowHours - TIMELINE_START) * HOUR_H

  const rawBlocks = useMemo(() => {
    const blocks = []
    days.forEach((day, dayIndex) => {
      const dayTasks = allTasks[day.key] ?? []
      dayTasks.forEach((task, taskIdx) => {
        const status   = getTaskStatus(task)
        const colorIdx = task.colorIdx ?? (taskIdx % TASK_PALETTE.length)
        task.sessions.forEach(sess => {
          const start  = new Date(sess.startTime)
          const end    = sess.endTime ? new Date(sess.endTime) : new Date(now)
          const startH = start.getHours() + start.getMinutes() / 60 + start.getSeconds() / 3600
          const endH   = end.getHours()   + end.getMinutes()   / 60 + end.getSeconds()   / 3600

          const clampedStart = Math.max(startH, TIMELINE_START)
          const startY       = (clampedStart - TIMELINE_START) * HOUR_H

          let height, endY, realEndY
          if (!sess.endTime) {
            const liveEndY = Math.max(nowTop, startY)
            height   = liveEndY - startY
            endY     = liveEndY
            realEndY = liveEndY
          } else {
            const clampedEnd = Math.min(endH, TIMELINE_END)
            if (clampedEnd <= clampedStart) return
            const rawH = (clampedEnd - clampedStart) * HOUR_H
            height   = Math.max(rawH, 2)
            endY     = startY + height
            realEndY = startY + rawH
          }

          const blockId = sess.id ? `${sess.id}` : `${task.id}-${sess.startTime}`
          blocks.push({
            id: blockId, taskId: task.id, name: task.name,
            status, colorIdx, isLive: !sess.endTime,
            startY, endY, realEndY, height,
            startTime: sess.startTime, endTime: sess.endTime, dayIndex,
            tagId: task.tags?.[0], tags: task.tags,
          })
        })
      })
    })
    return blocks
  }, [allTasks, days, now])

  const blocksWithCols = useMemo(() => {
    const result = []
    days.forEach((_, dayIndex) => {
      const dayBlocks = rawBlocks.filter(b => b.dayIndex === dayIndex)
      result.push(...buildColumns(dayBlocks))
    })
    return result
  }, [rawBlocks, days])

  const displayBlocks = useMemo(() => {
    const result = {}
    blocksWithCols.forEach(block => {
      result[block.id] = { displayTop: block.startY, displayHeight: block.isLive ? block.height : Math.max(block.height, 2) }
    })
    return result
  }, [blocksWithCols])

  const numColsForBlock = useMemo(() => {
    return blocksWithCols.map(block => {
      const overlapping = blocksWithCols.filter(b =>
        b.dayIndex === block.dayIndex &&
        b.startY < block.realEndY - 0.5 && b.realEndY > block.startY + 0.5
      )
      return Math.max(...overlapping.map(b => b.col + 1), 1)
    })
  }, [blocksWithCols])

  const hours = useMemo(() => {
    const arr = []
    for (let h = TIMELINE_START; h <= TIMELINE_END; h++) arr.push(h)
    return arr
  }, [])

  return (
    <div className={`panel-timeline${isWeek ? ' panel-timeline--week' : ''}`}>
      <div className="timeline-scroll" ref={timelineScrollRef}>
        {isWeek && (
          <div className="timeline-header-week">
            <div className="timeline-hour-label-spacer" />
            <div className="timeline-days-wrapper">
              {days.map(d => (
                <div key={d.key} className={`timeline-day-hdr ${d.key === todayKey ? 'timeline-day-hdr--today' : ''}`}>
                  <span className="hdr-short">{d.shortLabel}</span>
                  <span className="hdr-num">{d.dayNum}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="timeline-inner" style={{ height: (TIMELINE_END - TIMELINE_START) * HOUR_H }}>
          <div className="timeline-grid">
            {hours.map(h => (
              <div key={h} className="timeline-hour-row" style={{ top: (h - TIMELINE_START) * HOUR_H }}>
                <span className="timeline-hour-label">
                  {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
                </span>
                <div className="timeline-hour-line" />
              </div>
            ))}
          </div>

          <div className="timeline-blocks">
            {isWeek && days.map((_, i) => i > 0 && (
              <div key={`div-${i}`} className="timeline-day-divider" style={{ left: `${i * (100 / days.length)}%` }} />
            ))}

            {blocksWithCols.flatMap((block, idx) => {
              const numCols  = numColsForBlock[idx]
              const dayLeft  = block.dayIndex * (100 / days.length)
              const dayWidth = 100 / days.length
              const colWidth = dayWidth / numCols
              const colLeft  = dayLeft + (block.col * colWidth)
              const leftPct  = `calc(${colLeft}% + 2px)`
              const widthPct = `calc(${colWidth}% - 4px)`
              const sessionMs = block.endTime ? block.endTime - block.startTime : now - block.startTime
              const display   = displayBlocks[block.id] ?? { displayTop: block.startY, displayHeight: block.height }
              const { displayTop, displayHeight } = display
              const elems     = []
              const palette   = { ...TASK_PALETTE[block.colorIdx] }

              // ── Color override by tag ────────
              const taskTag = DEFAULT_TAGS.find(t => t.id === block.tagId)
              if (taskTag) {
                palette.dot    = taskTag.dot || taskTag.color
                palette.bg     = taskTag.bg
                palette.border = taskTag.border || taskTag.dot || taskTag.color
              }

              if (block.isLive) {
                elems.push(
                  <div key={`ptr-${block.id}`} className="session-pointer"
                    style={{ top: nowTop + 4, left: leftPct, width: widthPct }}>
                    <span className="sp-dot" style={{ background: palette.dot, boxShadow: `0 0 0 3px ${palette.border}` }} />
                    <span className="sp-name">{block.name}</span>
                    <span className="sp-bar" />
                    <span className="sp-time" style={{ color: palette.dot }}>{formatLive(sessionMs)}</span>
                  </div>
                )
              }

              const SHORT_BLOCK  = 40
              const tooltipLabel = !block.isLive && displayHeight < SHORT_BLOCK
                ? `${block.name} · ${formatShort(sessionMs)}`
                : undefined

              elems.push(
                <div
                  key={block.id}
                  className={`session-block${tooltipLabel ? ' session-block--short' : ''}${block.isLive ? ' session-block--live' : ''}`}
                  data-tooltip={tooltipLabel}
                  style={{
                    top:        displayTop,
                    height:     displayHeight,
                    left:       leftPct,
                    width:      widthPct,
                    background: block.isLive ? palette.dot : palette.bg,
                    border:     `1px solid ${palette.border}`,
                  }}
                >
                  {!block.isLive && displayHeight >= SHORT_BLOCK && (
                    <>
                      <span className="sb-name" style={{ color: palette.dot }}>{block.name}</span>
                      <span className="sb-duration" style={{ color: palette.dot }}>{formatShort(sessionMs)}</span>
                    </>
                  )}
                </div>
              )

              return elems
            })}

            {days.map((day, i) => {
              if (day.key !== todayKey) return null
              if (nowTop < 0 || nowTop > (TIMELINE_END - TIMELINE_START) * HOUR_H) return null
              const dayLeft  = i * (100 / days.length)
              const dayWidth = 100 / days.length
              return (
                <div key={`now-${day.key}`} className="timeline-now-line"
                  style={{ top: nowTop, left: `${dayLeft}%`, width: `${dayWidth}%` }}>
                  <div className="timeline-now-dot" style={{ left: '-4px' }} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Right Panel ───────────────────────────────────────────────────────────────

function RightPanel({ allTasks, favoriteTasks, selDate, now, weekStart, user, templates, onLogout, onAddTemplate, onRemoveTemplate }) {
  const [viewMode,       setViewMode]       = useState('day')
  const [rightTab,       setRightTab]       = useState('stats')
  const [templateInput,  setTemplateInput]  = useState('')

  // ── Stats data ─────────────────────────────────────────────────────────────
  let tasks = []
  if (viewMode === 'day') {
    tasks = allTasks[selDate] ?? []
  } else if (viewMode === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i)
      tasks.push(...(allTasks[toKey(d)] ?? []))
    }
  } else if (viewMode === 'month') {
    const selDateObj = new Date(selDate + 'T12:00:00')
    const year  = selDateObj.getFullYear()
    const month = selDateObj.getMonth()
    Object.keys(allTasks).forEach(key => {
      const [y, m] = key.split('-')
      if (parseInt(y) === year && parseInt(m) - 1 === month) {
        tasks.push(...allTasks[key])
      }
    })
  }

  const done   = tasks.filter(t => t.done).length
  const active = tasks.filter(t => getTaskStatus(t) === 'active').length
  const idle   = tasks.filter(t => getTaskStatus(t) === 'idle').length
  const total  = tasks.length
  const totalTrackedMs = tasks.reduce((acc, t) => acc + getTotalMs(t, now), 0)

  // ── Calculate tag stats ───────────────────────────────────────────────────
  const tagTimeMap = {}
  let allProcessedSessions = []
  tasks.forEach(task => {
    const ms = getTotalMs(task, now)
    if (ms <= 0) return
    const tagId = task.tags?.[0] ?? 'other'
    tagTimeMap[tagId] = (tagTimeMap[tagId] ?? 0) + ms
    allProcessedSessions = [...allProcessedSessions, ...task.sessions]
  })

  const tagStats = Object.keys(tagTimeMap).map(id => {
    const tag = DEFAULT_TAGS.find(t => t.id === id) || DEFAULT_TAGS.find(t => t.id === 'other')
    return { id, label: tag.label, color: tag.dot, ms: tagTimeMap[id] }
  }).sort((a, b) => b.ms - a.ms)


  const todayTasks     = allTasks[toKey(new Date())] ?? []
  const activeTask     = todayTasks.find(t => getTaskStatus(t) === 'active')
  const activeDuration = activeTask ? formatLive(getTotalMs(activeTask, now)) : '—'


  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'G'

  const handleAddTemplate = () => {
    const val = templateInput.trim()
    if (val) { onAddTemplate(val); setTemplateInput('') }
  }

  return (
    <div className="panel-right">
      {/* ── Tab strip ──────────────────────────────────────────────────────── */}
      <div className="rp-tabs">
        <button className={`rp-tab${rightTab === 'stats' ? ' rp-tab--active' : ''}`} onClick={() => setRightTab('stats')}>Stats</button>
        <button className={`rp-tab${rightTab === 'profile' ? ' rp-tab--active' : ''}`} onClick={() => setRightTab('profile')}>Profile</button>
      </div>

      {/* ── STATS TAB ──────────────────────────────────────────────────────── */}
      {rightTab === 'stats' && (
        <>
          <div className="view-toggle">
            <button className={`toggle-btn${viewMode === 'day'   ? ' toggle-btn--active' : ''}`} onClick={() => setViewMode('day')}>Day</button>
            <button className={`toggle-btn${viewMode === 'week'  ? ' toggle-btn--active' : ''}`} onClick={() => setViewMode('week')}>Week</button>
            <button className={`toggle-btn${viewMode === 'month' ? ' toggle-btn--active' : ''}`} onClick={() => setViewMode('month')}>Month</button>
          </div>

          <div className="divider" />
          
          <div className="stats-header-row">
            <DonutChart data={tagStats} totalMs={totalTrackedMs || 0} />
          </div>

          <div className="divider" />

          <Heatmap allTasks={allTasks} now={now} mode={viewMode} selDate={selDate} />

          <div className="legend">
            {tagStats.length === 0 ? (
              <div className="profile-empty">No tracked time yet</div>
            ) : (
              tagStats.map(stat => (
                <div key={stat.id} className="legend-row">
                  <span className="legend-dot" style={{ background: stat.color }} />
                  <span className="legend-label">{stat.label}</span>
                  <span className="legend-value">{formatShort(stat.ms)}</span>
                </div>
              ))
            )}
          </div>

          <div className="divider" />

          <div>
            <div className="right-section-title">Quick Stats</div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-item-label">Status breakdown</span>
                <span className="stat-item-sub">{done} done · {active} active · {idle} idle</span>
              </div>
              <div className="stat-item">
                <span className="stat-item-label">Active task</span>
                <span className="stat-item-value">{activeDuration}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PROFILE TAB ────────────────────────────────────────────────────── */}
      {rightTab === 'profile' && (
        <div className="profile-content">
          {/* User card */}
          <div className="profile-user-card">
            <div className="profile-avatar">{userInitials}</div>
            <div className="profile-user-info">
              <div className="profile-user-name">{user?.name ?? 'Guest'}</div>
              {user?.email && <div className="profile-user-email">{user.email}</div>}
            </div>
          </div>

          <div className="divider" />

          {/* Favorites */}
          <div className="profile-section">
            <div className="right-section-title">Favorites · {favoriteTasks.length}</div>
            {favoriteTasks.length === 0 ? (
              <div className="profile-empty">No favorites yet</div>
            ) : (
              <div className="favorite-list">
                {favoriteTasks.map(task => {
                  const taskTags = (task.tags ?? [])
                    .map(id => DEFAULT_TAGS.find(t => t.id === id))
                    .filter(Boolean)
                  return (
                    <div key={`${task.id}-${task.dateKey}`} className="favorite-item">
                      <div className="favorite-item-name">{task.name}</div>
                      <div className="favorite-item-date">{task.dateKey}</div>
                      {taskTags.length > 0 && (
                        <div className="favorite-item-tags">
                          {taskTags.map(tag => (
                             <span
                               key={tag.id}
                               className="task-tag-chip"
                               style={{ background: tag.bg, color: tag.textColor, border: `1px solid ${tag.border || tag.dot}` }}
                             >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="divider" />

          {/* Templates */}
          <div className="profile-section">
            <div className="right-section-title">Templates</div>
            <div className="template-add-row">
              <input
                className="template-add-input"
                placeholder="Save a template…"
                value={templateInput}
                onChange={e => setTemplateInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTemplate()}
              />
              <button className="template-add-btn" onClick={handleAddTemplate}>+</button>
            </div>
            {templates.length === 0 ? (
              <div className="profile-empty">No templates yet</div>
            ) : (
              <div className="template-list">
                {templates.map(tpl => (
                  <div key={tpl} className="template-item">
                    <span className="template-item-name">{tpl}</span>
                    <button className="template-remove-btn" onClick={() => onRemoveTemplate(tpl)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="divider" />

          <button className="profile-logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  // ── Tasks ──────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  // ── Auth ───────────────────────────────────────────────────────────────────
  const [user,   setUser]   = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY)
      if (saved) setUser(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  const login = useCallback((userData) => {
    setUser(userData)
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(userData)) } catch {}
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    try { localStorage.removeItem(AUTH_KEY) } catch {}
  }, [])

  // ── Templates ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(TEMPLATES_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return []
  })

  useEffect(() => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
  }, [templates])

  const addTemplate = useCallback((name) => {
    setTemplates(prev => prev.includes(name) ? prev : [...prev, name])
  }, [])

  const removeTemplate = useCallback((name) => {
    setTemplates(prev => prev.filter(t => t !== name))
  }, [])

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('dl-theme') === 'dark' } catch {}
    return false
  })

  useEffect(() => {
    localStorage.setItem('dl-theme', darkMode ? 'dark' : 'light')
    if (darkMode) document.documentElement.setAttribute('data-theme', 'dark')
    else          document.documentElement.removeAttribute('data-theme')
  }, [darkMode])

  // ── UI state ───────────────────────────────────────────────────────────────
  const todayKey = toKey(new Date())
  const [selDate,       setSelDate]       = useState(todayKey)
  const [weekStart,     setWeekStart]     = useState(() => getWeekStart(new Date()))
  const [selTaskId,     setSelTaskId]     = useState(null)
  const [inputValue,    setInputValue]    = useState('')
  const [selectedTag,   setSelectedTag]   = useState(null)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [tick,          setTick]          = useState(0)
  const [timelineView,  setTimelineView]  = useState('day')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')

  const inputRef          = useRef(null)
  const timelineScrollRef = useRef(null)
  const dragItem          = useRef(null)
  const dragOverItem      = useRef(null)
  
  // ── Favorites across all dates ─────────────────────────────────────────────
  const favoriteTasks = useMemo(() => {
    const all = []
    Object.keys(tasks).forEach(dateKey => {
      tasks[dateKey].forEach(task => {
        if (task.favorite) all.push({ ...task, dateKey })
      })
    })
    return all.sort((a, b) => b.createdAt - a.createdAt)
  }, [tasks])

  // ── Tick ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Tab title ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const todayTasks = tasks[toKey(new Date())] ?? []
    const activeTask = todayTasks.find(t => getTaskStatus(t) === 'active')
    if (activeTask) {
      const ms = getTotalMs(activeTask, Date.now())
      document.title = `▶ [${formatLive(ms)}] ${activeTask.name} - Echo`
    } else {
      document.title = 'Echo'
    }
  }, [tasks, tick])

  // ── Persist tasks ──────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  // ── Auto-scroll timeline ───────────────────────────────────────────────────
  useEffect(() => {
    if (selDate !== todayKey) return
    if (!timelineScrollRef.current) return
    const now = new Date()
    const h   = now.getHours() + now.getMinutes() / 60
    const top = (h - TIMELINE_START) * HOUR_H
    const scrollTarget = Math.max(0, top - timelineScrollRef.current.clientHeight * 0.3)
    timelineScrollRef.current.scrollTo({ top: scrollTarget, behavior: 'smooth' })
  }, [selDate, todayKey])

  // ── Derived ────────────────────────────────────────────────────────────────
  const now      = Date.now()
  const dayTasks = tasks[selDate] ?? []

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      return { date: d, key: toKey(d), shortLabel: DAY_SHORT[d.getDay()], dayNum: d.getDate() }
    })
  }, [weekStart])

  // ── Week navigation ────────────────────────────────────────────────────────
  const prevWeek = useCallback(() => setWeekStart(ws => addDays(ws, -7)), [])
  const nextWeek = useCallback(() => setWeekStart(ws => addDays(ws,  7)), [])

  const goToday = useCallback(() => {
    const today = new Date()
    setWeekStart(getWeekStart(today))
    setSelDate(toKey(today))
    setSelTaskId(null)
  }, [])

  const selectDay = useCallback((key) => {
    setSelDate(key)
    setSelTaskId(null)
    setInputValue('')
    setSelectedTag(null)
    setShowTagPicker(false)
  }, [])

  // ── Task actions ────────────────────────────────────────────────────────────

  const addTask = useCallback(() => {
    const name = inputValue.trim()
    if (!name) return
    const currentDayTasks = tasks[selDate] ?? []
    const task = {
      id:       uid(),
      name,
      sessions: [],
      done:     false,
      colorIdx: currentDayTasks.length % TASK_PALETTE.length,
      createdAt: Date.now(),
      tags:     selectedTag ? [selectedTag] : ['other'],
      favorite: false,
    }
    setTasks(prev => ({ ...prev, [selDate]: [...(prev[selDate] ?? []), task] }))
    setSelTaskId(task.id)
    setInputValue('')
    setSelectedTag(null)
    setShowTagPicker(false)
    inputRef.current?.focus()
  }, [inputValue, selDate, selectedTag])

  const updateTask = useCallback((id, updater) => {
    setTasks(prev => ({
      ...prev,
      [selDate]: (prev[selDate] ?? []).map(t => t.id === id ? updater(t) : t),
    }))
  }, [selDate])

  // Toggles favorite across ALL dates (not just selDate)
  const toggleFavorite = useCallback((taskId) => {
    setTasks(prev => {
      const next = {}
      Object.keys(prev).forEach(key => {
        next[key] = prev[key].map(t => t.id === taskId ? { ...t, favorite: !t.favorite } : t)
      })
      return next
    })
  }, [])

  const startTask = useCallback((id) => {
    const now = Date.now()
    setTasks(prev => ({
      ...prev,
      [selDate]: (prev[selDate] ?? []).map(t => {
        if (t.id === id) {
          const sessions = t.sessions.map(s => s.endTime ? s : { ...s, endTime: now })
          return { ...t, sessions: [...sessions, { id: uid(), startTime: now, endTime: null }], done: false }
        }
        const hasLive = t.sessions.some(s => !s.endTime)
        if (hasLive) return { ...t, sessions: t.sessions.map(s => s.endTime ? s : { ...s, endTime: now }) }
        return t
      }),
    }))
  }, [selDate])

  const pauseTask = useCallback((id) => {
    updateTask(id, t => ({
      ...t,
      sessions: t.sessions.map(s => s.endTime ? s : { ...s, endTime: Date.now() }),
    }))
  }, [updateTask])

  const doneTask = useCallback((id) => {
    updateTask(id, t => ({
      ...t,
      sessions: t.sessions.map(s => s.endTime ? s : { ...s, endTime: Date.now() }),
      done: true,
    }))
  }, [updateTask])

  const deleteTask = useCallback((id) => {
    setTasks(prev => ({
      ...prev,
      [selDate]: (prev[selDate] ?? []).filter(t => t.id !== id),
    }))
    setSelTaskId(prev => (prev === id ? null : prev))
  }, [selDate])

  const renameTask = useCallback((id, newName) => {
    updateTask(id, t => ({ ...t, name: newName.trim() || t.name }))
    setEditingTaskId(null)
  }, [updateTask])

  const deleteSession = useCallback((taskId, sessId) => {
    updateTask(taskId, t => ({ ...t, sessions: t.sessions.filter(s => s.id !== sessId) }))
  }, [updateTask])

  const updateSession = useCallback((taskId, sessId, key, newVal) => {
    // newVal is expected as a timestamp or HM string we parse
    updateTask(taskId, task => ({
      ...task,
      sessions: task.sessions.map(s => {
        if (s.id !== sessId) return s
        const d = new Date(s[key] || Date.now())
        const [h, m] = newVal.split(':').map(Number)
        d.setHours(h, m, 0, 0)
        return { ...s, [key]: d.getTime() }
      })
    }))
  }, [updateTask])

  const handleSort = useCallback(() => {
    const currentTasks = [...(tasks[selDate] ?? [])].map((t, i) => ({
      ...t, colorIdx: t.colorIdx ?? (i % TASK_PALETTE.length),
    }))
    const dragged = currentTasks.splice(dragItem.current, 1)[0]
    currentTasks.splice(dragOverItem.current, 0, dragged)
    dragItem.current = null
    dragOverItem.current = null
    setTasks(prev => ({ ...prev, [selDate]: currentTasks }))
  }, [selDate, tasks])

  const toggleTag = useCallback((tagId) => {
    setSelectedTag(prev => prev === tagId ? null : tagId)
  }, [])

  // ── Selected day display ────────────────────────────────────────────────────
  const selDateObj  = new Date(selDate + 'T12:00:00')
  const selDayName  = DAY_FULL[selDateObj.getDay()]
  const selMonthStr = MONTH_FULL[selDateObj.getMonth()]
  const selDayNum   = selDateObj.getDate()
  const isToday     = selDate === todayKey

  // ── Auth gate ───────────────────────────────────────────────────────────────
  if (loaded && !user) {
    return <LoginScreen onLogin={login} />
  }

  if (!loaded) return null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-brand">
          <span className="brand-text">ECHO<span className="brand-dot" /></span>
        </div>

        <nav className="header-nav">
          <button className="nav-arrow" onClick={prevWeek} title="Previous week">&#8249;</button>
          {weekDays.map(day => {
            const isSelDay   = day.key === selDate
            const isTodayDay = day.key === todayKey
            const hasTasks   = (tasks[day.key]?.length ?? 0) > 0
            return (
              <button
                key={day.key}
                className={['day-btn', isSelDay ? 'day-btn--selected' : '', isTodayDay ? 'day-btn--today' : ''].filter(Boolean).join(' ')}
                onClick={() => selectDay(day.key)}
                title={day.key}
              >
                <span className="day-btn-label">{day.shortLabel}</span>
                <span className="day-btn-num">{day.dayNum}</span>
                {hasTasks && <span className="day-btn-dot" />}
              </button>
            )
          })}
          <button className="nav-arrow" onClick={nextWeek} title="Next week">&#8250;</button>
        </nav>

        <div className="header-actions">
          <button className="btn-icon" onClick={() => setDarkMode(d => !d)} title="Toggle Dark Mode"
            style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', marginRight: '16px' }}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <div className="view-toggle" style={{ marginBottom: 0, marginRight: '10px' }}>
            <button className={`toggle-btn${timelineView === 'day'  ? ' toggle-btn--active' : ''}`} onClick={() => setTimelineView('day')}>Day</button>
            <button className={`toggle-btn${timelineView === 'week' ? ' toggle-btn--active' : ''}`} onClick={() => setTimelineView('week')}>Week</button>
          </div>
          <button className={`btn-today${isToday ? ' btn-today--active' : ''}`} onClick={goToday}>Today</button>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div className="body">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <aside className="panel-left">
          <div className="panel-left-header">
            <div className="panel-day-name">{selDayName}</div>
            <div className="panel-day-date">{selDayNum} {selMonthStr}</div>
          </div>

          {/* Add task */}
          <div className="add-task-row">
            <div className="add-task-input-wrap">
              <input
                ref={inputRef}
                className="add-task-input"
                type="text"
                placeholder="Add a task… (Enter)"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTask() }}
              />
              <button
                className={`btn-tag-toggle${showTagPicker ? ' btn-tag-toggle--active' : ''}`}
                onClick={() => setShowTagPicker(p => !p)}
                title="Add tags"
              >
                #
              </button>
              <button className="btn-add-task" onClick={addTask} title="Add task">+</button>
            </div>

            {/* Tag picker */}
            {showTagPicker && (
              <div className="tag-picker-row">
                {DEFAULT_TAGS.map(tag => {
                  const isActive = selectedTag === tag.id
                  return (
                    <button
                      key={tag.id}
                      className={`tag-pill${isActive ? ' tag-pill--active' : ''}`}
                      style={isActive
                        ? { background: tag.dot, color: '#fff',   borderColor: tag.dot }
                        : { background: '#fff',  color: tag.textColor, borderColor: tag.border || tag.dot }
                      }
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Quick Favorites Tray */}
            {favoriteTasks.length > 0 && (
              <div className="favorites-tray">
                {Array.from(new Set(favoriteTasks.map(t => t.name))).slice(0, 8).map(name => {
                  const firstFav = favoriteTasks.find(t => t.name === name)
                  return (
                    <button
                      key={name}
                      className="fav-chip"
                      onClick={() => {
                        const taskToAdd = {
                          id:       uid(),
                          name:     name,
                          sessions: [],
                          done:     false,
                          colorIdx: (tasks[selDate]?.length ?? 0) % TASK_PALETTE.length,
                          createdAt: Date.now(),
                          tags:     firstFav.tags ?? ['other'],
                          favorite: true,
                        }
                        setTasks(prev => ({ ...prev, [selDate]: [...(prev[selDate] ?? []), taskToAdd] }))
                        setSelTaskId(taskToAdd.id)
                      }}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Task list header */}
          <div className="task-list-header">
            <span className="task-list-title">
              Tasks {dayTasks.length > 0 ? `· ${dayTasks.length}` : ''}
            </span>
          </div>

          {/* Task list */}
          <div className="task-list">
            {dayTasks.length === 0 && (
              <div className="task-card-empty">No tasks for this day</div>
            )}

            {dayTasks.map((task, i) => {
              const status      = getTaskStatus(task)
              const totalMs     = getTotalMs(task, now)
              const isExpanded  = selTaskId === task.id
              const taskPalette = { ...TASK_PALETTE[task.colorIdx ?? (i % TASK_PALETTE.length)] }
              const taskTags    = (task.tags ?? []).map(id => DEFAULT_TAGS.find(t => t.id === id)).filter(Boolean)
              const firstTag    = taskTags[0]
              
              if (firstTag) {
                taskPalette.dot = firstTag.dot || firstTag.color
                taskPalette.bg  = firstTag.bg
                taskPalette.border = firstTag.border || firstTag.dot || firstTag.color
              }

              const isFav       = task.favorite ?? false

              let metaText = 'not started'
              if (status === 'active') metaText = formatLive(totalMs)
              else if (totalMs > 0)   metaText = formatShort(totalMs)

              return (
                <div
                  key={task.id}
                  className={['task-card', `task-card--${status}`, isExpanded ? 'task-card--selected' : ''].filter(Boolean).join(' ')}
                  style={{ animationDelay: `${i * 0.035}s` }}
                  onClick={() => setSelTaskId(prev => prev === task.id ? null : task.id)}
                  draggable
                  onDragStart={(e) => { dragItem.current = i; e.currentTarget.style.opacity = '0.5' }}
                  onDragEnter={()  => { dragOverItem.current = i }}
                  onDragEnd={(e)   => { e.currentTarget.style.opacity = '1'; handleSort() }}
                  onDragOver={(e)  => e.preventDefault()}
                >
                  <div className="task-card-top">
                    <span className="status-dot" style={{ background: taskPalette.dot }} />
                    {editingTaskId === task.id ? (
                      <input
                        className="task-rename-input"
                        autoFocus
                        value={editNameValue}
                        onChange={e => setEditNameValue(e.target.value)}
                        onBlur={() => renameTask(task.id, editNameValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') renameTask(task.id, editNameValue)
                          if (e.key === 'Escape') setEditingTaskId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="task-card-name"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingTaskId(task.id)
                          setEditNameValue(task.name)
                        }}
                      >
                        {task.name}
                        <button
                          className="btn-edit-inline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingTaskId(task.id)
                            setEditNameValue(task.name)
                          }}
                          title="Rename task"
                        >
                          ✎
                        </button>
                      </span>
                    )}
                    <button
                      className={`task-heart${isFav ? ' task-heart--active' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleFavorite(task.id) }}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFav ? '♥' : '♡'}
                    </button>
                  </div>

                  {/* Tag chips */}
                  {taskTags.length > 0 && (
                    <div className="task-card-tags">
                      {taskTags.map(tag => (
                        <span
                          key={tag.id}
                          className="task-tag-chip"
                          style={{ background: tag.bg, color: tag.textColor, border: `1px solid ${tag.border || tag.dot}` }}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="task-card-meta" style={{ color: taskPalette.dot }}>{metaText}</div>

                  {isExpanded && (
                    <div className="task-card-actions" onClick={e => e.stopPropagation()}>
                      {status === 'idle' && task.sessions.length === 0 && (
                        <button className="btn btn--start" onClick={() => startTask(task.id)} disabled={selDate !== toKey(new Date())}>▶ Start</button>
                      )}
                      {status === 'idle' && task.sessions.length > 0 && (
                        <button className="btn btn--start" onClick={() => startTask(task.id)} disabled={selDate !== toKey(new Date())}>↺ Resume</button>
                      )}
                      {status === 'active' && (
                        <>
                          <button className="btn" onClick={() => { pauseTask(task.id); setSelTaskId(task.id) }}>⏸ Pause</button>
                          <button className="btn btn--done" onClick={() => doneTask(task.id)}>✓ Done</button>
                        </>
                      )}
                      {status === 'done' && (
                        <button className="btn" onClick={() => startTask(task.id)} disabled={selDate !== toKey(new Date())}>↺ Reopen</button>
                      )}
                      <button className="btn btn--delete" onClick={() => deleteTask(task.id)}>✕ Delete task</button>

                      {/* Sessions editor */}
                      {task.sessions.length > 0 && (
                        <div className="task-sessions-list">
                          <div className="task-sessions-header">Edit sessions</div>
                          {task.sessions.map((s, idx) => (
                            <div key={s.id || idx} className="session-edit-row">
                              <input
                                type="time"
                                className="session-time-input"
                                value={formatHM(s.startTime)}
                                onChange={e => updateSession(task.id, s.id, 'startTime', e.target.value)}
                              />
                              <span className="session-time-sep">to</span>
                              {s.endTime ? (
                                <input
                                  type="time"
                                  className="session-time-input"
                                  value={formatHM(s.endTime)}
                                  onChange={e => updateSession(task.id, s.id, 'endTime', e.target.value)}
                                />
                              ) : (
                                <span className="session-time-live">Active now</span>
                              )}
                              <button
                                className="btn-session-del"
                                onClick={() => deleteSession(task.id, s.id)}
                                title="Remove session"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline Tag Picker for Task */}
                      <div className="task-inline-tags">
                        {DEFAULT_TAGS.map(tag => {
                          const isActive = (task.tags ?? []).includes(tag.id)
                          return (
                            <button
                              key={tag.id}
                              className={`tag-pill${isActive ? ' tag-pill--active' : ''}`}
                              style={isActive
                                ? { background: tag.dot, color: '#fff',   borderColor: tag.dot }
                                : { background: '#fff',  color: tag.textColor, borderColor: tag.border || tag.dot }
                              }
                              onClick={() => {
                                updateTask(task.id, t => {
                                  const next = [tag.id] // Force single tag selection
                                  return { ...t, tags: next }
                                })
                              }}
                            >
                              {tag.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── TIMELINE ───────────────────────────────────────────────────── */}
        <Timeline
          allTasks={tasks}
          days={timelineView === 'week'
            ? (weekDays || [])
            : [(weekDays || []).find(d => d.key === selDate) ?? { key: selDate, shortLabel: '?', dayNum: '' }]
          }
          viewMode={timelineView}
          now={now}
          timelineScrollRef={timelineScrollRef}
        />

        {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
        <RightPanel
          allTasks={tasks}
          favoriteTasks={favoriteTasks}
          selDate={selDate}
          now={now}
          weekStart={weekStart}
          user={user}
          templates={templates}
          onLogout={logout}
          onAddTemplate={addTemplate}
          onRemoveTemplate={removeTemplate}
        />
      </div>
    </div>
  )
}
