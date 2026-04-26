import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

type CountdownData = {
  has_date: boolean
  interview_date?: string
  days_remaining?: number
  total_topics?: number
  mastered?: number
  uncovered?: number
  projected_covered?: number
  velocity_per_day?: number
  daily_goal_min?: number
  min_needed_per_day?: number
  on_track?: boolean
}

export default function CountdownWidget() {
  const { isDemoMode, demoToken } = useStore()
  const navigate = useNavigate()
  const [data, setData] = useState<CountdownData | null>(null)
  const [settingDate, setSettingDate] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchCountdown = async () => {
    const token = isDemoMode && demoToken ? demoToken
      : auth?.currentUser ? await auth.currentUser.getIdToken() : null
    if (!token) return
    const r = await fetch(`${BACKEND_URL}/user/countdown`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) setData(await r.json())
  }

  useEffect(() => { fetchCountdown() }, [isDemoMode, demoToken])

  const saveDate = async () => {
    if (!dateInput) return
    setSaving(true)
    const token = isDemoMode && demoToken ? demoToken
      : auth?.currentUser ? await auth.currentUser.getIdToken() : null
    if (!token) { setSaving(false); return }
    await fetch(`${BACKEND_URL}/user/interview-date`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ interview_date: dateInput }),
    })
    setSaving(false)
    setSettingDate(false)
    await fetchCountdown()
  }

  if (!data) return null

  if (!data.has_date) {
    return (
      <div className="p-4 bg-bg-surface border border-border rounded-lg">
        <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-2">Interview Countdown</p>
        {settingDate ? (
          <div className="flex gap-2 mt-2">
            <input
              type="date"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              className="flex-1 bg-bg-elevated border border-border text-text-primary font-body text-xs rounded px-2 py-1.5"
              min={new Date().toISOString().slice(0, 10)}
            />
            <button
              onClick={saveDate}
              disabled={saving || !dateInput}
              className="px-3 py-1.5 bg-accent-primary text-white font-body text-xs rounded disabled:opacity-50"
            >
              {saving ? '...' : 'Set'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSettingDate(true)}
            className="mt-1 font-body text-xs text-accent-primary hover:underline"
          >
            Set your interview date
          </button>
        )}
      </div>
    )
  }

  const { days_remaining, total_topics, mastered, projected_covered, on_track, min_needed_per_day, daily_goal_min, velocity_per_day } = data
  const safeTotalTopics = (total_topics && total_topics > 0) ? total_topics : 47
  const coveragePercent = Math.min(100, Math.round(((mastered ?? 0) / safeTotalTopics) * 100))
  const projectedPercent = Math.min(100, Math.round(((projected_covered ?? 0) / safeTotalTopics) * 100))
  const isCritical = (days_remaining ?? 99) <= 7

  const urgencyColor = (days_remaining ?? 30) < 7 ? '#ff4757' : (days_remaining ?? 30) < 14 ? '#ffb300' : '#6c63ff'

  return (
    <div className="p-4 bg-bg-surface border border-border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <p className="font-body text-text-secondary text-xs uppercase tracking-wider">Interview Countdown</p>
        <button onClick={() => setSettingDate(!settingDate)} className="font-body text-[10px] text-text-secondary hover:text-text-primary">
          {settingDate ? 'cancel' : 'change date'}
        </button>
      </div>

      {settingDate && (
        <div className="flex gap-2 mb-3">
          <input
            type="date"
            value={dateInput}
            onChange={e => setDateInput(e.target.value)}
            className="flex-1 bg-bg-elevated border border-border text-text-primary font-body text-xs rounded px-2 py-1.5"
            min={new Date().toISOString().slice(0, 10)}
          />
          <button onClick={saveDate} disabled={saving || !dateInput} className="px-3 py-1.5 bg-accent-primary text-white font-body text-xs rounded disabled:opacity-50">
            {saving ? '...' : 'Set'}
          </button>
        </div>
      )}

      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-display text-3xl font-bold" style={{ color: urgencyColor }}>{days_remaining}</span>
        <span className="font-body text-text-secondary text-sm">days</span>
      </div>
      <p className="font-body text-text-secondary text-xs mb-4">
        {new Date(data.interview_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>

      {/* Current coverage */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="font-body text-text-secondary text-xs">Current coverage</span>
          <span className="font-body text-text-primary text-xs">{mastered}/{total_topics} topics</span>
        </div>
        <div className="w-full h-1.5 bg-bg-elevated rounded-full">
          <div className="h-full rounded-full bg-accent-primary" style={{ width: `${coveragePercent}%` }} />
        </div>
      </div>

      {/* Projected coverage */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="font-body text-text-secondary text-xs">At current pace</span>
          <span className="font-body text-xs" style={{ color: on_track ? '#00e676' : '#ffb300' }}>{projected_covered}/{total_topics}</span>
        </div>
        <div className="w-full h-1.5 bg-bg-elevated rounded-full">
          <div className="h-full rounded-full transition-all" style={{ width: `${projectedPercent}%`, background: on_track ? '#00e676' : '#ffb300' }} />
        </div>
      </div>

      {/* Pace recommendation */}
      <div className="p-3 rounded mb-3" style={{ background: on_track ? 'rgba(0,230,118,0.06)' : 'rgba(255,183,0,0.06)', border: `1px solid ${on_track ? 'rgba(0,230,118,0.2)' : 'rgba(255,183,0,0.2)'}` }}>
        {on_track ? (
          <p className="font-body text-xs" style={{ color: '#00e676' }}>
            On track. {velocity_per_day && velocity_per_day > 0 ? `${velocity_per_day.toFixed(1)} topics/day.` : ''}
          </p>
        ) : (
          <p className="font-body text-xs text-accent-warn">
            Need {min_needed_per_day}min/day instead of {daily_goal_min}min to cover all {safeTotalTopics} topics.
          </p>
        )}
      </div>

      {/* T-Minus link */}
      <button
        onClick={() => navigate('/tminus')}
        className="w-full font-body text-xs py-2 rounded-lg transition-all"
        style={{
          background: isCritical ? 'rgba(255,71,87,0.1)' : 'rgba(108,99,255,0.08)',
          border: `1px solid ${isCritical ? 'rgba(255,71,87,0.4)' : 'rgba(108,99,255,0.3)'}`,
          color: isCritical ? '#ff4757' : '#6c63ff',
          animation: isCritical ? 'pulse 1.5s infinite' : 'none',
        }}
      >
        {isCritical ? 'T-Minus Protocol — activate now' : 'T-Minus Protocol →'}
      </button>
    </div>
  )
}
