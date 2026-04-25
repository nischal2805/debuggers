import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
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

  const startTimeRef = useRef<number>(0)
  const firstKeystrokeRef = useRef<boolean>(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!topicId) return
    const load = async () => {
      const token = await getToken(isDemoMode, demoToken)
      if (!token) return
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

  const enterCoding = useCallback(() => {
    if (!problem) return
    const lang: 'python' | 'javascript' = problem.languages.includes('python') ? 'python' : 'javascript'
    setLanguage(lang)
    setCode(problem.starter_code[lang] ?? '')
    setPhase('coding')
    startTimer()
  }, [problem, startTimer])

  useEffect(() => {
    if (timeLeftS === 0 && phase === 'coding') {
      handleSubmit(true)
    }
  }, [timeLeftS, phase])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const onCodeChange = useCallback((val: string) => {
    setCode(val)
    if (!firstKeystrokeRef.current && startTimeRef.current) {
      firstKeystrokeRef.current = true
      setFirstKeystrokeMs(Date.now() - startTimeRef.current)
    }
  }, [])

  const handleRun = useCallback(async () => {
    if (!problem) return
    setNumRuns(n => n + 1)
    const token = await getToken(isDemoMode, demoToken)
    if (!token) return
    const r = await fetch(`${BACKEND_URL}/judge/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: problem.id, language, source: code }),
    })
    const data = await r.json()
    setTestResults(data.results ?? [])
  }, [problem, language, code, isDemoMode, demoToken])

  const handleSubmit = useCallback(async (timesUp = false) => {
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
          approach_notes: '',
          num_runs: numRuns,
          hints_requested: 0,
          first_keystroke_ms: firstKeystrokeMs,
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
              <div className="p-4 bg-bg-elevated border border-border rounded-lg mb-6">
                <p className="font-body text-text-secondary text-xs mb-1">Your problem</p>
                <p className="font-display font-bold text-text-primary">{problem.title}</p>
                <p className="font-body text-text-secondary text-xs mt-1">Difficulty: {problem.difficulty}/10 · Pattern: {problem.pattern}</p>
              </div>
              <div className="mb-6 space-y-2">
                {['No hints available.', 'No looking up solutions.', '45 minutes. Timer starts when you enter.', 'You will receive a mock interviewer debrief.'].map(r => (
                  <div key={r} className="flex items-start gap-2">
                    <span className="font-body text-accent-danger text-xs mt-0.5">—</span>
                    <span className="font-body text-text-secondary text-xs">{r}</span>
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
            className="px-3 py-1.5 bg-bg-elevated border border-border font-body text-xs text-text-secondary hover:text-text-primary rounded transition-colors"
          >
            Run
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

        {/* Editor */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              value={code}
              onChange={onCodeChange}
              language={language}
              height="100%"
            />
          </div>

          {/* Test results */}
          {testResults.length > 0 && (
            <div className="h-36 border-t border-border overflow-y-auto p-3 flex-shrink-0">
              <div className="font-body text-text-secondary text-xs uppercase tracking-wider mb-2">
                Test Results — {testResults.filter(r => r.passed).length}/{testResults.length} passed
              </div>
              <div className="flex gap-2 flex-wrap">
                {testResults.map((r, i) => (
                  <div key={i} className={`px-2 py-1 rounded text-xs font-body ${r.passed ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-danger/10 text-accent-danger'}`}>
                    Test {i + 1}: {r.passed ? 'Pass' : 'Fail'}
                    {!r.passed && r.actual && <span className="ml-1 text-text-secondary">got: {String(r.actual).slice(0, 20)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
