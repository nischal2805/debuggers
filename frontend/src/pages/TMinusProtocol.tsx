import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import NavBar from '../components/NavBar'

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
const spring = { type: 'spring' as const, stiffness: 400, damping: 26 }

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
  const urgencyColor = daysLeft === 0 ? '#ff4757' : daysLeft === 1 ? '#ff4757' : daysLeft !== null && daysLeft <= 3 ? '#ffb300' : '#6c63ff'

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar active="/tminus" />
      {/* T-Minus sub-header */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-bg-surface/60">
        <span className="font-display font-bold text-text-primary text-sm">T-Minus Protocol</span>
        <AnimatePresence>
          {isActive && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="font-body text-[10px] text-accent-danger border border-accent-danger/40 rounded-full px-2 py-0.5 bg-accent-danger/10 animate-pulse"
            >
              ACTIVE
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-center space-y-3"
        >
          <p className="font-body text-accent-secondary text-xs uppercase tracking-widest">48-Hour Pre-Interview Diagnostic</p>

          <h1 className="font-display font-bold leading-tight">
            {daysLeft !== null ? (
              <span className="block">
                {daysLeft === 0 ? (
                  <span className="text-5xl gradient-text-danger">Interview Day</span>
                ) : (
                  <>
                    <motion.span
                      key={daysLeft}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="block text-6xl font-black"
                      style={{ color: urgencyColor, textShadow: `0 0 30px ${urgencyColor}50` }}
                    >
                      T-{daysLeft}
                    </motion.span>
                    <span className="text-2xl text-text-secondary font-normal">
                      {daysLeft === 1 ? 'day remaining' : 'days remaining'}
                    </span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-5xl gradient-text">T-Minus Protocol</span>
            )}
          </h1>

          <p className="font-body text-text-secondary text-sm max-w-lg mx-auto leading-relaxed">
            Stop studying everything. The night before your interview, you need to know{' '}
            <em className="text-text-primary">exactly</em> what to review and what to ignore.
          </p>
        </motion.div>

        {/* ── Interview Date ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
          style={{ borderTop: `2px solid ${urgencyColor}60` }}
        >
          <div className="p-5">
            <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-4">Set Your Interview Date</p>
            <div className="flex gap-3">
              <input
                type="date"
                value={interviewDate}
                onChange={e => setInterviewDate(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-bg-elevated border border-border rounded-xl font-body text-sm text-text-primary focus:outline-none focus:border-accent-primary/60 transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 4px 16px rgba(108,99,255,0.35)' }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                onClick={saveDate}
                disabled={saving || !interviewDate}
                className="px-5 py-2.5 text-white font-body text-sm rounded-xl transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6c63ff, #5a54d4)', boxShadow: '0 2px 10px rgba(108,99,255,0.25)' }}
              >
                {saving ? 'Saving...' : 'Set Date'}
              </motion.button>
            </div>

            <AnimatePresence>
              {daysLeft !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-2 flex-1 bg-bg-elevated rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(5, Math.min(100, ((14 - Math.min(daysLeft, 14)) / 14) * 100))}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${urgencyColor}, ${urgencyColor}cc)` }}
                      />
                    </div>
                    <span className="font-body text-xs font-semibold whitespace-nowrap" style={{ color: urgencyColor }}>
                      {daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days out`}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 w-10 h-10 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-1.5 w-7 h-7 border-2 border-accent-secondary/30 border-b-transparent rounded-full animate-spin" style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
            </div>
          </div>
        )}

        <AnimatePresence>
          {!loading && data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >

              {/* ── Stop Studying ── */}
              {data.stop_studying.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl border border-accent-danger/20 bg-accent-danger/5 overflow-hidden"
                >
                  <div className="px-5 py-4 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-accent-danger/15 border border-accent-danger/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-accent-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-body text-accent-danger text-xs uppercase tracking-wider font-semibold mb-1">Stop Studying These</p>
                      <p className="font-body text-text-secondary text-xs mb-3 leading-relaxed">
                        Decent mastery already. Near-zero ROI to practice further tonight.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {data.stop_studying.map(t => (
                          <span key={t} className="font-body text-xs px-2.5 py-1 rounded-full border border-accent-danger/25 text-text-secondary/70 line-through bg-bg-surface">
                            {t.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── 2-Hour Plan ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'rgba(108,99,255,0.35)', background: 'rgba(108,99,255,0.04)' }}
              >
                <div className="px-5 py-4">
                  <p className="font-body text-accent-primary text-xs uppercase tracking-wider font-semibold mb-2">Your 2-Hour Review Plan</p>
                  <p className="font-body text-text-primary text-sm leading-relaxed">
                    Based on your knowledge graph, these are your{' '}
                    <strong className="text-accent-primary">3 highest-risk topics</strong> —
                    high FAANG frequency combined with your current weak spots. 40 minutes each.
                  </p>
                </div>
              </motion.div>

              {/* ── Top 3 Risk Topics ── */}
              <div className="space-y-4">
                {data.top_risk.map((item, idx) => {
                  const riskColor = RISK_COLOR(item.risk_score)
                  return (
                    <motion.div
                      key={item.topic}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + idx * 0.08 }}
                      className="bg-bg-surface border border-border rounded-2xl overflow-hidden"
                      style={{ borderLeft: `3px solid ${riskColor}` }}
                    >
                      <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-display font-bold border"
                              style={{
                                color: riskColor,
                                borderColor: `${riskColor}40`,
                                background: `${riskColor}15`,
                              }}
                            >
                              {idx + 1}
                            </motion.div>
                            <div>
                              <div className="font-display text-base font-bold text-text-primary capitalize">
                                {item.topic.replace(/_/g, ' ')}
                              </div>
                              <div className="font-body text-xs text-text-secondary leading-relaxed">{item.why}</div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="font-body text-[10px] text-text-secondary mb-1">Risk Score</div>
                            <div
                              className="font-display text-2xl font-black"
                              style={{ color: riskColor, textShadow: `0 0 16px ${riskColor}50` }}
                            >
                              {Math.round(item.risk_score * 100)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="flex justify-between mb-1.5">
                              <span className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Mastery</span>
                              <span className="font-body text-[10px] text-text-secondary">{Math.round(item.mastery * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${item.mastery * 100}%` }}
                                transition={{ delay: 0.4 + idx * 0.1, duration: 0.6, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{
                                  background: item.mastery >= 0.7 ? '#00e676' : item.mastery >= 0.4 ? '#ffb300' : '#ff4757',
                                  boxShadow: `0 0 8px ${item.mastery >= 0.7 ? '#00e676' : item.mastery >= 0.4 ? '#ffb300' : '#ff4757'}60`,
                                }}
                              />
                            </div>
                          </div>
                          <div
                            className="font-body text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded-full"
                            style={{ color: riskColor, background: `${riskColor}12`, border: `1px solid ${riskColor}30` }}
                          >
                            {item.time_allocation_min} min
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3">
                        <p className="font-body text-text-secondary text-[10px] uppercase tracking-wider mb-2">Practice These</p>
                        <div className="space-y-2">
                          {item.problems.map(p => (
                            <div key={p.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-body text-xs text-text-primary truncate">{p.title}</span>
                                <span
                                  className="font-body text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{ color: DIFF_COLORS[p.difficulty] ?? '#888', border: `1px solid ${(DIFF_COLORS[p.difficulty] ?? '#888')}40`, background: `${DIFF_COLORS[p.difficulty] ?? '#888'}10` }}
                                >
                                  {p.difficulty}
                                </span>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.04, boxShadow: '0 4px 12px rgba(108,99,255,0.3)' }}
                                whileTap={{ scale: 0.96 }}
                                transition={spring}
                                onClick={() => navigate(`/solve/${item.topic}`)}
                                className="font-body text-[10px] px-2.5 py-1 rounded-lg border border-accent-primary/35 text-accent-primary hover:bg-accent-primary/10 transition-all flex-shrink-0 ml-2"
                              >
                                Solve
                              </motion.button>
                            </div>
                          ))}
                          {item.problems.length === 0 && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              onClick={() => navigate(`/solve/${item.topic}`)}
                              className="font-body text-xs text-accent-primary hover:underline"
                            >
                              Start practicing {item.topic.replace(/_/g, ' ')} →
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}

                {data.top_risk.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-12 text-center bg-bg-surface border border-border rounded-2xl"
                  >
                    <p className="font-body text-text-secondary text-sm">
                      Complete some practice sessions first — the protocol needs data to identify your risk areas.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => navigate('/dashboard')}
                      className="mt-5 font-body text-sm text-accent-primary px-4 py-2 rounded-xl border border-accent-primary/30 hover:bg-accent-primary/10 transition-all"
                    >
                      Go practice →
                    </motion.button>
                  </motion.div>
                )}
              </div>

              {/* ── Closing ── */}
              {data.top_risk.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-6 bg-bg-elevated border border-border rounded-2xl text-center"
                  style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.04), rgba(0,212,255,0.04))' }}
                >
                  <p className="font-body text-text-secondary text-sm italic leading-relaxed">
                    "Stop studying DP. You won't master it in 48 hours. Your highest ROI is{' '}
                    <span className="text-text-primary font-semibold not-italic">
                      {data.top_risk.map(t => t.topic.replace(/_/g, ' ')).join(' and ')}
                    </span>
                    . Here's your 2 hours. Make them count."
                  </p>
                  <p className="font-body text-text-secondary text-[10px] mt-3 uppercase tracking-widest">— NeuralDSA T-Minus Protocol</p>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}
