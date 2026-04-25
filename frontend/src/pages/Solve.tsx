import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useAttemptTracker } from '../hooks/useAttemptTracker'
import CodeEditor from '../components/CodeEditor'
import ProblemPanel from '../components/ProblemPanel'
import ApproachBox from '../components/ApproachBox'
import TestCasePanel from '../components/TestCasePanel'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

async function getToken(isDemoMode: boolean, demoToken: string | null): Promise<string | null> {
  if (isDemoMode && demoToken) return demoToken
  return auth.currentUser?.getIdToken() ?? null
}

type RunResult = {
  input: string; expected: string; actual: string
  stderr: string; exit_code: number | null; passed: boolean; runtime_ms?: number | null
}

type SubmitResult = {
  correct: boolean; passed: number; total: number
  public_results: RunResult[]; hidden_results: RunResult[]
  evaluation: {
    correct: boolean; feedback: string; pattern_insight?: string
    approach_feedback?: string; next_step?: string
    error_fingerprint?: string | null; approach_quality?: number
    optimality_score?: { time_complexity: number; space_complexity: number; code_clarity: number; overall_optimality: number }
  }
  mastery_delta: number; new_mastery: number
}

type Hint = { hint: string; hint_level: number }

interface Problem {
  id: string; lc: string; title: string; topic: string; pattern: string; difficulty: string
  statement: string; constraints: string[]; examples: { input: string; output: string; explanation?: string }[]
  expected_complexity: { time: string; space: string }
  starter_code: Record<string, string>; public_tests: { input: string; expected: string }[]
  languages: string[]; learner_mastery: number
}

export default function Solve() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()
  const { isDemoMode, demoToken, updateTopicMastery } = useStore()

  const [problem, setProblem] = useState<Problem | null>(null)
  const [loadingProblem, setLoadingProblem] = useState(true)
  const [language, setLanguage] = useState<'python' | 'javascript'>('python')
  const [code, setCode] = useState('')
  const [runResults, setRunResults] = useState<RunResult[] | null>(null)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [hints, setHints] = useState<Hint[]>([])
  const [loadingRun, setLoadingRun] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [loadingHint, setLoadingHint] = useState(false)
  const [panelMode, setPanelMode] = useState<'idle' | 'run' | 'submit'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [showHints, setShowHints] = useState(false)

  const tracker = useAttemptTracker()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load problem
  useEffect(() => {
    if (!topicId) return
    setLoadingProblem(true)
    tracker.reset()

    getToken(isDemoMode, demoToken).then(token => {
      if (!token) return
      fetch(`${BACKEND_URL}/solve/problem/${topicId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then((data: Problem) => {
          setProblem(data)
          setCode(data.starter_code[language] ?? '')
          setLoadingProblem(false)
          // Start timer
          timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
        })
        .catch(() => setLoadingProblem(false))
    })

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [topicId])

  // Update starter code when language switches
  useEffect(() => {
    if (problem) setCode(problem.starter_code[language] ?? '')
  }, [language])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleRun = useCallback(async () => {
    if (!problem) return
    tracker.noteRun()
    setLoadingRun(true)
    setPanelMode('run')
    setSubmitResult(null)

    const token = await getToken(isDemoMode, demoToken)
    if (!token) return

    try {
      const r = await fetch(`${BACKEND_URL}/solve/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problem.id, language, source: code }),
      })
      const data = await r.json()
      setRunResults(data.results ?? [])
    } finally {
      setLoadingRun(false)
    }
  }, [problem, code, language, isDemoMode, demoToken, tracker])

  const handleSubmit = useCallback(async () => {
    if (!problem) return
    setLoadingSubmit(true)
    setPanelMode('submit')
    setRunResults(null)

    const token = await getToken(isDemoMode, demoToken)
    if (!token) return

    const log = tracker.getLog()

    try {
      const r = await fetch(`${BACKEND_URL}/solve/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problem.id, language, source: code, attempt_log: log }),
      })
      const data: SubmitResult = await r.json()
      setSubmitResult(data)

      // Update local brain model store
      if (data.mastery_delta !== 0 && problem.topic) {
        updateTopicMastery(problem.topic, { mastery: data.new_mastery, knowledge: data.new_mastery })
      }

      if (timerRef.current) clearInterval(timerRef.current)
    } finally {
      setLoadingSubmit(false)
    }
  }, [problem, code, language, isDemoMode, demoToken, tracker, updateTopicMastery])

  const handleHint = useCallback(async () => {
    if (!problem) return
    tracker.noteHint()
    setLoadingHint(true)

    const token = await getToken(isDemoMode, demoToken)
    if (!token) return

    try {
      const r = await fetch(`${BACKEND_URL}/solve/hint`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_id: problem.id,
          code_so_far: code,
          hint_number: hints.length + 1,
          elapsed_ms: elapsed * 1000,
        }),
      })
      const data: Hint = await r.json()
      setHints(prev => [...prev, data])
      setShowHints(true)
    } finally {
      setLoadingHint(false)
    }
  }, [problem, code, elapsed, hints, isDemoMode, demoToken, tracker])

  if (loadingProblem) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-4">
        <p className="font-body text-text-secondary">No problem available for this topic yet.</p>
        <button onClick={() => navigate(-1)} className="font-body text-sm text-accent-primary">go back</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-display font-bold text-text-primary text-sm">{problem.title}</span>
          <a
            href={`https://leetcode.com/problems/${problem.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}/`}
            target="_blank" rel="noopener noreferrer"
            className="font-body text-[10px] text-text-secondary hover:text-accent-primary transition-colors"
          >
            LC {problem.lc}
          </a>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <span className="font-body text-xs text-text-secondary font-mono">{formatTime(elapsed)}</span>

          {/* Language selector */}
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as 'python' | 'javascript')}
            className="font-body text-xs bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary focus:outline-none"
          >
            {problem.languages.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Hint button */}
          <button
            onClick={handleHint}
            disabled={loadingHint}
            className="font-body text-xs px-3 py-1.5 border border-border rounded transition-colors hover:border-accent-warn/40 hover:text-accent-warn text-text-secondary"
          >
            {loadingHint ? '...' : `hint${hints.length > 0 ? ` (${hints.length})` : ''}`}
          </button>

          {/* Run */}
          <button
            onClick={handleRun}
            disabled={loadingRun || loadingSubmit}
            className="font-body text-xs px-4 py-1.5 rounded border border-border hover:border-accent-primary/40 text-text-secondary hover:text-accent-primary transition-colors"
          >
            {loadingRun ? 'running...' : 'run'}
          </button>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loadingRun || loadingSubmit}
            className="font-body text-xs px-4 py-1.5 rounded bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors"
          >
            {loadingSubmit ? 'submitting...' : 'submit'}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Problem panel */}
        <div className="w-[380px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ProblemPanel problem={problem} />
          </div>

          {/* Approach box */}
          <ApproachBox
            onChange={tracker.setApproachText}
            onFocus={tracker.noteApproachStart}
          />

          {/* Hints */}
          {hints.length > 0 && (
            <div className="border-t border-border">
              <button
                onClick={() => setShowHints(h => !h)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-bg-elevated transition-colors"
              >
                <span className="font-body text-xs text-text-secondary uppercase tracking-wider">hints ({hints.length})</span>
                <svg className={`w-3 h-3 text-text-secondary transition-transform ${showHints ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showHints && (
                <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {hints.map((h, i) => (
                    <div key={i} className="bg-bg-elevated rounded p-2.5 font-body text-xs text-text-primary border-l-2 border-accent-warn/40">
                      <span className="text-accent-warn text-[10px] uppercase tracking-wider">Hint {h.hint_level}</span>
                      <p className="mt-1">{h.hint}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Code editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden" onKeyDown={tracker.noteFirstKeystroke}>
            <CodeEditor
              value={code}
              onChange={val => { setCode(val ?? ''); tracker.noteFirstKeystroke() }}
              language={language}
              height="100%"
              hideLanguageBar
            />
          </div>

          {/* Bottom: Test case panel */}
          <div className="h-56 border-t border-border flex-shrink-0">
            <TestCasePanel
              runResults={runResults}
              submitResults={submitResult}
              loading={loadingRun || loadingSubmit}
              mode={panelMode}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
