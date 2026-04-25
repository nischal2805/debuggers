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
  if (!auth) return null
  return auth.currentUser?.getIdToken() ?? null
}

type RunResult = {
  input: string; expected: string; actual: string
  stderr: string; exit_code: number | null; passed: boolean; runtime_ms?: number | null
  timed_out?: boolean
}

type SubmitResult = {
  correct: boolean; passed: number; total: number; timed_out?: boolean
  public_results: RunResult[]; hidden_results: RunResult[]
  evaluation: {
    correct: boolean; feedback: string; pattern_insight?: string
    approach_feedback?: string; next_step?: string; behavioral_notes?: string
    error_fingerprint?: string | null; approach_quality?: number
    optimality_score?: { time_complexity: number; space_complexity: number; code_clarity: number; overall_optimality: number }
  }
  mastery_delta: number; new_mastery: number
  next_problem?: Problem | null
}

type Hint = { hint: string; hint_level: number }

interface Problem {
  id: string; lc: string; title: string; topic: string; pattern: string; difficulty: string
  statement: string; constraints: string[]; examples: { input: string; output: string; explanation?: string }[]
  expected_complexity: { time: string; space: string }
  starter_code: Record<string, string>; public_tests: { input: string; expected: string }[]
  languages: string[]; learner_mastery: number
}

const FINGERPRINT_LABELS: Record<string, string> = {
  optimization_blindness: 'Suboptimal — correct but not efficient',
  complexity_confusion: 'Wrong Big-O stated',
  off_by_one: 'Off-by-one boundary error',
  edge_case_blindness: 'Edge case not handled',
  pattern_overfitting: 'Wrong pattern applied',
  incomplete_solution: 'Incomplete implementation',
  syntax_error: 'Syntax / runtime error',
  prereq_gap: 'Prerequisite gap detected',
  TLE_timeout: 'Time limit exceeded',
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
  const [showApproach, setShowApproach] = useState(false)

  const tracker = useAttemptTracker()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadProblem = useCallback((id: string) => {
    setLoadingProblem(true)
    setSubmitResult(null)
    setRunResults(null)
    setHints([])
    setPanelMode('idle')
    setElapsed(0)
    tracker.reset()

    if (timerRef.current) clearInterval(timerRef.current)

    getToken(isDemoMode, demoToken).then(token => {
      if (!token) { setLoadingProblem(false); return }
      fetch(`${BACKEND_URL}/solve/problem/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then((data: Problem) => {
          setProblem(data)
          setCode(data.starter_code[language] ?? data.starter_code['python'] ?? '')
          setLoadingProblem(false)
          timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
        })
        .catch(() => setLoadingProblem(false))
    })
  }, [isDemoMode, demoToken, language, tracker])

  useEffect(() => {
    if (!topicId) return
    loadProblem(topicId)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [topicId])

  useEffect(() => {
    if (problem) setCode(problem.starter_code[language] ?? problem.starter_code['python'] ?? '')
  }, [language])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleRun = useCallback(async () => {
    if (!problem) return
    tracker.noteRun()
    setLoadingRun(true)
    setPanelMode('run')
    setSubmitResult(null)

    const token = await getToken(isDemoMode, demoToken)
    if (!token) { setLoadingRun(false); return }

    try {
      const r = await fetch(`${BACKEND_URL}/solve/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problem.id, language, source: code }),
      })
      const data = await r.json()
      setRunResults(data.results ?? [])
    } catch {
      setRunResults([])
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
    if (!token) { setLoadingSubmit(false); return }

    const log = tracker.getLog()

    try {
      const r = await fetch(`${BACKEND_URL}/solve/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problem.id, language, source: code, attempt_log: log }),
      })
      const data: SubmitResult = await r.json()
      setSubmitResult(data)

      if (data.mastery_delta !== 0 && problem.topic) {
        updateTopicMastery(problem.topic, { mastery: data.new_mastery, knowledge: data.new_mastery })
      }

      if (timerRef.current) clearInterval(timerRef.current)
    } catch {
      setSubmitResult(null)
    } finally {
      setLoadingSubmit(false)
    }
  }, [problem, code, language, isDemoMode, demoToken, tracker, updateTopicMastery])

  const handleHint = useCallback(async () => {
    if (!problem) return
    tracker.noteHint()
    setLoadingHint(true)

    const token = await getToken(isDemoMode, demoToken)
    if (!token) { setLoadingHint(false); return }

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

  const handleNextProblem = useCallback(() => {
    if (!submitResult?.next_problem) return
    const next = submitResult.next_problem
    navigate(`/solve/${next.topic}`, { replace: false })
    loadProblem(next.topic)
    setProblem(next)
    setCode(next.starter_code[language] ?? next.starter_code['python'] ?? '')
  }, [submitResult, navigate, loadProblem, language])

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
        <button onClick={() => navigate('/dashboard')} className="font-body text-sm text-accent-primary">back to dashboard</button>
      </div>
    )
  }

  const diffColor = problem.difficulty === 'easy' ? '#00e676' : problem.difficulty === 'hard' ? '#ff4757' : '#ffb300'

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
          <span className="font-body text-[10px] px-1.5 py-0.5 rounded border" style={{ color: diffColor, borderColor: `${diffColor}40` }}>
            {problem.difficulty}
          </span>
          <span className="font-body text-[10px] text-text-secondary px-1.5 py-0.5 rounded bg-bg-elevated">
            {problem.pattern.replace(/_/g, ' ')}
          </span>
          <a
            href={`https://leetcode.com/problems/${problem.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}/`}
            target="_blank" rel="noopener noreferrer"
            className="font-body text-[10px] text-text-secondary hover:text-accent-primary transition-colors"
          >
            LC {problem.lc}
          </a>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-body text-xs text-text-secondary font-mono">{formatTime(elapsed)}</span>

          <select
            value={language}
            onChange={e => setLanguage(e.target.value as 'python' | 'javascript')}
            className="font-body text-xs bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary focus:outline-none"
          >
            {problem.languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <button
            onClick={handleHint}
            disabled={loadingHint}
            className="font-body text-xs px-3 py-1.5 border border-border rounded transition-colors hover:border-accent-warn/40 hover:text-accent-warn text-text-secondary"
          >
            {loadingHint ? '...' : `hint${hints.length > 0 ? ` (${hints.length})` : ''}`}
          </button>

          <button
            onClick={handleRun}
            disabled={loadingRun || loadingSubmit}
            className="font-body text-xs px-4 py-1.5 rounded border border-border hover:border-accent-primary/40 text-text-secondary hover:text-accent-primary transition-colors"
          >
            {loadingRun ? 'running...' : 'run'}
          </button>

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
        {/* Left: Problem + approach + hints */}
        <div className="w-[380px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ProblemPanel problem={problem} />
          </div>

          {/* Approach toggle */}
          <div className="border-t border-border">
            <button
              onClick={() => setShowApproach(a => !a)}
              className="w-full flex items-center justify-between px-4 py-2 hover:bg-bg-elevated transition-colors"
            >
              <span className="font-body text-xs text-text-secondary uppercase tracking-wider">approach</span>
              <svg className={`w-3 h-3 text-text-secondary transition-transform ${showApproach ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showApproach && (
              <ApproachBox
                onChange={tracker.setApproachText}
                onFocus={tracker.noteApproachStart}
              />
            )}
          </div>

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
                <div className="px-4 pb-3 space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
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

        {/* Center: Editor + test panel */}
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

          <div className="h-64 border-t border-border flex-shrink-0">
            <TestCasePanel
              runResults={runResults}
              submitResults={submitResult}
              loading={loadingRun || loadingSubmit}
              mode={panelMode}
            />
          </div>
        </div>

        {/* Right: Agent panel — shows after submit */}
        {submitResult && (
          <div className="w-72 flex-shrink-0 border-l border-border flex flex-col overflow-y-auto scrollbar-thin bg-bg-surface">
            {/* Verdict header */}
            <div
              className="px-5 py-4 border-b border-border"
              style={{
                background: submitResult.correct ? 'rgba(0,230,118,0.04)' : 'rgba(255,71,87,0.04)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="font-display font-bold text-base"
                  style={{ color: submitResult.correct ? '#00e676' : '#ff4757' }}
                >
                  {submitResult.correct ? 'Accepted' : submitResult.timed_out ? 'Time Limit Exceeded' : 'Wrong Answer'}
                </span>
                <span className="font-body text-[10px] text-text-secondary">
                  {submitResult.passed}/{submitResult.total}
                </span>
              </div>

              {/* Mastery bar */}
              <div className="space-y-1">
                <div className="flex justify-between font-body text-[10px] text-text-secondary">
                  <span>{problem.topic.replace(/_/g, ' ')} mastery</span>
                  <span style={{ color: submitResult.mastery_delta >= 0 ? '#00e676' : '#ff4757' }}>
                    {submitResult.mastery_delta >= 0 ? '+' : ''}{(submitResult.mastery_delta * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.round(submitResult.new_mastery * 100)}%`,
                      background: submitResult.new_mastery >= 0.75 ? '#00e676' : submitResult.new_mastery >= 0.45 ? '#ffb300' : '#ff4757',
                    }}
                  />
                </div>
                <p className="font-body text-[10px] text-text-secondary text-right">
                  {Math.round(submitResult.new_mastery * 100)}% mastery
                </p>
              </div>
            </div>

            {/* Error fingerprint */}
            {submitResult.evaluation.error_fingerprint && (
              <div className="px-5 py-3 border-b border-border">
                <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-1.5">Error pattern</p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-danger/10 border border-accent-danger/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-danger" />
                  <span className="font-body text-xs text-accent-danger">
                    {FINGERPRINT_LABELS[submitResult.evaluation.error_fingerprint] ?? submitResult.evaluation.error_fingerprint}
                  </span>
                </div>
              </div>
            )}

            {/* Agent feedback */}
            <div className="px-5 py-3 border-b border-border space-y-3">
              <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Agent analysis</p>

              {submitResult.evaluation.feedback && (
                <p className="font-body text-xs text-text-primary leading-relaxed">
                  {submitResult.evaluation.feedback}
                </p>
              )}

              {submitResult.evaluation.pattern_insight && (
                <p className="font-body text-xs text-accent-primary/80 leading-relaxed">
                  {submitResult.evaluation.pattern_insight}
                </p>
              )}

              {submitResult.evaluation.behavioral_notes && (
                <p className="font-body text-[10px] text-text-secondary border-l-2 border-accent-warn/40 pl-3 leading-relaxed">
                  {submitResult.evaluation.behavioral_notes}
                </p>
              )}

              {submitResult.evaluation.next_step && (
                <p className="font-body text-[10px] text-accent-warn">
                  Next: {submitResult.evaluation.next_step}
                </p>
              )}
            </div>

            {/* Optimality scores */}
            {submitResult.evaluation.optimality_score && (
              <div className="px-5 py-3 border-b border-border space-y-2">
                <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Solution quality</p>
                {(Object.entries({
                  'Time': submitResult.evaluation.optimality_score.time_complexity,
                  'Space': submitResult.evaluation.optimality_score.space_complexity,
                  'Clarity': submitResult.evaluation.optimality_score.code_clarity,
                }) as [string, number][]).map(([label, val]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="font-body text-[10px] text-text-secondary w-12">{label}</span>
                    <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${val * 100}%`,
                        background: val >= 0.7 ? '#00e676' : val >= 0.4 ? '#ffb300' : '#ff4757',
                      }} />
                    </div>
                    <span className="font-body text-[10px] text-text-secondary w-7 text-right">{Math.round(val * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Next problem */}
            <div className="px-5 py-4 space-y-2">
              {submitResult.next_problem ? (
                <>
                  <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Up next</p>
                  <div className="rounded-lg bg-bg-elevated border border-border p-3 mb-2">
                    <p className="font-body text-xs text-text-primary font-medium">{submitResult.next_problem.title}</p>
                    <p className="font-body text-[10px] text-text-secondary mt-0.5">
                      {submitResult.next_problem.difficulty} · {submitResult.next_problem.pattern.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <button
                    onClick={handleNextProblem}
                    className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-sm py-2.5 rounded-lg transition-colors"
                  >
                    next problem
                  </button>
                </>
              ) : (
                <p className="font-body text-xs text-text-secondary">You have completed all problems for this topic.</p>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full border border-border text-text-secondary font-body text-sm py-2.5 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                back to dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
