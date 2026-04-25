import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useStore } from '../store/useStore'
import { useAttemptTracker } from '../hooks/useAttemptTracker'
import CodeEditor from '../components/CodeEditor'
import ProblemPanel from '../components/ProblemPanel'
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
    next_step?: string; behavioral_notes?: string
    error_fingerprint?: string | null
    optimality_score?: { time_complexity: number; space_complexity: number; code_clarity: number; overall_optimality: number }
  }
  mastery_delta: number; new_mastery: number
  next_problem?: Problem | null
}

type ChatMsg = {
  id: number
  role: 'user' | 'agent' | 'system'
  content: string
  // for agent messages
  approach_score?: number | null
  approach_verdict?: 'strong' | 'partial' | 'off_track' | null
  next_focus?: string
  // for system verdict cards
  verdict?: SubmitResult
}

interface Problem {
  id: string; lc: string; title: string; topic: string; pattern: string; difficulty: string
  statement: string; constraints: string[]; examples: { input: string; output: string; explanation?: string }[]
  expected_complexity: { time: string; space: string }
  starter_code: Record<string, string>; public_tests: { input: string; expected: string }[]
  languages: string[]; learner_mastery: number
}

const FINGERPRINT_LABELS: Record<string, string> = {
  optimization_blindness: 'Suboptimal complexity',
  off_by_one: 'Off-by-one error',
  edge_case_blindness: 'Edge case missed',
  pattern_overfitting: 'Wrong pattern',
  incomplete_solution: 'Incomplete',
  syntax_error: 'Syntax error',
  prereq_gap: 'Prereq gap',
  TLE_timeout: 'Time limit exceeded',
}

let _msgId = 0
function mkId() { return ++_msgId }

export default function Solve() {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()
  const { isDemoMode, demoToken, updateTopicMastery } = useStore()

  const [problem, setProblem] = useState<Problem | null>(null)
  const [loadingProblem, setLoadingProblem] = useState(true)
  const [language, setLanguage] = useState<'python' | 'javascript'>('python')
  const [code, setCode] = useState('')

  // Test results
  const [runResults, setRunResults] = useState<RunResult[] | null>(null)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [loadingRun, setLoadingRun] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [bottomTab, setBottomTab] = useState<'testcase' | 'result'>('testcase')

  // Timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Agent chat
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentPhase, setAgentPhase] = useState<'approach' | 'debug' | 'review'>('approach')
  const [approachText, setApproachText] = useState('')
  const [showApproach, setShowApproach] = useState(true)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const tracker = useAttemptTracker()

  // ── Problem loading ──────────────────────────────────────────────────────────

  const loadProblem = useCallback((id: string) => {
    setLoadingProblem(true)
    setSubmitResult(null)
    setRunResults(null)
    setElapsed(0)
    setChat([])
    setAgentPhase('approach')
    setApproachText('')
    setShowApproach(true)
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
          setCode(data.starter_code[language] ?? data.starter_code.python ?? '')
          setLoadingProblem(false)
          timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
          // Greet
          setChat([{
            id: mkId(), role: 'agent',
            content: `LC ${data.lc} — ${data.title}. Pattern: ${data.pattern.replace(/_/g, ' ')}. Write your approach before coding, then hit "Rate approach". I will give you a score and guide you to the right thinking before you touch the editor.`,
          }])
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
    if (problem) setCode(problem.starter_code[language] ?? problem.starter_code.python ?? '')
  }, [language])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat, agentLoading])

  // Auto-switch phase on test results
  useEffect(() => {
    if (runResults?.some(r => !r.passed)) setAgentPhase('debug')
  }, [runResults])

  // ── Formatters ───────────────────────────────────────────────────────────────

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (!problem) return
    tracker.noteRun()
    setLoadingRun(true)
    setSubmitResult(null)
    setBottomTab('result')

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
    setBottomTab('result')

    const token = await getToken(isDemoMode, demoToken)
    if (!token) { setLoadingSubmit(false); return }

    const log = tracker.getLog()
    log.approach_written = approachText.length > 20
    log.approach_text = approachText

    try {
      const r = await fetch(`${BACKEND_URL}/solve/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problem.id, language, source: code, attempt_log: log }),
      })
      const data: SubmitResult = await r.json()
      setSubmitResult(data)
      setRunResults(null)

      if (data.mastery_delta !== 0 && problem.topic) {
        updateTopicMastery(problem.topic, { mastery: data.new_mastery, knowledge: data.new_mastery })
      }
      if (timerRef.current) clearInterval(timerRef.current)

      // Push verdict card into chat
      setAgentPhase(data.correct ? 'review' : 'debug')
      setChat(prev => [...prev, { id: mkId(), role: 'system', content: '', verdict: data }])

      // Auto-agent follow-up
      setTimeout(() => {
        const msg = data.correct
          ? 'Accepted. Great work. Ask me to review your solution quality or suggest the next challenge.'
          : `${data.passed}/${data.total} tests passed. ${data.evaluation.feedback ?? ''} Switch to debug phase and ask me to analyze the failures.`
        setChat(prev => [...prev, { id: mkId(), role: 'agent', content: msg }])
      }, 400)
    } catch {
      setSubmitResult(null)
    } finally {
      setLoadingSubmit(false)
    }
  }, [problem, code, language, isDemoMode, demoToken, tracker, updateTopicMastery, approachText])

  const sendToAgent = useCallback(async (overrideMsg?: string) => {
    const msg = overrideMsg ?? chatInput.trim()
    if (!msg || !problem || agentLoading) return

    setChat(prev => [...prev, { id: mkId(), role: 'user', content: msg }])
    setChatInput('')
    setAgentLoading(true)

    const token = await getToken(isDemoMode, demoToken)
    if (!token) { setAgentLoading(false); return }

    const historyForApi = chat
      .filter(m => m.role !== 'system')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'agent', content: m.content }))

    try {
      const r = await fetch(`${BACKEND_URL}/solve/agent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_id: problem.id,
          message: msg,
          phase: agentPhase,
          code,
          test_results: runResults ?? (submitResult?.public_results ?? []),
          approach_text: approachText,
          history: historyForApi,
        }),
      })
      const data = await r.json()
      setChat(prev => [...prev, {
        id: mkId(), role: 'agent',
        content: data.response ?? '',
        approach_score: data.approach_score,
        approach_verdict: data.approach_verdict,
        next_focus: data.next_focus,
      }])
    } catch {
      setChat(prev => [...prev, { id: mkId(), role: 'agent', content: 'Agent unavailable. Check backend.' }])
    } finally {
      setAgentLoading(false)
    }
  }, [problem, chatInput, agentLoading, chat, agentPhase, code, runResults, submitResult, approachText, isDemoMode, demoToken])

  const handleNextProblem = useCallback(() => {
    if (!submitResult?.next_problem) return
    const next = submitResult.next_problem
    navigate(`/solve/${next.topic}`, { replace: false })
    setProblem(next)
    setCode(next.starter_code[language] ?? next.starter_code.python ?? '')
    loadProblem(next.topic)
  }, [submitResult, navigate, loadProblem, language])

  // ── Loading / empty states ────────────────────────────────────────────────────

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
        <p className="font-body text-text-secondary">No problem found for this topic.</p>
        <button onClick={() => navigate('/dashboard')} className="font-body text-sm text-accent-primary">back</button>
      </div>
    )
  }

  const diffColor = problem.difficulty === 'easy' ? '#00e676' : problem.difficulty === 'hard' ? '#ff4757' : '#ffb300'

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-surface flex-shrink-0 h-11">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-text-secondary hover:text-text-primary transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-display font-semibold text-text-primary text-sm">{problem.title}</span>
          <span className="font-body text-[10px] px-1.5 py-0.5 rounded border" style={{ color: diffColor, borderColor: `${diffColor}40` }}>
            {problem.difficulty}
          </span>
          <span className="font-body text-[10px] text-text-secondary bg-bg-elevated px-1.5 py-0.5 rounded">
            {problem.pattern.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-text-secondary w-12 text-center">{fmt(elapsed)}</span>

          <select
            value={language}
            onChange={e => setLanguage(e.target.value as 'python' | 'javascript')}
            className="font-body text-xs bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary focus:outline-none"
          >
            {problem.languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={loadingRun || loadingSubmit}
            className="flex items-center gap-1.5 font-body text-xs px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary hover:border-border/80 transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {loadingRun ? 'running...' : 'run'}
          </button>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={loadingRun || loadingSubmit}
            className="flex items-center gap-1.5 font-body text-xs px-3 py-1.5 rounded bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {loadingSubmit ? 'submitting...' : 'submit'}
          </button>
        </div>
      </header>

      {/* ── 3-panel body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Panel 1: Problem description ── */}
        <div className="w-[380px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          {/* Tab strip */}
          <div className="flex border-b border-border flex-shrink-0 bg-bg-surface">
            <div className="flex items-center px-4 py-2 gap-1 border-b-2 border-accent-primary">
              <svg className="w-3 h-3 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-body text-xs text-accent-primary">Description</span>
            </div>
            <a
              href={`https://leetcode.com/problems/${problem.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}/`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center px-4 py-2 gap-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="font-body text-xs">LC {problem.lc}</span>
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Problem content */}
          <div className="flex-1 overflow-hidden">
            <ProblemPanel problem={problem} />
          </div>
        </div>

        {/* ── Panel 2: Editor + test results ── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          {/* Editor header */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-bg-surface flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-accent-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="font-body text-xs text-text-secondary">Code</span>
            </div>
          </div>

          {/* Monaco editor */}
          <div className="flex-1 overflow-hidden" onKeyDown={tracker.noteFirstKeystroke}>
            <CodeEditor
              value={code}
              onChange={val => { setCode(val ?? ''); tracker.noteFirstKeystroke() }}
              language={language}
              height="100%"
              hideLanguageBar
            />
          </div>

          {/* Bottom: Testcase / Test Result tabs */}
          <div className="h-52 border-t border-border flex flex-col flex-shrink-0 bg-bg-surface">
            <div className="flex border-b border-border flex-shrink-0">
              {(['testcase', 'result'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  className="flex items-center gap-1.5 px-4 py-2 font-body text-xs transition-colors"
                  style={bottomTab === tab
                    ? { color: '#f0f0ff', borderBottom: '2px solid #6c63ff' }
                    : { color: '#8888aa' }
                  }
                >
                  {tab === 'testcase' && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                  {tab === 'testcase' ? 'Testcase' : 'Test Result'}
                  {tab === 'result' && runResults && (
                    <span className={`text-[10px] px-1 rounded-full ${runResults.every(r => r.passed) ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-danger/20 text-accent-danger'}`}>
                      {runResults.filter(r => r.passed).length}/{runResults.length}
                    </span>
                  )}
                </button>
              ))}
              {(loadingRun || loadingSubmit) && (
                <div className="ml-auto flex items-center pr-4">
                  <div className="w-3 h-3 border border-accent-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              {bottomTab === 'testcase' ? (
                <div className="p-4 space-y-2 overflow-y-auto h-full scrollbar-thin">
                  <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-2">Public test cases</p>
                  {problem.public_tests.map((t, i) => (
                    <div key={i} className="bg-bg-elevated rounded p-2.5 font-mono text-xs text-text-primary">
                      <span className="text-text-secondary text-[10px]">Input: </span>{t.input}
                      <span className="text-text-secondary text-[10px] ml-2">→</span>
                      <span className="text-accent-success ml-2">{t.expected}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <TestCasePanel
                  runResults={runResults}
                  submitResults={submitResult}
                  loading={loadingRun || loadingSubmit}
                  mode={runResults ? 'run' : submitResult ? 'submit' : 'idle'}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Panel 3: Agent ── always visible ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col overflow-hidden bg-bg-surface">
          {/* Agent header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-accent-primary" />
              </div>
              <span className="font-display font-semibold text-text-primary text-sm">Agent</span>
            </div>
            {/* Phase tabs */}
            <div className="flex items-center gap-0.5 bg-bg-elevated rounded p-0.5 border border-border">
              {(['approach', 'debug', 'review'] as const).map(ph => (
                <button
                  key={ph}
                  onClick={() => setAgentPhase(ph)}
                  className="text-[10px] font-body px-2 py-0.5 rounded transition-colors capitalize"
                  style={agentPhase === ph
                    ? { background: '#6c63ff', color: '#fff' }
                    : { color: '#8888aa' }
                  }
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>

          {/* Approach box — shown in approach phase, collapsible */}
          {agentPhase === 'approach' && (
            <div className="border-b border-border flex-shrink-0">
              <button
                onClick={() => setShowApproach(a => !a)}
                className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-bg-elevated transition-colors"
              >
                <span className="font-body text-[10px] text-text-secondary uppercase tracking-wider">your approach</span>
                <svg className={`w-3 h-3 text-text-secondary transition-transform ${showApproach ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showApproach && (
                <div className="px-3 pb-2">
                  <textarea
                    value={approachText}
                    onChange={e => { setApproachText(e.target.value); tracker.setApproachText(e.target.value) }}
                    onFocus={tracker.noteApproachStart}
                    placeholder="Describe your approach: pattern, data structure, time complexity..."
                    rows={3}
                    className="w-full bg-bg-elevated border border-border rounded p-2 font-body text-xs text-text-primary resize-none focus:outline-none focus:border-accent-primary/40 placeholder:text-text-secondary/40"
                  />
                  <button
                    onClick={() => sendToAgent(`Rate my approach for this problem: ${approachText || '(not written yet)'}`)}
                    disabled={agentLoading || !approachText.trim()}
                    className="mt-1 w-full text-[10px] font-body py-1 rounded border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10 transition-colors disabled:opacity-40"
                  >
                    rate my approach
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Debug shortcut */}
          {agentPhase === 'debug' && (runResults?.some(r => !r.passed) || submitResult && !submitResult.correct) && (
            <div className="px-3 py-2 border-b border-border flex-shrink-0">
              <button
                onClick={() => sendToAgent('Analyze the failing test cases and help me find the bug in my code.')}
                disabled={agentLoading}
                className="w-full text-[10px] font-body py-1.5 rounded border border-accent-danger/30 text-accent-danger hover:bg-accent-danger/10 transition-colors disabled:opacity-40"
              >
                analyze failures
              </button>
            </div>
          )}

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
            {chat.map(msg => {
              if (msg.role === 'system' && msg.verdict) {
                const v = msg.verdict
                const color = v.correct ? '#00e676' : '#ff4757'
                return (
                  <div key={msg.id} className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
                    {/* Verdict header */}
                    <div className="flex items-center justify-between px-3 py-2" style={{ background: v.correct ? 'rgba(0,230,118,0.06)' : 'rgba(255,71,87,0.06)' }}>
                      <span className="font-display font-bold text-sm" style={{ color }}>
                        {v.correct ? 'Accepted' : v.timed_out ? 'TLE' : 'Wrong Answer'}
                      </span>
                      <span className="font-body text-[10px] text-text-secondary">{v.passed}/{v.total} tests</span>
                    </div>
                    {/* Mastery bar */}
                    <div className="px-3 py-2 border-t border-border/50">
                      <div className="flex justify-between font-body text-[10px] text-text-secondary mb-1">
                        <span>mastery</span>
                        <span style={{ color: v.mastery_delta >= 0 ? '#00e676' : '#ff4757' }}>
                          {v.mastery_delta >= 0 ? '+' : ''}{(v.mastery_delta * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1 bg-bg-primary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.round(v.new_mastery * 100)}%`,
                            background: v.new_mastery >= 0.75 ? '#00e676' : v.new_mastery >= 0.45 ? '#ffb300' : '#ff4757',
                          }} />
                      </div>
                    </div>
                    {/* Error fingerprint */}
                    {v.evaluation.error_fingerprint && (
                      <div className="px-3 pb-2 pt-0">
                        <span className="font-body text-[10px] text-accent-danger bg-accent-danger/10 px-2 py-0.5 rounded-full">
                          {FINGERPRINT_LABELS[v.evaluation.error_fingerprint] ?? v.evaluation.error_fingerprint}
                        </span>
                      </div>
                    )}
                    {/* Optimality bars */}
                    {v.evaluation.optimality_score && (
                      <div className="px-3 py-2 border-t border-border/50 space-y-1.5">
                        {(['time_complexity', 'space_complexity', 'code_clarity'] as const).map(k => {
                          const val = v.evaluation.optimality_score![k]
                          const labels: Record<string, string> = { time_complexity: 'Time', space_complexity: 'Space', code_clarity: 'Clarity' }
                          return (
                            <div key={k} className="flex items-center gap-2">
                              <span className="font-body text-[10px] text-text-secondary w-10">{labels[k]}</span>
                              <div className="flex-1 h-1 bg-bg-primary rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{
                                  width: `${val * 100}%`,
                                  background: val >= 0.7 ? '#00e676' : val >= 0.4 ? '#ffb300' : '#ff4757',
                                }} />
                              </div>
                              <span className="font-body text-[10px] text-text-secondary">{Math.round(val * 100)}%</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* Next problem */}
                    {v.next_problem && (
                      <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2">
                        <p className="font-body text-[10px] text-text-secondary">Up next</p>
                        <div className="bg-bg-primary rounded p-2">
                          <p className="font-body text-xs text-text-primary">{v.next_problem.title}</p>
                          <p className="font-body text-[10px] text-text-secondary mt-0.5">
                            {v.next_problem.difficulty} · {v.next_problem.pattern.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <button
                          onClick={handleNextProblem}
                          className="w-full bg-accent-primary hover:bg-accent-primary/90 text-white font-body text-xs py-1.5 rounded transition-colors"
                        >
                          next problem
                        </button>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[92%] rounded-lg px-3 py-2 font-body text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-accent-primary/15 text-text-primary ml-4'
                        : 'bg-bg-elevated text-text-primary border border-border mr-4'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {/* Approach score */}
                  {msg.role === 'agent' && msg.approach_score != null && (
                    <div className="flex items-center gap-2 ml-1">
                      <div className="h-1 w-16 bg-bg-elevated rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{
                            width: `${(msg.approach_score / 10) * 100}%`,
                            background: msg.approach_score >= 7 ? '#00e676' : msg.approach_score >= 4 ? '#ffb300' : '#ff4757',
                          }} />
                      </div>
                      <span className="font-body text-[10px]"
                        style={{ color: msg.approach_score >= 7 ? '#00e676' : msg.approach_score >= 4 ? '#ffb300' : '#ff4757' }}>
                        {msg.approach_score}/10 {msg.approach_verdict?.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {msg.role === 'agent' && msg.next_focus && (
                    <p className="font-body text-[10px] text-accent-warn ml-1">
                      Focus: {msg.next_focus}
                    </p>
                  )}
                </div>
              )
            })}

            {agentLoading && (
              <div className="flex items-center gap-1.5 ml-1">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-pulse"
                    style={{ animationDelay: `${delay}s` }} />
                ))}
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-border p-3 flex-shrink-0 bg-bg-surface">
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAgent() }
                }}
                placeholder="Ask the agent... (Shift+Enter for new line)"
                rows={2}
                className="flex-1 bg-bg-elevated border border-border rounded px-3 py-2 font-body text-xs text-text-primary resize-none focus:outline-none focus:border-accent-primary/40 placeholder:text-text-secondary/40"
              />
              <button
                onClick={() => sendToAgent()}
                disabled={agentLoading || !chatInput.trim()}
                className="p-2 bg-accent-primary rounded-lg text-white disabled:opacity-40 hover:bg-accent-primary/90 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
