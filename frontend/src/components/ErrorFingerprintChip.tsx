import type { OptimalityScore } from '../lib/types'

const FINGERPRINT_LABELS: Record<string, string> = {
  optimization_blindness: 'Optimization Blindness',
  complexity_confusion:   'Complexity Confusion',
  space_time_mixup:       'Space/Time Mix-up',
  off_by_one:             'Off-by-one',
  pattern_overfitting:    'Pattern Overfit',
  edge_case_blindness:    'Edge-case Blind',
  prereq_gap:             'Prereq Gap',
  syntax_error:           'Syntax Error',
  incomplete_solution:    'Incomplete',
}

interface ErrorFingerprintChipProps {
  fingerprint?: string | null
  optimality?: OptimalityScore | null
}

export default function ErrorFingerprintChip({ fingerprint, optimality }: ErrorFingerprintChipProps) {
  if (!fingerprint && !optimality) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {fingerprint && (
        <span className="font-body text-[10px] text-accent-warn border border-accent-warn/30 bg-accent-warn/10 rounded px-2 py-0.5 uppercase tracking-wider">
          {FINGERPRINT_LABELS[fingerprint] ?? fingerprint.replaceAll('_', ' ')}
        </span>
      )}
      {optimality && (
        <div className="flex items-center gap-3 font-body text-[10px] text-text-secondary">
          <Bar label="time" value={optimality.time_complexity} />
          <Bar label="space" value={optimality.space_complexity} />
          <Bar label="clarity" value={optimality.code_clarity} />
        </div>
      )}
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value ?? 0) * 100)
  const color = pct >= 80 ? '#00e676' : pct >= 50 ? '#ffb300' : '#ff4757'
  return (
    <div className="flex items-center gap-1.5">
      <span className="uppercase tracking-wider">{label}</span>
      <div className="w-12 h-1 rounded-full bg-bg-elevated overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span>{pct}%</span>
    </div>
  )
}
