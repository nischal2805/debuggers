import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import NavBar from '../components/NavBar'
import { useStore } from '../store/useStore'
import { useKnowledgeModel } from '../hooks/useKnowledgeModel'
import { TOPIC_GRAPH, getMasteryColor } from '../lib/topics'
import SkillRadar from '../components/SkillRadar'
import ReadinessCard from '../components/ReadinessCard'
import TrajectorySparkline from '../components/TrajectorySparkline'
import AssessmentLevelBadge from '../components/AssessmentLevelBadge'
import ReportCardPanel from '../components/ReportCardPanel'
import type { ReportCard } from '../lib/types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

interface ChatMsg { role: 'user' | 'assistant'; content: string }

interface SolveHistoryItem {
  problem_id: string; lc: string; title: string; topic: string; pattern: string
  correct: boolean; passed?: number; total?: number; language: string
  mastery_delta: number; total_time_min?: number; hints_requested: number
  approach_written: boolean; num_runs: number; timed_out: boolean
  behavioral_insight?: string; ts: string
}
interface SolveHistorySummary { total_solved: number; correct: number; accuracy: number; topics_touched: number }


async function getToken(isDemoMode: boolean, demoToken: string | null): Promise<string | null> {
  if (isDemoMode && demoToken) return demoToken
  if (!auth) return null
  return auth.currentUser?.getIdToken() ?? null
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, isDemoMode, demoToken, exitDemoMode, readiness, calibrationGap, lastReport, setReadiness } = useStore()
  const model = useKnowledgeModel()

  // Advisor chat
  const [chatOpen, setChatOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Solve history
  const [solveHistory, setSolveHistory] = useState<SolveHistoryItem[]>([])
  const [solveSummary, setSolveSummary] = useState<SolveHistorySummary | null>(null)
  const [interviewEvents, setInterviewEvents] = useState<any[]>([])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // Fetch readiness on mount
  useEffect(() => {
    if (!user) return
    const tokenP = isDemoMode && demoToken ? Promise.resolve(demoToken) : auth?.currentUser?.getIdToken() ?? Promise.resolve(null)
    tokenP.then(token => {
      if (!token) return
      fetch(`${BACKEND_URL}/user/readiness`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.snapshot) setReadiness(data.snapshot, data.calibration_gap ?? 0) })
        .catch(() => {})
      // Fetch solve history
      fetch(`${BACKEND_URL}/user/solve_history`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (data.history) setSolveHistory(data.history)
          if (data.summary) setSolveSummary(data.summary)
        })
        .catch(() => {})
      // Fetch interview events
      fetch(`${BACKEND_URL}/user/events?kind=interview_submit&limit=10`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { events: [] })
        .then(data => { if (data.events) setInterviewEvents(data.events) })
        .catch(() => {})
    })
  }, [user, isDemoMode, demoToken, setReadiness])

  const sendChatMsg = async (msg: string, history: ChatMsg[]) => {
    setChatLoading(true)
    try {
      const token = await getToken(isDemoMode, demoToken)
      if (!token) throw new Error('Not authenticated')
      const res = await fetch(`${BACKEND_URL}/advisor/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: history.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setChatHistory(h => [...h, { role: 'assistant', content: data.response || 'No response from advisor.' }])
    } catch {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Could not reach advisor. Make sure the backend is running.' }])
    }
    setChatLoading(false)
  }

  const sendChat = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    const newHistory: ChatMsg[] = [...chatHistory, { role: 'user', content: msg }]
    setChatHistory(newHistory)
    setChatInput('')
    await sendChatMsg(msg, chatHistory)
  }

  const reviewAttempt = async (item: SolveHistoryItem) => {
    // Build a rich review prompt with all available data
    const outcome = item.correct ? 'solved correctly' : item.timed_out ? 'timed out' : 'failed'
    const parts: string[] = [
      `Review my attempt on LC ${item.lc} — "${item.title}" (topic: ${item.topic.replace(/_/g, ' ')}, pattern: ${item.pattern?.replace(/_/g, ' ') ?? 'unknown'}).`,
      `Outcome: ${outcome}. Time: ${item.total_time_min ?? '?'} min. Hints used: ${item.hints_requested}. Runs: ${item.num_runs}.`,
    ]
    if (item.approach_written) parts.push('I did write down my approach before coding.')
    else parts.push('I did NOT write an approach before coding — I jumped straight to code.')
    if (item.mastery_delta !== 0) parts.push(`Mastery change: ${item.mastery_delta > 0 ? '+' : ''}${(item.mastery_delta * 100).toFixed(1)}%.`)
    if (item.behavioral_insight) parts.push(`Behavioral note from the agent: "${item.behavioral_insight}".`)

    // Add topic mastery context
    const topicMastery = model?.topics?.[item.topic]?.mastery ?? 0
    const topicAttempts = model?.topics?.[item.topic]?.attempts ?? 0
    parts.push(`My current mastery on ${item.topic.replace(/_/g, ' ')}: ${Math.round(topicMastery * 100)}% over ${topicAttempts} attempts.`)

    parts.push(
      `Based on all of this: what did I likely do wrong? What specific concept or edge case did I miss? What should I practice next to fix the gap? Be direct and specific — not generic advice.`
    )

    const prompt = parts.join(' ')
    const userMsg: ChatMsg = { role: 'user', content: prompt }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setChatOpen(true)
    setChatInput('')
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    await sendChatMsg(prompt, chatHistory)
  }

  const handleLogout = async () => {
    if (isDemoMode) {
      sessionStorage.removeItem('neuraldsa_demo_token')
      exitDemoMode()
      navigate('/')
      return
    }
    if (auth) await signOut(auth)
    navigate('/')
  }

  const topTopics = model
    ? Object.entries(model.topics)
        .filter(([, v]) => v.mastery > 0 || v.attempts > 0)
        .sort((a, b) => b[1].mastery - a[1].mastery)
        .slice(0, 15)
    : []

  const miscHistogram: Record<string, number> = {}
  if (model) {
    for (const stat of Object.values(model.topics)) {
      for (const [type, count] of Object.entries(stat.misconceptionHistogram ?? {})) {
        miscHistogram[type] = (miscHistogram[type] ?? 0) + count
      }
    }
  }
  const miscSorted = Object.entries(miscHistogram).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const miscMax = miscSorted[0]?.[1] ?? 1
  const readinessHistory = model?.readinessHistory ?? []

  return (
    <div className="min-h-screen bg-bg-primary">
      <NavBar active="/profile" />
      {/* Profile sub-header */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-border bg-bg-surface/60 flex-shrink-0">
        <span className="font-display font-bold text-text-primary text-sm">Profile</span>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setChatOpen(o => !o)}
            className="font-body text-xs px-3 py-1.5 rounded-lg border border-accent-secondary/40 text-accent-secondary hover:bg-accent-secondary/10 transition-all"
          >
            {chatOpen ? 'close advisor' : 'ask advisor'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className="font-body text-xs text-text-secondary hover:text-accent-danger transition-colors px-2 py-1.5 rounded-lg hover:bg-accent-danger/5"
          >
            {isDemoMode ? 'exit demo' : 'sign out'}
          </motion.button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* User header */}
        <div className="flex items-center gap-5">
          {user?.photoURL ? (
            <motion.img
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(108,99,255,0.4)' }}
              src={user.photoURL}
              alt=""
              className="w-16 h-16 rounded-full border-2 border-accent-primary/40 cursor-pointer"
              style={{ boxShadow: '0 0 12px rgba(108,99,255,0.25)' }}
            />
          ) : (
            <motion.div
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(108,99,255,0.5)' }}
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-display font-bold text-white cursor-default"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #00d4ff)', boxShadow: '0 0 14px rgba(108,99,255,0.35)' }}
            >
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </motion.div>
          )}
          <div>
            <div className="font-display text-2xl font-bold text-text-primary">{user?.name}</div>
            <div className="font-body text-sm text-text-secondary">{user?.email}</div>
          </div>
        </div>

        {/* Advisor Chat Panel */}
        {chatOpen && (
          <div className="bg-bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-display text-sm font-bold text-text-primary">NeuralDSA Advisor</span>
              <span className="font-body text-xs text-text-secondary">Ask about your progress, what to study next, or weak areas</span>
            </div>
            <div className="h-64 overflow-y-auto px-4 py-3 space-y-3">
              {chatHistory.length === 0 && (
                <div className="space-y-2">
                  <p className="font-body text-xs text-text-secondary">Try asking:</p>
                  {[
                    'What should I study next?',
                    'Where are my biggest weaknesses?',
                    'How is my overall progress?',
                    'Am I ready for placement interviews?',
                  ].map(s => (
                    <button
                      key={s}
                      onClick={() => { setChatInput(s) }}
                      className="block font-body text-xs text-accent-secondary hover:text-accent-primary transition-colors"
                    >
                      — {s}
                    </button>
                  ))}
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-lg font-body text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-accent-primary/20 text-text-primary'
                        : 'bg-bg-elevated text-text-secondary border border-border'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 bg-bg-elevated border border-border rounded-lg">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="px-4 py-3 border-t border-border flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                placeholder="Ask the advisor..."
                className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 font-body text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-primary/50 transition-colors"
              />
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 4px 14px rgba(108,99,255,0.35)' }}
                whileTap={{ scale: 0.95 }}
                onClick={sendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2 text-white font-body text-xs rounded-lg transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6c63ff, #5a54d4)' }}
              >
                Send
              </motion.button>
            </div>
          </div>
        )}

        {/* Stats row */}
        {model && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { value: model.sessionCount, label: 'sessions', accent: '#6c63ff' },
              { value: `${Math.round(model.totalMinutes / 60)}h`, label: 'study time', accent: '#00d4ff' },
              { value: Object.values(model.topics).filter(v => v.mastery > 0.85).length, label: 'mastered topics', accent: '#00e676' },
              {
                value: Math.round(readiness.total),
                label: 'readiness score',
                accent: readiness.total >= 70 ? '#00e676' : readiness.total >= 40 ? '#ffb300' : '#ff4757',
              },
            ].map(({ value, label, accent }) => (
              <motion.div
                key={label}
                whileHover={{ y: -3, boxShadow: `0 8px 24px ${accent}25` }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="bg-bg-surface border border-border rounded-xl p-5 cursor-default"
                style={{ borderTop: `2px solid ${accent}60` }}
              >
                <div className="font-display text-3xl font-bold" style={{ color: accent }}>{value}</div>
                <div className="font-body text-xs text-text-secondary mt-1">{label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Readiness + trajectory */}
        <div className="grid grid-cols-2 gap-6">
          <ReadinessCard snapshot={readiness} calibrationGap={calibrationGap} />
          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-4">Readiness trajectory</p>
            {readinessHistory.length >= 2 ? (
              <TrajectorySparkline points={readinessHistory} width={280} height={80} />
            ) : (
              <p className="font-body text-xs text-text-secondary">Complete sessions to build a trajectory.</p>
            )}
          </div>
        </div>

        {/* Skill radar + topic mastery */}
        <div className="grid grid-cols-2 gap-6">
          {model && (
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Skill radar</p>
              <SkillRadar model={model} />
            </div>
          )}
          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Topic breakdown</p>
            <div className="space-y-2.5 max-h-80 overflow-y-auto scrollbar-thin pr-1">
              {topTopics.map(([id, stat]) => (
                <div key={id} className="flex items-center gap-3">
                  <div className="w-24 font-body text-xs text-text-secondary truncate flex-shrink-0">
                    {TOPIC_GRAPH[id]?.label ?? id}
                  </div>
                  <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${stat.mastery * 100}%`, background: getMasteryColor(stat.mastery) }}
                    />
                  </div>
                  <AssessmentLevelBadge knowledge={stat.mastery} compact />
                </div>
              ))}
              {topTopics.length === 0 && (
                <p className="font-body text-text-secondary text-sm">No sessions yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Interview Performance */}
        {interviewEvents.length > 0 && (
          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Interview Performance</p>
            <div className="space-y-3">
              {interviewEvents.map((ev, i) => {
                const s = ev.perception_signals ?? {}
                const msgs = s.chat_message_count ?? 0
                const commScore = Math.min(100, Math.round((msgs >= 4 ? 35 : msgs * 8) + (s.clarifying_q_count > 0 ? 15 : 0) + (s.self_corrections <= 1 ? 10 : 0) + 20))
                const proactiveScore = Math.min(100, Math.round((s.edge_cases_proactive ? 45 : 10) + (s.complexity_proactive ? 35 : 10) + (s.clarifying_q_count >= 2 ? 20 : (s.clarifying_q_count ?? 0) * 7)))
                const composureScore = Math.min(100, Math.round((s.first_msg_time_ms > 0 && s.first_msg_time_ms < 90000 ? 40 : s.first_msg_time_ms < 180000 ? 25 : 15) + (s.self_corrections === 0 ? 40 : s.self_corrections === 1 ? 28 : 14) + (msgs >= 2 ? 20 : 10)))
                const edgeScore = Math.min(100, Math.round((s.edge_cases_proactive ? 55 : 15) + (ev.passed === ev.total && ev.total > 0 ? 30 : Math.round((ev.passed / Math.max(ev.total, 1)) * 30)) + 15))
                const overall = Math.round((commScore + proactiveScore + composureScore + edgeScore) / 4)
                const scoreColor = (n: number) => n >= 75 ? '#00e676' : n >= 50 ? '#6c63ff' : n >= 30 ? '#ffb300' : '#ff4757'
                const VERDICT_COLORS: Record<string, string> = { 'Strong Hire': '#00e676', 'Hire': '#6c63ff', 'Borderline': '#ffb300', 'No Hire': '#ff4757' }
                const vColor = VERDICT_COLORS[ev.verdict] ?? '#8888aa'
                return (
                  <div key={i} className="p-4 bg-bg-elevated border border-border/60 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-body text-xs font-semibold" style={{ color: vColor }}>{ev.verdict}</span>
                        <span className="font-body text-xs text-text-secondary ml-2">{ev.topic?.replace(/_/g, ' ')} · {ev.passed}/{ev.total} tests · {ev.time_used_min}min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-body text-xs text-text-secondary">Perception</span>
                        <span className="font-display text-sm font-bold" style={{ color: scoreColor(overall) }}>{overall}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[['Comm', commScore], ['Proactive', proactiveScore], ['Composure', composureScore], ['Edge Cases', edgeScore]].map(([label, score]) => (
                        <div key={label as string}>
                          <div className="flex justify-between mb-0.5">
                            <span className="font-body text-[10px] text-text-secondary">{label}</span>
                            <span className="font-body text-[10px]" style={{ color: scoreColor(score as number) }}>{score}</span>
                          </div>
                          <div className="h-1 bg-bg-primary rounded-full">
                            <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor(score as number) }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {(s.edge_cases_proactive || s.complexity_proactive || s.clarifying_q_count > 0) && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {s.edge_cases_proactive && <span className="font-body text-[10px] px-1.5 py-0.5 rounded border border-green-500/30 text-green-400">✓ edge cases unprompted</span>}
                        {s.complexity_proactive && <span className="font-body text-[10px] px-1.5 py-0.5 rounded border border-green-500/30 text-green-400">✓ complexity stated</span>}
                        {s.clarifying_q_count > 0 && <span className="font-body text-[10px] px-1.5 py-0.5 rounded border border-accent-secondary/30 text-accent-secondary">✓ asked {s.clarifying_q_count} clarifying Q{s.clarifying_q_count > 1 ? 's' : ''}</span>}
                        {s.self_corrections > 1 && <span className="font-body text-[10px] px-1.5 py-0.5 rounded border border-accent-warn/30 text-accent-warn">⚠ {s.self_corrections} self-corrections</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Solve Activity History */}
        {solveHistory.length > 0 && (
          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-body text-xs text-text-secondary uppercase tracking-wider">Solve Activity</p>
              {solveSummary && (
                <div className="flex items-center gap-4">
                  <span className="font-body text-xs text-text-secondary">
                    <span className="font-bold text-text-primary">{solveSummary.accuracy}%</span> accuracy
                  </span>
                  <span className="font-body text-xs text-text-secondary">
                    <span className="font-bold text-text-primary">{solveSummary.total_solved}</span> problems
                  </span>
                  <span className="font-body text-xs text-text-secondary">
                    <span className="font-bold text-text-primary">{solveSummary.topics_touched}</span> topics
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
              {solveHistory.map((item, i) => (
                <div
                  key={`${item.problem_id}-${i}`}
                  className={`rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors ${
                    item.correct
                      ? 'border-green-500/20 bg-green-500/5'
                      : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  {/* Status dot */}
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    item.correct ? 'bg-green-400' : item.timed_out ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body text-xs font-semibold text-text-primary">
                        {item.lc ? `#${item.lc} ` : ''}{item.title}
                      </span>
                      <span className="font-body text-[10px] text-text-secondary border border-border rounded px-1.5 py-0.5">
                        {item.topic.replace(/_/g, ' ')}
                      </span>
                      {item.pattern && (
                        <span className="font-body text-[10px] text-accent-secondary border border-accent-secondary/30 rounded px-1.5 py-0.5">
                          {item.pattern.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {item.total_time_min != null && (
                        <span className="font-body text-[11px] text-text-secondary">{item.total_time_min}m</span>
                      )}
                      {item.hints_requested > 0 && (
                        <span className="font-body text-[11px] text-text-secondary">{item.hints_requested} hint{item.hints_requested > 1 ? 's' : ''}</span>
                      )}
                      {item.approach_written && (
                        <span className="font-body text-[11px] text-accent-primary">planned</span>
                      )}
                      {item.mastery_delta !== 0 && (
                        <span className={`font-body text-[11px] ${
                          item.mastery_delta > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {item.mastery_delta > 0 ? '+' : ''}{(item.mastery_delta * 100).toFixed(1)}% mastery
                        </span>
                      )}
                    </div>
                    {item.behavioral_insight && (
                      <p className="font-body text-[11px] text-text-secondary mt-1 italic">{item.behavioral_insight}</p>
                    )}
                  </div>

                  {/* Discuss button */}
                  <button
                    onClick={() => reviewAttempt(item)}
                    className="flex-shrink-0 font-body text-[10px] px-2 py-1 rounded border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/10 transition-colors"
                  >
                    AI review
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Misconception histogram */}
        {miscSorted.length > 0 && (
          <div className="bg-bg-surface border border-border rounded-lg p-5">
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-4">Recurring error patterns</p>
            <div className="space-y-2.5">
              {miscSorted.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-48 font-body text-xs text-text-secondary truncate flex-shrink-0">
                    {type.replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(count / miscMax) * 100}%`, background: '#ff4757' }}
                    />
                  </div>
                  <div className="font-body text-xs text-text-secondary w-6 text-right">{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last session report */}
        {lastReport && (
          <div>
            <p className="font-body text-xs text-text-secondary uppercase tracking-wider mb-3">Last session report</p>
            <ReportCardPanel report={lastReport as ReportCard} />
          </div>
        )}
      </div>
    </div>
  )
}
