interface TestResult {
  input: string
  expected: string
  actual: string
  stderr: string
  exit_code: number | null
  passed: boolean
  runtime_ms?: number | null
}

interface EvaluationResult {
  correct: boolean
  feedback: string
  pattern_insight?: string
  approach_feedback?: string
  next_step?: string
  error_fingerprint?: string | null
  approach_quality?: number
  optimality_score?: {
    time_complexity: number
    space_complexity: number
    code_clarity: number
    overall_optimality: number
  }
}

interface TestCasePanelProps {
  runResults: TestResult[] | null
  submitResults: {
    correct: boolean
    passed: number
    total: number
    public_results: TestResult[]
    hidden_results: TestResult[]
    evaluation: EvaluationResult
    mastery_delta: number
    new_mastery: number
  } | null
  loading: boolean
  mode: 'idle' | 'run' | 'submit'
}

export default function TestCasePanel({ runResults, submitResults, loading, mode }: TestCasePanelProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-text-secondary font-body text-xs">
        <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        {mode === 'submit' ? 'Running all tests...' : 'Running...'}
      </div>
    )
  }

  if (mode === 'idle' || (!runResults && !submitResults)) {
    return (
      <div className="h-full flex items-center justify-center font-body text-xs text-text-secondary">
        Run your code to see test results.
      </div>
    )
  }

  if (submitResults) {
    const { correct, passed, total, public_results, hidden_results, evaluation, mastery_delta, new_mastery } = submitResults
    const allResults = [...public_results, ...hidden_results]

    return (
      <div className="h-full overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Verdict */}
        <div
          className="rounded-lg px-4 py-3 border"
          style={{
            background: correct ? 'rgba(0,230,118,0.06)' : 'rgba(255,71,87,0.06)',
            borderColor: correct ? 'rgba(0,230,118,0.3)' : 'rgba(255,71,87,0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-display font-bold text-sm" style={{ color: correct ? '#00e676' : '#ff4757' }}>
              {correct ? 'Accepted' : 'Wrong Answer'}
            </span>
            <span className="font-body text-[10px] text-text-secondary">
              {passed}/{total} tests passed
            </span>
          </div>
          {mastery_delta !== 0 && (
            <p className="font-body text-[10px]" style={{ color: mastery_delta > 0 ? '#00e676' : '#ff4757' }}>
              mastery {mastery_delta > 0 ? '+' : ''}{(mastery_delta * 100).toFixed(1)}% → {Math.round(new_mastery * 100)}%
            </p>
          )}
        </div>

        {/* Evaluation feedback */}
        <div className="space-y-2">
          <p className="font-body text-xs text-text-primary">{evaluation.feedback}</p>
          {evaluation.pattern_insight && (
            <p className="font-body text-xs text-accent-primary/80">{evaluation.pattern_insight}</p>
          )}
          {evaluation.approach_feedback && (
            <p className="font-body text-[10px] text-text-secondary border-l-2 border-border pl-3">
              {evaluation.approach_feedback}
            </p>
          )}
          {evaluation.next_step && (
            <p className="font-body text-[10px] text-accent-warn">Next: {evaluation.next_step}</p>
          )}
        </div>

        {/* Optimality bars */}
        {evaluation.optimality_score && (
          <div className="space-y-1.5">
            <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Solution quality</p>
            {Object.entries({
              'Time complexity': evaluation.optimality_score.time_complexity,
              'Space complexity': evaluation.optimality_score.space_complexity,
              'Code clarity': evaluation.optimality_score.code_clarity,
            }).map(([label, val]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="font-body text-[10px] text-text-secondary w-28 flex-shrink-0">{label}</span>
                <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${val * 100}%`,
                    background: val >= 0.7 ? '#00e676' : val >= 0.4 ? '#ffb300' : '#ff4757',
                  }} />
                </div>
                <span className="font-body text-[10px] text-text-secondary w-8 text-right">{Math.round(val * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Test results */}
        <div className="space-y-1.5">
          <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Test cases</p>
          {allResults.map((r, i) => (
            <div
              key={i}
              className="rounded p-2.5 font-body text-[10px]"
              style={{ background: r.passed ? 'rgba(0,230,118,0.06)' : 'rgba(255,71,87,0.06)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: r.passed ? '#00e676' : '#ff4757' }}>
                  {i < public_results.length ? `Test ${i + 1}` : `Hidden ${i - public_results.length + 1}`}
                </span>
                <span style={{ color: r.passed ? '#00e676' : '#ff4757' }}>
                  {r.passed ? 'pass' : 'fail'}
                </span>
              </div>
              {!r.passed && r.input !== '<hidden>' && (
                <>
                  <p className="text-text-secondary">Input: <span className="text-text-primary">{r.input.slice(0, 60)}</span></p>
                  <p className="text-text-secondary">Expected: <span className="text-text-primary">{r.expected}</span></p>
                  <p className="text-text-secondary">Got: <span className="text-accent-danger">{r.actual || '(empty)'}</span></p>
                  {r.stderr && <p className="text-accent-danger mt-1 truncate">{r.stderr.slice(0, 100)}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Run mode
  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider">Public tests</p>
        <p className="font-body text-[10px]" style={{
          color: runResults!.every(r => r.passed) ? '#00e676' : '#ff4757'
        }}>
          {runResults!.filter(r => r.passed).length}/{runResults!.length} passed
        </p>
      </div>
      {runResults!.map((r, i) => (
        <div
          key={i}
          className="rounded p-2.5 font-body text-[10px]"
          style={{ background: r.passed ? 'rgba(0,230,118,0.06)' : 'rgba(255,71,87,0.06)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-secondary">Test {i + 1}</span>
            <span style={{ color: r.passed ? '#00e676' : '#ff4757' }}>{r.passed ? 'pass' : 'fail'}</span>
          </div>
          <p className="text-text-secondary">Input: <span className="text-text-primary">{r.input.slice(0, 60)}</span></p>
          <p className="text-text-secondary">Expected: <span className="text-text-primary">{r.expected}</span></p>
          <p className="text-text-secondary">Got: <span className={r.passed ? 'text-text-primary' : 'text-accent-danger'}>{r.actual || '(empty)'}</span></p>
          {r.stderr && <p className="text-accent-danger mt-1 truncate">{r.stderr.slice(0, 100)}</p>}
        </div>
      ))}
    </div>
  )
}
