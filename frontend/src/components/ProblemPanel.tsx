interface Example {
  input: string
  output: string
  explanation?: string
}

interface Problem {
  lc: string
  title: string
  difficulty: string
  topic: string
  pattern: string
  statement: string
  constraints: string[]
  examples: Example[]
  expected_complexity: { time: string; space: string }
}

const DIFF_COLOR: Record<string, string> = {
  easy: '#00e676',
  medium: '#ffb300',
  hard: '#ff4757',
}

export default function ProblemPanel({ problem }: { problem: Problem }) {
  const diffColor = DIFF_COLOR[problem.difficulty] ?? '#8888aa'

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-5 py-4 space-y-5">
      {/* Title row */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-body text-[10px] text-text-secondary">LC {problem.lc}</span>
          <span
            className="font-body text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: `${diffColor}18`, color: diffColor, border: `1px solid ${diffColor}40` }}
          >
            {problem.difficulty}
          </span>
          <span className="font-body text-[10px] text-accent-primary/70 px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)' }}>
            {problem.pattern.replace(/_/g, ' ')}
          </span>
        </div>
        <h2 className="font-display text-lg font-bold text-text-primary">{problem.title}</h2>
      </div>

      {/* Statement */}
      <div>
        <p className="font-body text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
          {problem.statement}
        </p>
      </div>

      {/* Examples */}
      <div className="space-y-3">
        {problem.examples.map((ex, i) => (
          <div key={i} className="bg-bg-elevated rounded-lg p-3 font-body text-xs">
            <p className="text-text-secondary mb-1">Example {i + 1}</p>
            <p className="text-text-primary"><span className="text-text-secondary">Input:</span> {ex.input}</p>
            <p className="text-text-primary"><span className="text-text-secondary">Output:</span> {ex.output}</p>
            {ex.explanation && (
              <p className="text-text-secondary mt-1">{ex.explanation}</p>
            )}
          </div>
        ))}
      </div>

      {/* Constraints */}
      <div>
        <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-2">Constraints</p>
        <ul className="space-y-1">
          {problem.constraints.map((c, i) => (
            <li key={i} className="font-body text-xs text-text-secondary">
              <span className="text-accent-primary/60 mr-1">—</span>{c}
            </li>
          ))}
        </ul>
      </div>

      {/* Expected complexity */}
      <div className="bg-bg-elevated rounded-lg p-3">
        <p className="font-body text-[10px] text-text-secondary uppercase tracking-wider mb-2">Expected complexity</p>
        <div className="flex gap-6">
          <div>
            <p className="font-body text-[10px] text-text-secondary">Time</p>
            <p className="font-body text-xs text-accent-success font-medium">{problem.expected_complexity.time}</p>
          </div>
          <div>
            <p className="font-body text-[10px] text-text-secondary">Space</p>
            <p className="font-body text-xs text-accent-primary font-medium">{problem.expected_complexity.space}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
