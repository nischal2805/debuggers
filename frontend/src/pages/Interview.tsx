import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useVoice } from '../hooks/useVoice'
import CodeEditor from '../components/CodeEditor'

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
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (phase === 'briefing') {
    const ready = readyInfo?.ready ?? false
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <div className="font-body text-accent-secondary text-xs uppercase tracking-widest mb-2">Interview Mode</div>
            <h1 className="font-display text-4xl font-bold text-text-primary mb-2">The Final Boss</h1>
            <p className="font-body text-text-secondary text-sm">No hints. No help. 45 minutes. Code like it counts.</p>
          </div>

          {error && <div className="mb-6 p-3 bg-accent-danger/10 border border-accent-danger/30 rounded font-body text-accent-danger text-sm">{error}</div>}

          <div className="p-5 bg-bg-surface border border-border rounded-lg mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body text-text-secondary text-xs uppercase tracking-wider">Readiness</span>
              <span className="font-display text-lg font-bold" style={{ color: ready ? '#00e676' : '#ffb300' }}>
                {Math.round((readyInfo?.mastery ?? 0) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-bg-elevated rounded-full mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(readyInfo?.mastery ?? 0) * 100}%`, background: ready ? '#00e676' : '#ffb300' }}
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
              <button
                onClick={enterCoding}
                className="w-full py-3 bg-accent-danger hover:bg-accent-danger/90 text-white font-display font-bold rounded-lg transition-colors"
              >
                Enter Interview
              </button>
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
    )
  }

  if (phase === 'debrief' && debrief) {
    const verdictColor = VERDICT_COLORS[debrief.verdict] ?? '#8888aa'
    return (
      <div className="min-h-screen bg-bg-primary overflow-y-auto px-6 py-12">
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
            <button onClick={() => navigate('/dashboard')} className="flex-1 py-3 bg-bg-surface border border-border font-body text-sm text-text-secondary hover:text-text-primary rounded-lg transition-colors">
              Dashboard
            </button>
            <button onClick={() => navigate(`/solve/${topicId}`)} className="flex-1 py-3 bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-sm font-medium rounded-lg transition-colors">
              Keep Practicing
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Coding phase
  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-body text-accent-secondary text-xs uppercase tracking-widest">Interview</span>
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
        <div className="w-80 border-l border-border flex flex-col flex-shrink-0 bg-bg-surface">
          <div className="px-4 py-2.5 border-b border-border flex-shrink-0">
            <span className="font-body text-accent-secondary text-xs uppercase tracking-widest">Interviewer</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {interviewHistory.length === 0 && (
              <p className="font-body text-text-secondary text-xs text-center mt-6 opacity-50">Interview starting...</p>
            )}
            {interviewHistory.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-0.5 ${msg.role === 'candidate' ? 'items-end' : 'items-start'}`}>
                <span className="font-body text-xs text-text-secondary opacity-60 px-1">
                  {msg.role === 'interviewer' ? 'Interviewer' : 'You'}
                </span>
                <div className={`max-w-[92%] px-3 py-2 rounded-lg font-body text-xs leading-relaxed ${
                  msg.role === 'interviewer'
                    ? 'bg-bg-elevated border border-border/60 text-text-primary'
                    : 'bg-accent-primary/15 border border-accent-primary/25 text-text-primary'
                }`}>{msg.content}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-start">
                <div className="px-3 py-2 bg-bg-elevated border border-border/60 rounded-lg flex gap-1">
                  <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          {/* Interviewer chat input */}
          <div className="p-3 border-t border-border flex-shrink-0">
            <div className="flex gap-2 items-center">
              {/* Mic button */}
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
                title={isRecording ? 'Recording… release to transcribe' : 'Hold to speak'}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isRecording
                    ? 'bg-accent-danger animate-pulse'
                    : sttLoading
                    ? 'bg-accent-warn/30 cursor-wait'
                    : 'bg-bg-elevated border border-border hover:border-accent-secondary'
                }`}
              >
                {sttLoading ? (
                  <div className="w-3 h-3 border border-accent-warn border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className={`w-3.5 h-3.5 ${isRecording ? 'text-white' : 'text-text-secondary'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zM11 19.93V22h2v-2.07A8.001 8.001 0 0019 13h-2a6 6 0 01-12 0H3a8.001 8.001 0 008 6.93z"/>
                  </svg>
                )}
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                placeholder={isRecording ? '🎙 Recording…' : sttLoading ? 'Transcribing…' : 'Respond to interviewer...'}
                className="flex-1 px-3 py-2 bg-bg-elevated border border-border rounded font-body text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
              />

              {/* Speaker / mute toggle */}
              <button
                onClick={() => { setVoiceMuted(m => !m); if (!voiceMuted) stopSpeaking() }}
                title={voiceMuted ? 'Unmute interviewer voice' : 'Mute interviewer voice'}
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-bg-elevated border border-border hover:border-accent-secondary transition-colors"
              >
                {ttsLoading && !voiceMuted ? (
                  <div className="w-3 h-3 border border-accent-secondary border-t-transparent rounded-full animate-spin" />
                ) : voiceMuted ? (
                  <svg className="w-3.5 h-3.5 text-text-secondary/40" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0017.73 18l2 2L21 18.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-accent-secondary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>

              <button
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-xs rounded transition-colors disabled:opacity-40 flex-shrink-0"
              >Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
