import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'

// ── Constants ────────────────────────────────────────────────────────────────

const HOUR_H         = 100
const TIMELINE_START = 0
const TIMELINE_END   = 24
const STORAGE_KEY    = 'dl-tasks-v3'
const AUTH_KEY       = 'dl-auth'
const TEMPLATES_KEY  = 'dl-templates'
const NOTES_KEY      = 'dl-daily-notes'

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

const DAILY_QUOTES = [
  "Your day was yours. Be proud of the steps you took.",
  "Happiness is a direction, not a place. Reflect on your journey.",
  "Every sunset is an opportunity to reset. What was your win today?",
  "Pause, breathe, and acknowledge how far you've come.",
  "Small wins are the bricks that build great lives.",
  "Finish your day happy: you did your best, and that's enough.",
  "A productive day is not just about tasks; it's about peace of mind."
];

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
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
          const dayTasks = allTasks[k] ?? []
          dayTasks.forEach(t => {
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
        const dayTasks = allTasks?.[key] ?? []
        dayTasks.forEach(t => {
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
      </div>
    </div>
  )
}

function LineChart({ data }) {
  const size = { w: 1000, h: 250 }
  const max = Math.max(...data.map(d => d.ms), 3600000)
  
  const getX = (i) => (i / (data.length - 1)) * size.w
  const getY = (v) => size.h - (v / max) * (size.h * 0.75) - 40

  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.ms) }))
  
  let dPath = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const cp1x = points[i].x + (points[i+1].x - points[i].x) / 3
    const cp2x = points[i+1].x - (points[i+1].x - points[i].x) / 3
    dPath += ` C ${cp1x} ${points[i].y}, ${cp2x} ${points[i+1].y}, ${points[i+1].x} ${points[i+1].y}`
  }

  const areaPath = `${dPath} L ${points[points.length-1].x} ${size.h} L ${points[0].x} ${size.h} Z`

  return (
    <div className="line-chart-wrap">
      <div className="card-top" style={{ marginBottom: 20 }}>
        <h3 className="card-title">Focus Velocity</h3>
        <div className="card-badge">Engagement Trends</div>
      </div>
      <div className="line-chart-svg-wrap">
        <svg viewBox={`0 0 ${size.w} ${size.h}`} className="line-chart-svg" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--amber)" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(124, 92, 252, 0.15)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#fillGrad)" />
          <path d={dPath} fill="none" stroke="url(#lineGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" 
            style={{ filter: 'drop-shadow(0 6px 12px rgba(124, 92, 252, 0.25))' }} 
          />
          {points.map((p, i) => (
             <circle key={i} cx={p.x} cy={p.y} r="5" fill="var(--bg-panel)" stroke="var(--amber)" strokeWidth="3" />
          ))}
        </svg>
      </div>
      <div className="line-chart-labels">
        {data.filter((_, i) => i % 2 === 0).map(d => <span key={d.date}>{d.label}</span>)}
      </div>
    </div>
  )
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function buildColumns(blocks) {
  const actuals = blocks.filter(b => b.type === 'actual').sort((a, b) => a.startY - b.startY)
  const planneds = blocks.filter(b => b.type === 'planned').sort((a, b) => a.startY - b.startY)
  
  const cols = [] // Array of columns, each col is an array of blocks
  const result = []

  // PASS 1: Actual sessions (Reality defines the lanes)
  actuals.forEach(block => {
    let colIdx = cols.findIndex(col => {
      const last = col[col.length - 1]
      return last.realEndY <= block.startY + 0.5
    })
    if (colIdx === -1) {
      colIdx = cols.length
      cols.push([])
    }
    const positioned = { ...block, col: colIdx }
    cols[colIdx].push(positioned)
    result.push(positioned)
  })

  // PASS 2: Planned sessions (Goals snap to reality)
  planneds.forEach(block => {
    // 1. Try to find a column with an actual block of the same task that overlaps
    let colIdx = cols.findIndex(col => 
      col.some(b => 
        b.type === 'actual' && 
        b.taskId === block.taskId &&
        b.startY < block.realEndY - 0.5 && b.realEndY > block.startY + 0.5
      )
    )

    // 2. Fallback: normal fit (avoiding ALL blocks already placed in that column)
    if (colIdx === -1) {
      colIdx = cols.findIndex(col => {
        return !col.some(b => b.startY < block.realEndY - 0.5 && b.realEndY > block.startY + 0.5)
      })
    }

    if (colIdx === -1) {
      colIdx = cols.length
      cols.push([])
    }
    const positioned = { ...block, col: colIdx }
    cols[colIdx].push(positioned)
    result.push(positioned)
  })

  return result
}

function Timeline({ allTasks, days, viewMode, now, timelineScrollRef, selTaskId, onPlanHour }) {
  const isWeek  = viewMode === 'week'
  const todayKey = toKey(new Date())

  const nowDate  = new Date(now)
  const nowHours = nowDate.getHours() + nowDate.getMinutes() / 60 + nowDate.getSeconds() / 3600
  const nowTop   = (nowHours - TIMELINE_START) * HOUR_H

  // ── Auto-scroll to now on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (timelineScrollRef.current) {
      const container   = timelineScrollRef.current
      const containerH  = container.clientHeight
      // Center the now-line by subtracting half the container height
      const targetScroll = nowTop - (containerH / 2)
      container.scrollTop = Math.max(0, targetScroll)
    }
  }, [timelineScrollRef]) // Depend on ref just in case, but usually mount is enough

  const rawBlocks = useMemo(() => {
    const blocks = []
    days.forEach((day, dayIndex) => {
      const dayTasks = allTasks[day.key] || []
      dayTasks.forEach((task, taskIdx) => {
        const colorIdx = task.colorIdx ?? (taskIdx % (TASK_PALETTE.length || 1))
        
        // 1. Actual sessions
        const sessArr = task.sessions || []
        sessArr.forEach(sess => {
          const start  = new Date(sess.startTime)
          const end    = sess.endTime ? new Date(sess.endTime) : new Date(now)
          const startH = start.getHours() + start.getMinutes() / 60 + start.getSeconds() / 3600
          const endH   = end.getHours()   + end.getMinutes()   / 60 + end.getSeconds()   / 3600

          const clampedStart = Math.max(startH, TIMELINE_START)
          const startY       = (clampedStart - TIMELINE_START) * HOUR_H
          
          if (isNaN(startY)) return

          let height, endY, realEndY
          if (!sess.endTime) {
            const liveEndY = Math.max(nowTop, startY)
            height   = liveEndY - startY
            endY     = liveEndY
            realEndY = liveEndY
          } else {
            const clampedEnd = Math.min(endH, TIMELINE_END)
            if (clampedEnd <= clampedStart || isNaN(clampedEnd) || isNaN(clampedStart)) return
            const rawH = (clampedEnd - clampedStart) * HOUR_H
            height   = Math.max(rawH, 2)
            if (isNaN(height)) return
            endY     = startY + height
            realEndY = startY + rawH
          }

          blocks.push({
            id: sess.id || uid(), taskId: task.id, name: task.name,
            colorIdx, isLive: !sess.endTime,
            startY, endY, realEndY, height,
            dayIndex, type: 'actual',
            startTime: sess.startTime, endTime: sess.endTime,
            tagId: task.tags?.[0], tags: task.tags
          })
        })

        // 2. Planned sessions
        if (task.plannedSessions) {
          task.plannedSessions.forEach(p => {
            const start = new Date(p.startTime)
            const end   = new Date(p.endTime)
            const startH = start.getHours() + start.getMinutes() / 60
            const endH   = end.getHours()   + end.getMinutes()   / 60

            const clampedStart = Math.max(startH, TIMELINE_START)
            const startY = (clampedStart - TIMELINE_START) * HOUR_H
            const height = (endH - clampedStart) * HOUR_H

            if (height <= 0 || isNaN(height) || isNaN(startY)) return

            blocks.push({
              id: p.id || uid(), taskId: task.id, name: task.name,
              colorIdx, isPlanned: true,
              startY, endY: startY + height, realEndY: startY + height, height,
              dayIndex, type: 'planned',
              startTime: p.startTime, endTime: p.endTime,
              tagId: task.tags?.[0], tags: task.tags
            })
          })
        }
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
    window.__DEBUG_TIMELINE = { allTasks, days, rawBlocks, blocksWithCols, displayBlocks, numColsForBlock }
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
        <div 
          className="timeline-inner" 
          style={{ height: (TIMELINE_END - TIMELINE_START) * HOUR_H }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const taskId = e.dataTransfer.getData('taskId')
            if (!taskId) return
            const rect = e.currentTarget.getBoundingClientRect()
            const relY = e.clientY - rect.top
            const hour = TIMELINE_START + (relY / HOUR_H)
            onPlanHour?.(hour)
          }}
        >
          <div className="timeline-grid">
            {hours.map(h => (
              <div 
                key={h} 
                className="timeline-hour-row" 
                style={{ top: (h - TIMELINE_START) * HOUR_H }}
                onClick={() => onPlanHour?.(h)}
              >
                <span className="timeline-hour-label">
                  {h}h
                </span>
                <div className="timeline-hour-line" />
              </div>
            ))}
            {/* Now indicator - inside grid for correct coordinate system */}
            {days.some(d => d.key === todayKey) && nowTop >= 0 && nowTop <= (TIMELINE_END - TIMELINE_START) * HOUR_H && (
              <div className="timeline-hour-row timeline-now-row" style={{ top: nowTop, zIndex: 5, pointerEvents: 'none' }}>
                <span className="timeline-hour-label" style={{ position: 'relative' }}>
                  <span className="timeline-now-dot" style={{ left: 'auto', right: -6 }} />
                </span>
                <div className="timeline-hour-line" style={{ background: '#F43F5E', height: 1 }} />
              </div>
            )}
          </div>

          <div className="timeline-blocks">
            {isWeek && days.map((_, i) => i > 0 && (
              <div key={`div-${i}`} className="timeline-day-divider" style={{ left: `${i * (100 / days.length)}%` }} />
            ))}

            {blocksWithCols.flatMap((block, idx) => {
              const numCols  = numColsForBlock[idx]
              const isPlanned = block.type === 'planned'
              const day      = days[block.dayIndex]
              const dayKey   = day?.key || 'unknown'
              const dayWidth = 100 / days.length
              const colWidth = dayWidth / numCols
              const dayLeft  = block.dayIndex * dayWidth
              const leftPct  = `calc(${dayLeft + (block.col * colWidth)}% + 2px)`
              const widthPct = `calc(${colWidth}% - 4px)`
              const sessionMs = block.endTime ? block.endTime - block.startTime : now - block.startTime
              const display   = displayBlocks[block.id] ?? { displayTop: block.startY, displayHeight: block.height }
              const { displayTop, displayHeight } = display
              const isSameTaskOverlap = isPlanned && blocksWithCols.some(b => 
                b.id !== block.id && 
                b.col === block.col && 
                b.dayIndex === block.dayIndex &&
                b.taskId === block.taskId &&
                b.type === 'actual' &&
                b.startY < block.realEndY - 0.5 && b.realEndY > block.startY + 0.5
              )
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
                const dayTasks = allTasks[dayKey] || []
                const task     = dayTasks.find(t => t.id === block.taskId)
                const displayMs = task ? getTotalMs(task, now) : sessionMs

                elems.push(
                  <div key={`ptr-${idx}-${block.id}`} className="session-pointer"
                    style={{ top: nowTop, left: leftPct, width: widthPct, transform: 'translateY(2px)' }}>
                    <span className="sp-name">{block.name}</span>
                    <span className="sp-time" style={{ color: palette.dot }}>{formatLive(displayMs)}</span>
                  </div>
                )
              }

              const SHORT_BLOCK  = 40
              const tooltipLabel = !block.isLive && displayHeight < SHORT_BLOCK
                ? `${block.name} · ${formatShort(sessionMs)}`
                : undefined

              const isFocus = selTaskId === block.taskId

              elems.push(
                <div
                  key={`sb-${idx}-${block.id}`}
                  className={[
                    'session-block',
                    block.isLive ? 'session-block--live' : '',
                    isPlanned ? 'session-block--planned' : '',
                    isFocus ? 'session-block--focus' : '',
                    tooltipLabel ? 'session-block--short' : ''
                  ].filter(Boolean).join(' ')}
                  data-tooltip={tooltipLabel}
                  style={{
                    top:          displayTop,
                    height:       displayHeight,
                    left:         leftPct,
                    width:        widthPct,
                    zIndex:       isPlanned ? 1 : 10,
                    background:   isPlanned ? 'rgba(255,255,255,0.05)' : palette.dot,
                    borderColor:  palette.dot,
                    borderStyle:  isPlanned ? 'dashed' : 'none', 
                    borderWidth:  isPlanned ? '1.5px' : '0px',
                    opacity:      isPlanned ? 0.6 : (block.isLive ? 0.85 : 0.9),
                  }}
                >
                  {!block.isLive && displayHeight >= 20 && !isSameTaskOverlap && (
                    <div className="sb-content" style={{ display: 'flex', flexDirection: 'column', padding: '4px' }}>
                      <span className="sb-name" style={{ 
                        color: isPlanned ? palette.dot : (block.isLive ? '#fff' : palette.dot),
                        fontSize: '11px',
                        fontWeight: '700',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                      }}>{block.name}</span>
                      {displayHeight >= 32 && (
                        <span className="sb-duration" style={{ 
                    color: isPlanned ? palette.dot : (block.isLive ? 'rgba(255,255,255,0.8)' : palette.dot),
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {formatShort(sessionMs)}
                  </span>
                )}
              </div>
            )}
            {isPlanned && (
              <button 
                className="btn-planned-del"
                onClick={e => { e.stopPropagation(); deletePlannedSession(block.taskId, days[block.dayIndex].key, block.id) }}
              >
                ×
              </button>
            )}
          </div>
        )

              return elems
            })}


          </div>
        </div>
      </div>
    </div>
  )
}

// ── Right Panel ───────────────────────────────────────────────────────────────

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.avgMs), 1)
  return (
    <div className="bar-chart-wrap">
      <div className="right-section-title">Avg Session by Category</div>
      <div className="bar-list">
        {data.slice(0, 5).map(item => {
          const barWidth = (item.avgMs / max) * 100
          if (item.avgMs <= 0) return null
          return (
            <div key={item.id} className="bar-row">
              <div className="bar-info">
                <span className="bar-name">{item.label}</span>
                <span className="bar-val">{formatShort(item.avgMs)}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${barWidth}%`, background: item.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RightPanel({
  allTasks, favoriteTasks, selDate, now, weekStart, user, templates, 
  onLogout, onAddTemplate, onRemoveTemplate, isInsights, isAccount
}) {
  const [viewMode, setViewMode] = useState('day')
  const [rightTab, setRightTab] = useState('stats')
  const [templateInput, setTemplateInput] = useState('')
  const uid = () => Math.random().toString(36).substr(2, 9)

  // ── Stats calculation ─────────────────────────────────────────────────────
  const { 
    tasks, doneTasks, activeTasks, idleTasks, totalTrackedMs, 
    tagStats, sessCount, longestSessMs, completionRate, avgSessMs, dailyTotals, carryOverCount
  } = useMemo(() => {
    let tempTasks = []
    if (viewMode === 'day') {
      tempTasks = allTasks[selDate] ?? []
    } else if (viewMode === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i)
        tempTasks.push(...(allTasks[toKey(d)] ?? []))
      }
    } else if (viewMode === 'month') {
      const selDateObj = new Date(selDate + 'T12:00:00')
      const year = selDateObj.getFullYear()
      const month = selDateObj.getMonth()
      Object.keys(allTasks).forEach(key => {
        const [y, m] = key.split('-')
        if (parseInt(y) === year && parseInt(m) - 1 === month) {
          tempTasks.push(...(allTasks[key] || []))
        }
      })
    }

    const dTasks = tempTasks.filter(t => t.done)
    const aTasks = tempTasks.filter(t => getTaskStatus(t) === 'active')
    const iTasks = tempTasks.filter(t => getTaskStatus(t) === 'idle')
    const msTotal = tempTasks.reduce((acc, t) => acc + getTotalMs(t, now), 0)

    const tagTimeMap = {}
    const tagSessCountMap = {}
    tempTasks.forEach(task => {
      const ms = getTotalMs(task, now)
      if (ms <= 0) return
      const tagId = task.tags?.[0] ?? 'other'
      tagTimeMap[tagId] = (tagTimeMap[tagId] ?? 0) + ms
      tagSessCountMap[tagId] = (tagSessCountMap[tagId] ?? 0) + (task.sessions?.length || 0)
    })

    const tStats = Object.keys(tagTimeMap).map(id => {
      const tag = DEFAULT_TAGS.find(t => t.id === id) || DEFAULT_TAGS.find(t => t.id === 'other')
      const tagAvgMs = tagSessCountMap[id] > 0 ? tagTimeMap[id] / tagSessCountMap[id] : 0
      return { id, label: tag.label, color: tag.dot, ms: tagTimeMap[id], avgMs: tagAvgMs }
    }).sort((a, b) => b.ms - a.ms)

    const sessTotal = tempTasks.reduce((acc, t) => acc + (t.sessions?.length || 0), 0)
    let maxSessMs = 0
    tempTasks.forEach(t => {
      (t.sessions || []).forEach(s => {
        if (s.endTime) {
          const dur = s.endTime - s.startTime
          if (dur > maxSessMs) maxSessMs = dur
        } else {
          const dur = now - s.startTime // current session
          if (dur > maxSessMs) maxSessMs = dur
        }
      })
    })

    const doneRate      = tempTasks.length > 0 ? Math.round((dTasks.length / tempTasks.length) * 100) : 0
    const aSessMs       = sessTotal > 0 ? msTotal / sessTotal : 0
    const coCount       = tempTasks.filter(t => t.carriedOver).length

    return { 
      tasks: tempTasks, 
      doneTasks: dTasks, 
      activeTasks: aTasks, 
      idleTasks: iTasks, 
      totalTrackedMs: msTotal, 
      tagStats: tStats,
      sessCount: sessTotal,
      longestSessMs: maxSessMs,
      completionRate: doneRate,
      avgSessMs: aSessMs,
      dailyTotals: (() => {
        const arr = []
        const nowRef = new Date()
        for (let i = 13; i >= 0; i--) {
          const d = new Date(nowRef)
          d.setDate(d.getDate() - i)
          const k = toKey(d)
          const tasks = allTasks[k] ?? []
          const ms = tasks.reduce((acc, t) => acc + getTotalMs(t, now), 0)
          arr.push({ date: k, ms, label: d.getDate() })
        }
        return arr
      })(),
      carryOverCount: coCount
    }
  }, [viewMode, allTasks, selDate, weekStart, now])


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
    <div className={`right-panel ${isInsights || isAccount ? 'rp--full' : ''}`}>
      {isInsights && (
        <div className="view-container insights-page page-fade-in">
          <div className="view-header">
            <div className="view-header-left">
              <h1 className="view-title">Insights<span className="brand-dot" /></h1>
              <div className="view-subtitle">Your productivity pulse across {viewMode}.</div>
            </div>
            <div className="view-mode-pills">
              <button className={`pill-btn ${viewMode === 'day' ? 'active' : ''}`} onClick={() => setViewMode('day')}>Day</button>
              <button className={`pill-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>Week</button>
              <button className={`pill-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>Month</button>
            </div>
          </div>

          <div className="stats-strip">
             <div className="stat-box">
               <div className="stat-val">{formatShort(totalTrackedMs)}</div>
               <div className="stat-lab">Tracked Time</div>
             </div>
             <div className="stat-box">
               <div className="stat-val">{completionRate}%</div>
               <div className="stat-lab">Completion Rate</div>
             </div>
             <div className="stat-box">
               <div className="stat-val">{sessCount}</div>
               <div className="stat-lab">Sessions</div>
             </div>
             <div className="stat-box">
               <div className="stat-val" style={{ color: carryOverCount > 0 ? '#E11D48' : 'inherit' }}>{carryOverCount}</div>
               <div className="stat-lab">Carried Over</div>
             </div>
             <div className="stat-box">
               <div className="stat-val">{longestSessMs > 0 ? formatShort(longestSessMs) : '—'}</div>
               <div className="stat-lab">Peak Focus</div>
             </div>
          </div>

          <div className="insights-grid">
            <div className="insights-card main-chart">
               <div className="card-top">
                 <h3 className="card-title">Time Allocation</h3>
                 <div className="card-badge">Tag distribution</div>
               </div>
               <div className="chart-wrapper">
                 <DonutChart data={tagStats} totalMs={totalTrackedMs || 0} />
               </div>
            </div>

            <div className="insights-card">
              <BarChart data={tagStats} />
            </div>

            <div className="insights-card secondary-chart">
               <div className="card-top">
                 <h3 className="card-title">Productivity Rhythm</h3>
               </div>
               <div className="heatmap-container">
                 <Heatmap allTasks={allTasks} now={now} mode={viewMode} selDate={selDate} />
               </div>
               <div className="heatmap-footer">
                 <span>{viewMode === 'day' ? 'Hourly focus' : 'Daily trends'}</span>
                 <span>Activity intensity</span>
               </div>
            </div>

            <div className="insights-card wide-card">
              <LineChart data={dailyTotals} />
            </div>
          </div>

          <div className="tag-leaderboard">
            <h3 className="card-title">Top Categories</h3>
            <div className="leader-grid">
              {tagStats.slice(0, 4).map(s => (
                <div key={s.id} className="leader-item">
                  <div className="leader-info">
                    <span className="leader-dot" style={{ background: s.color }} />
                    <span className="leader-name">{s.label}</span>
                  </div>
                  <div className="leader-time">{formatShort(s.ms)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAccount && (
        <div className="view-container page-fade-in">
          <div className="view-header">
            <h1 className="view-title">Account</h1>
            <div className="view-subtitle">Manage your profile and tools</div>
          </div>

          <div className="account-grid">
            <div className="card-glass user-card">
              <div className="user-info">
                <div className="user-avatar-large">{user?.email?.charAt(0).toUpperCase() || 'U'}</div>
                <div className="user-details">
                  <div className="user-email">{user?.email}</div>
                  <div className="user-plan">Premium Member</div>
                </div>
              </div>
              <button className="logout-btn" onClick={onLogout}>Sign Out</button>
            </div>

            <div className="library-sections">
              <div className="card-glass">
                <div className="card-header">Favorite Tasks</div>
                <div className="fav-list">
                  {favoriteTasks.length === 0 && <div className="empty-msg">No favorites yet.</div>}
                  {favoriteTasks.map(ft => (
                    <div key={ft.id} className="fav-item">
                      <span className="fav-name">{ft.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-glass">
                <div className="card-header">Workflow Templates</div>
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
            </div>
          </div>
        </div>
      )}

      {!isInsights && !isAccount && (
        <div className="legacy-empty">Select a view from the sidebar</div>
      )}
    </div>
  )
}

function TodayDashboard({ activeTask, now, dayTasks, totalDayMs, longestSessMs, dailyNote, onNoteChange, selDate }) {
  const doneCount = dayTasks.filter(t => t.done).length
  const totalCount = dayTasks.length
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const quoteIdx = (selDate || '').split('-').reduce((acc, part) => acc + parseInt(part), 0) % DAILY_QUOTES.length;
  const dailyQuote = DAILY_QUOTES[quoteIdx] || DAILY_QUOTES[0];
  
  return (
    <aside className="panel-right-today page-fade-in">
      <div className="dash-section active-focus-wrap">
        <h3 className="dash-title">Current Focus</h3>
        {activeTask ? (
          <div className="active-card-focus">
            <div className="active-glow" />
            <div className="active-info">
              <span className="active-name">{activeTask.name}</span>
              <div className="active-timer">{formatLive(getTotalMs(activeTask, now))}</div>
            </div>
            <div className="active-sessions-count">
              {activeTask.sessions.length} sessions today
            </div>
          </div>
        ) : (
          <div className="active-card-idle">
            No active session. Time to pick a task!
          </div>
        )}
      </div>

      <div className="dash-section">
        <h3 className="dash-title">Progress Overview</h3>
        <div className="progress-card-today">
          <div className="progress-ring-wrap">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-app)" strokeWidth="10" />
              <circle 
                cx="50" cy="50" r="40" 
                fill="none" stroke="var(--amber)" strokeWidth="10" 
                strokeDasharray={`${progressPercent * 2.51} 251`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className="progress-val-today">{progressPercent}%</div>
          </div>
          <div className="progress-details">
            <div className="prog-item"><strong>{doneCount}</strong>/{totalCount} Tasks</div>
            <div className="prog-item"><strong>{formatShort(totalDayMs)}</strong> Focused</div>
          </div>
        </div>
      </div>

      <div className="dash-section dash-section--highlight">
        <h3 className="dash-title">Daily Highlight</h3>
        {!dailyNote && (
          <div className="daily-quote-fallback page-fade-in" style={{ marginBottom: '16px' }}>
             <div className="quote-icon">✨</div>
             <p>"{dailyQuote}"</p>
             <span>Take a moment to note your win and end your day happy.</span>
          </div>
        )}
        <textarea 
          className="highlight-textarea"
          placeholder="What made today memorable?"
          value={dailyNote || ''}
          onChange={e => onNoteChange(e.target.value)}
        />
      </div>
    </aside>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  // ── Tasks ──────────────────────────────────────────────────────────────────
  const [allTasks, setAllTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  const [dailyNotes, setDailyNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTES_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks))
  }, [allTasks])

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(dailyNotes))
  }, [dailyNotes])

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
  const [activeNav,     setActiveNav]     = useState('today') // today, insights, account
  const [selTaskId,     setSelTaskId]     = useState(null)
  const [inputValue,    setInputValue]    = useState('')
  const [suggestedTags, setSuggestedTags] = useState([])
  const [planInput,      setPlanInput]      = useState('')
  const [suggestedPlanTags, setSuggestedPlanTags] = useState([])
  const [selectedTag,   setSelectedTag]   = useState(null)
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
    Object.keys(allTasks).forEach(dateKey => {
      allTasks[dateKey].forEach(task => {
        if (task.favorite) all.push({ ...task, dateKey })
      })
    })
    return all.sort((a, b) => b.createdAt - a.createdAt)
  }, [allTasks])

  // ── Tick ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Tab title ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const todayTasks = allTasks[toKey(new Date())] ?? []
    const activeTask = todayTasks.find(t => getTaskStatus(t) === 'active')
    if (activeTask) {
      const ms = getTotalMs(activeTask, Date.now())
      document.title = `▶ [${formatLive(ms)}] ${activeTask.name} - Echo`
    } else {
      document.title = 'Echo'
    }
  }, [allTasks, tick])

  // ── Midnight Split ──────────────────────────────────────────────────────────
  useEffect(() => {
    const currentToday = toKey(new Date())
    
    // Check if there's any active task in a day that is NOT today
    let foundActive = false
    for (const dateKey in allTasks) {
      if (dateKey === currentToday) continue
      if (allTasks[dateKey].some(t => t.sessions.some(s => !s.endTime))) {
        foundActive = true
        break
      }
    }

    if (foundActive) {
      setAllTasks(prev => {
        const next = { ...prev }
        let changed = false

        Object.keys(next).forEach(dateKey => {
          if (dateKey === currentToday) return
          
          let dayChanged = false
          const updatedDayTasks = next[dateKey].map(task => {
            const activeSessIdx = task.sessions.findIndex(s => !s.endTime)
            if (activeSessIdx !== -1) {
              dayChanged = true
              changed = true
              
              const activeSess = task.sessions[activeSessIdx]
              const [y, m, d] = dateKey.split('-').map(Number)
              
              // Midnight of the next day (00:00:00)
              const midnightNextDate = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
              const midnightNext = midnightNextDate.getTime()
              const nextDayKey = toKey(midnightNextDate)

              // 1. Close session on current dateKey
              const nextSessions = [...task.sessions]
              nextSessions[activeSessIdx] = { ...activeSess, endTime: midnightNext }
              
              // 2. Open task on the next day
              const nextDayTasks = [...(next[nextDayKey] ?? [])]
              // Avoid duplicate continuation if we somehow re-run
              const alreadyContinued = nextDayTasks.find(t => 
                t.name === task.name && 
                t.sessions.some(s => s.startTime === midnightNext && !s.endTime)
              )

              if (!alreadyContinued) {
                const newTask = {
                  ...task,
                  id: uid(),
                  sessions: [{
                    id: uid(),
                    startTime: midnightNext,
                    endTime: null
                  }],
                  done: false
                }
                next[nextDayKey] = [...nextDayTasks, newTask]
              }

              return { ...task, sessions: nextSessions }
            }
            return task
          })

          if (dayChanged) {
            next[dateKey] = updatedDayTasks
          }
        })

        return changed ? next : prev
      })
    }
  }, [allTasks, tick])

  // ── Persist allTasks ──────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks))
  }, [allTasks])

  // ── Auto-scroll timeline ───────────────────────────────────────────────────
  useEffect(() => {
    if (!timelineScrollRef.current) return
    const timer = setTimeout(() => {
      const el  = timelineScrollRef.current
      if (!el) return
      const now = new Date()
      const h   = now.getHours() + now.getMinutes() / 60
      const top = (h - TIMELINE_START) * HOUR_H
      const viewH = el.clientHeight || window.innerHeight
      el.scrollTo({ top: Math.max(0, top - viewH * 0.5), behavior: 'smooth' })
    }, 150)
    return () => clearTimeout(timer)
  }, [selDate, todayKey])

  // ── Derived ────────────────────────────────────────────────────────────────
  const now      = Date.now()
  const dayTasks = useMemo(() => {
    const raw = allTasks[selDate] ?? []
    const undone = raw.filter(t => !t.done)
    const done   = raw.filter(t => t.done)
    return [...undone, ...done]
  }, [allTasks, selDate])
  const yesterdayKey = toKey(addDays(new Date(), -1))
  const tomorrowKey  = toKey(addDays(new Date(),  1))
  
  const overdueTasks = useMemo(() => {
    if (selDate !== todayKey) return []
    return (allTasks[yesterdayKey] ?? []).filter(t => !t.done)
  }, [allTasks, selDate, todayKey, yesterdayKey])

  const plannedTasks = useMemo(() => {
    if (selDate !== todayKey) return []
    return allTasks[tomorrowKey] ?? []
  }, [allTasks, selDate, todayKey, tomorrowKey])

  const totalDayMs = useMemo(() => {
    return dayTasks.reduce((acc, t) => acc + getTotalMs(t, now), 0)
  }, [dayTasks, now])

  const activeTask = useMemo(() => {
    return dayTasks.find(t => getTaskStatus(t) === 'active')
  }, [dayTasks, tick])

  const maxSessMsToday = useMemo(() => {
    let max = 0
    dayTasks.forEach(t => {
      (t.sessions || []).forEach(s => {
        const dur = (s.endTime ?? now) - s.startTime
        if (dur > max) max = dur
      })
    })
    return max
  }, [dayTasks, now])
  
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
    let name = inputValue.trim()
    if (!name) return

    let finalTags = selectedTag ? [selectedTag] : ['other']
    const tagMatch = name.match(/#(\w+)/)
    if (tagMatch) {
      const found = DEFAULT_TAGS.find(t => t.id === tagMatch[1].toLowerCase() || t.label.toLowerCase() === tagMatch[1].toLowerCase())
      if (found) {
        finalTags = [found.id]
        name = name.replace(tagMatch[0], '').trim()
      }
    }

    const currentDayTasks = allTasks[selDate] ?? []
    const task = {
      id:       uid(),
      name,
      sessions: [],
      done:     false,
      colorIdx: currentDayTasks.length % TASK_PALETTE.length,
      createdAt: Date.now(),
      tags:     finalTags,
      favorite: false,
    }
    setAllTasks(prev => ({ ...prev, [selDate]: [task, ...(prev[selDate] ?? [])] }))
    setSelTaskId(task.id)
    setInputValue('')
    setSelectedTag(null)
    setSuggestedTags([])
    inputRef.current?.focus()
  }, [inputValue, selDate, selectedTag, allTasks])

  const updateTask = useCallback((id, updater) => {
    setAllTasks(prev => {
      const next = {}
      Object.keys(prev).forEach(key => {
        next[key] = prev[key].map(t => t.id === id ? updater(t) : t)
      })
      return next
    })
  }, [])

  // Toggles favorite across ALL dates (not just selDate)
  const toggleFavorite = useCallback((taskId) => {
    setAllTasks(prev => {
      const next = {}
      Object.keys(prev).forEach(key => {
        next[key] = prev[key].map(t => t.id === taskId ? { ...t, favorite: !t.favorite } : t)
      })
      return next
    })
  }, [])

  const startTask = useCallback((id) => {
    const now = Date.now()
    const TWO_MIN = 2 * 60 * 1000
    setAllTasks(prev => ({
      ...prev,
      [selDate]: (prev[selDate] ?? []).map(t => {
        if (t.id === id) {
          // Close any open sessions first
          const sessions = t.sessions.map(s => s.endTime ? s : { ...s, endTime: now })
          
          let nextSessions = sessions
          let finalPlanned = t.plannedSessions ?? []

          // Merge only if the last session is recent (started < 2min ago AND ended < 2min ago)
          const last = sessions[sessions.length - 1]
          if (last && (now - last.endTime) < TWO_MIN && (now - last.startTime) < TWO_MIN) {
            nextSessions = [...sessions.slice(0, -1), { ...last, endTime: null }]
          } else {
            nextSessions = [...sessions, { id: uid(), startTime: now, endTime: null }]
          }

          // SMART TARGET: Create/Update Ghost Block
          if (t.goalDurationMs > 0) {
            const doneToday = nextSessions.filter(s => s.endTime).reduce((acc, s) => acc + (s.endTime - s.startTime), 0)
            const remaining  = Math.max(0, t.goalDurationMs - doneToday)
            const active     = nextSessions.find(s => !s.endTime)
            if (active && remaining > 0) {
              const others = (t.plannedSessions ?? []).filter(p => !p.isPrimary)
              finalPlanned = [...others, { id: uid(), startTime: active.startTime, endTime: active.startTime + remaining, isPrimary: true }]
            }
          }

          return { ...t, sessions: nextSessions, plannedSessions: finalPlanned, done: false }
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

  const carryOverTask = useCallback((task) => {
    const newTask = {
      ...task,
      id: uid(),
      sessions: [],
      createdAt: Date.now(),
      done: false
    }
    setAllTasks(prev => ({
      ...prev,
      [todayKey]: [...(prev[todayKey] ?? []), newTask],
      [yesterdayKey]: (prev[yesterdayKey] ?? []).map(t => t.id === task.id ? { ...t, done: true, carriedOver: true } : t)
    }))
    setSelTaskId(newTask.id)
  }, [todayKey, yesterdayKey])

  const planForTomorrow = useCallback((rawName) => {
    let name = rawName.trim()
    if (!name) return

    let finalTags = ['other']
    const tagMatch = name.match(/#(\w+)/)
    if (tagMatch) {
      const found = DEFAULT_TAGS.find(t => t.id === tagMatch[1].toLowerCase() || t.label.toLowerCase() === tagMatch[1].toLowerCase())
      if (found) {
        finalTags = [found.id]
        name = name.replace(tagMatch[0], '').trim()
      }
    }

    const newTask = {
      id: uid(),
      name,
      sessions: [],
      done: false,
      colorIdx: (allTasks[tomorrowKey]?.length ?? 0) % TASK_PALETTE.length,
      createdAt: Date.now(),
      tags: finalTags
    }
    setAllTasks(prev => ({ ...prev, [tomorrowKey]: [newTask, ...(prev[tomorrowKey] ?? [])] }))
    setPlanInput('')
    setSuggestedPlanTags([])
  }, [tomorrowKey, allTasks])

  const deleteTask = useCallback((id, dateKey = selDate) => {
    setAllTasks(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] ?? []).filter(t => t.id !== id),
    }))
    setSelTaskId(prev => (prev === id ? null : prev))
  }, [selDate])

  const renameTask = useCallback((id, newName, dateKey = selDate) => {
    setAllTasks(prev => ({
      ...prev,
      [dateKey]: (prev[dateKey] ?? []).map(t => t.id === id ? { ...t, name: newName.trim() || t.name } : t),
    }))
    setEditingTaskId(null)
  }, [selDate])

  const parseDuration = (str) => {
    if (!str) return null
    const s = str.toLowerCase().trim()
    const hMatch = s.match(/(\d+(?:\.\d+)?)\s*h/)
    const mMatch = s.match(/(\d+)\s*(m|min)/)
    let ms = 0
    if (hMatch) ms += parseFloat(hMatch[1]) * 3600000
    if (mMatch) ms += parseInt(mMatch[1]) * 60000
    if (!hMatch && !mMatch) {
      const val = parseFloat(s)
      if (!isNaN(val) && val > 0) {
        // Heuristic: < 10? likely hours. >= 10? likely minutes.
        if (val < 10) ms = val * 3600000
        else ms = val * 60000
      }
    }
    return ms > 0 ? ms : null
  }

  const parseTimeStr = (str) => {
    if (!str) return null
    const s = str.trim().toLowerCase()
    
    let h = null
    let m = null
    let durationMs = 3600000 // default 1h

    // Case 1: HH:MM [Duration]
    if (s.includes(':')) {
      const parts = s.split(/\s+/)
      const timeMatch = parts[0].match(/(\d+):(\d+)/)
      if (timeMatch) {
        h = parseInt(timeMatch[1], 10)
        m = parseInt(timeMatch[2], 10)
      }
      if (parts.length > 1) {
        durationMs = parseDuration(parts.slice(1).join(' ')) || durationMs
      }
    } 
    // Case 2: Just Duration (e.g. 1h, 30m)
    else if (s.match(/[hm]/) || (!isNaN(parseFloat(s)) && !s.includes(':'))) { // Added !s.includes(':') to differentiate from HH:MM
      durationMs = parseDuration(s) || durationMs
      const cur = new Date() // Use new Date() for current time
      h = cur.getHours()
      m = cur.getMinutes()
    }
    // Case 3: Legacy (just number, e.g., "9" for 9:00, "930" for 9:30)
    else {
      const parts = s.match(/\d+/g)
      if (parts && parts.length > 0) {
        h = parseInt(parts[0], 10)
        m = parts.length > 1 ? parseInt(parts[1], 10) : 0
      }
    }

    if (h === null || isNaN(h) || h < 0 || h > 23) return null
    if (m === null || isNaN(m) || m < 0 || m > 59) return null
    return { h, m, durationMs }
  }

  const deleteSession = useCallback((taskId, sessId) => {
    updateTask(taskId, t => ({ ...t, sessions: t.sessions.filter(s => s.id !== sessId) }))
  }, [updateTask])

  const updatePlannedSession = useCallback((taskId, planId, key, newVal) => {
    const time = parseTimeStr(newVal)
    if (!time) return
    const { h, m } = time

    updateTask(taskId, t => ({
      ...t,
      plannedSessions: (t.plannedSessions ?? []).map(p => {
        if (p.id !== planId) return p
        const d = new Date(p[key] || Date.now())
        d.setHours(h, m, 0, 0)
        return { ...p, [key]: d.getTime() }
      })
    }))
  }, [updateTask])

  const addPlannedSession = useCallback((taskId, dateKey, startHour) => {
    setAllTasks(prev => {
      const next = { ...prev }
      let targetTask = null
      let sourceKey = null

      // Look in selDate, tomorrowKey, and other dates
      const keys = [dateKey, tomorrowKey, ...Object.keys(next).filter(k => k !== dateKey && k !== tomorrowKey)]
      for (const k of keys) {
        const found = (next[k] ?? []).find(t => t.id === taskId)
        if (found) { targetTask = found; sourceKey = k; break }
      }

      if (!targetTask) return prev

      const d = new Date(dateKey + 'T12:00:00')
      d.setHours(Math.floor(startHour), (startHour % 1) * 60, 0, 0)
      const startTime = d.getTime()
      const endTime = startTime + 60 * 60 * 1000 // default 1h

      const updatedTask = { 
        ...targetTask, 
        plannedSessions: [...(targetTask.plannedSessions ?? []), { id: uid(), startTime, endTime }] 
      }

      if (sourceKey !== dateKey) {
        const dayArr = next[dateKey] ?? []
        if (!dayArr.some(t => t.id === taskId)) {
          next[dateKey] = [updatedTask, ...dayArr]
        } else {
          next[dateKey] = dayArr.map(t => t.id === taskId ? updatedTask : t)
        }
      } else {
        next[dateKey] = (next[dateKey] ?? []).map(t => t.id === taskId ? updatedTask : t)
      }
      return next
    })
  }, [tomorrowKey])

  const deletePlannedSession = useCallback((taskId, dateKey, planId) => {
    updateTask(taskId, t => ({
      ...t,
      plannedSessions: (t.plannedSessions ?? []).filter(p => p.id !== planId)
    }))
  }, [updateTask])

  const setGoalTime = useCallback((taskId, dateKey, timeStr) => {
    const time = parseTimeStr(timeStr)
    if (!time) return
    const { durationMs } = time

    const dArr = allTasks[dateKey] || []
    const task = dArr.find(t => t.id === taskId)
    if (!task) return

    const activeSession = task.sessions.find(s => !s.endTime)

    if (activeSession) {
      // If active, create the ghost IMMEDIATELY starting at the session start
      const doneBeforeActive = task.sessions.filter(s => s.endTime && s.id !== activeSession.id).reduce((acc, s) => acc + (s.endTime - s.startTime), 0)
      const remainingTarget = Math.max(0, durationMs - doneBeforeActive)

      updateTask(taskId, t => {
        const others = (t.plannedSessions ?? []).filter(p => !p.isPrimary)
        return {
          ...t,
          goalDurationMs: durationMs,
          plannedSessions: [...others, { id: uid(), startTime: activeSession.startTime, endTime: activeSession.startTime + remainingTarget, isPrimary: true }]
        }
      })
    } else {
      // If inactive, just store the goal, don't show on timeline
      updateTask(taskId, t => ({
        ...t,
        goalDurationMs: durationMs
      }))
    }
  }, [allTasks, updateTask])
  const updateSession = useCallback((taskId, sessId, key, newVal) => {
    const time = parseTimeStr(newVal)
    if (!time) return
    const { h, m } = time

    updateTask(taskId, task => ({
      ...task,
      sessions: task.sessions.map(s => {
        if (s.id !== sessId) return s
        const d = new Date(s[key] || Date.now())
        d.setHours(h, m, 0, 0)
        return { ...s, [key]: d.getTime() }
      })
    }))
  }, [updateTask])

  const handleSort = useCallback(() => {
    const currentTasks = [...(allTasks[selDate] ?? [])].map((t, i) => ({
      ...t, colorIdx: t.colorIdx ?? (i % TASK_PALETTE.length),
    }))
    const dragged = currentTasks.splice(dragItem.current, 1)[0]
    currentTasks.splice(dragOverItem.current, 0, dragged)
    dragItem.current = null
    dragOverItem.current = null
    setAllTasks(prev => ({ ...prev, [selDate]: currentTasks }))
  }, [selDate, allTasks])

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
    <div className="app-wrapper">
      {/* ── NAV STRIP (Far Left - Full Height) ────────────────────────────────── */}
      <nav className="nav-strip">
        <div className="nav-avatar">L</div>
        <div className="nav-items">
          <div 
            className={`nav-item${activeNav === 'today' ? ' nav-item--active' : ''}`} 
            title="Today"
            onClick={() => setActiveNav('today')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          </div>
          <div 
            className={`nav-item${activeNav === 'insights' ? ' nav-item--active' : ''}`} 
            title="Insights"
            onClick={() => setActiveNav('insights')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
          </div>
          <div 
            className={`nav-item${activeNav === 'account' ? ' nav-item--active' : ''}`} 
            title="Account"
            onClick={() => setActiveNav('account')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="12" r="4"></circle></svg>
          </div>
        </div>
        <div className="nav-footer">
           <div className="nav-item" title="Notifications">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
           </div>
           <div className="nav-item" title="Help">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>
           </div>
        </div>
      </nav>

      <div className="app-main-area">
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
            const hasTasks   = (allTasks[day.key]?.length ?? 0) > 0
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
        {activeNav === 'today' && (
          <>
            {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
            <aside className="panel-left">
              <div className="panel-left-header">
                <h2 className="panel-title">{isToday ? 'Focus Board' : (selDayName || 'Tasks')}</h2>
              </div>
              <div className="task-board">
                {/* ── Yesterday / Overdue ── */}
                <div className="board-col">
                  <div className="board-header">
                    <span className="board-title">Overdue</span>
                    <span className="board-count">{overdueTasks.length}</span>
                  </div>
                  <div className="board-content">
                    {overdueTasks.length > 0 ? (
                      overdueTasks.map(t => (
                        <div key={t.id} className="mini-task-card">
                          <div className="mini-task-info">
                            <span className="mini-task-dot" style={{ background: TASK_PALETTE[t.colorIdx ?? 0].dot }} />
                            <span className="mini-task-name">{t.name}</span>
                          </div>
                          <button className="mini-task-action" onClick={() => carryOverTask(t)} title="Bring to today">↳</button>
                        </div>
                      ))
                    ) : (
                      <div className="board-empty">Nothing left over.</div>
                    )}
                  </div>
                </div>

                {/* ── Today ── */}
                <div className="board-col" style={{ flex: 1.2 }}>
                  <div className="board-header">
                    <span className="board-title">
                      Today's Focus
                      {totalDayMs > 0 && <span className="board-title-ms"> · {formatShort(totalDayMs)}</span>}
                    </span>
                    <span className="board-count">{dayTasks.length}</span>
                  </div>
                  <div className="board-content">

                    <div className="add-task-row" style={{ padding: '0 0 12px 0' }}>
                      <div className="add-task-input-wrap">
                        <input
                          ref={inputRef}
                          className="add-task-input"
                          type="text"
                          placeholder="What's next? (use # for tags)"
                          value={inputValue}
                          onChange={e => {
                            const val = e.target.value
                            setInputValue(val)
                            const lastWord = val.split(' ').pop()
                            if (lastWord.startsWith('#')) {
                              const search = lastWord.slice(1).toLowerCase()
                              setSuggestedTags(DEFAULT_TAGS.filter(t => t.label.toLowerCase().startsWith(search)))
                            } else {
                              setSuggestedTags([])
                            }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') addTask() }}
                        />
                        <button className="btn-add-task" onClick={addTask} title="Add task">+</button>
                        
                        {suggestedTags.length > 0 && (
                          <div className="smart-tag-suggestions">
                            {suggestedTags.map(tag => (
                              <button key={tag.id} className="suggestion-chip" onClick={() => {
                                const words = inputValue.split(' ')
                                words.pop()
                                setInputValue([...words, `#${tag.label}`, ''].join(' '))
                                setSuggestedTags([])
                                inputRef.current?.focus()
                              }}>
                                <span className="mini-task-dot" style={{ background: tag.dot, marginRight: 6 }} />
                                {tag.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

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
                              colorIdx: (allTasks[selDate]?.length ?? 0) % TASK_PALETTE.length,
                              createdAt: Date.now(),
                              tags:     firstFav.tags ?? ['other'],
                              favorite: true,
                            }
                            setAllTasks(prev => ({ ...prev, [selDate]: [...(prev[selDate] ?? []), taskToAdd] }))
                            setSelTaskId(taskToAdd.id)
                          }}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}


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
                            style={{ flex: 1, textDecoration: status === 'done' ? 'line-through' : 'none', opacity: status === 'done' ? 0.5 : 1 }}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              setEditingTaskId(task.id)
                              setEditNameValue(task.name)
                            }}
                          >
                            {task.name}
                            <button
                              className="btn-edit-inline btn-edit-inline--flipped"
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

                        {isExpanded && (
                          <button
                            className={`task-heart${isFav ? ' task-heart--active' : ''}`}
                            style={{ marginLeft: 'auto', opacity: 1 }}
                            onClick={e => { e.stopPropagation(); toggleFavorite(task.id) }}
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {isFav ? '♥' : '♡'}
                          </button>
                        )}

                        {!isExpanded && (
                          <div className="task-card-actions-mini">
                            <button
                              className={`task-heart${isFav ? ' task-heart--active' : ''}`}
                              onClick={e => { e.stopPropagation(); toggleFavorite(task.id) }}
                              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {isFav ? '♥' : '♡'}
                            </button>
                            {status === 'active' ? (
                              <button
                                className="btn-card-play btn-card-play--active"
                                onClick={e => { e.stopPropagation(); pauseTask(task.id) }}
                                title="Pause session"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>
                              </button>
                            ) : (
                              <button
                                className="btn-card-play"
                                onClick={e => { e.stopPropagation(); startTask(task.id) }}
                                disabled={selDate !== todayKey}
                                title={totalMs > 0 ? "Resume session" : "Start session"}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
                              </button>
                            )}

                            {status === 'active' ? (
                               <button 
                                  className="btn-card-play btn-card-done-subtle"
                                  onClick={e => { e.stopPropagation(); doneTask(task.id) }}
                                  title="Mark as Done"
                               >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                               </button>
                            ) : (
                              <button 
                                className="btn-card-action-subtle btn-card-del-subtle" 
                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                                title="Delete task"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tag chips */}
                      <div className="task-card-meta-row">
                        {taskTags.length > 0 && (
                          <div className="task-card-tags" style={{ marginTop: 0 }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                          <div className="task-card-meta" style={{ color: taskPalette.dot }}>{metaText}</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="task-card-expanded" onClick={e => e.stopPropagation()}>
                          
                          <div className="task-card-expanded-actions-block">
                            {status === 'idle' && task.sessions.length === 0 && (
                              <button className="tag-btn btn--start-pill" onClick={() => startTask(task.id)} disabled={selDate !== todayKey}>▶ Start</button>
                            )}
                            {status === 'idle' && task.sessions.length > 0 && (
                              <>
                                <button className="tag-btn btn--start-pill" onClick={() => startTask(task.id)} disabled={selDate !== todayKey}>↺ Resume</button>
                                <button className="tag-btn btn--done-pill" onClick={() => doneTask(task.id)}>✓ Done</button>
                              </>
                            )}
                            {status === 'active' && (
                              <>
                                <button className="tag-btn" onClick={() => { pauseTask(task.id); setSelTaskId(task.id) }}>⏸ Pause</button>
                                <button className="tag-btn btn--done-pill" onClick={() => doneTask(task.id)}>✓ Done</button>
                              </>
                            )}
                            {status === 'done' && (
                              <button className="tag-btn" onClick={() => startTask(task.id)} disabled={selDate !== todayKey}>↺ Reopen</button>
                            )}
                            <button className="tag-btn btn--del-pill" onClick={() => deleteTask(task.id)} title="Delete task">✕</button>
                          </div>

                          {/* Sessions editor */}
                          {task.sessions.length > 0 && (
                            <div className="task-sessions-list">
                              <div className="task-sessions-header">Edit sessions</div>
                              {task.sessions.map((s, idx) => (
                                <div key={s.id || idx} className="session-edit-row">
                                  <input
                                    type="text"
                                    className="session-time-input"
                                    value={formatHM(s.startTime)}
                                    placeholder="00:00"
                                    onChange={e => updateSession(task.id, s.id, 'startTime', e.target.value)}
                                  />
                                  <span className="session-time-sep">to</span>
                                  {s.endTime ? (
                                    <input
                                      type="text"
                                      className="session-time-input"
                                      value={formatHM(s.endTime)}
                                      placeholder="00:00"
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
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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

                          {/* Plans editor (Ghosts) */}
                          {(task.plannedSessions ?? []).length > 0 && (
                            <div className="task-sessions-list" style={{ marginTop: 16 }}>
                              <div className="task-sessions-header">Ghost Intention (Planned)</div>
                              {(task.plannedSessions ?? []).map((p, pIdx) => (
                                <div key={p.id || pIdx} className="session-edit-row">
                                  <input 
                                    type="text" 
                                    className="session-time-input" 
                                    style={{ borderStyle: 'dashed' }}
                                    defaultValue={formatHM(p.startTime)}
                                    onBlur={e => updatePlannedSession(task.id, p.id, 'startTime', e.target.value)}
                                  />
                                  <span className="session-time-sep">to</span>
                                  <input 
                                    type="text" 
                                    className="session-time-input" 
                                    style={{ borderStyle: 'dashed' }}
                                    defaultValue={formatHM(p.endTime)}
                                    onBlur={e => updatePlannedSession(task.id, p.id, 'endTime', e.target.value)}
                                  />
                                  <button
                                    className="btn-session-del"
                                    onClick={() => deletePlannedSession(task.id, selDate, p.id)}
                                    title="Remove ghost"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="task-goal-row" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                            <div className="task-sessions-header">Plan Duration (e.g. 1h, 30m)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                               <input 
                                 type="text" 
                                 className="session-time-input" 
                                 placeholder="1h or 14:00"
                                 defaultValue={task.goalDurationMs ? formatShort(task.goalDurationMs) : ''}
                                 key={task.goalDurationMs} 
                                 onBlur={e => e.target.value && setGoalTime(task.id, selDate, e.target.value)}
                                 onKeyDown={e => { 
                                   if (e.key === 'Enter') { 
                                     setGoalTime(task.id, selDate, e.target.value)
                                     e.target.blur() 
                                   } 
                                 }}
                               />
                               <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{task.goalDurationMs ? 'Goal set.' : 'Type duration to set goal'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                    </div>
                  </div>
                </div>

                {/* ── Planned / Tomorrow ── */}
                <div className="board-col">
                  <div className="board-header">
                    <span className="board-title">To Plan</span>
                    <span className="board-count">{plannedTasks.length}</span>
                  </div>
                  <div className="board-content">
                    <div className="add-task-row" style={{ padding: '0 0 12px 0' }}>
                      <div className="add-task-input-wrap">
                        <input
                          className="add-task-input"
                          type="text"
                          placeholder="Tomorrow's goal… (use # for tags)"
                          value={planInput}
                          onChange={e => {
                            const val = e.target.value
                            setPlanInput(val)
                            const lastWord = val.split(' ').pop()
                            if (lastWord.startsWith('#')) {
                              const search = lastWord.slice(1).toLowerCase()
                              setSuggestedPlanTags(DEFAULT_TAGS.filter(t => t.label.toLowerCase().startsWith(search)))
                            } else {
                              setSuggestedPlanTags([])
                            }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') planForTomorrow(e.target.value.trim()) }}
                        />
                        <button className="btn-add-task" onClick={() => planForTomorrow(planInput)} title="Add plan">+</button>
                        
                        {suggestedPlanTags.length > 0 && (
                          <div className="smart-tag-suggestions">
                            {suggestedPlanTags.map(tag => (
                              <button key={tag.id} className="suggestion-chip" onClick={() => {
                                const words = planInput.split(' ')
                                words.pop()
                                setPlanInput([...words, `#${tag.label}`, ''].join(' '))
                                setSuggestedPlanTags([])
                              }}>
                                <span className="mini-task-dot" style={{ background: tag.dot, marginRight: 6 }} />
                                {tag.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="task-list">
                      {plannedTasks.map((task, i) => {
                        const status      = getTaskStatus(task)
                        const isExpanded  = selTaskId === task.id
                        const isFav       = favoriteTasks.includes(task.id)
                        const taskPalette = { ...TASK_PALETTE[task.colorIdx ?? (i % TASK_PALETTE.length)] }
                        const taskTags    = (task.tags ?? []).map(id => DEFAULT_TAGS.find(t => t.id === id)).filter(Boolean)
                        const firstTag    = taskTags[0]
                        if (firstTag) {
                          taskPalette.dot = firstTag.dot || firstTag.color
                          taskPalette.bg  = firstTag.bg
                          taskPalette.border = firstTag.border || firstTag.dot || firstTag.color
                        }

                        return (
                          <div
                            key={task.id}
                            className={['task-card', `task-card--${status}`, isExpanded ? 'task-card--selected' : ''].filter(Boolean).join(' ')}
                            draggable
                            onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                            onClick={() => setSelTaskId(prev => prev === task.id ? null : task.id)}
                          >
                            <div className="task-card-top">
                              <span className="status-dot" style={{ background: taskPalette.dot }} />
                              {editingTaskId === task.id ? (
                                <input
                                  className="task-rename-input"
                                  autoFocus
                                  value={editNameValue}
                                  onChange={e => setEditNameValue(e.target.value)}
                                  onBlur={() => renameTask(task.id, editNameValue, tomorrowKey)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') renameTask(task.id, editNameValue, tomorrowKey)
                                    if (e.key === 'Escape') setEditingTaskId(null)
                                  }}
                                  onClick={e => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className="task-card-name"
                                  style={{ flex: 1, textDecoration: status === 'done' ? 'line-through' : 'none', opacity: status === 'done' ? 0.5 : 1 }}
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
                              
                              <div className="task-card-actions">
                                <button
                                  className={`task-heart${isFav ? ' task-heart--active' : ''}`}
                                  onClick={e => { e.stopPropagation(); toggleFavorite(task.id, tomorrowKey) }}
                                  title={isFav ? 'Remove' : 'Add to favorites'}
                                >
                                  {isFav ? '♥' : '♡'}
                                </button>
                                
                                <button 
                                  className="btn-card-action-subtle btn-card-del-subtle" 
                                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id, tomorrowKey) }}
                                  title="Delete task"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="task-card-expanded page-fade-in" style={{ padding: '0 12px 12px' }}>
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
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setAllTasks(prev => ({
                                            ...prev,
                                            [tomorrowKey]: (prev[tomorrowKey] ?? []).map(t => t.id === task.id ? { ...t, tags: [tag.id] } : t)
                                          }))
                                        }}
                                      >
                                        {tag.label}
                                      </button>
                                    )
                                  })}
                                </div>
                                
                                <div className="task-card-bottom-actions" style={{ marginTop: 12 }}>
                                  <button className="btn btn--delete" style={{ width: '100%' }} onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}>
                                    ✕ Delete task
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {plannedTasks.length === 0 && <div className="board-empty">No future tasks yet.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── TIMELINE ───────────────────────────────────────────────────── */}
            <Timeline
              allTasks={allTasks}
              days={timelineView === 'week'
                ? (weekDays || [])
                : [(weekDays || []).find(d => d.key === selDate) ?? { key: selDate, shortLabel: '?', dayNum: '' }]
              }
              viewMode={timelineView}
              now={now}
              timelineScrollRef={timelineScrollRef}
              selTaskId={selTaskId}
              onPlanHour={(hour) => {
                if (selTaskId) addPlannedSession(selTaskId, selDate, hour)
              }}
            />

            <TodayDashboard 
              activeTask={activeTask}
              now={now}
              dayTasks={dayTasks}
              totalDayMs={totalDayMs}
              longestSessMs={maxSessMsToday}
              dailyNote={dailyNotes[selDate]}
              onNoteChange={(val) => setDailyNotes(prev => ({ ...prev, [selDate]: val }))}
              selDate={selDate}
            />
          </>
        )}

        {(activeNav === 'insights' || activeNav === 'account') && (
          <div className="full-view-panel page-fade-in">
            <RightPanel
              allTasks={allTasks}
              favoriteTasks={favoriteTasks}
              selDate={selDate}
              now={now}
              weekStart={weekStart}
              user={user}
              templates={templates}
              onLogout={logout}
              onAddTemplate={addTemplate}
              onRemoveTemplate={removeTemplate}
              isInsights={activeNav === 'insights'}
              isAccount={activeNav === 'account'}
            />
          </div>
        )}
      </div>
    </div>
  </div>
)
}
