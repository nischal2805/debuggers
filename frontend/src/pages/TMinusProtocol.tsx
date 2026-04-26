import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

async function getToken(isDemoMode: boolean, demoToken: string | null): Promise<string | null> {
  if (isDemoMode && demoToken) return demoToken
  if (!auth) return null
  return auth.currentUser?.getIdToken() ?? null
}

type ReviewTopic = {
  topic: string
  mastery: number
  risk_score: number
  importance: number
  why: string
  time_allocation_min: number
  problems: { id: string; title: string; difficulty: string }[]
}

type TMinusData = {
  top_risk: ReviewTopic[]
  stop_studying: string[]
  total_time_min: number
  interview_date: string | null
}

const DIFF_COLORS: Record<string, string> = { easy: '#00e676', medium: '#ffb300', hard: '#ff4757' }
const RISK_COLOR = (r: number) => r >= 0.6 ? '#ff4757' : r >= 0.4 ? '#ffb300' : '#6c63ff'

export default function TMinusProtocol() {
  const navigate = useNavigate()
  const { isDemoMode, demoToken } = useStore()

  const [data, setData] = useState<TMinusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [interviewDate, setInterviewDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const token = await getToken(isDemoMode, demoToken)
      if (!token) { setLoading(false); return }
      try {
        const r = await fetch(`${BACKEND_URL}/user/tminus`, { headers: { Authorization: `Bearer ${token}` } })
        const d = await r.json()
        setData(d)
        if (d.interview_date) {
          setInterviewDate(d.interview_date)
          const days = Math.max(0, Math.ceil((new Date(d.interview_date).getTime() - Date.now()) / 86400000))
          setDaysLeft(days)
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [isDemoMode, demoToken])

  const saveDate = async () => {
    if (!interviewDate) return
    setSaving(true)
    const token = await getToken(isDemoMode, demoToken)
    if (token) {
      await fetch(`${BACKEND_URL}/user/interview-date`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ interview_date: interviewDate }),
      })
      const days = Math.max(0, Math.ceil((new Date(interviewDate).getTime() - Date.now()) / 86400000))
      setDaysLeft(days)
    }
    setSaving(false)
  }

  const isActive = daysLeft !== null && daysLeft <= 2

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-display font-bold text-text-primary">T-Minus Protocol</span>
          {isActive && (
            <span className="font-body text-[10px] text-accent-danger border border-accent-danger/40 rounded px-1.5 py-0.5 animate-pulse">ACTIVE</span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="text-center">
          <div className="font-body text-accent-secondary text-xs uppercase tracking-widest mb-2">48-Hour Pre-Interview Diagnostic</div>
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">
            {daysLeft !== null
              ? daysLeft === 0 ? 'Interview Day' : `T-Minus ${daysLeft} Day${daysLeft !== 1 ? 's' : ''}`
              : 'T-Minus Protocol'}
          </h1>
          <p className="font-body text-text-secondary text-sm max-w-lg mx-auto">
            Stop studying everything. The night before your interview, you need to know <em>exactly</em> what to review and what to ignore. This protocol tells you.
          </p>
        </div>

        {/* Interview Date */}
        <div className="p-5 bg-bg-surface border border-border rounded-lg">
          <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-3">Set Your Interview Date</p>
          <div className="flex gap-3">
            <input
              type="date"
              value={interviewDate}
              onChange={e => setInterviewDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-bg-elevated border border-border rounded font-body text-sm text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
            />
            <button
              onClick={saveDate}
              disabled={saving || !interviewDate}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-sm rounded transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Set Date'}
            </button>
          </div>
          {daysLeft !== null && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(5, Math.min(100, ((14 - Math.min(daysLeft, 14)) / 14) * 100))}%`,
                    background: daysLeft <= 1 ? '#ff4757' : daysLeft <= 3 ? '#ffb300' : '#6c63ff',
                  }}
                />
              </div>
              <span className="font-body text-xs text-text-secondary whitespace-nowrap">
                {daysLeft === 0 ? '⚠ Today!' : daysLeft === 1 ? '⚠ Tomorrow' : `${daysLeft} days out`}
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* Stop studying */}
            {data.stop_studying.length > 0 && (
              <div className="p-5 bg-accent-danger/5 border border-accent-danger/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-accent-danger text-lg mt-0.5">✕</span>
                  <div>
                    <p className="font-body text-accent-danger text-xs uppercase tracking-wider mb-1">Stop Studying These</p>
                    <p className="font-body text-text-secondary text-sm mb-2">
                      These topics have decent mastery already. Spending time on them now has near-zero ROI.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {data.stop_studying.map(t => (
                        <span key={t} className="font-body text-xs px-2 py-1 rounded border border-accent-danger/30 text-text-secondary line-through">
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* T-Minus directive */}
            <div className="p-5 bg-bg-surface border border-accent-primary/30 rounded-lg">
              <p className="font-body text-accent-primary text-xs uppercase tracking-wider mb-2">Your 2-Hour Review Plan</p>
              <p className="font-body text-text-primary text-sm leading-relaxed">
                Based on your knowledge graph, these are your <strong>3 highest-risk topics</strong> —
                high FAANG interview frequency combined with your current weak spots.
                40 minutes each. This is how you move the needle in 120 minutes.
              </p>
            </div>

            {/* Top 3 risk topics */}
            <div className="space-y-4">
              {data.top_risk.map((item, idx) => (
                <div key={item.topic} className="bg-bg-surface border border-border rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span
                          className="font-display text-2xl font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm border"
                          style={{ color: RISK_COLOR(item.risk_score), borderColor: RISK_COLOR(item.risk_score) + '40', background: RISK_COLOR(item.risk_score) + '15' }}
                        >{idx + 1}</span>
                        <div>
                          <div className="font-display text-base font-bold text-text-primary capitalize">
                            {item.topic.replace(/_/g, ' ')}
                          </div>
                          <div className="font-body text-xs text-text-secondary">{item.why}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-body text-xs text-text-secondary mb-0.5">Risk Score</div>
                        <div className="font-display text-lg font-bold" style={{ color: RISK_COLOR(item.risk_score) }}>
                          {Math.round(item.risk_score * 100)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Current Mastery</span>
                          <span className="font-body text-[10px] text-text-secondary">{Math.round(item.mastery * 100)}%</span>
                        </div>
                        <div className="h-1 bg-bg-elevated rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${item.mastery * 100}%`, background: item.mastery >= 0.7 ? '#00e676' : item.mastery >= 0.4 ? '#ffb300' : '#ff4757' }}
                          />
                        </div>
                      </div>
                      <div className="font-body text-xs text-text-secondary whitespace-nowrap">
                        ⏱ {item.time_allocation_min} min
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3">
                    <p className="font-body text-text-secondary text-[10px] uppercase tracking-wider mb-2">Practice These</p>
                    <div className="space-y-2">
                      {item.problems.map(p => (
                        <div key={p.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-body text-xs text-text-primary">{p.title}</span>
                            <span className="font-body text-[10px] px-1.5 py-0.5 rounded" style={{ color: DIFF_COLORS[p.difficulty] ?? '#888', border: `1px solid ${(DIFF_COLORS[p.difficulty] ?? '#888') + '40'}` }}>
                              {p.difficulty}
                            </span>
                          </div>
                          <button
                            onClick={() => navigate(`/solve/${item.topic}`)}
                            className="font-body text-[10px] px-2 py-1 rounded border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10 transition-colors"
                          >
                            Solve →
                          </button>
                        </div>
                      ))}
                      {item.problems.length === 0 && (
                        <button
                          onClick={() => navigate(`/solve/${item.topic}`)}
                          className="font-body text-xs text-accent-primary hover:underline"
                        >
                          Start practicing {item.topic.replace(/_/g, ' ')} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {data.top_risk.length === 0 && (
                <div className="p-8 text-center bg-bg-surface border border-border rounded-lg">
                  <p className="font-body text-text-secondary text-sm">Complete some practice sessions first — the protocol needs data to identify your risk areas.</p>
                  <button onClick={() => navigate('/dashboard')} className="mt-4 font-body text-xs text-accent-primary hover:underline">Go practice →</button>
                </div>
              )}
            </div>

            {/* Closing message */}
            {data.top_risk.length > 0 && (
              <div className="p-5 bg-bg-elevated border border-border rounded-lg text-center">
                <p className="font-body text-text-secondary text-sm italic">
                  "Stop studying DP. You won't master it in 48 hours. Your highest ROI is{' '}
                  <span className="text-text-primary font-medium">
                    {data.top_risk.map(t => t.topic.replace(/_/g, ' ')).join(' and ')}
                  </span>.
                  Here's your 2 hours. Make them count."
                </p>
                <p className="font-body text-text-secondary text-[10px] mt-2 uppercase tracking-wider">— NeuralDSA T-Minus Protocol</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
