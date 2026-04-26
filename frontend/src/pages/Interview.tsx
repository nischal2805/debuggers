import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useVoice } from '../hooks/useVoice'
import CodeEditor from '../components/CodeEditor'
import NavBar from '../components/NavBar'

// Stable heights seeded by bar index to avoid Math.random() on re-renders
const WAVE_HEIGHTS = [55, 75, 45, 90, 60, 80, 40, 70, 85, 50, 65, 95, 45, 75, 55, 85, 60, 70, 50, 80]

// ── Waveform bars component ───────────────────────────────────────────────────
function VoiceWaveform({ active, bars = 20 }: { active: boolean; bars?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: active ? `${WAVE_HEIGHTS[i % WAVE_HEIGHTS.length]}%` : '15%',
            background: active
              ? `hsl(${220 + i * 6}, 80%, 62%)`
              : 'rgba(136,136,170,0.25)',
            borderRadius: 2,
            transition: active ? undefined : 'height 0.3s ease, background 0.3s ease',
            animation: active
              ? `voiceWave ${0.38 + (i % 5) * 0.11}s ease-in-out infinite alternate`
              : undefined,
            animationDelay: active ? `${i * 0.035}s` : undefined,
          }}
        />
      ))}
    </div>
  )
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

async function getToken(isDemoMode: boolean, demoToken: string | null): Promise<string | null> {
  if (isDemoMode && demoToken) return demoToken
  if (!auth) return null
  return auth.currentUser?.getIdToken() ?? null
}

type Problem = {
  id: string; title: string; description: string
  examples: { input: string; output: string; explanation?: string }[]
  constraints: string[]; difficulty: number; pattern: string
  starter_code: Record<string, string>; languages: string[]
  public_tests: { input: string; expected: string }[]
}

type Debrief = {
  verdict: string
  pattern_recognition_verdict: string
  time_verdict: string
  correctness: string
  edge_cases_missed: string[]
  code_quality: string
  complexity_assessment: string
  what_would_cost_the_offer: string | null
  strongest_signal: string
  interviewer_closing: string
}

const VERDICT_COLORS: Record<string, string> = {
  'Strong Hire': '#00e676',
  'Hire': '#6c63ff',
  'Borderline': '#ffb300',
  'No Hire': '#ff4757',
}

export default function Interview() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()
  const { isDemoMode, demoToken } = useStore()

  const [phase, setPhase] = useState<'loading' | 'briefing' | 'coding' | 'submitting' | 'debrief'>('loading')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [language, setLanguage] = useState<'python' | 'javascript'>('python')
  const [code, setCode] = useState('')
  const [timeLeftS, setTimeLeftS] = useState(45 * 60)
  const [timeUsedMs, setTimeUsedMs] = useState(0)
  const [numRuns, setNumRuns] = useState(0)
  const [firstKeystrokeMs, setFirstKeystrokeMs] = useState(0)
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const [testResults, setTestResults] = useState<any[]>([])
  const [passed, setPassed] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [readyInfo, setReadyInfo] = useState<{ ready: boolean; reason: string; mastery: number } | null>(null)
  const [interviewHistory, setInterviewHistory] = useState<{ role: 'interviewer' | 'candidate'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [loadingRun, setLoadingRun] = useState(false)
  const [approachText, setApproachText] = useState('')
  const [approachResult, setApproachResult] = useState<any>(null)
  const [approachSubmitted, setApproachSubmitted] = useState(false)
  const [firstMsgTimeMs, setFirstMsgTimeMs] = useState(0)
  const [selfCorrections, setSelfCorrections] = useState(0)
  const [edgeCasesProactive, setEdgeCasesProactive] = useState(false)
  const [complexityProactive, setComplexityProactive] = useState(false)
  const [clarifyingQCount, setClarifyingQCount] = useState(0)
  const firstCandidateMsgRef = useRef(false)
  const [voiceMuted, setVoiceMuted] = useState(false)

  const { speak, stopSpeaking, ttsLoading, startRecording, stopRecording, isRecording, sttLoading } = useVoice()

  const startTimeRef = useRef<number>(0)
  const firstKeystrokeRef = useRef<boolean>(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const checkin15Done = useRef(false)
  const checkin30Done = useRef(false)
  const checkinFinalDone = useRef(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Auto-speak new interviewer messages
  const lastSpokenIdx = useRef(-1)
  useEffect(() => {
    if (voiceMuted) return
    const msgs = interviewHistory.filter(m => m.role === 'interviewer')
    if (msgs.length > lastSpokenIdx.current + 1) {
      lastSpokenIdx.current = msgs.length - 1
      speak(msgs[msgs.length - 1].content)
    }
  }, [interviewHistory, voiceMuted, speak])

  useEffect(() => {
    if (!topicId) return
    const load = async () => {
      const token = await getToken(isDemoMode, demoToken)
      if (!token) {
        setError('Not signed in. Please log in or use demo mode.')
        setPhase('briefing')
        return
      }
      const r = await fetch(`${BACKEND_URL}/interview/check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicId }),
      })
      const data = await r.json()
      setReadyInfo({ ready: data.ready, reason: data.reason, mastery: data.mastery })
      if (data.ready) {
        const sr = await fetch(`${BACKEND_URL}/interview/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topicId }),
        })
        if (!sr.ok) { setError('No problems available for this topic.'); setPhase('briefing'); return }
        const sd = await sr.json()
        setProblem(sd.problem)
        setTimeLeftS(sd.time_limit_min * 60)
        setPhase('briefing')
      } else {
        setPhase('briefing')
      }
    }
    load().catch(e => { setError(String(e)); setPhase('briefing') })
  }, [topicId, isDemoMode, demoToken])

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeftS(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const sendInterviewerChat = useCallback(async (message: string, trigger = 'candidate') => {
    if (!problem) return
    setChatLoading(true)
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0
    const token = await getToken(isDemoMode, demoToken)
    if (!token) { setChatLoading(false); return }
    try {
      const r = await fetch(`${BACKEND_URL}/interview/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_id: problem.id, message, current_code: code,
          elapsed_ms: elapsed, tests_passed: passed, tests_total: total,
          history: interviewHistory, trigger,
        }),
      })
      const data = await r.json()
      setInterviewHistory(prev => [...prev, { role: 'interviewer' as const, content: data.message }])
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) { console.error('chat error', e) }
    setChatLoading(false)
  }, [problem, code, passed, total, interviewHistory, isDemoMode, demoToken])

  const sendInterviewerCheckin = useCallback((trigger: string) => {
    sendInterviewerChat('', trigger)
  }, [sendInterviewerChat])

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')
    // Behavioral signal tracking
    if (!firstCandidateMsgRef.current && startTimeRef.current) {
      firstCandidateMsgRef.current = true
      setFirstMsgTimeMs(Date.now() - startTimeRef.current)
    }
    const lower = msg.toLowerCase()
    if (/\b(actually|wait,?\s|let me rethink|no wait|scratch that|hmm)/.test(lower)) setSelfCorrections(c => c + 1)
    if (/\b(edge case|null|empty|overflow|negative|zero|boundary|corner case)/.test(lower)) setEdgeCasesProactive(true)
    if (/\b(o\(|time complexity|space complexity|big.?o|linear|quadratic)/.test(lower)) setComplexityProactive(true)
    if (msg.includes('?')) setClarifyingQCount(c => c + 1)
    setInterviewHistory(prev => [...prev, { role: 'candidate' as const, content: msg }])
    await sendInterviewerChat(msg, 'candidate')
  }, [chatInput, sendInterviewerChat])

  const handleSubmitApproach = useCallback(async () => {
    if (!problem || !approachText.trim()) return
    const token = await getToken(isDemoMode, demoToken)
    if (!token) return
    try {
      const r = await fetch(`${BACKEND_URL}/interview/approach`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problem.id, approach_text: approachText }),
      })
      const data = await r.json()
      setApproachResult(data)
      setApproachSubmitted(true)
    } catch (e) { console.error('approach error', e) }
  }, [problem, approachText, isDemoMode, demoToken])

  const enterCoding = useCallback(() => {
    if (!problem) return
    const lang: 'python' | 'javascript' = problem.languages.includes('python') ? 'python' : 'javascript'
    setLanguage(lang)
    setCode(problem.starter_code[lang] ?? '')
    setPhase('coding')
    startTimer()
    setTimeout(() => {
      setInterviewHistory([{ role: 'interviewer', content: "Let's begin. Before you write any code — walk me through your initial approach. What's your intuition for solving this problem?" }])
    }, 300)
  }, [problem, startTimer, sendInterviewerChat])

  useEffect(() => {
    if (timeLeftS === 0 && phase === 'coding') { handleSubmit(true); return }
    if (phase !== 'coding') return
    if (timeLeftS === 30 * 60 && !checkin15Done.current) { checkin15Done.current = true; sendInterviewerCheckin('checkin_15') }
    if (timeLeftS === 15 * 60 && !checkin30Done.current) { checkin30Done.current = true; sendInterviewerCheckin('checkin_30') }
    if (timeLeftS === 5 * 60 && !checkinFinalDone.current) { checkinFinalDone.current = true; sendInterviewerCheckin('checkin_final') }
  }, [timeLeftS, phase])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const onCodeChange = useCallback((val: string | undefined) => {
    setCode(val || '')
    if (!firstKeystrokeRef.current && startTimeRef.current) {
      firstKeystrokeRef.current = true
      setFirstKeystrokeMs(Date.now() - startTimeRef.current)
    }
  }, [])

  const handleRun = useCallback(async () => {
    if (!problem) return
    setNumRuns(n => n + 1)
    setLoadingRun(true)
    setTestResults([])
    const token = await getToken(isDemoMode, demoToken)
    if (!token) { setLoadingRun(false); return }
    try {
      const r = await fetch(`${BACKEND_URL}/judge/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problem.id, language, source: code }),
      })
      const data = await r.json()
      setTestResults(data.results ?? [])
    } catch (e) {
      console.error('run error', e)
      setTestResults([])
    } finally {
      setLoadingRun(false)
    }
  }, [problem, language, code, isDemoMode, demoToken])

  const handleSubmit = useCallback(async (_timesUp = false) => {
    if (!problem || phase === 'submitting') return
    if (timerRef.current) clearInterval(timerRef.current)
    setPhase('submitting')
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0
    setTimeUsedMs(elapsed)

    const token = await getToken(isDemoMode, demoToken)
    if (!token) { setPhase('debrief'); return }
    try {
      const r = await fetch(`${BACKEND_URL}/interview/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_id: problem.id,
          language,
          source: code,
          time_used_ms: elapsed,
          approach_notes: approachText,
          num_runs: numRuns,
          hints_requested: 0,
          first_keystroke_ms: firstKeystrokeMs,
          first_msg_time_ms: firstMsgTimeMs,
          self_corrections: selfCorrections,
          edge_cases_proactive: edgeCasesProactive,
          complexity_proactive: complexityProactive,
          clarifying_q_count: clarifyingQCount,
          chat_message_count: interviewHistory.filter(m => m.role === 'candidate').length,
        }),
      })
      const data = await r.json()
      setPassed(data.passed ?? 0)
      setTotal(data.total ?? 0)
      setDebrief(data.debrief ?? null)
      setTestResults(data.public_results ?? [])
    } catch (e) {
      setDebrief(null)
    }
    setPhase('debrief')
  }, [problem, phase, language, code, numRuns, firstKeystrokeMs, isDemoMode, demoToken])

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const timerDanger = timeLeftS < 300

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col">
        <NavBar active="/interview" interviewTopic={topicId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (phase === 'briefing') {
    const ready = readyInfo?.ready ?? false
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col">
        <NavBar active="/interview" interviewTopic={topicId} />
        <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <div className="font-body text-accent-secondary text-xs uppercase tracking-widest mb-2">Interview Mode</div>
            <h1 className="font-display text-4xl font-bold text-text-primary mb-2">The Final Boss</h1>
            <p className="font-body text-text-secondary text-sm">No hints. No help. 45 minutes. Code like it counts.</p>
          </div>

          {error && <div className="mb-6 p-3 bg-accent-danger/10 border border-accent-danger/30 rounded font-body text-accent-danger text-sm">{error}</div>}

          <div className="p-5 bg-bg-surface border border-border rounded-2xl mb-6 overflow-hidden" style={{ borderTop: `2px solid ${readyInfo?.ready ? '#00e676' : '#ffb300'}80` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-text-secondary text-xs uppercase tracking-wider">Readiness</span>
              <span className="font-display text-lg font-bold" style={{ color: readyInfo?.ready ? '#00e676' : '#ffb300' }}>
                {Math.round((readyInfo?.mastery ?? 0) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-bg-elevated rounded-full mb-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(readyInfo?.mastery ?? 0) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: readyInfo?.ready ? '#00e676' : '#ffb300', boxShadow: `0 0 8px ${readyInfo?.ready ? '#00e676' : '#ffb300'}60` }}
              />
            </div>
            <p className="font-body text-text-secondary text-xs">{readyInfo?.reason ?? 'Checking readiness...'}</p>
          </div>

          {ready && problem ? (
            <>
              <div className="p-4 bg-bg-elevated border border-border rounded-lg mb-4">
                <p className="font-body text-text-secondary text-xs mb-1">Your problem</p>
                <p className="font-display font-bold text-text-primary">{problem.title}</p>
                <p className="font-body text-text-secondary text-xs mt-1">Difficulty: {problem.difficulty}/10 · Pattern: {problem.pattern}</p>
              </div>

              <div className="mb-5 space-y-2">
                {[
                  'Interviewer will probe your approach in the chat panel.',
                  'No hints. No external help.',
                  '45 minutes. Timer starts when you enter.',
                  'You receive an Interviewer Perception Score — not just correctness.',
                ].map(rule => (
                  <div key={rule} className="flex items-start gap-2">
                    <span className="font-body text-accent-danger text-xs mt-0.5">—</span>
                    <span className="font-body text-text-secondary text-xs">{rule}</span>
                  </div>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 6px 20px rgba(255,71,87,0.4)' }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                onClick={enterCoding}
                className="w-full py-3 text-white font-display font-bold rounded-xl transition-all"
                style={{ background: 'linear-gradient(135deg, #ff4757, #d63040)', boxShadow: '0 4px 16px rgba(255,71,87,0.3)' }}
              >
                Enter Interview
              </motion.button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="font-body text-text-secondary text-sm">You need {Math.round((0.70 - (readyInfo?.mastery ?? 0)) * 100)}% more mastery before interview mode unlocks.</p>
              <button onClick={() => navigate(`/solve/${topicId}`)} className="w-full py-3 bg-accent-primary hover:bg-accent-primary/90 text-white font-display font-bold rounded-lg transition-colors">
                Keep Practicing
              </button>
            </div>
          )}
          <button onClick={() => navigate(-1)} className="mt-4 w-full py-2 font-body text-text-secondary text-sm hover:text-text-primary transition-colors">
            Back
          </button>
        </div>
        </div>
      </div>
    )
  }

  if (phase === 'debrief' && debrief) {
    const verdictColor = VERDICT_COLORS[debrief.verdict] ?? '#8888aa'
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col">
        <NavBar active="/interview" interviewTopic={topicId} />
        <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <div className="font-body text-text-secondary text-xs uppercase tracking-widest mb-2">Interview Complete</div>
            <div className="font-display text-5xl font-bold mb-1" style={{ color: verdictColor }}>{debrief.verdict}</div>
            <div className="font-body text-text-secondary text-sm">{problem?.title}</div>
            <div className="font-body text-text-secondary text-xs mt-1">{passed}/{total} tests · {Math.round(timeUsedMs / 60000)} min used</div>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Pattern Recognition', value: debrief.pattern_recognition_verdict },
              { label: 'Time', value: debrief.time_verdict },
              { label: 'Correctness', value: debrief.correctness },
              { label: 'Code Quality', value: debrief.code_quality },
              { label: 'Complexity', value: debrief.complexity_assessment },
              { label: 'Strongest Signal', value: debrief.strongest_signal },
            ].map(item => (
              <div key={item.label} className="p-4 bg-bg-surface border border-border rounded-lg">
                <div className="font-body text-text-secondary text-xs uppercase tracking-wider mb-1">{item.label}</div>
                <div className="font-body text-text-primary text-sm">{item.value}</div>
              </div>
            ))}

            {debrief.edge_cases_missed.length > 0 && (
              <div className="p-4 bg-bg-surface border border-accent-warn/30 rounded-lg">
                <div className="font-body text-accent-warn text-xs uppercase tracking-wider mb-2">Edge Cases Missed</div>
                {debrief.edge_cases_missed.map(e => (
                  <div key={e} className="font-body text-text-secondary text-sm">— {e}</div>
                ))}
              </div>
            )}

            {debrief.what_would_cost_the_offer && (
              <div className="p-4 bg-accent-danger/10 border border-accent-danger/30 rounded-lg">
                <div className="font-body text-accent-danger text-xs uppercase tracking-wider mb-1">What Would Have Cost the Offer</div>
                <div className="font-body text-text-primary text-sm">{debrief.what_would_cost_the_offer}</div>
              </div>
            )}

            <div className="p-4 bg-bg-elevated border border-border rounded-lg">
              <div className="font-body text-text-secondary text-xs uppercase tracking-wider mb-1">Interviewer</div>
              <div className="font-body text-text-primary text-sm italic">"{debrief.interviewer_closing}"</div>
            </div>

            {/* Interviewer Perception Score */}
            {(() => {
              const candidateMsgs = interviewHistory.filter(m => m.role === 'candidate')
              const totalWords = candidateMsgs.reduce((s, m) => s + m.content.split(' ').length, 0)
              const avgWords = candidateMsgs.length ? totalWords / candidateMsgs.length : 0
              const commScore = Math.min(100, Math.round(
                (candidateMsgs.length >= 4 ? 35 : candidateMsgs.length * 8) +
                (avgWords >= 20 ? 40 : avgWords * 2) +
                (clarifyingQCount > 0 ? 15 : 0) +
                (selfCorrections <= 1 ? 10 : 0)
              ))
              const proactiveScore = Math.min(100, Math.round(
                (edgeCasesProactive ? 45 : 10) +
                (complexityProactive ? 35 : 10) +
                (clarifyingQCount >= 2 ? 20 : clarifyingQCount * 7)
              ))
              const composureScore = Math.min(100, Math.round(
                (firstMsgTimeMs > 0 && firstMsgTimeMs < 90000 ? 40 : firstMsgTimeMs < 180000 ? 25 : 10) +
                (selfCorrections === 0 ? 40 : selfCorrections === 1 ? 28 : selfCorrections <= 3 ? 14 : 5) +
                (candidateMsgs.length >= 2 ? 20 : 10)
              ))
              const edgeScore = Math.min(100, Math.round(
                (edgeCasesProactive ? 55 : 15) +
                (passed === total && total > 0 ? 30 : Math.round((passed / Math.max(total, 1)) * 30)) +
                15
              ))
              const overall = Math.round((commScore + proactiveScore + composureScore + edgeScore) / 4)
              const dims = [
                { label: 'Communication Clarity', score: commScore, tip: commScore >= 70 ? 'Articulate and structured' : commScore >= 45 ? 'Adequate but could be clearer' : 'Sparse — interviewers need to hear you think out loud' },
                { label: 'Proactiveness', score: proactiveScore, tip: proactiveScore >= 70 ? 'Volunteered complexity + edge cases unprompted' : proactiveScore >= 45 ? 'Partially proactive' : 'Waited to be asked — strong hires lead the conversation' },
                { label: 'Composure Under Pressure', score: composureScore, tip: composureScore >= 70 ? 'Steady and confident throughout' : composureScore >= 45 ? 'Minor hesitation detected' : 'High hesitation — work on thinking out loud when stuck' },
                { label: 'Edge Case Awareness', score: edgeScore, tip: edgeScore >= 70 ? 'Proactively considered edge cases' : edgeScore >= 45 ? 'Partial awareness' : 'Edge cases not mentioned — this is a key signal for L5+' },
              ]
              const scoreColor = (s: number) => s >= 75 ? '#00e676' : s >= 50 ? '#6c63ff' : s >= 30 ? '#ffb300' : '#ff4757'
              return (
                <div className="p-5 bg-bg-surface border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-body text-text-secondary text-xs uppercase tracking-wider mb-0.5">Interviewer Perception Score</div>
                      <div className="font-body text-text-secondary text-xs opacity-60">How a Google L5 engineer would have perceived this session</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl font-bold" style={{ color: scoreColor(overall) }}>{overall}</div>
                      <div className="font-body text-text-secondary text-xs">/100</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {dims.map(d => (
                      <div key={d.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-body text-text-secondary text-xs">{d.label}</span>
                          <span className="font-body text-xs font-medium" style={{ color: scoreColor(d.score) }}>{d.score}</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-elevated rounded-full mb-1">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.score}%`, background: scoreColor(d.score) }} />
                        </div>
                        <div className="font-body text-text-secondary text-xs opacity-70">{d.tip}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="mt-8 flex gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-3 bg-bg-surface border border-border font-body text-sm text-text-secondary hover:text-text-primary rounded-xl transition-all hover:border-accent-primary/30"
            >
              Dashboard
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 6px 20px rgba(108,99,255,0.35)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/solve/${topicId}`)}
              className="flex-1 py-3 text-white font-body text-sm font-medium rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #5a54d4)', boxShadow: '0 4px 14px rgba(108,99,255,0.25)' }}
            >
              Keep Practicing
            </motion.button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  // Coding phase
  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">
      {/* Top bar — slim focus mode, no full NavBar */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-border flex-shrink-0" style={{ borderTop: '2px solid rgba(255,71,87,0.5)' }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff4757', boxShadow: '0 0 6px #ff475780', animation: 'pulse 2s infinite' }} />
          <span className="font-body text-accent-danger text-xs uppercase tracking-widest font-semibold">Interview</span>
          <span className="font-body text-text-secondary text-xs">|</span>
          <span className="font-display text-text-primary text-sm font-bold">{problem?.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={language}
            onChange={e => { const l = e.target.value as 'python' | 'javascript'; setLanguage(l); setCode(problem?.starter_code[l] ?? '') }}
            className="bg-bg-elevated border border-border text-text-primary font-body text-xs rounded px-2 py-1"
          >
            {(problem?.languages ?? ['python']).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className={`font-display text-xl font-bold tabular-nums ${timerDanger ? 'text-accent-danger animate-pulse' : 'text-text-primary'}`}>
            {fmtTime(timeLeftS)}
          </div>
          <button
            onClick={handleRun}
            disabled={loadingRun || phase === 'submitting'}
            className="px-3 py-1.5 bg-bg-elevated border border-border font-body text-xs text-text-secondary hover:text-text-primary rounded transition-colors disabled:opacity-50"
          >
            {loadingRun ? 'Running...' : 'Run'}
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={phase === 'submitting'}
            className="px-4 py-1.5 bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-xs font-medium rounded transition-colors disabled:opacity-50"
          >
            {phase === 'submitting' ? 'Evaluating...' : 'Submit'}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Problem panel */}
        <div className="w-96 border-r border-border overflow-y-auto p-5 flex-shrink-0">
          <div className="mb-4 p-3 bg-accent-danger/10 border border-accent-danger/20 rounded font-body text-accent-danger text-xs">
            No hints. No external help. This is your interview.
          </div>
          {problem && (
            <>
              <h2 className="font-display text-lg font-bold text-text-primary mb-3">{problem.title}</h2>
              <p className="font-body text-text-secondary text-sm leading-relaxed mb-4 whitespace-pre-wrap">{problem.description}</p>
              {problem.examples.map((ex, i) => (
                <div key={i} className="mb-3 p-3 bg-bg-elevated rounded font-mono text-xs">
                  <div className="text-text-secondary mb-1">Example {i + 1}</div>
                  <div><span className="text-text-secondary">Input: </span><span className="text-text-primary">{ex.input}</span></div>
                  <div><span className="text-text-secondary">Output: </span><span className="text-text-primary">{ex.output}</span></div>
                  {ex.explanation && <div className="text-text-secondary mt-1">{ex.explanation}</div>}
                </div>
              ))}
              {problem.constraints.length > 0 && (
                <div>
                  <p className="font-body text-text-secondary text-xs uppercase tracking-wider mb-2">Constraints</p>
                  {problem.constraints.map((c, i) => <p key={i} className="font-mono text-xs text-text-secondary">— {c}</p>)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Middle: Editor + test results */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor value={code} onChange={onCodeChange} language={language} height="100%" />
          </div>
          {(loadingRun || testResults.length > 0) && (
            <div className="h-36 border-t border-border overflow-y-auto p-3 flex-shrink-0">
              <div className="font-body text-text-secondary text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                {loadingRun ? (
                  <>
                    <div className="w-3 h-3 border border-accent-primary border-t-transparent rounded-full animate-spin" />
                    Running tests...
                  </>
                ) : (
                  <>Test Results — {testResults.filter(r => r.passed).length}/{testResults.length} passed</>
                )}
              </div>
              {!loadingRun && (
                <div className="flex gap-2 flex-wrap">
                  {testResults.map((r, i) => (
                    <div key={i} className={`px-2 py-1 rounded text-xs font-body ${r.passed ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-danger/10 text-accent-danger'}`}>
                      Test {i + 1}: {r.passed ? 'Pass' : 'Fail'}
                      {!r.passed && r.actual && <span className="ml-1 text-text-secondary">got: {String(r.actual).slice(0, 20)}</span>}
                      {(r as any).stderr && !r.passed && <div className="text-[10px] text-accent-danger/70 mt-0.5 font-mono truncate max-w-32">{(r as any).stderr.slice(0, 60)}</div>}
                    </div>
                  ))}
                  {testResults.length === 0 && <span className="font-body text-xs text-text-secondary">No results.</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Interviewer Chat Panel */}
        <div className="w-80 border-l border-border flex flex-col flex-shrink-0 bg-bg-surface" style={{ borderTop: '2px solid rgba(255,71,87,0.4)' }}>
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-border flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-danger" style={{ boxShadow: '0 0 6px #ff475780', animation: 'pulse 2s infinite' }} />
              <span className="font-body text-accent-secondary text-xs uppercase tracking-widest">Interviewer</span>
            </div>
            <div className="flex items-center gap-2">
              {/* TTS status */}
              {ttsLoading && !voiceMuted && (
                <div className="flex items-center gap-1">
                  <VoiceWaveform active bars={8} />
                </div>
              )}
              {/* Mute toggle */}
              <button
                onClick={() => { setVoiceMuted(m => !m); if (!voiceMuted) stopSpeaking() }}
                title={voiceMuted ? 'Unmute' : 'Mute interviewer'}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${voiceMuted ? 'rgba(136,136,170,0.2)' : 'rgba(0,212,255,0.4)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'border-color 0.2s',
                }}
              >
                {voiceMuted ? (
                  <svg width="13" height="13" fill="rgba(136,136,170,0.4)" viewBox="0 0 24 24">
                    <path d="M16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0017.73 18l2 2L21 18.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" fill="#00d4ff" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <AnimatePresence>
              {interviewHistory.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  className="font-body text-text-secondary text-xs text-center mt-8"
                >
                  Interview starting...
                </motion.p>
              )}
              {interviewHistory.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8, x: msg.role === 'candidate' ? 8 : -8 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`flex flex-col gap-0.5 ${msg.role === 'candidate' ? 'items-end' : 'items-start'}`}
                >
                  <span className="font-body text-[10px] text-text-secondary opacity-50 px-1">
                    {msg.role === 'interviewer' ? 'Interviewer' : 'You'}
                  </span>
                  <div
                    style={{
                      maxWidth: '90%',
                      padding: '8px 12px',
                      borderRadius: msg.role === 'interviewer' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 11,
                      lineHeight: 1.55,
                      background: msg.role === 'interviewer'
                        ? 'var(--bg-elevated)'
                        : 'rgba(108,99,255,0.12)',
                      border: msg.role === 'interviewer'
                        ? '1px solid rgba(108,99,255,0.12)'
                        : '1px solid rgba(108,99,255,0.3)',
                      color: 'var(--text-primary)',
                      borderLeft: msg.role === 'interviewer' ? '2px solid rgba(255,71,87,0.5)' : undefined,
                    }}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {chatLoading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start"
              >
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(108,99,255,0.12)',
                  borderLeft: '2px solid rgba(255,71,87,0.5)',
                  borderRadius: '4px 12px 12px 12px',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 150, 300].map(d => (
                    <span
                      key={d}
                      style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--text-secondary)',
                        display: 'inline-block',
                        animation: `bounce 1s ease infinite`,
                        animationDelay: `${d}ms`,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Voice input area */}
          <div className="p-3 border-t border-border flex-shrink-0" style={{ background: 'var(--bg-elevated)' }}>
            {/* Waveform + mic button row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              {/* Animated waveform */}
              <div style={{ flex: 1 }}>
                <AnimatePresence>
                  {(isRecording || sttLoading) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <VoiceWaveform active={isRecording} bars={18} />
                    </motion.div>
                  )}
                  {!isRecording && !sttLoading && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.45 }}
                      style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: 'var(--text-secondary)', margin: 0 }}
                    >
                      {ttsLoading && !voiceMuted ? 'Interviewer speaking...' : 'Hold mic to respond by voice'}
                    </motion.p>
                  )}
                  {sttLoading && !isRecording && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#ffb300', margin: 0 }}
                    >
                      Transcribing...
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Large mic button */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {/* Pulse rings when recording */}
                {isRecording && (
                  <>
                    <div style={{
                      position: 'absolute', inset: -8, borderRadius: '50%',
                      border: '2px solid rgba(255,71,87,0.6)',
                      animation: 'micPulse 1s ease-out infinite',
                    }} />
                    <div style={{
                      position: 'absolute', inset: -16, borderRadius: '50%',
                      border: '1.5px solid rgba(255,71,87,0.3)',
                      animation: 'micPulse 1s ease-out infinite',
                      animationDelay: '0.3s',
                    }} />
                  </>
                )}
                <button
                  onMouseDown={startRecording}
                  onMouseUp={async () => {
                    const t = await stopRecording()
                    if (t) setChatInput(prev => prev ? prev + ' ' + t : t)
                  }}
                  onTouchStart={startRecording}
                  onTouchEnd={async () => {
                    const t = await stopRecording()
                    if (t) setChatInput(prev => prev ? prev + ' ' + t : t)
                  }}
                  disabled={sttLoading}
                  title={isRecording ? 'Recording — release to send' : 'Hold to speak'}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    border: `2px solid ${isRecording ? '#ff4757' : 'rgba(0,212,255,0.35)'}`,
                    background: isRecording
                      ? 'rgba(255,71,87,0.18)'
                      : sttLoading
                      ? 'rgba(255,179,0,0.1)'
                      : 'var(--bg-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: sttLoading ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isRecording ? '0 0 16px rgba(255,71,87,0.4)' : undefined,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {sttLoading ? (
                    <div style={{
                      width: 14, height: 14, border: '2px solid #ffb300',
                      borderTopColor: 'transparent', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                  ) : (
                    <svg
                      width="18" height="18"
                      fill={isRecording ? '#ff4757' : '#00d4ff'}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zM11 19.93V22h2v-2.07A8.001 8.001 0 0019 13h-2a6 6 0 01-12 0H3a8.001 8.001 0 008 6.93z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Text input row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                placeholder={isRecording ? 'Recording...' : sttLoading ? 'Transcribing...' : 'Type or use mic above'}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 11,
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(108,99,255,0.5)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-color)' }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim()}
                style={{
                  padding: '7px 14px',
                  background: chatInput.trim() ? 'linear-gradient(135deg, #6c63ff, #5a54d4)' : 'var(--bg-surface)',
                  border: '1px solid rgba(108,99,255,0.4)',
                  borderRadius: 8,
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 11,
                  color: chatInput.trim() ? '#fff' : 'var(--text-secondary)',
                  cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                  opacity: chatLoading || !chatInput.trim() ? 0.45 : 1,
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                Send
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
